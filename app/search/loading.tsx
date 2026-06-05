export default function SearchLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'var(--card)' }} />
      {[1, 2].map(i => (
        <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
      ))}
    </div>
  )
}
