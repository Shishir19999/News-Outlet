export default function PaginationComponent({ page, pages, onChange, label = 'Pagination' }) {
  if (pages <= 1) return null;
  const go = (p) => {
    onChange(p);
  };
  return (
    <nav className="pagination" aria-label={label}>
      <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => go(page - 1)}>
        <i className="bi bi-chevron-left" aria-hidden="true" /> Previous
      </button>
      <span className="pagination-info" aria-current="page">Page {page} of {pages}</span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => go(page + 1)}>
        Next <i className="bi bi-chevron-right" aria-hidden="true" />
      </button>
    </nav>
  );
}
