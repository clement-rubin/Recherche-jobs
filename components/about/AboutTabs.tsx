'use client'

import { useState, useEffect } from 'react'

const TABS = [
  { id: 'features', label: 'Fonctionnalités' },
  { id: 'data', label: 'Données & Confidentialité' },
  { id: 'faq', label: 'FAQ Alex' },
]

export function AboutTabs() {
  const [active, setActive] = useState('features')

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    TABS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id) },
        { rootMargin: '-40% 0px -55% 0px' }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [])

  return (
    <div
      className="sticky top-0 z-20 flex justify-center gap-1 py-3 px-4"
      style={{ background: 'var(--background)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}
    >
      {TABS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={() => setActive(id)}
          className="px-4 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
          style={{
            background: active === id ? 'var(--accent-surface)' : 'transparent',
            color: active === id ? 'var(--accent-text)' : 'var(--muted)',
            border: `1px solid ${active === id ? 'var(--accent-border)' : 'transparent'}`,
          }}
        >
          {label}
        </a>
      ))}
    </div>
  )
}
