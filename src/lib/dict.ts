import { db } from './db'
import type { DictPayload } from './types'

const DICT_TTL = 1000 * 60 * 60 * 24 * 30
const TRANS_TTL = 1000 * 60 * 60 * 24 * 60

const hash = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return 'h' + (h >>> 0).toString(36)
}

export const wordAudio = (word: string) =>
  `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`

export const textAudio = (text: string) =>
  `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text.slice(0, 500))}&type=2`

export async function lookup(raw: string): Promise<DictPayload> {
  const word = raw.trim().toLowerCase()
  if (!word) throw new Error('空单词')

  const cached = await db.dictCache.get(word)
  if (cached && Date.now() - cached.savedAt < DICT_TTL) {
    try {
      return JSON.parse(cached.payload)
    } catch {
      /* ignore broken cache */
    }
  }

  let payload: DictPayload | null = null
  try {
    const res = await fetch(`/api/dict?w=${encodeURIComponent(word)}`)
    if (res.ok) payload = await res.json()
  } catch {
    payload = null
  }

  if (!payload || !payload.defsZh?.length) {
    payload = await fallbackLookup(word)
  }

  if (payload) {
    await db.dictCache.put({ word, payload: JSON.stringify(payload), savedAt: Date.now() })
  }
  return payload
}

/** 直接调用公开词典兜底（英英 + 音标 + 音频），在代理不可用时使用 */
async function fallbackLookup(word: string): Promise<DictPayload> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
    if (!res.ok) throw new Error('not found')
    const data: any = await res.json()
    const first = data?.[0]
    const defsEn: DictPayload['defsEn'] = []
    const defsZh: DictPayload['defsZh'] = []
    const examples: DictPayload['examples'] = []
    let phoneticUs = ''
    let audio = ''
    for (const entry of data) {
      if (!phoneticUs && (entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text)) {
        phoneticUs = entry.phonetic || entry.phonetics.find((p: any) => p.text)?.text || ''
      }
      for (const p of entry.phonetics || []) {
        if (!audio && p.audio) audio = p.audio
      }
      for (const m of entry.meanings || []) {
        for (const d of m.definitions || []) {
          defsEn.push({ pos: m.partOfSpeech, text: d.definition, example: d.example })
          if (d.example) examples.push({ en: d.example })
        }
      }
    }
    if (!defsEn.length && !defsZh.length) throw new Error('empty')
    return {
      word: first?.word || word,
      phoneticUs: phoneticUs.replace(/^\/|\/$/g, ''),
      audio: audio || wordAudio(word),
      defsZh,
      defsEn,
      examples: examples.slice(0, 3),
      source: 'Wiktionary'
    }
  } catch {
    throw new Error('查不到这个单词，检查网络后再试')
  }
}

export async function translate(text: string, to = 'zh'): Promise<string> {
  const clean = text.trim()
  if (!clean) return ''
  const key = hash(clean + '|' + to)
  const cached = await db.transCache.get(key)
  if (cached && Date.now() - cached.savedAt < TRANS_TTL) return cached.text

  let result = ''
  try {
    const res = await fetch(`/api/translate?q=${encodeURIComponent(clean)}&to=${to}`)
    if (res.ok) {
      const data = await res.json()
      result = (data.translation || '').trim()
    }
  } catch {
    result = ''
  }

  if (!result) {
    try {
      const r = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean.slice(0, 480))}&langpair=en|zh-CN`
      )
      const j: any = await r.json()
      result = (j?.responseData?.translatedText || '').trim()
    } catch {
      result = ''
    }
  }

  if (!result) throw new Error('翻译失败，稍后再试')
  await db.transCache.put({ hash: key, text: result, savedAt: Date.now() })
  return result
}

/* ---------------- 朗读 ---------------- */

let current: HTMLAudioElement | null = null
let currentObjUrl = ''

function stopCurrent() {
  if (current) {
    current.pause()
    current = null
  }
  if (currentObjUrl) {
    URL.revokeObjectURL(currentObjUrl)
    currentObjUrl = ''
  }
}

export async function speak(text: string, _opts: { word?: boolean } = {}) {
  const clean = (text || '').trim()
  if (!clean) return
  stopCurrent()
  try {
    const r = await fetch(`/api/tts?q=${encodeURIComponent(clean.slice(0, 500))}`)
    if (!r.ok) throw new Error('tts status ' + r.status)
    const blob = await r.blob()
    if (!blob.size) throw new Error('empty audio')
    const url = URL.createObjectURL(blob)
    currentObjUrl = url
    const a = new Audio(url)
    current = a
    a.onended = () => {
      if (current === a) {
        current = null
        URL.revokeObjectURL(url)
        if (currentObjUrl === url) currentObjUrl = ''
      }
    }
    await a.play()
    return
  } catch {
    /* 回退到系统原生语音 */
  }
  nativeSpeak(clean)
}

function nativeSpeak(text: string) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.92
  const v = window.speechSynthesis.getVoices().find(x => /en[-_]US/i.test(x.lang))
  if (v) u.voice = v
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}
