'use client'

import { useRef, useEffect } from 'react'
import gsap from 'gsap'

interface Props {
  children: React.ReactNode
  className?: string
}

export function PageTransition({ children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || typeof requestAnimationFrame === 'undefined') return
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.22, ease: 'power3.out', clearProps: 'all' }
    )
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
