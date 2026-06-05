export default function ApplicationsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'var(--card)' }} />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-8 w-20 rounded-full animate-pulse" style={{ background: 'var(--card)' }} />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
        ))}
      </div>
    </div>
  )
}
