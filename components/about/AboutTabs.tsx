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
      style={{ background: 'rgba(8,9,14,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(124,58,237,0.1)' }}
    >
      {TABS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={() => setActive(id)}
          className="px-4 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
          style={{
            background: active === id ? 'rgba(124,58,237,0.2)' : 'transparent',
            color: active === id ? '#a78bfa' : '#4b5175',
            border: `1px solid ${active === id ? 'rgba(124,58,237,0.4)' : 'transparent'}`,
          }}
        >
          {label}
        </a>
      ))}
    </div>
  )
}
