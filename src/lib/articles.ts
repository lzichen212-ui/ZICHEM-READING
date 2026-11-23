import { DEMO_ARTICLES } from '../data/demo'
import type { Article } from './types'

let cache: Article[] | null = null
let loading: Promise<Article[]> | null = null

const normalize = (list: any[]): Article[] =>
  list
    .filter(a => a && a.id && Array.isArray(a.paragraphs) && a.paragraphs.length)
    .map(a => ({
      ...a,
      minutes: a.minutes || Math.max(1, Math.round((a.paragraphs.join(' ').split(/\s+/).length || 120) / 130))
    }))

export async function loadArticles(): Promise<Article[]> {
  if (cache) return cache
  if (loading) return loading
  loading = (async () => {
    // 优先从服务端代理的远程文章（Gitee 国内镜像）加载
    try {
      const res = await fetch('/api/articles', { cache: 'no-cache' })
      if (res.ok) {
        const data = await res.json()
        const list = normalize(Array.isArray(data?.articles) ? data.articles : [])
        if (list.length) {
          cache = list
          cache.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
          return cache
        }
      }
    } catch {
      /* 继续回退 */
    }
    // 回退：同源打包的文章文件
    try {
      const res = await fetch('/articles/index.json', { cache: 'no-cache' })
      if (res.ok) {
        const data = await res.json()
        const list = normalize(Array.isArray(data?.articles) ? data.articles : [])
        if (list.length) cache = list
      }
    } catch {
      /* 继续回退 */
    }
    if (!cache) cache = DEMO_ARTICLES
    cache.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    return cache
  })()
  return loading
}

export function getCachedArticle(id: string): Article | undefined {
  return cache?.find(a => a.id === id)
}

export async function getArticle(id: string): Promise<Article | undefined> {
  const list = await loadArticles()
  return list.find(a => a.id === id)
}

export function groupByDate(list: Article[]): { date: string; items: Article[] }[] {
  const map = new Map<string, Article[]>()
  for (const a of list) {
    if (!map.has(a.date)) map.set(a.date, [])
    map.get(a.date)!.push(a)
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, items }))
}
