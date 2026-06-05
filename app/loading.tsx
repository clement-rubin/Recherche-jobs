// Dashboard skeleton — shown instantly while server fetches application data
export default function DashboardLoading() {
  return (
    <div className="max-w-4xl space-y-8 py-2">
      {/* Header skeleton */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
        <div className="h-7 w-32 rounded-lg animate-pulse" style={{ background: 'var(--card)' }} />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="rounded-xl p-5 animate-pulse"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', height: 100 }}
          />
        ))}
      </div>

      {/* Progress bar skeleton */}
      <div className="rounded-xl p-4 animate-pulse" style={{ background: 'var(--card)', border: '1px solid var(--border)', height: 72 }} />

      {/* Quick actions skeleton */}
      <div className="flex gap-3">
        <div className="h-10 w-44 rounded-lg animate-pulse" style={{ background: 'var(--card)' }} />
        <div className="h-10 w-36 rounded-lg animate-pulse" style={{ background: 'var(--card)' }} />
      </div>

      {/* Recent activity skeleton */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4 border-b animate-pulse" style={{ borderColor: 'var(--border)', height: 52 }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="px-5 py-4 flex items-center gap-3 border-b animate-pulse" style={{ borderColor: 'var(--border)' }}>
            <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: 'var(--border)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-32 rounded" style={{ background: 'var(--border)' }} />
              <div className="h-3 w-20 rounded" style={{ background: 'var(--border)' }} />
            </div>
            <div className="h-5 w-16 rounded-full" style={{ background: 'var(--border)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
