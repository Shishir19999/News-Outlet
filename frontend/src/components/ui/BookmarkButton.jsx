import { useBookmarks } from '../../context/BookmarksContext';

export default function BookmarkButton({ id, title, variant = 'icon', className = '' }) {
  const { has, toggle } = useBookmarks();
  const saved = has(id);
  const label = saved ? `Remove "${title}" from reading list` : `Save "${title}" to read later`;
  if (variant === 'full') {
    return (
      <button type="button" className={`btn btn-secondary ${saved ? 'is-active' : ''} ${className}`} aria-pressed={saved} onClick={() => toggle(id)}>
        <i className={`bi ${saved ? 'bi-bookmark-fill' : 'bi-bookmark'}`} aria-hidden="true" /> {saved ? 'Saved' : 'Read later'}
      </button>
    );
  }
  return (
    <button type="button" className={`icon-btn bookmark-btn ${saved ? 'is-active' : ''} ${className}`} aria-pressed={saved} aria-label={label} title={saved ? 'Saved' : 'Read later'} onClick={() => toggle(id)}>
      <i className={`bi ${saved ? 'bi-bookmark-fill' : 'bi-bookmark'}`} aria-hidden="true" />
    </button>
  );
}
