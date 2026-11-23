export type Category = 'politics' | 'entertainment' | 'sports' | 'economy' | 'science' | 'life' | 'ai'

export type Difficulty = 'easy' | 'medium' | 'hard'

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'politics', label: '时政', icon: '🏛️' },
  { key: 'entertainment', label: '娱乐', icon: '🎬' },
  { key: 'sports', label: '体育', icon: '🏅' },
  { key: 'economy', label: '经济', icon: '📈' },
  { key: 'science', label: '科学', icon: '🔬' },
  { key: 'life', label: '生活', icon: '🌿' },
  { key: 'ai', label: 'AI', icon: '🤖' }
]

export const DIFFICULTIES: { key: Difficulty; label: string; hint: string }[] = [
  { key: 'easy', label: '简易', hint: '短句为主，生词少' },
  { key: 'medium', label: '中等', hint: '常规外媒短文' },
  { key: 'hard', label: '困难', hint: '长难句与专业词' }
]

export const catLabel = (c: Category) => CATEGORIES.find(x => x.key === c)?.label ?? c
export const catIcon = (c: Category) => CATEGORIES.find(x => x.key === c)?.icon ?? '📄'
export const diffLabel = (d: Difficulty) => DIFFICULTIES.find(x => x.key === d)?.label ?? d

export interface Article {
  id: string
  category: Category
  difficulty: Difficulty
  title: string
  titleZh?: string
  image?: string
  source: string
  url: string
  publishedAt: string
  date: string
  minutes: number
  paragraphs: string[]
  summary?: string
}

export interface DictExample {
  en: string
  zh?: string
}

export interface DictEn {
  pos?: string
  text: string
  example?: string
}

export interface DictPayload {
  word: string
  phoneticUs?: string
  phoneticUk?: string
  audio?: string
  defsZh: { pos?: string; text: string }[]
  forms?: string
  exams?: string[]
  defsEn: DictEn[]
  examples: DictExample[]
  source: string
}

export interface WordEntry {
  term: string
  kind: 'word' | 'phrase'
  phonetic?: string
  pos?: string[]
  defsZh: string[]
  defsEn: { pos?: string; text: string; example?: string }[]
  forms?: string
  audio?: string
  translation?: string
  addedAt: number
  sourceArticleId?: string
  sourceArticleTitle?: string
  mastered: 0 | 1
  reviews: number
}

export interface SentenceEntry {
  id: string
  text: string
  translation: string
  articleId: string
  articleTitle: string
  createdAt: number
}

export interface HighlightEntry {
  id: string
  articleId: string
  articleTitle: string
  text: string
  translation?: string
  createdAt: number
  pi?: number
  start?: number
  end?: number
}

export interface ReadRecord {
  articleId: string
  date: string
  seconds: number
  counted: number
}

export interface WrongEntry {
  id: string
  kind: 'word' | 'sentence'
  term: string
  meaning?: string
  phonetic?: string
  pos?: string[]
  audio?: string
  createdAt: number
}

export interface DayStat {
  date: string
  newWords: number
  articlesRead: number
  seconds: number
}

export interface Settings {
  key: string
  difficulty: Difficulty
  notifyTimes: string[]
  notifyCount: number
  weights: Record<Category, number>
  theme: 'auto' | 'light' | 'dark'
  mwKey?: string
}

export const todayStr = (d = new Date()) => {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return t.toISOString().slice(0, 10)
}

export const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export const fmtClock = (sec: number) => {
  if (sec < 60) return `${sec} 秒`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  return `${h} 小时 ${m % 60} 分`
}
