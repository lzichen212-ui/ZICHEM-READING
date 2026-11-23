import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { loadArticles } from '../lib/articles'
import { getReadIds, getSettings, saveSettings } from '../lib/db'
import { CATEGORIES, DIFFICULTIES, catIcon, catLabel, diffLabel, fmtDate, todayStr, type Article, type Category, type Difficulty } from '../lib/types'

function Thumb({ article, big }: { article: Article; big?: boolean }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className="thumb">
      {article.image && !broken ? (
        <img src={article.image} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <div className="fallback">{catIcon(article.category)}</div>
      )}
      {big && <span className="badge">{catLabel(article.category)}</span>}
    </div>
  )
}

export function Home() {
  const nav = useNavigate()
  const [all, setAll] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState<'all' | Category>('all')
  const [diff, setDiff] = useState<Difficulty>('medium')
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    getSettings().then(s => setDiff(s.difficulty))
    getReadIds().then(setReadIds)
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadArticles()
      .then(list => {
        if (!alive) return
        setAll(list)
        setLoading(false)
      })
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [refreshKey])

  useEffect(() => {
    const onFocus = () => getReadIds().then(setReadIds)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const filtered = useMemo(() => {
    let list = all
    if (cat !== 'all') list = list.filter(a => a.category === cat)
    const byDiff = list.filter(a => a.difficulty === diff)
    return byDiff.length ? byDiff : list
  }, [all, cat, diff])

  const today = todayStr()
  const todayList = useMemo(() => {
    const t = filtered.filter(a => a.date === today)
    if (t.length) return t
    const latest = filtered[0]?.date
    return filtered.filter(a => a.date === latest)
  }, [filtered, today])

  const history = useMemo(() => {
    const shownDate = todayList[0]?.date
    const rest = filtered.filter(a => a.date !== shownDate)
    const map = new Map<string, Article[]>()
    for (const a of rest) {
      if (!map.has(a.date)) map.set(a.date, [])
      map.get(a.date)!.push(a)
    }
    return [...map.entries()].sort((x, y) => (x[0] < y[0] ? 1 : -1))
  }, [filtered, todayList])

  function changeDiff(d: Difficulty) {
    setDiff(d)
    saveSettings({ difficulty: d })
  }

  return (
    <div className="page">
      <div className="brand-row">
        <div className="brand">
          子辰阅读
          <small>DAILY ENGLISH READING</small>
        </div>
        <div className="date-chip">
          {fmtDate(today)}
          <button className="icon-btn plain" style={{ display: 'inline-flex', marginLeft: 6 }} onClick={() => setRefreshKey(k => k + 1)}>
            <Icon name="refresh" size={17} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <div className="segmented">
          {DIFFICULTIES.map(d => (
            <button key={d.key} className={diff === d.key ? 'on' : ''} onClick={() => changeDiff(d.key)}>
              {d.label}
            </button>
          ))}
        </div>
        <span className="tiny muted">{DIFFICULTIES.find(d => d.key === diff)?.hint}</span>
      </div>

      <div className="chips">
        <button className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>
          全部
        </button>
        {CATEGORIES.map(c => (
          <button key={c.key} className={`chip ${cat === c.key ? 'on' : ''}`} onClick={() => setCat(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="section-head">
        <h2>今日推荐</h2>
        <span>{todayList.length} 篇 · 点击开始精读</span>
      </div>

      {loading ? (
        <div className="card-grid">
          {[0, 1, 2, 3].map(i => (
            <div className="acard" key={i}>
              <div className="thumb skeleton" style={{ aspectRatio: '4/3', height: 'auto', margin: 0, borderRadius: 0 }} />
              <div className="body">
                <div className="skeleton" style={{ width: '90%' }} />
                <div className="skeleton" style={{ width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : todayList.length === 0 ? (
        <div className="empty">
          <div className="big">📭</div>
          这个分类今天还没有文章
          <br />
          换个分类或难度看看
        </div>
      ) : (
        <div className="card-grid">
          {todayList.map(a => (
            <button className="acard" key={a.id} onClick={() => nav(`/read/${a.id}`)}>
              <Thumb article={a} big />
              {readIds.has(a.id) && <div className="done" style={{ position: 'absolute' }} />}
              <div className="body">
                <div className="title">{a.title}</div>
                <div className="meta">
                  <span>{diffLabel(a.difficulty)}</span>
                  <span>·</span>
                  <span>{a.minutes} 分钟</span>
                  {readIds.has(a.id) && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>已读</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <>
          <div className="section-head">
            <h2>往期回顾</h2>
            <span>向下滑动查看更多</span>
          </div>
          {history.map(([date, items]) => (
            <div key={date}>
              <div className="day-label">
                {fmtDate(date)}
                {date === today ? ' · 今天' : ''}
              </div>
              {items.map(a => (
                <button className="hrow" key={a.id} onClick={() => nav(`/read/${a.id}`)}>
                  <Thumb article={a} />
                  <div className="grow">
                    <div className="t">{a.title}</div>
                    <div className="m">
                      {catLabel(a.category)} · {diffLabel(a.difficulty)} · {a.minutes} 分钟
                      {readIds.has(a.id) ? ' · 已读' : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
