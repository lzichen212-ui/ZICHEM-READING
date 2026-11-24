import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { WordSheet } from '../components/WordSheet'
import { getArticle } from '../lib/articles'
import { addHighlight, addReading, addWord, db, getHighlights, markArticleRead, removeHighlight } from '../lib/db'
import { speak, translate } from '../lib/dict'
import { CATEGORIES, catLabel, diffLabel, fmtClock, fmtDate, type Article, type HighlightEntry } from '../lib/types'

interface Tok {
  text: string
  word: boolean
  index: number
}

interface Sel {
  pi: number
  start: number
  end: number
}

const WORD_RE = /[A-Za-z]+(?:['’\-][A-Za-z]+)*/g

function tokenize(p: string): Tok[] {
  const out: Tok[] = []
  let last = 0
  let wi = 0
  for (const m of p.matchAll(WORD_RE)) {
    const start = m.index!
    if (start > last) out.push({ text: p.slice(last, start), word: false, index: -1 })
    out.push({ text: m[0], word: true, index: wi++ })
    last = start + m[0].length
  }
  if (last < p.length) out.push({ text: p.slice(last), word: false, index: -1 })
  return out
}

export function Reader() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [missing, setMissing] = useState(false)

  const [sel, setSel] = useState<Sel | null>(null)
  const [word, setWord] = useState<string | null>(null)
  const [phrase, setPhrase] = useState<{ text: string; translation: string; loading: boolean } | null>(null)
  const [activeHl, setActiveHl] = useState<HighlightEntry | null>(null)
  const [highlights, setHighlights] = useState<HighlightEntry[]>([])
  const [saved, setSaved] = useState<Set<string>>(new Set())

  const [showZh, setShowZh] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [zhMap, setZhMap] = useState<Record<number, string>>({})
  const [secs, setSecs] = useState(0)
  const [toast, setToast] = useState('')

  const pressTimer = useRef<number>()
  const pressInfo = useRef<{ pi: number; wi: number } | null>(null)
  const selecting = useRef(false)
  const selRef = useRef<Sel | null>(null)
  const lastLong = useRef(0)

  useEffect(() => {
    getArticle(id).then(a => {
      if (!a) setMissing(true)
      else setArticle(a)
    })
  }, [id])

  useEffect(() => {
    if (!article) return
    getHighlights(article.id).then(setHighlights)
    db.words.toArray().then(list => setSaved(new Set(list.map(w => w.term.toLowerCase()))))
  }, [article?.id])

  // 阅读计时
  useEffect(() => {
    if (!article) return
    let acc = 0
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        acc += 5
        setSecs(s => s + 5)
      }
    }, 5000)
    const flush = () => {
      if (acc > 0) {
        addReading(article.id, acc)
        if (acc >= 15) markArticleRead(article.id)
        acc = 0
      }
    }
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', flush)
      flush()
    }
  }, [article?.id])

  const tokens = useMemo(() => (article ? article.paragraphs.map(tokenize) : []), [article])
  // 标题也分词，pi 用 -1 与正文段落区分
  const titleTokens = useMemo(() => (article ? tokenize(article.title) : []), [article])

  const hlKeys = useMemo(() => {
    const s = new Set<string>()
    for (const h of highlights) {
      if (h.pi != null && h.start != null && h.end != null) {
        for (let k = h.start; k <= h.end; k++) s.add(`${h.pi}:${k}`)
      }
    }
    return s
  }, [highlights])

  const selText = useMemo(() => {
    if (!sel) return ''
    const arr = sel.pi === -1 ? titleTokens : tokens[sel.pi] || []
    const a = arr.findIndex(t => t.word && t.index === sel.start)
    const b = arr.findIndex(t => t.word && t.index === sel.end)
    if (a < 0 || b < 0) return ''
    return arr.slice(a, b + 1).map(t => t.text).join('')
  }, [sel, tokens, titleTokens])

  function extendTo(pi: number, wi: number) {
    const cur = selRef.current
    if (!cur || cur.pi !== pi) return
    const next = { ...cur, start: Math.min(cur.start, wi), end: Math.max(cur.end, wi) }
    selRef.current = next
    setSel(next)
  }

  function clearSel() {
    selRef.current = null
    setSel(null)
  }

  function onDown(e: React.PointerEvent, pi: number, wi: number) {
    if (showZh) return
    if (selRef.current) {
      extendTo(pi, wi)
      return
    }
    pressInfo.current = { pi, wi }
    window.clearTimeout(pressTimer.current)
    pressTimer.current = window.setTimeout(() => {
      if (!pressInfo.current) return
      const s = { pi: pressInfo.current.pi, start: pressInfo.current.wi, end: pressInfo.current.wi }
      selRef.current = s
      selecting.current = true
      lastLong.current = Date.now()
      setSel(s)
      if (navigator.vibrate) navigator.vibrate(12)
    }, 360)
  }

  function onMove(e: React.PointerEvent) {
    if (!selecting.current || !selRef.current) return
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const wi = el?.dataset?.wi
    const pi = el?.dataset?.pi
    if (wi != null && pi != null) extendTo(Number(pi), Number(wi))
  }

  function onUp() {
    window.clearTimeout(pressTimer.current)
    pressInfo.current = null
    selecting.current = false
  }

  function onTokClick(pi: number, wi: number, text: string) {
    if (Date.now() - lastLong.current < 320) return
    if (selRef.current) {
      extendTo(pi, wi)
      return
    }
    if (showZh) return
    const key = `${pi}:${wi}`
    if (hlKeys.has(key)) {
      const h = highlights.find(
        x => x.pi === pi && x.start != null && x.end != null && wi >= x.start && wi <= x.end
      )
      if (h) {
        setActiveHl(h)
        return
      }
    }
    setWord(text)
  }

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 1700)
  }

  async function openPhrase() {
    if (!sel) return
    const text = selText
    setPhrase({ text, translation: '', loading: true })
    try {
      const t = await translate(text)
      setPhrase({ text, translation: t, loading: false })
    } catch {
      setPhrase({ text, translation: '', loading: false })
    }
  }

  async function quickTranslate(): Promise<string> {
    if (!sel) return ''
    try {
      const t = await translate(selText)
      return t
    } catch {
      return ''
    }
  }

  async function quickAdd() {
    if (!article || !sel) return
    const text = selText
    const t = await quickTranslate()
    const ok = await addWord({
      term: text,
      kind: 'phrase',
      defsZh: t ? [t] : [],
      defsEn: [],
      translation: t,
      addedAt: Date.now(),
      sourceArticleId: article.id,
      sourceArticleTitle: article.title,
      mastered: 0,
      reviews: 0
    })
    show(ok ? '已把这句话加入生词本' : '这句话已经在生词本里了')
    clearSel()
  }

  async function quickHighlight() {
    if (!article || !sel) return
    const text = selText
    const t = await quickTranslate()
    const res = await addHighlight({
      id: `${article.id}-${Date.now()}`,
      articleId: article.id,
      articleTitle: article.title,
      text,
      translation: t,
      createdAt: Date.now(),
      pi: sel.pi,
      start: sel.start,
      end: sel.end
    })
    if (res.duplicate) show('这句已经划过线了')
    else {
      setHighlights(await getHighlights(article.id))
      show('已划线，可在「学习 · 划线句子」复习')
    }
    clearSel()
  }

  async function addPhraseFromSheet() {
    if (!article || !phrase) return
    const ok = await addWord({
      term: phrase.text,
      kind: 'phrase',
      defsZh: phrase.translation ? [phrase.translation] : [],
      defsEn: [],
      translation: phrase.translation,
      addedAt: Date.now(),
      sourceArticleId: article.id,
      sourceArticleTitle: article.title,
      mastered: 0,
      reviews: 0
    })
    show(ok ? '已加入生词本' : '已经在生词本里了')
    setPhrase(null)
    clearSel()
  }

  async function highlightFromSheet() {
    if (!article || !phrase || !sel) return
    const res = await addHighlight({
      id: `${article.id}-${Date.now()}`,
      articleId: article.id,
      articleTitle: article.title,
      text: phrase.text,
      translation: phrase.translation,
      createdAt: Date.now(),
      pi: sel.pi,
      start: sel.start,
      end: sel.end
    })
    if (res.duplicate) show('这句已经划过线了')
    else {
      setHighlights(await getHighlights(article.id))
      show('已划线')
    }
    setPhrase(null)
    clearSel()
  }

  useEffect(() => {
    if (!showZh || !article) return
    if (zhMap[-1] === undefined) {
      translate(article.title)
        .then(t => setZhMap(m => ({ ...m, [-1]: t })))
        .catch(() => setZhMap(m => ({ ...m, [-1]: '（标题翻译失败，稍后重试）' })))
    }
    article.paragraphs.forEach((p, i) => {
      if (zhMap[i] !== undefined) return
      translate(p)
        .then(t => setZhMap(m => ({ ...m, [i]: t })))
        .catch(() => setZhMap(m => ({ ...m, [i]: '（这段翻译失败，稍后重试）' })))
    })
  }, [showZh, article?.id])

  if (missing) {
    return (
      <div className="reader">
        <div className="reader-bar">
          <button className="icon-btn" onClick={() => nav(-1)}>
            <Icon name="back" />
          </button>
        </div>
        <div className="empty">
          <div className="big">🔍</div>
          没找到这篇文章
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="reader">
        <div className="reader-bar">
          <button className="icon-btn" onClick={() => nav(-1)}>
            <Icon name="back" />
          </button>
        </div>
        <div style={{ padding: '10px 20px' }}>
          <div className="skeleton" style={{ height: 26, width: '80%' }} />
          <div className="skeleton" style={{ width: '40%' }} />
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div className="skeleton" key={i} style={{ width: `${70 + (i % 3) * 8}%` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="reader" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="reader-bar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="返回">
          <Icon name="back" />
        </button>
        <span className="time">
          <Icon name="clock" size={13} /> {fmtClock(secs)}
        </span>
        <div className="spacer" />
        <button
          className={`translate-btn ${pinned ? 'pinned' : ''}`}
          onPointerDown={e => {
            e.preventDefault()
            setShowZh(true)
          }}
          onPointerUp={() => {
            if (!pinned) setShowZh(false)
          }}
          onPointerLeave={() => {
            if (!pinned) setShowZh(false)
          }}
          onPointerCancel={() => {
            if (!pinned) setShowZh(false)
          }}
          onDoubleClick={() => {
            setPinned(p => {
              const np = !p
              if (!np) setShowZh(false)
              return np
            })
          }}
          title="按住看中文，双击锁定"
        >
          <Icon name="translate" size={17} />
          按住看中文
        </button>
      </div>

      <div className="reader-head">
        <div className="tags">
          <span className="tag">{catLabel(article.category)}</span>
          <span className="tag warm">{diffLabel(article.difficulty)}</span>
          <span className="tag" style={{ background: 'var(--line-soft)', color: 'var(--muted)' }}>
            {article.minutes} 分钟
          </span>
        </div>
        <h1 className="article-title">
          {showZh
            ? zhMap[-1] ?? <span className="skeleton" style={{ display: 'block', height: 22 }} />
            : titleTokens.map((t, i) =>
                t.word ? (
                  <span
                    key={i}
                    className={`tok${saved.has(t.text.toLowerCase()) ? ' saved' : ''}${
                      sel && sel.pi === -1 && t.index >= sel.start && t.index <= sel.end ? ' sel' : ''
                    }${hlKeys.has(`-1:${t.index}`) ? ' hl' : ''}`}
                    data-pi={-1}
                    data-wi={t.index}
                    onPointerDown={e => onDown(e, -1, t.index)}
                    onClick={() => onTokClick(-1, t.index, t.text)}
                  >
                    {t.text}
                  </span>
                ) : (
                  <span key={i}>{t.text}</span>
                )
              )}
        </h1>
        <div className="sub">
          <span>{article.source}</span>
          <span>{fmtDate(article.date)}</span>
          <span>{article.paragraphs.join(' ').split(/\s+/).length} 词</span>
        </div>
      </div>

      <div className="article-body">
        {article.paragraphs.map((p, pi) =>
          showZh ? (
            <p className="zh" key={pi}>
              {zhMap[pi] ?? <span className="skeleton" style={{ display: 'block', height: 16 }} />}
            </p>
          ) : (
            <p key={pi}>
              {tokens[pi].map((t, i) =>
                t.word ? (
                  <span
                    key={i}
                    className={`tok${saved.has(t.text.toLowerCase()) ? ' saved' : ''}${
                      sel && sel.pi === pi && t.index >= sel.start && t.index <= sel.end ? ' sel' : ''
                    }${hlKeys.has(`${pi}:${t.index}`) ? ' hl' : ''}`}
                    data-pi={pi}
                    data-wi={t.index}
                    onPointerDown={e => onDown(e, pi, t.index)}
                    onClick={() => onTokClick(pi, t.index, t.text)}
                  >
                    {t.text}
                  </span>
                ) : (
                  <span key={i}>{t.text}</span>
                )
              )}
            </p>
          )
        )}
        <p className="tiny muted center" style={{ marginTop: 24 }}>
          — 文章来自 {article.source}，仅供个人学习 —
          {article.url ? (
            <>
              <br />
              <a href={article.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                查看原文
              </a>
            </>
          ) : null}
        </p>
      </div>

      {sel && (
        <div className="selbar">
          <div className="sel-text">{selText}</div>
          <button onClick={openPhrase}>翻译</button>
          <button onClick={quickAdd}>+生词</button>
          <button className="primary" onClick={quickHighlight}>
            划线
          </button>
          <button onClick={clearSel} aria-label="取消">
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      {phrase && (
        <>
          <div className="mask" onClick={() => setPhrase(null)} />
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <div className="def-block" style={{ marginTop: 4 }}>
              <div className="lab">选中的句子</div>
              <p className="en-def" style={{ fontSize: 15.5, color: 'var(--ink)' }}>
                {phrase.text}
              </p>
            </div>
            <div className="def-block">
              <div className="lab">中文翻译</div>
              {phrase.loading ? (
                <>
                  <div className="skeleton" style={{ width: '80%' }} />
                  <div className="skeleton" style={{ width: '55%' }} />
                </>
              ) : (
                <p className="zh-def">{phrase.translation || '翻译失败，检查网络后重试'}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn ghost" onClick={addPhraseFromSheet}>
                <Icon name="plus" size={17} /> 加入生词本
              </button>
              <button className="btn" onClick={highlightFromSheet}>
                <Icon name="pen" size={17} /> 划线标记
              </button>
            </div>
          </div>
        </>
      )}

      {activeHl && (
        <>
          <div className="mask" onClick={() => setActiveHl(null)} />
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <div className="def-block" style={{ marginTop: 4 }}>
              <div className="lab">划线句子</div>
              <p className="en-def" style={{ fontSize: 15.5, color: 'var(--ink)' }}>
                {activeHl.text}
              </p>
              {activeHl.translation && <p className="zh-def" style={{ marginTop: 8 }}>{activeHl.translation}</p>}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn ghost" onClick={() => speak(activeHl.text)}>
                <Icon name="sound" size={17} /> 朗读
              </button>
              <button
                className="btn danger"
                onClick={async () => {
                  await removeHighlight(activeHl.id)
                  setHighlights(await getHighlights(article.id))
                  setActiveHl(null)
                }}
              >
                <Icon name="trash" size={17} /> 取消划线
              </button>
            </div>
          </div>
        </>
      )}

      {word && (
        <WordSheet
          term={word}
          articleId={article.id}
          articleTitle={article.title}
          onClose={() => setWord(null)}
          onChanged={() => db.words.toArray().then(list => setSaved(new Set(list.map(w => w.term.toLowerCase()))))}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
