/**
 * 每天抓取外媒短文，生成 public/articles/index.json
 * 由 GitHub Actions 定时运行（也可本地 `npm run fetch` 手动跑）
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const OUT_DIR = path.join(process.cwd(), 'public', 'articles')
const OUT_FILE = path.join(OUT_DIR, 'index.json')
const KEEP_DAYS = 45

const FEEDS = [
  // 时政
  { cat: 'politics', src: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { cat: 'politics', src: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
  { cat: 'politics', src: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml' },
  // 娱乐
  { cat: 'entertainment', src: 'BBC Entertainment', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },
  { cat: 'entertainment', src: 'Variety', url: 'https://variety.com/feed/' },
  { cat: 'entertainment', src: 'The Guardian Culture', url: 'https://www.theguardian.com/culture/rss' },
  // 体育
  { cat: 'sports', src: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { cat: 'sports', src: 'ESPN', url: 'https://www.espn.com/espn/rss/news' },
  { cat: 'sports', src: 'The Guardian Sport', url: 'https://www.theguardian.com/uk/sport/rss' },
  // 经济
  { cat: 'economy', src: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { cat: 'economy', src: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { cat: 'economy', src: 'The Guardian Business', url: 'https://www.theguardian.com/uk/business/rss' },
  // 科学
  { cat: 'science', src: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/all.xml' },
  { cat: 'science', src: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { cat: 'science', src: 'NASA', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss' },
  // 生活
  { cat: 'life', src: 'The Guardian Life', url: 'https://www.theguardian.com/lifeandstyle/rss' },
  { cat: 'life', src: 'NPR Life Kit', url: 'https://feeds.npr.org/510338/rss.xml' },
  { cat: 'life', src: 'BBC Health', url: 'https://feeds.bbci.co.uk/news/health/rss.xml' },
  // AI
  { cat: 'ai', src: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { cat: 'ai', src: 'MIT Tech Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { cat: 'ai', src: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' }
]

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const decode = s =>
  (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const hash = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 10)

async function grab(url, timeout = 20000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xml,application/rss+xml,*/*' }
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

function parseFeed(xml) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map(m => m[0])
  const out = []
  for (const b of blocks) {
    const title = decode((b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1])
    let link = decode((b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1])
    if (!link) {
      const m = b.match(/<link[^>]*href=["']([^"']+)["']/i)
      link = m ? m[1] : ''
    }
    const pub = decode(
      (b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
        b.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) ||
        [])[1]
    )
    const desc = decode(
      (b.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
        b.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) ||
        [])[1]
    )
    let image = ''
    const mc = b.match(/<media:content[^>]*url=["']([^"']+)["']/i) || b.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i)
    const en = b.match(/<enclosure[^>]*url=["']([^"']+)["']/i)
    if (mc) image = mc[1]
    else if (en) image = en[1]
    if (title && link) out.push({ title, link, pub, desc, image })
  }
  return out
}

function extractParagraphs(html) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<(nav|aside|footer|header|form)[\s\S]*?<\/\1>/gi, '')

  const ps = [...cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => decode(m[1]))
    .filter(
      t =>
        t.length > 55 &&
        !/cookie|subscribe|newsletter|sign up|advertisement|all rights reserved|follow us|share this|accuracy and availability of transcripts|does not offer or accept money|this text may not be in its final form|see the original article|visit npr\.org|transcripts? (?:are|is) created|provided by npr|is provided for personal, non-?commercial use/i.test(
          t
        )
    )

  const seen = new Set()
  const uniq = ps.filter(p => (seen.has(p) ? false : (seen.add(p), true)))
  return uniq.slice(0, 8)
}

function getOgImage(html) {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  return m ? m[1] : ''
}

/** 判断是否为媒体机构的默认占位图（不是真实文章配图） */
function isPlaceholderImage(url) {
  if (!url) return true
  const u = url.toLowerCase()
  const bad = [
    'default',
    'placeholder',
    'no-image',
    'noimage',
    'nophoto',
    'no_photo',
    'stock',
    'fallback',
    'facebook-default',
    'twitter-default',
    'og-default',
    'logo',
    'sitewide',
    'generic',
    'blank',
    'empty',
    '1x1',
    '1-pixel',
    'sprite',
    'data:image',
    '.svg', // SVG 占位图（纯 logo）通常没用
    '/icon/',
    '/icons/',
    '/avatar/',
    '/avatars/',
    '/logo/',
    '/logos/'
  ]
  if (bad.some(k => u.includes(k))) return true
  // 极短或极长也可疑（短的是纯色，长的可能是 data URL 或带参数但没用）
  if (u.length < 30) return true
  return false
}

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  const m = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g)
  return m ? m.length : 1
}

function scoreDifficulty(text, base) {
  const words = text.split(/\s+/).filter(Boolean)
  const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length)
  if (words.length < 60) return base || 'medium'
  const syl = words.reduce((n, w) => n + syllables(w), 0)
  const flesch = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syl / words.length)
  if (flesch >= 65) return 'easy'
  if (flesch >= 45) return 'medium'
  return 'hard'
}

function itemDate(pub) {
  const d = pub ? new Date(pub) : new Date()
  if (isNaN(d.getTime())) return new Date()
  return d
}

function todayShanghai() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

async function main() {
  const now = Date.now()
  const collected = []
  const stats = []

  for (const feed of FEEDS) {
    try {
      const xml = await grab(feed.url)
      const items = parseFeed(xml).slice(0, 6)
      let got = 0
      for (const it of items) {
        const d = itemDate(it.pub)
        if (now - d.getTime() > 1000 * 3600 * 36) continue
        try {
          const html = await grab(it.link)
          const paras = extractParagraphs(html)
          const body = paras.join('\n\n')
          const text = body || it.desc
          if (!text || text.split(/\s+/).length < 60) continue
          let image = it.image || getOgImage(html)
          if (isPlaceholderImage(image)) image = ''
          collected.push({
            id: hash(it.link),
            category: feed.cat,
            difficulty: scoreDifficulty(text, ''),
            title: it.title,
            image,
            source: feed.src,
            url: it.link,
            publishedAt: d.toISOString(),
            paragraphs: paras.length ? paras : [it.desc]
          })
          got++
        } catch {
          /* 单篇失败不影响整体 */
        }
      }
      stats.push(`${feed.src}: ${got}`)
      console.log(`✓ ${feed.src} (${feed.cat}) → ${got} 篇`)
    } catch (e) {
      console.warn(`✗ ${feed.src} (${feed.cat}) ${e.message}`)
    }
  }

  // 去重（同标题/同链接）
  const seenIds = new Set()
  const seenTitles = new Set()
  const fresh = collected.filter(a => {
    const t = a.title.toLowerCase().trim()
    if (seenIds.has(a.id) || seenTitles.has(t)) return false
    seenIds.add(a.id)
    seenTitles.add(t)
    return true
  })

  // 合并历史
  let old = []
  try {
    const prev = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'))
    old = Array.isArray(prev.articles) ? prev.articles : []
  } catch {
    old = []
  }

  const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10)
  const merged = [...fresh.map(a => ({ ...a, date: todayShanghai() })), ...old].filter(
    a => a.date >= cutoff
  )

  const uniq = []
  const seen = new Set()
  for (const a of merged) {
    if (seen.has(a.id)) continue
    seen.add(a.id)
    const words = a.paragraphs.join(' ').split(/\s+/).filter(Boolean).length
    uniq.push({ ...a, minutes: Math.max(1, Math.round(words / 130)) })
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), count: uniq.length, articles: uniq }, null, 1)
  )
  console.log(`\n完成：新增 ${fresh.length} 篇，总计 ${uniq.length} 篇`)
  console.log(stats.join(' | '))
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
