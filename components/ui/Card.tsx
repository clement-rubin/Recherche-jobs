'use client'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

const BASE = 'rounded-[var(--r-xl)] border transition-shadow duration-200'

export function Card({ children, className = '', onClick }: CardProps) {
  const style = {
    background: 'var(--card-gradient)',
    borderColor: 'var(--border)',
    boxShadow: 'var(--shadow-sm)',
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${BASE} text-left w-full hover:shadow-[var(--shadow-md)] ${className}`}
        style={style}
      >
        {children}
      </button>
    )
  }

  return (
    <div className={`${BASE} ${className}`} style={style}>
      {children}
    </div>
  )
}
