import Dexie, { type Table } from 'dexie'
import {
  type WordEntry,
  type SentenceEntry,
  type HighlightEntry,
  type ReadRecord,
  type WrongEntry,
  type DayStat,
  type Settings,
  type Category,
  type Article,
  todayStr
} from './types'

export const DEFAULT_SETTINGS: Settings = {
  key: 'app',
  difficulty: 'medium',
  notifyTimes: ['07:30'],
  notifyCount: 2,
  weights: { politics: 3, entertainment: 2, sports: 2, economy: 3, science: 4, life: 3, ai: 3 },
  theme: 'auto'
}

class ReadingDB extends Dexie {
  words!: Table<WordEntry, string>
  sentences!: Table<SentenceEntry, string>
  highlights!: Table<HighlightEntry, string>
  reads!: Table<ReadRecord, string>
  wrong!: Table<WrongEntry, string>
  days!: Table<DayStat, string>
  settings!: Table<Settings, string>
  dictCache!: Table<{ word: string; payload: string; savedAt: number }, string>
  transCache!: Table<{ hash: string; text: string; savedAt: number }, string>
  custom!: Table<Article & { createdAt: number }, string>

  constructor() {
    super('zichen-reading')
    this.version(1).stores({
      words: '&term, addedAt, kind, mastered',
      sentences: '&id, createdAt, articleId',
      highlights: '&id, createdAt, articleId',
      reads: '&articleId, date, counted',
      wrong: '&id, createdAt',
      days: '&date',
      settings: '&key',
      dictCache: '&word, savedAt',
      transCache: '&hash, savedAt'
    })
    // v2：新增「手动粘贴的文章」，与每日文章共存于本机
    this.version(2).stores({
      custom: '&id, createdAt'
    })
  }
}

export const db = new ReadingDB()

/* ---------------- settings ---------------- */

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app')
  return { ...DEFAULT_SETTINGS, ...(s || {}), key: 'app' }
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings()
  await db.settings.put({ ...cur, ...patch, key: 'app' })
}

/* ---------------- day stats ---------------- */

async function ensureDay(date: string): Promise<DayStat> {
  const d = await db.days.get(date)
  if (d) return d
  const fresh: DayStat = { date, newWords: 0, articlesRead: 0, seconds: 0 }
  await db.days.put(fresh)
  return fresh
}

export async function bumpDay(date: string, patch: Partial<DayStat>) {
  const d = await ensureDay(date)
  const next: DayStat = {
    date,
    newWords: d.newWords + (patch.newWords || 0),
    articlesRead: d.articlesRead + (patch.articlesRead || 0),
    seconds: d.seconds + (patch.seconds || 0)
  }
  await db.days.put(next)
  return next
}

export async function getDay(date = todayStr()) {
  return (await db.days.get(date)) || { date, newWords: 0, articlesRead: 0, seconds: 0 }
}

export async function getRecentDays(n = 7): Promise<DayStat[]> {
  const out: DayStat[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    out.push(await getDay(todayStr(d)))
  }
  return out
}

export async function getAllDays(): Promise<DayStat[]> {
  return db.days.orderBy('date').toArray()
}

/* ---------------- words ---------------- */

export async function addWord(entry: WordEntry): Promise<boolean> {
  const exists = await db.words.get(entry.term)
  if (exists) return false
  await db.words.put(entry)
  if (entry.kind === 'word') await bumpDay(todayStr(), { newWords: 1 })
  return true
}

export async function isSaved(term: string) {
  return !!(await db.words.get(term))
}

export async function removeWord(term: string) {
  await db.words.delete(term)
}

export async function setMastered(term: string, mastered: 0 | 1) {
  const w = await db.words.get(term)
  if (!w) return
  await db.words.put({ ...w, mastered })
}

export async function markReviewed(term: string) {
  const w = await db.words.get(term)
  if (!w) return
  await db.words.put({ ...w, reviews: (w.reviews || 0) + 1 })
}

export async function countWords(kind?: 'word' | 'phrase') {
  const all = await db.words.toArray()
  return kind ? all.filter(w => w.kind === kind).length : all.length
}

export async function countRemainingWords() {
  const all = await db.words.toArray()
  return all.filter(w => w.kind === 'word' && !w.mastered).length
}

/* ---------------- sentences & highlights ---------------- */

export async function addSentence(entry: SentenceEntry) {
  const exists = await db.sentences.get(entry.id)
  if (exists) return false
  await db.sentences.put(entry)
  return true
}

export async function addHighlight(entry: HighlightEntry): Promise<{ added: boolean; duplicate: boolean }> {
  const all = await db.highlights.where('articleId').equals(entry.articleId).toArray()
  const dup = all.find(h => h.text.trim() === entry.text.trim())
  if (dup) return { added: false, duplicate: true }
  await db.highlights.put(entry)
  return { added: true, duplicate: false }
}

export async function removeHighlight(id: string) {
  await db.highlights.delete(id)
}

export async function getHighlights(articleId: string) {
  return db.highlights.where('articleId').equals(articleId).toArray()
}

/* ---------------- reading ---------------- */

export async function addReading(articleId: string, seconds: number, date = todayStr()) {
  if (seconds <= 0) return
  const rec = await db.reads.get(articleId)
  const base: ReadRecord = rec || { articleId, date, seconds: 0, counted: 1 }
  const next: ReadRecord = { ...base, date, seconds: (base.seconds || 0) + seconds, counted: 1 }
  await db.reads.put(next)
  await bumpDay(date, { seconds })
}

export async function markArticleRead(articleId: string) {
  const rec = await db.reads.get(articleId)
  if (rec && rec.counted === 2) return
  if (!rec) {
    await db.reads.put({ articleId, date: todayStr(), seconds: 0, counted: 2 })
  } else {
    await db.reads.put({ ...rec, counted: 2 })
  }
  await bumpDay(todayStr(), { articlesRead: 1 })
}

export async function getReadIds(): Promise<Set<string>> {
  const all = await db.reads.toArray()
  return new Set(all.map(r => r.articleId))
}

/* ---------------- wrong book ---------------- */

export async function addWrong(entry: WrongEntry) {
  const all = await db.wrong.toArray()
  const dup = all.find(w => w.term.toLowerCase() === entry.term.toLowerCase() && w.kind === entry.kind)
  if (dup) return false
  await db.wrong.put(entry)
  return true
}

export async function removeWrong(id: string) {
  await db.wrong.delete(id)
}

/* ---------------- custom articles ---------------- */

export async function saveCustomArticle(a: Article) {
  await db.custom.put({ ...a, createdAt: Date.now() })
}

export async function getCustomArticle(id: string): Promise<Article | undefined> {
  return db.custom.get(id)
}

export async function listCustomArticles(): Promise<(Article & { createdAt: number })[]> {
  const all = await db.custom.toArray()
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function removeCustomArticle(id: string) {
  await db.custom.delete(id)
}

/* ---------------- backup ---------------- */

export async function exportAll() {
  const data = {
    exportedAt: new Date().toISOString(),
    version: 1,
    words: await db.words.toArray(),
    sentences: await db.sentences.toArray(),
    highlights: await db.highlights.toArray(),
    reads: await db.reads.toArray(),
    wrong: await db.wrong.toArray(),
    days: await db.days.toArray(),
    settings: await db.settings.toArray(),
    custom: await db.custom.toArray()
  }
  return data
}

export async function importAll(data: any) {
  if (!data || typeof data !== 'object') throw new Error('文件格式不对')
  await db.transaction(
    'rw',
    [db.words, db.sentences, db.highlights, db.reads, db.wrong, db.days, db.settings, db.custom],
    async () => {
      if (Array.isArray(data.words)) await db.words.bulkPut(data.words)
      if (Array.isArray(data.sentences)) await db.sentences.bulkPut(data.sentences)
      if (Array.isArray(data.highlights)) await db.highlights.bulkPut(data.highlights)
      if (Array.isArray(data.reads)) await db.reads.bulkPut(data.reads)
      if (Array.isArray(data.wrong)) await db.wrong.bulkPut(data.wrong)
      if (Array.isArray(data.days)) await db.days.bulkPut(data.days)
      if (Array.isArray(data.settings)) await db.settings.bulkPut(data.settings)
      if (Array.isArray(data.custom)) await db.custom.bulkPut(data.custom)
    }
  )
}

export async function clearAll() {
  await db.transaction(
    'rw',
    [db.words, db.sentences, db.highlights, db.reads, db.wrong, db.days, db.dictCache, db.transCache, db.custom],
    async () => {
      await Promise.all([
        db.words.clear(),
        db.sentences.clear(),
        db.highlights.clear(),
        db.reads.clear(),
        db.wrong.clear(),
        db.days.clear(),
        db.dictCache.clear(),
        db.transCache.clear(),
        db.custom.clear()
      ])
    }
  )
}

export async function counts() {
  const [words, sentences, highlights, wrong] = await Promise.all([
    db.words.toArray(),
    db.sentences.count(),
    db.highlights.count(),
    db.wrong.count()
  ])
  return {
    words: words.filter(w => w.kind === 'word').length,
    phrases: words.filter(w => w.kind === 'phrase').length,
    remaining: words.filter(w => w.kind === 'word' && !w.mastered).length,
    sentences,
    highlights,
    wrong
  }
}

export type { Category }
