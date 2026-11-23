import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import {
  clearAll,
  counts,
  exportAll,
  getAllDays,
  getDay,
  getRecentDays,
  getSettings,
  importAll,
  saveSettings
} from '../lib/db'
import { applyTheme } from '../lib/theme'
import { CATEGORIES, DIFFICULTIES, fmtClock, todayStr, type DayStat, type Settings } from '../lib/types'

export function Mine() {
  const [today, setToday] = useState<DayStat>({ date: todayStr(), newWords: 0, articlesRead: 0, seconds: 0 })
  const [week, setWeek] = useState<DayStat[]>([])
  const [allDays, setAllDays] = useState<DayStat[]>([])
  const [c, setC] = useState({ words: 0, phrases: 0, remaining: 0, sentences: 0, highlights: 0, wrong: 0 })
  const [settings, setSettings] = useState<Settings | null>(null)
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getDay().then(setToday)
    getRecentDays(7).then(setWeek)
    getAllDays().then(setAllDays)
    counts().then(setC)
    getSettings().then(setSettings)
  }, [])

  const total = useMemo(
    () =>
      allDays.reduce(
        (acc, d) => ({ words: acc.words + d.newWords, articles: acc.articles + d.articlesRead, seconds: acc.seconds + d.seconds }),
        { words: 0, articles: 0, seconds: 0 }
      ),
    [allDays]
  )

  const streak = useMemo(() => {
    const map = new Map(allDays.map(d => [d.date, d]))
    let n = 0
    const d = new Date()
    for (;;) {
      const s = map.get(todayStr(d))
      if (!s || (s.newWords === 0 && s.articlesRead === 0 && s.seconds < 60)) break
      n++
      d.setDate(d.getDate() - 1)
    }
    return n
  }, [allDays])

  const maxWords = Math.max(1, ...week.map(d => d.newWords))
  const maxMin = Math.max(1, ...week.map(d => Math.round(d.seconds / 60)))

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 1600)
  }

  async function patch(p: Partial<Settings>) {
    if (!settings) return
    const next = { ...settings, ...p }
    setSettings(next)
    await saveSettings(p)
  }

  async function doExport() {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `子辰阅读备份-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
    show('已导出备份文件')
  }

  async function doImport(file: File) {
    try {
      const text = await file.text()
      await importAll(JSON.parse(text))
      show('导入成功，正在刷新')
      setTimeout(() => location.reload(), 700)
    } catch (e: any) {
      show('导入失败：' + (e?.message || '文件格式不对'))
    }
  }

  if (!settings) return <div className="page" />

  return (
    <div className="page">
      <div className="brand-row">
        <div className="brand">
          我的
          <small>MY PROGRESS</small>
        </div>
        <div className="date-chip">连续学习 {streak} 天</div>
      </div>

      <div className="hero-stat">
        <div className="top">
          <span>今日学习</span>
          <span>{today.date}</span>
        </div>
        <div className="nums">
          <div>
            <b>{today.newWords}</b>
            <span>新学单词</span>
          </div>
          <div>
            <b>{today.articlesRead}</b>
            <span>阅读短文</span>
          </div>
          <div>
            <b>{Math.round(today.seconds / 60)}</b>
            <span>阅读分钟</span>
          </div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <b>{c.remaining}</b>
          <span>生词本剩余（未掌握）</span>
        </div>
        <div className="stat-tile">
          <b>{c.wrong}</b>
          <span>错题本剩余</span>
        </div>
      </div>

      <div className="chart">
        <div className="chart-head">
          <h3>近 7 天新学单词</h3>
          <span className="tiny muted">共 {total.words} 词</span>
        </div>
        <div className="bars">
          {week.map(d => (
            <div className="bar-col" key={d.date}>
              <div className="bar" style={{ height: `${(d.newWords / maxWords) * 88}px` }} />
              <small>{d.date.slice(5).replace('-', '/')}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="chart">
        <div className="chart-head">
          <h3>近 7 天阅读时长（分钟）</h3>
          <span className="tiny muted">累计 {fmtClock(total.seconds)}</span>
        </div>
        <div className="bars">
          {week.map(d => (
            <div className="bar-col" key={d.date}>
              <div className="bar warm" style={{ height: `${(Math.round(d.seconds / 60) / maxMin) * 88}px` }} />
              <small>{d.date.slice(5).replace('-', '/')}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h2>设置</h2>
      </div>

      <div className="settings">
        <div className="set-item">
          <div className="k">
            默认难度
            <small>首页打开时默认显示的难度</small>
          </div>
          <select value={settings.difficulty} onChange={e => patch({ difficulty: e.target.value as any })}>
            {DIFFICULTIES.map(d => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="set-item">
          <div className="k">
            外观
            <small>跟随系统或手动切换深色</small>
          </div>
          <select value={settings.theme} onChange={e => {
            const v = e.target.value as any
            applyTheme(v)
            patch({ theme: v })
          }}>
            <option value="auto">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>

        <div className="set-item" style={{ alignItems: 'flex-start' }}>
          <div className="k">
            每日通知时间
            <small>云端任务按这些时间推送一篇文章</small>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            {settings.notifyTimes.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <input
                  type="time"
                  value={t}
                  onChange={e => {
                    const arr = [...settings.notifyTimes]
                    arr[i] = e.target.value
                    patch({ notifyTimes: arr })
                  }}
                />
                {settings.notifyTimes.length > 1 && (
                  <button className="tiny muted" onClick={() => patch({ notifyTimes: settings.notifyTimes.filter((_, k) => k !== i) })}>
                    删除
                  </button>
                )}
              </div>
            ))}
            {settings.notifyTimes.length < 3 && (
              <button className="tiny" style={{ color: 'var(--accent)' }} onClick={() => patch({ notifyTimes: [...settings.notifyTimes, '20:00'] })}>
                + 添加时间
              </button>
            )}
          </div>
        </div>

        <div className="set-item">
          <div className="k">
            每天最多推送
            <small>避免打扰，1-3 次比较合适</small>
          </div>
          <input
            type="number"
            min={1}
            max={5}
            value={settings.notifyCount}
            style={{ width: 64 }}
            onChange={e => patch({ notifyCount: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })}
          />
        </div>

        {CATEGORIES.map(cat => (
          <div className="weight-row" key={cat.key}>
            <div className="wl">
              <span style={{ color: 'var(--ink)' }}>
                {cat.icon} {cat.label}
              </span>
              <span>推荐权重 {settings.weights[cat.key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              value={settings.weights[cat.key]}
              onChange={e => patch({ weights: { ...settings.weights, [cat.key]: Number(e.target.value) } })}
            />
          </div>
        ))}
      </div>

      <div className="settings" style={{ marginTop: 12 }}>
        <button className="set-item" style={{ width: '100%' }} onClick={doExport}>
          <div className="k">导出学习数据</div>
          <span className="v">
            <Icon name="right" size={16} />
          </span>
        </button>
        <button className="set-item" style={{ width: '100%' }} onClick={() => fileRef.current?.click()}>
          <div className="k">导入备份文件</div>
          <span className="v">
            <Icon name="right" size={16} />
          </span>
        </button>
        <button
          className="set-item"
          style={{ width: '100%' }}
          onClick={async () => {
            if (!confirm('确定清空所有生词、划线和学习记录？此操作不可恢复。')) return
            await clearAll()
            show('已清空')
            setTimeout(() => location.reload(), 600)
          }}
        >
          <div className="k" style={{ color: 'var(--danger)' }}>
            清空全部数据
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) doImport(f)
            e.currentTarget.value = ''
          }}
        />
      </div>

      <p className="tiny muted center" style={{ marginTop: 20, lineHeight: 1.8 }}>
        数据只保存在这台手机上，换设备请先用「导出」备份。
        <br />
        文章版权归原作者与媒体所有，仅供个人学习。
      </p>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
