import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { db, removeWrong } from '../lib/db'
import { speak } from '../lib/dict'
import type { WrongEntry } from '../lib/types'

export function WrongBook() {
  const nav = useNavigate()
  const [list, setList] = useState<WrongEntry[]>([])

  const load = () => db.wrong.toArray().then(a => setList(a.sort((x, y) => y.createdAt - x.createdAt)))
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div className="list-title">
        <button className="icon-btn plain" onClick={() => nav(-1)}>
          <Icon name="back" />
        </button>
        <h1>错题本</h1>
        <span className="tiny muted">{list.length} 个</span>
      </div>

      {list.length > 0 && (
        <button className="btn" style={{ marginTop: 0, marginBottom: 14 }} onClick={() => nav('/study/dictation?from=wrong')}>
          <Icon name="sound" size={17} /> 重练错题（抽 10 个）
        </button>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <div className="big">🎯</div>
          错题本是空的
          <br />
          听写时答错的词会自动收进来
        </div>
      ) : (
        list.map(w => (
          <div key={w.id} className="row">
            <div className="grow">
              <div className="term">
                {w.term}
                {w.phonetic && <span className="phon" style={{ marginLeft: 8 }}>/{w.phonetic}/</span>}
              </div>
              <div className="mean">{w.meaning || '—'}</div>
              {!!w.pos?.length && <div className="tiny muted" style={{ marginTop: 2 }}>{w.pos.join(' / ')}</div>}
            </div>
            <button className="spk" onClick={() => speak(w.term, { word: true })} aria-label="朗读">
              <Icon name="sound" size={17} />
            </button>
            <button
              className="icon-btn"
              style={{ width: 30, height: 30, boxShadow: 'none', background: 'var(--line-soft)', color: 'var(--muted)' }}
              onClick={async () => {
                await removeWrong(w.id)
                load()
              }}
              aria-label="移出错题本"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  )
}
