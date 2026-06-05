export default function OffersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded-lg animate-pulse" style={{ background: 'var(--card)' }} />
          <div className="h-4 w-16 rounded animate-pulse" style={{ background: 'var(--card)' }} />
        </div>
        <div className="h-8 w-28 rounded-lg animate-pulse" style={{ background: 'var(--card)' }} />
      </div>
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-7 w-20 rounded-full animate-pulse" style={{ background: 'var(--card)' }} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-36 rounded-xl animate-pulse" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
        ))}
      </div>
    </div>
  )
}
