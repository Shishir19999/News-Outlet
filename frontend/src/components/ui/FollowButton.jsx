import { useFollows } from '../../context/FollowsContext';

// Follow or unfollow a section (kind="topic") or a writer (kind="author").
export default function FollowButton({ kind, id, label, className = '' }) {
  const f = useFollows();
  const on = kind === 'topic' ? f.followsTopic(id) : f.followsAuthor(id);
  const toggle = () => (kind === 'topic' ? f.toggleTopic(id, label) : f.toggleAuthor(id, label));
  return (
    <button type="button" className={`btn btn-secondary btn-sm ${on ? 'is-active' : ''} ${className}`} aria-pressed={on} onClick={toggle}>
      <i className={`bi ${on ? 'bi-check-lg' : 'bi-plus-lg'}`} aria-hidden="true" /> {on ? 'Following' : 'Follow'}
      <span className="visually-hidden"> {label}</span>
    </button>
  );
}
