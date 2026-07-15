import { useState, useEffect, useCallback } from 'react'
import { onKbUpdated } from './chatEvents'

export interface TocItem {
  level: 'h2' | 'h3'
  text: string
}

export interface PageMeta {
  stem: string
  title: string
  summary: string
  updated: string
  toc: TocItem[]
  type: 'wiki' | 'output'
}

export function usePages() {
  const [pages, setPages] = useState<PageMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch('/api/pages')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setPages(data as PageMeta[])
        setLoading(false)
        setError(null)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
    // agent 写完 wiki 后(server 推 kb_updated)自动重拉
    return onKbUpdated(load)
  }, [load])

  return { pages, loading, error, reload: load }
}

export function usePageContent(stem: string | undefined) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!stem) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(`/api/pages/${stem}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((html) => {
        setContent(html)
        setLoading(false)
      })
      .catch(() => {
        setContent(null)
        setLoading(false)
      })
  }, [stem])

  return { content, loading }
}
