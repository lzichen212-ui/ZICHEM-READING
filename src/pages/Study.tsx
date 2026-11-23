import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { counts } from '../lib/db'

export function Study() {
  const nav = useNavigate()
  const [c, setC] = useState({ words: 0, phrases: 0, remaining: 0, sentences: 0, highlights: 0, wrong: 0 })

  useEffect(() => {
    counts().then(setC)
    const onFocus = () => counts().then(setC)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <div className="page">
      <div className="brand-row">
        <div className="brand">
          学习
          <small>REVIEW & DICTATION</small>
        </div>
      </div>

      <div className="entry-grid">
        <button className="entry" onClick={() => nav('/study/words')}>
          <div className="ico">
            <Icon name="book" />
          </div>
          <div>
            <div className="name">生词本</div>
            <div className="cnt">
              {c.words} 个单词 · {c.phrases} 条短语
            </div>
          </div>
        </button>

        <button className="entry warm" onClick={() => nav('/study/sentences')}>
          <div className="ico">
            <Icon name="pen" />
          </div>
          <div>
            <div className="name">划线句子</div>
            <div className="cnt">{c.highlights} 句重点</div>
          </div>
        </button>

        <button className="entry gold" onClick={() => nav('/study/dictation')}>
          <div className="ico">
            <Icon name="sound" />
          </div>
          <div>
            <div className="name">听写本</div>
            <div className="cnt">从生词本随机抽 10 个</div>
          </div>
        </button>

        <button className="entry rose" onClick={() => nav('/study/wrong')}>
          <div className="ico">
            <Icon name="flag" />
          </div>
          <div>
            <div className="name">错题本</div>
            <div className="cnt">{c.wrong} 个待复习</div>
          </div>
        </button>
      </div>

      <div className="study-tip">
        <b>怎么用最有效</b>
        <br />
        白天读文章，遇到不认识的词就点开加进生词本；晚上做一轮听写，错的会自动进错题本；第二天先扫一遍错题本再读新文章。
      </div>

      <div className="study-tip" style={{ background: 'var(--accent-soft)' }}>
        <b>划线句子</b>
        <br />
        在文章里长按单词后滑动，选中一段话，松手点「划线」，以后在「划线句子」里可以直接复习并朗读。
      </div>
    </div>
  )
}
