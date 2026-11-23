/**
 * 按配置的时间给手机发一条「今日推荐文章」通知
 * 支持 PushPlus（微信）或 Server酱（微信）
 * 由 GitHub Actions 每小时检查一次
 */
import fs from 'node:fs'
import path from 'node:path'

const cfgPath = path.join(process.cwd(), 'config', 'notify.json')
const indexPath = path.join(process.cwd(), 'public', 'articles', 'index.json')

const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))

const beijing = () => new Date(Date.now() + 8 * 3600 * 1000)
const hhmm = () => {
  const d = beijing()
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
const today = () => beijing().toISOString().slice(0, 10)

const now = hhmm()
const hit = (cfg.times || []).find(t => {
  const [h1, m1] = t.split(':').map(Number)
  const [h2, m2] = now.split(':').map(Number)
  const diff = Math.abs(h1 * 60 + m1 - (h2 * 60 + m2))
  return diff <= 25
})

if (!hit) {
  console.log(`[skip] 当前 ${now}，不在通知时间 ${cfg.times.join(', ')} 附近`)
  process.exit(0)
}

const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
const articles = (data.articles || []).filter(a => a.date === today())
if (!articles.length) {
  console.log('[skip] 今天还没有文章，先跑抓取')
  process.exit(0)
}

const weights = cfg.weights || {}
const scored = articles.map(a => ({
  a,
  score: (weights[a.category] ?? 3) + Math.random()
}))
scored.sort((x, y) => y.score - x.score)
const pick = scored.slice(0, Math.max(1, Math.min(cfg.count || 2, 3))).map(x => x.a)

const site = cfg.siteUrl || ''
const html = pick
  .map(
    a => `<h3><a href="${site}/read/${a.id}">${a.title}</a></h3>
<p>【${categoryName(a.category)} · ${diffName(a.difficulty)} · ${a.minutes} 分钟】${a.source}</p>`
  )
  .join('<hr/>')

const title = `今日英语阅读推荐 · ${pick.length} 篇`
const content = `<p>早，子辰。今天的文章挑好了：</p>${html}<p><a href="${site}">打开子辰阅读</a></p>`

function categoryName(c) {
  return { politics: '时政', entertainment: '娱乐', sports: '体育', economy: '经济', science: '科学', life: '生活', ai: 'AI' }[c] || c
}
function diffName(d) {
  return { easy: '简易', medium: '中等', hard: '困难' }[d] || d
}

async function push() {
  const pushplus = process.env.PUSHPLUS_TOKEN
  const serverchan = process.env.SERVERCHAN_KEY
  if (pushplus) {
    const r = await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: pushplus, title, content, template: 'html' })
    })
    console.log('[pushplus]', r.status, await r.text())
    return
  }
  if (serverchan) {
    const r = await fetch(`https://sctapi.ftqq.com/${serverchan}.send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ title, desp: content })
    })
    console.log('[serverchan]', r.status, await r.text())
    return
  }
  console.log('[dry-run] 没有配置推送 token，本次通知内容如下：\n', title, '\n', content)
}

await push()
