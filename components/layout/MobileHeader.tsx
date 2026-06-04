'use client'

import { useEffect, useRef, useState } from 'react'
import { Nav } from './Nav'
import gsap from 'gsap'

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!drawerRef.current || !overlayRef.current) return

    if (open) {
      gsap.set(drawerRef.current, { display: 'flex' })
      gsap.set(overlayRef.current, { display: 'block' })
      gsap.fromTo(drawerRef.current, { x: -224 }, { x: 0, duration: 0.28, ease: 'power2.out' })
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 })
    } else {
      gsap.to(drawerRef.current, {
        x: -224, duration: 0.22, ease: 'power2.in',
        onComplete: () => { if (drawerRef.current) gsap.set(drawerRef.current, { display: 'none' }) },
      })
      gsap.to(overlayRef.current, {
        opacity: 0, duration: 0.2,
        onComplete: () => { if (overlayRef.current) gsap.set(overlayRef.current, { display: 'none' }) },
      })
    }
  }, [open])

  return (
    <>
      {/* Fixed top bar */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40"
        style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--muted)' }}
          aria-label="Ouvrir le menu"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2 ml-3">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'var(--accent)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>JobTracker</span>
        </div>
      </header>

      {/* Overlay */}
      <div
        ref={overlayRef}
        className="lg:hidden fixed inset-0 z-50 bg-black/40"
        style={{ display: 'none' }}
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="lg:hidden fixed top-0 left-0 h-full z-50 w-56 shadow-xl"
        style={{ display: 'none' }}
      >
        <Nav onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
