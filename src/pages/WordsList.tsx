import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { WordSheet } from '../components/WordSheet'
import { db, setMastered } from '../lib/db'
import type { WordEntry } from '../lib/types'

export function WordsList() {
  const nav = useNavigate()
  const [list, setList] = useState<WordEntry[]>([])
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'all' | 'word' | 'phrase'>('all')
  const [sort, setSort] = useState<'new' | 'az'>('new')
  const [active, setActive] = useState<WordEntry | null>(null)

  const load = () => db.words.toArray().then(setList)
  useEffect(() => {
    load()
  }, [])

  const shown = useMemo(() => {
    let arr = list
    if (tab !== 'all') arr = arr.filter(w => w.kind === tab)
    if (q.trim()) {
      const k = q.trim().toLowerCase()
      arr = arr.filter(
        w => w.term.toLowerCase().includes(k) || w.defsZh.join(' ').includes(q.trim()) || (w.translation || '').includes(q.trim())
      )
    }
    arr = [...arr].sort((a, b) => (sort === 'new' ? b.addedAt - a.addedAt : a.term.localeCompare(b.term)))
    return arr
  }, [list, q, tab, sort])

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div className="list-title">
        <button className="icon-btn plain" onClick={() => nav(-1)}>
          <Icon name="back" />
        </button>
        <h1>生词本</h1>
        <span className="tiny muted">{list.length} 条</span>
      </div>

      <div style={{ position: 'relative', marginBottom: 10 }}>
        <span style={{ position: 'absolute', left: 13, top: 12, color: 'var(--muted)' }}>
          <Icon name="search" size={18} />
        </span>
        <input
          className="input"
          style={{ paddingLeft: 40, height: 42 }}
          placeholder="搜索单词或中文释义"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="segmented">
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>
            全部
          </button>
          <button className={tab === 'word' ? 'on' : ''} onClick={() => setTab('word')}>
            单词
          </button>
          <button className={tab === 'phrase' ? 'on' : ''} onClick={() => setTab('phrase')}>
            短语
          </button>
        </div>
        <button className="tiny muted" onClick={() => setSort(s => (s === 'new' ? 'az' : 'new'))}>
          {sort === 'new' ? '按时间 ⌄' : '按字母 ⌄'}
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <div className="big">🌱</div>
          {list.length === 0 ? '还没有生词\n去读一篇文章，点开不认识的单词加入吧' : '没有匹配的词'}
        </div>
      ) : (
        shown.map(w => (
          <div key={w.term} className={`row ${w.kind === 'phrase' ? 'phrase-row' : ''}`}>
            <button
              className="grow"
              style={{ textAlign: 'left', minWidth: 0 }}
              onClick={() => setActive(w)}
            >
              <div className="term">
                {w.term}
                {w.kind === 'phrase' && <span className="mini">短语</span>}
                {!!w.mastered && <span className="mini" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>已掌握</span>}
              </div>
              <div className="mean">{w.translation || w.defsZh.slice(0, 2).join('；') || '—'}</div>
            </button>
            <button
              className="icon-btn"
              style={{
                width: 32,
                height: 32,
                background: w.mastered ? 'var(--accent-soft)' : 'var(--line-soft)',
                color: w.mastered ? 'var(--accent)' : 'var(--muted)',
                boxShadow: 'none'
              }}
              onClick={async () => {
                await setMastered(w.term, w.mastered ? 0 : 1)
                load()
              }}
              aria-label="标记掌握"
            >
              <Icon name="check" size={16} />
            </button>
          </div>
        ))
      )}

      {active && (
        <WordSheet
          term={active.term}
          translation={active.kind === 'phrase' ? active.translation : undefined}
          savedEntry={active}
          onClose={() => setActive(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
