import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Reader } from './pages/Reader'
import { Study } from './pages/Study'
import { Mine } from './pages/Mine'
import { WordsList } from './pages/WordsList'
import { Sentences } from './pages/Sentences'
import { Dictation } from './pages/Dictation'
import { WrongBook } from './pages/WrongBook'
import { getSettings } from './lib/db'
import { applyTheme, watchSystemTheme } from './lib/theme'

export function App() {
  useEffect(() => {
    let mode: 'auto' | 'light' | 'dark' = 'auto'
    getSettings().then(s => {
      mode = s.theme
      applyTheme(mode)
    })
    const off = watchSystemTheme(() => applyTheme(mode))
    return off
  }, [])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/study" element={<Study />} />
        <Route path="/me" element={<Mine />} />
      </Route>
      <Route path="/read/:id" element={<Reader />} />
      <Route path="/study/words" element={<WordsList />} />
      <Route path="/study/sentences" element={<Sentences />} />
      <Route path="/study/dictation" element={<Dictation />} />
      <Route path="/study/wrong" element={<WrongBook />} />
    </Routes>
  )
}
