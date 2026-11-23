import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { db, removeHighlight } from '../lib/db'
import { speak } from '../lib/dict'
import type { HighlightEntry } from '../lib/types'

export function Sentences() {
  const nav = useNavigate()
  const [list, setList] = useState<HighlightEntry[]>([])

  const load = () => db.highlights.toArray().then(a => setList(a.sort((x, y) => y.createdAt - x.createdAt)))
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      <div className="list-title">
        <button className="icon-btn plain" onClick={() => nav(-1)}>
          <Icon name="back" />
        </button>
        <h1>划线句子</h1>
        <span className="tiny muted">{list.length} 句</span>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <div className="big">✍️</div>
          还没有划线
          <br />
          在文章里长按并滑动选中一段话，点「划线」就会出现在这里
        </div>
      ) : (
        list.map(h => (
          <div key={h.id} className="row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', width: '100%', gap: 10 }}>
              <div className="grow">
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.6 }}>{h.text}</div>
                {h.translation && (
                  <div className="tiny" style={{ color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.6 }}>
                    {h.translation}
                  </div>
                )}
              </div>
              <button className="spk" style={{ width: 30, height: 30, flex: '0 0 auto' }} onClick={() => speak(h.text)}>
                <Icon name="sound" size={15} />
              </button>
            </div>
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="tiny muted">来自《{h.articleTitle}》</span>
              <button
                className="tiny"
                style={{ color: 'var(--danger)' }}
                onClick={async () => {
                  await removeHighlight(h.id)
                  load()
                }}
              >
                取消划线
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
