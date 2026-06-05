export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="h-8 w-36 rounded-lg animate-pulse" style={{ background: 'var(--card)' }} />
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
      ))}
    </div>
  )
}
