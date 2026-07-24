export function LoadingState({ label = 'Loading Japan 47…' }) {
  return <div className="state state--loading" role="status"><span className="spinner" aria-hidden="true" />{label}</div>
}

export function ErrorState({ error, onRetry }) {
  return <div className="state state--error" role="alert"><span aria-hidden="true">!</span><h2>Something went wrong</h2><p>{error?.message || 'Please try again.'}</p>{onRetry && <button className="button" onClick={onRetry}>Try again</button>}</div>
}

export function EmptyState({ title = 'Nothing here yet', message = 'Check back again soon.' }) {
  return <div className="state state--empty"><span aria-hidden="true">旅</span><h2>{title}</h2><p>{message}</p></div>
}
