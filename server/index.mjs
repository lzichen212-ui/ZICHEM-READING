import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

// 运行时根目录：部署后 server.mjs 与前端产物同处 dist/，本地 dev 时为 server/
const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 8000
const API = 'https://dict.youdao.com/jsonapi?q='
const FANYI = 'https://fanyi.youdao.com/translate?&doctype=json&type=AUTO'
const MYMEMORY = 'https://api.mymemory.translated.net/get'

const dictCache = new Map()
const transCache = new Map()
const MAX = 800

/* ---------- Edge 神经 TTS ---------- */
const ttsCache = new Map()
const TTS_MAX = 300
let ttsInstance = null
let ttsReady = null
function getTTS() {
  if (ttsInstance) return Promise.resolve(ttsInstance)
  if (!ttsReady) {
    ttsReady = (async () => {
      const t = new MsEdgeTTS({ connectionTimeoutMs: 8000, synthesisTimeoutMs: 30000 })
      await t.setMetadata('en-US-AriaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
      ttsInstance = t
      return t
    })().catch(e => {
      ttsReady = null
      throw e
    })
  }
  return ttsReady
}
function xmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/* ---------- 远程文章（Gitee 国内镜像） ---------- */
const articlesCache = { data: null, ts: 0 }
const ARTICLES_TTL = 10 * 60 * 1000

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8'
}

const cut = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()

function pickWord(j) {
  const arr = j?.ec?.word
  if (!Array.isArray(arr)) return null
  return arr.find(w => Array.isArray(w?.trs) && w.trs.length) || arr[0] || null
}

function collect(trs) {
  const out = []
  for (const t of trs || []) {
    for (const tr of t?.tr || []) {
      const lines = tr?.l?.i
      if (Array.isArray(lines)) {
        for (const line of lines) {
          const text = cut(line)
          if (!text) continue
          const m = text.match(/^([a-z]+\.)\s*(.+)$/i)
          out.push(m ? { pos: m[1], text: m[2] } : { text })
        }
      }
    }
  }
  return out
}

function normalize(word, j) {
  const w = pickWord(j)
  const defsZh = collect(w?.trs)
  const payload = {
    word,
    phoneticUs: (w?.usphone || '').trim(),
    phoneticUk: (w?.ukphone || '').trim(),
    audio: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`,
    defsZh,
    forms: '',
    exams: [],
    defsEn: [],
    examples: [],
    source: '有道词典'
  }

  if (Array.isArray(j?.ec?.exam_type)) payload.exams = j.ec.exam_type

  const wf = w?.wfs?.wf
  if (Array.isArray(wf)) {
    payload.forms = wf.map(x => `${cut(x.w || x.name || '')} ${cut(x.name || x.value || '')}`.trim()).join('；')
  }

  // 英英释义：优先柯林斯 COBUILD，其次 WordNet
  const collins = j?.collins?.entries?.entry
  if (Array.isArray(collins)) {
    for (const e of collins) {
      for (const te of e?.tran_entry || []) {
        const def = cut(te?.tran || '')
        if (!def) continue
        const sent = te?.exam_sents?.sent?.[0]
        payload.defsEn.push({
          pos: cut(te?.pos_entry?.pos || ''),
          text: def.replace(new RegExp(word, 'gi'), word),
          example: sent?.eng_sent ? cut(sent.eng_sent) : undefined
        })
        if (sent?.eng_sent) payload.examples.push({ en: cut(sent.eng_sent), zh: cut(sent.chn_sent || '') })
      }
    }
    payload.source = '有道 · Collins'
  }

  if (!payload.defsEn.length) {
    const trs = j?.ee?.word?.trs
    if (Array.isArray(trs)) {
      for (const t of trs) {
        for (const tr of t?.tr || []) {
          const def = cut(tr?.l?.i || '')
          if (!def) continue
          const ex = cut(tr?.exam?.i?.f?.l?.[0]?.i || '')
          payload.defsEn.push({ pos: cut(t?.pos || ''), text: def, example: ex || undefined })
          if (ex) payload.examples.push({ en: ex })
        }
      }
      if (payload.defsEn.length) payload.source = '有道 · WordNet'
    }
  }

  const pairs = j?.blng_sents_part?.['sentence-pair']
  if (Array.isArray(pairs)) {
    for (const p of pairs.slice(0, 4)) {
      const en = cut(p?.sentence || '')
      if (en) payload.examples.push({ en, zh: cut(p?.['sentence-translation'] || '') })
    }
  }

  payload.defsEn = payload.defsEn.slice(0, 6)
  payload.examples = payload.examples.slice(0, 4)
  return payload
}

async function getDict(word) {
  if (dictCache.has(word)) return dictCache.get(word)
  const r = await fetch(API + encodeURIComponent(word), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
    }
  })
  if (!r.ok) throw new Error('upstream ' + r.status)
  const j = await r.json()
  const payload = normalize(word, j)
  if (!payload.defsZh.length && !payload.defsEn.length) throw new Error('not found')
  if (dictCache.size > MAX) dictCache.delete(dictCache.keys().next().value)
  dictCache.set(word, payload)
  return payload
}

async function getTranslation(q, to) {
  const key = to + '|' + q
  if (transCache.has(key)) return transCache.get(key)

  let out = ''
  try {
    const r = await fetch(`${MYMEMORY}?q=${encodeURIComponent(q)}&langpair=en|${to === 'zh' ? 'zh-CN' : to}`)
    const j = await r.json()
    const t = j?.responseData?.translatedText || ''
    if (t && !/^MYMEMORY WARNING/i.test(t)) out = t
  } catch {
    /* ignore */
  }

  if (!out) {
    try {
      const r = await fetch(`${FANYI}&i=${encodeURIComponent(q)}`)
      const j = await r.json()
      const rows = j?.translateResult?.[0]
      if (Array.isArray(rows)) out = rows.map(x => x.tgt).join('')
    } catch {
      /* ignore */
    }
  }

  if (!out) throw new Error('translate failed')
  if (transCache.size > MAX) transCache.delete(transCache.keys().next().value)
  transCache.set(key, out)
  return out
}

const send = (res, code, obj) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  })
  res.end(typeof obj === 'string' ? obj : JSON.stringify(obj))
}

function sendFile(res, filePath, method) {
  const ext = path.extname(filePath).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'
  const buf = fs.readFileSync(filePath)
  const noCache = ext === '.html' || ext === '.webmanifest'
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': noCache ? 'no-cache' : 'public, max-age=3600'
  })
  res.end(method === 'HEAD' ? '' : buf)
}

// 托管 dist/ 静态文件 + SPA 路由回退
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname)
  if (rel.includes('..') || rel.startsWith('\\')) return false
  let filePath = path.join(ROOT, rel)

  let stat
  try {
    stat = fs.statSync(filePath)
  } catch {
    stat = null
  }
  if (stat?.isDirectory()) {
    filePath = path.join(filePath, 'index.html')
    try {
      stat = fs.statSync(filePath)
    } catch {
      stat = null
    }
  }

  if (stat?.isFile()) {
    sendFile(res, filePath, req.method)
    return true
  }

  // 无扩展名的路径视为前端路由，回退到 index.html（/read/:id 等刷新不 404）
  const isRoute = !path.extname(rel)
  if (isRoute && (req.method === 'GET' || req.method === 'HEAD')) {
    const idx = path.join(ROOT, 'index.html')
    if (fs.existsSync(idx)) {
      sendFile(res, idx, req.method)
      return true
    }
  }
  return false
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (req.method === 'OPTIONS') return send(res, 204, '')
    try {
      if (url.pathname === '/api/health') return send(res, 200, { ok: true, ts: Date.now() })
      if (url.pathname === '/api/dict') {
        const w = (url.searchParams.get('w') || '').trim().toLowerCase()
        if (!w) return send(res, 400, { error: 'missing w' })
        return send(res, 200, await getDict(w))
      }
      if (url.pathname === '/api/translate') {
        const q = (url.searchParams.get('q') || '').trim()
        const to = url.searchParams.get('to') || 'zh'
        if (!q) return send(res, 400, { error: 'missing q' })
        return send(res, 200, { translation: await getTranslation(q, to) })
      }
      if (url.pathname === '/api/tts') {
        const q = (url.searchParams.get('q') || '').trim()
        if (!q) return send(res, 400, { error: 'missing q' })
        const text = q.slice(0, 500)
        const cached = ttsCache.get(text)
        if (cached) {
          res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' })
          res.end(cached)
          return
        }
        try {
          const t = await getTTS()
          const { audioStream } = t.toStream(xmlEscape(text))
          const chunks = []
          let done = false
          audioStream.on('data', c => chunks.push(c))
          audioStream.on('error', e => {
            if (done) return
            done = true
            if (!res.headersSent) send(res, 502, { error: 'tts ' + String(e?.message || e) })
          })
          audioStream.on('end', () => {
            if (done) return
            done = true
            const buf = Buffer.concat(chunks)
            if (buf.length) {
              if (ttsCache.size >= TTS_MAX) ttsCache.delete(ttsCache.keys().next().value)
              ttsCache.set(text, buf)
            }
            if (!res.headersSent) {
              res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' })
              res.end(buf)
            }
          })
          return
        } catch (e) {
          return send(res, 502, { error: 'tts ' + String(e?.message || e) })
        }
      }
      if (url.pathname === '/api/articles') {
        const remote = process.env.ARTICLES_URL
        if (!remote) return send(res, 404, { error: 'no remote articles configured' })
        try {
          const now = Date.now()
          if (!articlesCache.data || now - articlesCache.ts > ARTICLES_TTL) {
            const r = await fetch(remote, { headers: { 'User-Agent': UA, Accept: 'application/json,*/*' } })
            if (!r.ok) throw new Error('remote ' + r.status)
            const text = await r.text()
            JSON.parse(text)
            articlesCache.data = text
            articlesCache.ts = now
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' })
          res.end(articlesCache.data)
          return
        } catch (e) {
          return send(res, 502, { error: 'articles ' + String(e?.message || e) })
        }
      }
      // 非 API 请求：托管前端静态文件
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (serveStatic(req, res, url.pathname)) return
      }
      send(res, 404, { error: 'not found' })
    } catch (e) {
      send(res, 502, { error: String(e?.message || e) })
    }
  })
  .listen(PORT, '0.0.0.0', () => console.log(`[server] http://0.0.0.0:${PORT} (root=${ROOT})`))
