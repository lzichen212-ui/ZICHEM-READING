import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { addWrong, db } from '../lib/db'
import { speak } from '../lib/dict'
import type { WordEntry } from '../lib/types'

interface Item {
  term: string
  phonetic?: string
  defs: string[]
  meaning: string
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,!?;:"'’“”()、，。；：！？]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

function zhMatch(input: string, defs: string[]) {
  const v = norm(input).replace(/\s/g, '')
  if (!v) return false
  return defs.some(d => {
    const parts = d
      .replace(/[（(][^）)]*[）)]/g, '')
      .split(/[，,；;、/\s]+/)
      .map(x => x.trim())
      .filter(Boolean)
    return parts.some(p => p.includes(v) || v.includes(p))
  })
}

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function Dictation() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const fromWrong = params.get('from') === 'wrong'

  const [phase, setPhase] = useState<'loading' | 'quiz' | 'result' | 'empty'>('loading')
  const [queue, setQueue] = useState<Item[]>([])
  const [idx, setIdx] = useState(0)
  const [step, setStep] = useState<'en' | 'zh'>('en')
  const [enAns, setEnAns] = useState('')
  const [zhAns, setZhAns] = useState('')
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [mistakes, setMistakes] = useState<Item[]>([])
  const [round, setRound] = useState(1)
  const [total, setTotal] = useState(0)
  const [right, setRight] = useState(0)
  const [firstTotal, setFirstTotal] = useState(0)
  const [firstWrong, setFirstWrong] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      if (fromWrong) {
        const wrong = await db.wrong.toArray()
        const items: Item[] = wrong
          .filter(w => w.kind === 'word')
          .map(w => ({
            term: w.term,
            phonetic: w.phonetic,
            defs: w.meaning ? w.meaning.split(/[；;]/) : [],
            meaning: w.meaning || ''
          }))
        if (!items.length) return setPhase('empty')
        const picked = shuffle(items).slice(0, 10)
        setQueue(picked)
        setFirstTotal(picked.length)
        setTotal(picked.length)
        return setPhase('quiz')
      }
      const words: WordEntry[] = (await db.words.toArray()).filter(w => w.kind === 'word')
      if (!words.length) return setPhase('empty')
      const pool = words.filter(w => !w.mastered)
      const source = pool.length >= 5 ? pool : words
      const picked = shuffle(source)
        .slice(0, 10)
        .map(w => ({
          term: w.term,
          phonetic: w.phonetic,
          defs: w.defsZh,
          meaning: w.defsZh.join('；')
        }))
      setQueue(picked)
      setFirstTotal(picked.length)
      setTotal(picked.length)
      setPhase('quiz')
    })()
  }, [])

  const item = queue[idx]

  useEffect(() => {
    if (phase === 'quiz' && item && step === 'en') speak(item.term, { word: true })
    if (phase === 'quiz') setTimeout(() => inputRef.current?.focus(), 250)
  }, [phase, idx, step])

  const progress = useMemo(() => (total ? Math.min(100, (idx / total) * 100) : 0), [idx, total])

  function submitEn() {
    if (!item || feedback) return
    const ok = norm(enAns) === norm(item.term)
    setFeedback({ ok, msg: ok ? '英文拼写正确' : `拼写有误，正确是 ${item.term}` })
    if (!ok) noteMistake(item)
  }

  function submitZh() {
    if (!item || feedback) return
    const ok = zhMatch(zhAns, item.defs)
    setFeedback({ ok, msg: ok ? '中文释义正确' : `中文没对上，参考：${item.meaning || '—'}` })
    if (!ok) noteMistake(item)
  }

  const noted = useRef<Set<string>>(new Set())
  function noteMistake(it: Item) {
    if (noted.current.has(it.term)) return
    noted.current.add(it.term)
    setMistakes(m => (m.find(x => x.term === it.term) ? m : [...m, it]))
    addWrong({
      id: `w-${it.term}-${Date.now()}`,
      kind: 'word',
      term: it.term,
      meaning: it.meaning,
      phonetic: it.phonetic,
      createdAt: Date.now()
    })
  }

  function advance() {
    if (!item) return
    if (step === 'en') {
      setStep('zh')
      setFeedback(null)
      setZhAns('')
      return
    }
    if (!feedback?.ok) setRight(r => r)
    setStep('en')
    setEnAns('')
    setZhAns('')
    setFeedback(null)
    if (idx + 1 >= total) {
      if (round === 1) setFirstWrong(mistakes.length)
      setPhase('result')
    } else {
      setIdx(i => i + 1)
    }
  }

  function restart(mode: 'all' | 'wrong') {
    const pool = mode === 'wrong' ? mistakes : queue
    if (!pool.length) return
    const picked = mode === 'wrong' ? pool : shuffle(pool).slice(0, 10)
    noted.current = new Set()
    setQueue(picked)
    setTotal(picked.length)
    setIdx(0)
    setStep('en')
    setEnAns('')
    setZhAns('')
    setFeedback(null)
    setMistakes([])
    setRound(r => r + 1)
    setRight(0)
    setPhase('quiz')
  }

  if (phase === 'loading') {
    return (
      <div className="dict-page">
        <div className="skeleton" style={{ height: 30, width: '40%' }} />
        <div className="dict-card">
          <div className="skeleton" style={{ width: '60%', margin: '0 auto 14px' }} />
          <div className="skeleton" style={{ width: '30%', height: 60, margin: '0 auto' }} />
        </div>
      </div>
    )
  }

  if (phase === 'empty') {
    return (
      <div className="dict-page">
        <div className="list-title">
          <button className="icon-btn plain" onClick={() => nav(-1)}>
            <Icon name="back" />
          </button>
          <h1>听写</h1>
        </div>
        <div className="empty">
          <div className="big">📖</div>
          {fromWrong ? '错题本里还没有单词' : '生词本还是空的'}
          <br />
          先去读文章，点开单词加入生词本吧
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const acc = firstTotal ? Math.round(((firstTotal - firstWrong) / firstTotal) * 100) : 0
    return (
      <div className="dict-page">
        <div className="list-title">
          <button className="icon-btn plain" onClick={() => nav(-1)}>
            <Icon name="back" />
          </button>
          <h1>本轮结束</h1>
        </div>
        <div className="dict-card">
          <div className="q">正确率</div>
          <div className="score-big">{acc}%</div>
          <div className="hint">
            本轮 {firstTotal} 个词，错 {firstWrong} 个
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button className="btn ghost" onClick={() => nav(-1)}>
              返回
            </button>
            <button className="btn" onClick={() => restart('wrong')} disabled={!mistakes.length}>
              重考错词（{mistakes.length}）
            </button>
          </div>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => restart('all')}>
            再抽一轮
          </button>
        </div>
        {!!mistakes.length && (
          <div className="settings" style={{ padding: '10px 16px' }}>
            {mistakes.map(m => (
              <div className="set-item" key={m.term}>
                <div className="k">
                  {m.term}
                  <small>{m.meaning}</small>
                </div>
                <button className="spk" style={{ width: 30, height: 30 }} onClick={() => speak(m.term, { word: true })}>
                  <Icon name="sound" size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="dict-page">
      <div className="list-title">
        <button className="icon-btn plain" onClick={() => nav(-1)}>
          <Icon name="back" />
        </button>
        <h1>听写</h1>
        <span className="tiny muted">
          第 {round} 轮 · {idx + 1}/{total}
        </span>
      </div>
      <div className="progress">
        <i style={{ width: `${progress}%` }} />
      </div>

      <div className="dict-card">
        <div className="q">{step === 'en' ? '听发音，写下英文单词' : '写下它的中文释义'}</div>
        <button className="speaker" onClick={() => item && speak(item.term, { word: true })}>
          <Icon name="sound" size={30} />
        </button>
        <div className="hint">点喇叭可以再听一次</div>

        {step === 'en' ? (
          <div className="field">
            <label>英文</label>
            <input
              ref={inputRef}
              className="input mono"
              value={enAns}
              onChange={e => setEnAns(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (feedback ? advance() : submitEn())}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder="在这里输入单词"
              disabled={!!feedback}
            />
          </div>
        ) : (
          <div className="field">
            <label>中文释义（写出主要意思即可）</label>
            <input
              ref={inputRef}
              className="input"
              value={zhAns}
              onChange={e => setZhAns(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (feedback ? advance() : submitZh())}
              autoComplete="off"
              placeholder="例如：放弃"
              disabled={!!feedback}
            />
          </div>
        )}

        {feedback && <div className={`result ${feedback.ok ? 'ok' : 'bad'}`}>{feedback.msg}</div>}

        {feedback ? (
          <button className="btn" onClick={advance}>
            继续
          </button>
        ) : (
          <button className="btn" onClick={step === 'en' ? submitEn : submitZh} disabled={step === 'en' ? !enAns.trim() : !zhAns.trim()}>
            确认
          </button>
        )}
      </div>

      <div className="tiny muted center" style={{ marginTop: 14 }}>
        答错的词会自动进入错题本，本轮末尾可以重考
      </div>
    </div>
  )
}
