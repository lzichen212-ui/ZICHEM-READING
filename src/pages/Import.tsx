import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { listCustomArticles, removeCustomArticle, saveCustomArticle } from '../lib/db'
import {
  CATEGORIES,
  DIFFICULTIES,
  catLabel,
  diffLabel,
  fmtDate,
  todayStr,
  type Article,
  type Category,
  type Difficulty
} from '../lib/types'

/** 把粘贴进来的纯文本整理成段落：优先按换行分段，整块无换行时按句子聚合 */
function parseParagraphs(raw: string): string[] {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  if (lines.length !== 1 || lines[0].length <= 700) return lines

  const sentences = lines[0].match(/[^.!?…]+[.!?…]+["'”’)\]]*/g) || [lines[0]]
  const out: string[] = []
  let buf = ''
  for (const s of sentences) {
    const piece = s.trim()
    if (!piece) continue
    if (buf && (buf + ' ' + piece).length > 420) {
      out.push(buf)
      buf = piece
    } else {
      buf = buf ? `${buf} ${piece}` : piece
    }
  }
  if (buf) out.push(buf)
  return out
}

const minutesOf = (words: number) => Math.max(1, Math.round(words / 130))

export function Import() {
  const nav = useNavigate()
  const [raw, setRaw] = useState('')
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [cat, setCat] = useState<Category>('life')
  const [diff, setDiff] = useState<Difficulty>('medium')
  const [list, setList] = useState<(Article & { createdAt: number })[]>([])
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listCustomArticles().then(setList)
  }, [])

  const paragraphs = useMemo(() => parseParagraphs(raw), [raw])
  const wordCount = useMemo(
    () => (paragraphs.length ? paragraphs.join(' ').split(/\s+/).filter(Boolean).length : 0),
    [paragraphs]
  )

  function tip(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 1800)
  }

  async function start() {
    if (saving) return
    if (!wordCount) {
      tip('先把英文正文粘贴进来')
      return
    }
    setSaving(true)
    const id = `custom-${Date.now()}`
    const autoTitle = paragraphs[0].split(/\s+/).slice(0, 9).join(' ')
    const article: Article = {
      id,
      category: cat,
      difficulty: diff,
      title: title.trim() || (autoTitle.length < paragraphs[0].length ? `${autoTitle}…` : autoTitle),
      source: source.trim() || '手动导入',
      url: '',
      publishedAt: new Date().toISOString(),
      date: todayStr(),
      minutes: minutesOf(wordCount),
      paragraphs
    }
    await saveCustomArticle(article)
    nav(`/read/${id}`)
  }

  async function del(id: string) {
    if (!window.confirm('删除这篇导入的文章？生词和划线会保留。')) return
    await removeCustomArticle(id)
    setList(await listCustomArticles())
  }

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div className="list-title">
        <button className="icon-btn plain" onClick={() => nav(-1)} aria-label="返回">
          <Icon name="back" />
        </button>
        <h1>粘贴文章</h1>
        <span className="tiny muted">{list.length} 篇已导入</span>
      </div>

      <p className="tiny muted" style={{ marginTop: -4, lineHeight: 1.6 }}>
        把想读的英文原文粘进来，保存后就能点词查义、划线翻译、朗读和听写，和每日文章完全一样。文章只存在这台手机上。
      </p>

      <div className="field">
        <label>标题（可留空，自动取正文开头）</label>
        <input
          className="input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="例如：The Future of Work"
        />
      </div>

      <div className="field">
        <label>英文正文</label>
        <textarea
          className="input area"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder="在这里长按粘贴文章正文…"
        />
      </div>

      <div className="field">
        <label>来源（可留空）</label>
        <input
          className="input"
          value={source}
          onChange={e => setSource(e.target.value)}
          placeholder="例如：The Economist"
        />
      </div>

      <div className="field">
        <label>分类</label>
        <div className="chips" style={{ marginTop: 0 }}>
          {CATEGORIES.map(c => (
            <button key={c.key} className={`chip ${cat === c.key ? 'on' : ''}`} onClick={() => setCat(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>难度</label>
        <div className="segmented">
          {DIFFICULTIES.map(d => (
            <button key={d.key} className={diff === d.key ? 'on' : ''} onClick={() => setDiff(d.key)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tiny muted" style={{ margin: '14px 2px 0' }}>
        {wordCount
          ? `${paragraphs.length} 段 · ${wordCount} 词 · 约 ${minutesOf(wordCount)} 分钟`
          : '还没有正文'}
      </div>

      <button className="btn" style={{ marginTop: 12 }} onClick={start} disabled={saving}>
        {saving ? '保存中…' : '开始精读'}
      </button>

      {list.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 26 }}>
            <h2>我导入的文章</h2>
            <span>点标题继续阅读</span>
          </div>
          {list.map(a => (
            <div className="row" key={a.id}>
              <button className="grow" style={{ textAlign: 'left', background: 'none' }} onClick={() => nav(`/read/${a.id}`)}>
                <div className="term" style={{ fontSize: 15 }}>
                  {a.title}
                </div>
                <div className="mean">
                  {catLabel(a.category)} · {diffLabel(a.difficulty)} · {a.minutes} 分钟 · {fmtDate(a.date)}
                </div>
              </button>
              <button className="icon-btn plain" onClick={() => del(a.id)} aria-label="删除">
                <Icon name="trash" size={18} />
              </button>
            </div>
          ))}
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
