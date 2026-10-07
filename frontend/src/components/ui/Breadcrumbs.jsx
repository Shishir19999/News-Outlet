import { Link } from 'react-router-dom';

// items: [{ label, to? }] - the last item is the current page.
export default function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.label + i}>
              {last || !item.to
                ? <span aria-current={last ? 'page' : undefined}>{item.label}</span>
                : <Link to={item.to}>{item.label}</Link>}
              {!last && <i className="bi bi-chevron-right" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
