import { Link } from 'react-router-dom';

export function Skeleton({ className = '', style }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="card article-card" aria-hidden="true">
      <Skeleton className="skeleton-cover" />
      <div className="card-body">
        <Skeleton className="skeleton-line short" />
        <Skeleton className="skeleton-line" />
        <Skeleton className="skeleton-line" />
        <Skeleton className="skeleton-line medium" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-3" role="status" aria-label="Loading articles">
      {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div role="status" aria-label="Loading" className="table-skeleton">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="skeleton-row" />)}
    </div>
  );
}

export function EmptyState({ icon = 'bi-inbox', title, children, action }) {
  return (
    <div className="state">
      <i className={`bi ${icon} state-icon`} aria-hidden="true" />
      <h2 className="state-title">{title}</h2>
      {children && <p className="state-text">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <i className="bi bi-exclamation-triangle state-icon" aria-hidden="true" />
      <h2 className="state-title">{title}</h2>
      <p className="state-text">{message || 'We could not load this content. Please check your connection and try again.'}</p>
      {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function BackHome() {
  return <Link to="/" className="btn btn-primary">Back to the homepage</Link>;
}
