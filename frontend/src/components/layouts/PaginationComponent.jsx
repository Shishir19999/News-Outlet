
export default function PaginationComponent({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 mb-4" aria-label="News pages">
      <ul className="pagination justify-content-center">
        <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => onChange(page - 1)}>Previous</button>
        </li>
        <li className="page-item disabled">
          <span className="page-link">Page {page} of {pages}</span>
        </li>
        <li className={`page-item ${page >= pages ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => onChange(page + 1)}>Next</button>
        </li>
      </ul>
    </nav>
  )
}
