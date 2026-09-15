'use client'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

const BASE =
  'rounded-[var(--r-xl)] border transition-shadow duration-200 bg-[image:var(--card-gradient)] border-[color:var(--border)] shadow-[var(--shadow-sm)]'

export function Card({ children, className = '', onClick }: CardProps) {
  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            if (event.key === ' ') {
              event.preventDefault()
            }
            onClick()
          }
        }}
        className={`${BASE} hover:shadow-[var(--shadow-md)] ${className}`}
      >
        {children}
      </div>
    )
  }

  return (
    <div className={`${BASE} ${className}`}>
      {children}
    </div>
  )
}
