import { useMemo, useState } from 'react';
import API, { authHeaders, errorMessage } from '../../config/API';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../hooks/useAsync';
import { COMMENT_MAX_DEPTH, REPORT_REASONS } from '../../shared/rules';
import { timeAgo, formatDateTime } from '../../lib/text';
import { ErrorState } from '../ui/States';

function Composer({ newsId, parentId, onDone, label = 'Add a comment', autoFocus = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const id = `c-${parentId || 'root'}`;
  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!body.trim()) found.body = 'Write your comment first';
    if (!user && !name.trim()) found.name = 'Tell us your name';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const res = await API.post('/comments', { newsId, body: body.trim(), name: name.trim(), parentId }, { headers: authHeaders() });
      toast.success(res.data.message);
      setBody('');
      onDone(res.data.status);
    } catch (err) {
      const data = err.response && err.response.data;
      if (data && data.errors) setErrors(data.errors);
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="comment-form" onSubmit={submit} noValidate>
      {!user && (
        <div className="field">
          <label htmlFor={`${id}-name`}>Name</label>
          <input id={`${id}-name`} className={`input ${errors.name ? 'is-invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
      )}
      <div className="field">
        <label htmlFor={`${id}-body`}>{label}</label>
        <textarea id={`${id}-body`} className={`input ${errors.body ? 'is-invalid' : ''}`} rows="3" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} autoFocus={autoFocus} />
        {errors.body && <p className="field-error">{errors.body}</p>}
        {errors.parentId && <p className="field-error">{errors.parentId}</p>}
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Sending…' : 'Post comment'}</button>
    </form>
  );
}

function ReportMenu({ id }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const send = async (reason) => {
    setOpen(false);
    try {
      const res = await API.post(`/comments/${id}/report`, { reason }, { headers: authHeaders() });
      toast.success(res.data.message);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <span className="report">
      <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>Report</button>
      {open && (
        <span className="report-list" role="group" aria-label="Reason for reporting">
          {REPORT_REASONS.map((r) => <button key={r} type="button" className="btn btn-secondary btn-sm" onClick={() => send(r)}>{r}</button>)}
        </span>
      )}
    </span>
  );
}

function Thread({ node, depth, newsId, onChanged }) {
  const [replying, setReplying] = useState(false);
  return (
    <li className="comment-item">
      <article className="comment">
        <span className="comment-avatar" aria-hidden="true">{node.name.charAt(0).toUpperCase()}</span>
        <div>
          <p className="comment-head">
            <strong>{node.name}</strong>
            {node.isStaff && <span className="badge badge-admin">Newsroom</span>}
            <time dateTime={node.createdAt} title={formatDateTime(node.createdAt)}>{timeAgo(node.createdAt)}</time>
          </p>
          <p className="comment-body">{node.body}</p>
          <p className="comment-actions">
            {depth < COMMENT_MAX_DEPTH && <button type="button" className="link-btn" aria-expanded={replying} onClick={() => setReplying(!replying)}>Reply<span className="visually-hidden"> to {node.name}</span></button>}
            <ReportMenu id={node._id} />
          </p>
          {replying && <Composer newsId={newsId} parentId={node._id} label={`Reply to ${node.name}`} autoFocus onDone={() => { setReplying(false); onChanged(); }} />}
        </div>
      </article>
      {node.children.length > 0 && (
        <ul className="comment-list comment-replies">
          {node.children.map((c) => <Thread key={c._id} node={c} depth={depth + 1} newsId={newsId} onChanged={onChanged} />)}
        </ul>
      )}
    </li>
  );
}

// Threaded comments (three levels). New comments wait for moderation unless the writer is staff.
export default function Comments({ newsId }) {
  const { settings } = useSettings();
  const list = useAsync(() => API.get('/comments', { params: { newsId } }).then((r) => r.data), [newsId]);
  const tree = useMemo(() => {
    const map = new Map((list.data || []).map((c) => [c._id, { ...c, children: [] }]));
    const roots = [];
    for (const n of map.values()) {
      const parent = n.parentId && map.get(n.parentId);
      if (parent) parent.children.push(n); else roots.push(n);
    }
    return roots;
  }, [list.data]);
  const total = (list.data || []).length;
  return (
    <section className="comments" aria-labelledby="comments-h">
      <h2 id="comments-h" className="section-title">Comments {total > 0 && <span className="muted">({total})</span>}</h2>
      {list.error ? <ErrorState title="Comments could not be loaded" onRetry={list.reload} /> : list.data === null ? <p className="muted">Loading comments…</p> : tree.length === 0 ? <p className="muted">No comments yet. Be the first to share your thoughts.</p> : (
        <ul className="comment-list">
          {tree.map((n) => <Thread key={n._id} node={n} depth={1} newsId={newsId} onChanged={list.reload} />)}
        </ul>
      )}
      {settings.commentsOpen ? (
        <>
          <h3 className="section-title-sm">Join the conversation</h3>
          <p className="muted small">Comments are moderated and appear after review. Be kind and stay on topic.</p>
          <Composer newsId={newsId} parentId={null} onDone={() => list.reload()} />
        </>
      ) : <p className="notice notice-warn">Comments are closed at the moment.</p>}
    </section>
  );
}
