import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { lookup, speak } from '../lib/dict'
import { addWord, isSaved, removeWord } from '../lib/db'
import type { DictPayload, WordEntry } from '../lib/types'

interface Props {
  term: string
  translation?: string
  articleId?: string
  articleTitle?: string
  savedEntry?: WordEntry
  onClose: () => void
  onChanged?: () => void
}

export function WordSheet({ term, translation, articleId, articleTitle, savedEntry, onClose, onChanged }: Props) {
  const isPhrase = !!translation || savedEntry?.kind === 'phrase'
  const [data, setData] = useState<DictPayload | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    setData(null)
    setError('')
    let alive = true
    isSaved(term).then(v => alive && setSaved(v))
    if (!isPhrase) {
      lookup(term)
        .then(d => alive && setData(d))
        .catch(e => alive && setError(e.message || '查询失败'))
    }
    return () => {
      alive = false
    }
  }, [term, isPhrase])

  const phonetic = savedEntry?.phonetic || data?.phoneticUs
  const audioWord = savedEntry?.term || term

  async function handleAdd() {
    setSaving(true)
    try {
      let ok = false
      if (isPhrase) {
        ok = await addWord({
          term,
          kind: 'phrase',
          defsZh: translation ? [translation] : [],
          defsEn: [],
          translation,
          addedAt: Date.now(),
          sourceArticleId: articleId,
          sourceArticleTitle: articleTitle,
          mastered: 0,
          reviews: 0
        })
      } else if (data) {
        ok = await addWord({
          term,
          kind: 'word',
          phonetic: data.phoneticUs || data.phoneticUk,
          pos: data.defsZh.map(d => d.pos).filter(Boolean) as string[],
          defsZh: data.defsZh.map(d => d.text),
          defsEn: data.defsEn.map(d => ({ pos: d.pos, text: d.text, example: d.example })),
          forms: data.forms,
          audio: data.audio,
          addedAt: Date.now(),
          sourceArticleId: articleId,
          sourceArticleTitle: articleTitle,
          mastered: 0,
          reviews: 0
        })
      }
      if (ok) {
        setSaved(true)
        setToast('已加入生词本')
        onChanged?.()
      } else {
        setSaved(true)
        setToast('这个词已经在生词本里了')
      }
    } finally {
      setSaving(false)
      setTimeout(() => setToast(''), 1600)
    }
  }

  async function handleRemove() {
    await removeWord(term)
    setSaved(false)
    setToast('已从生词本移除')
    onChanged?.()
    setTimeout(() => setToast(''), 1600)
  }

  return (
    <>
      <div className="mask" onClick={onClose} />
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        <div className="word-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ wordBreak: 'break-word' }}>{term}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              {isPhrase ? (
                <span className="phon">短语 / 句子</span>
              ) : (
                <>
                  <span className="phon">{phonetic ? `/${phonetic}/` : data ? '—' : '…'}</span>
                  <span className="tiny muted">美式</span>
                </>
              )}
              {!isPhrase && (data?.exams?.length || savedEntry) ? (
                <span className="tiny muted">
                  {(data?.exams || []).slice(0, 3).map(x => `#${x}`).join(' ')}
                </span>
              ) : null}
            </div>
          </div>
          {!isPhrase && (
            <button className="spk" onClick={() => speak(audioWord, { word: true })} aria-label="朗读">
              <Icon name="sound" size={18} />
            </button>
          )}
        </div>

        {isPhrase ? (
          <div className="def-block">
            <div className="lab">中文翻译</div>
            <p className="zh-def">{translation || savedEntry?.translation || '暂无翻译'}</p>
            {savedEntry?.sourceArticleTitle && (
              <p className="tiny muted">来自《{savedEntry.sourceArticleTitle}》</p>
            )}
          </div>
        ) : (
          <>
            {error && (
              <div className="def-block">
                <p className="zh-def" style={{ color: 'var(--danger)' }}>{error}</p>
                <p className="tiny muted">词典接口没连通时会查不到，检查网络后重新点一次。</p>
              </div>
            )}

            {!data && !error && (
              <div className="def-block">
                <div className="skeleton" style={{ width: '70%' }} />
                <div className="skeleton" style={{ width: '90%' }} />
                <div className="skeleton" style={{ width: '55%' }} />
              </div>
            )}

            {!!(data?.defsZh.length || savedEntry?.defsZh.length) && (
              <div className="def-block">
                <div className="lab">中文释义</div>
                {(data?.defsZh.map(d => d.text) || savedEntry?.defsZh || []).map((t, i) => (
                  <p className="zh-def" key={i}>
                    {(data?.defsZh[i]?.pos || savedEntry?.pos?.[i]) && (
                      <span className="pos">{data?.defsZh[i]?.pos || savedEntry?.pos?.[i]}</span>
                    )}
                    {t}
                  </p>
                ))}
              </div>
            )}

            {!!(data?.forms || savedEntry?.forms) && (
              <div className="form-line">
                <b>词形</b>
                {data?.forms || savedEntry?.forms}
              </div>
            )}

            {!!(data?.defsEn.length || savedEntry?.defsEn.length) && (
              <div className="def-block">
                <div className="lab">{data?.source || '英英词典'}</div>
                {(data?.defsEn || savedEntry?.defsEn || []).map((d, i) => (
                  <p className="en-def" key={i}>
                    {d.pos && <span className="pos">{d.pos}</span>}
                    {d.text}
                    {d.example && <span className="ex">“{d.example}”</span>}
                  </p>
                ))}
              </div>
            )}

            {!!data?.examples.length && (
              <div className="def-block">
                <div className="lab">例句</div>
                {data.examples.map((ex, i) => (
                  <div key={i} style={{ marginBottom: 9 }}>
                    <p className="en-def" style={{ margin: 0 }}>{ex.en}</p>
                    {ex.zh && <p className="tiny muted" style={{ margin: '2px 0 0' }}>{ex.zh}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {saved ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn ghost" onClick={handleRemove}>
              <Icon name="trash" size={17} /> 从生词本移除
            </button>
            <button className="btn" onClick={onClose}>
              <Icon name="check" size={17} /> 完成
            </button>
          </div>
        ) : (
          <button className="btn" onClick={handleAdd} disabled={saving || (!isPhrase && !data)}>
            <Icon name="plus" size={18} />
            {isPhrase ? '把这句话加入生词本' : '加入生词本'}
          </button>
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  )
}
