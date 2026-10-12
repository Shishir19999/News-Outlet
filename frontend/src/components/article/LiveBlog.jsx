import { useCallback, useEffect, useState } from 'react';
import API, { authHeaders, errorMessage } from '../../config/API';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { joinLive, subscribe } from '../../lib/realtime';
import { renderMarkdown } from '../../lib/markdown';
import { formatDateTime, timeAgo } from '../../lib/text';
import { can, isOwner } from '../../shared/rules';

const sortUpdates = (list) => [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt));

// Timeline that updates by itself: Socket.IO in real mode, BroadcastChannel between tabs in the live preview.
export default function LiveBlog({ article }) {
  const { user } = useAuth();
  const toast = useToast();
  const [updates, setUpdates] = useState(null);
  const [fresh, setFresh] = useState(0);
  const [text, setText] = useState('');
  const [flags, setFlags] = useState({ important: false, pinned: false });
  const [busy, setBusy] = useState(false);
  const canPost = !!user && (can(user.role, 'live.any') || (can(user.role, 'live.own') && isOwner(article, user)));

  const load = useCallback(() => API.get(`/news/${article._id}/live`, { headers: authHeaders() }).then((r) => setUpdates(sortUpdates(r.data.updates))).catch(() => setUpdates([])), [article._id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const leave = joinLive(article._id);
    const off = subscribe('live:update', (e) => {
      if (e.newsId !== article._id) return;
      setUpdates((list) => {
        const cur = list || [];
        if (e.type === 'add') { setFresh((n) => n + 1); return cur.some((u) => u._id === e.update._id) ? cur : sortUpdates([e.update, ...cur]); }
        if (e.type === 'edit') return sortUpdates(cur.map((u) => (u._id === e.update._id ? e.update : u)));
        return cur.filter((u) => u._id !== e.update._id);
      });
    });
    return () => { leave(); off(); };
  }, [article._id]);

  const post = async (e) => {
    e.preventDefault();
    if (!text.trim()) { toast.error('Write the update first'); return; }
    setBusy(true);
    try {
      await API.post(`/news/${article._id}/live`, { body: text, ...flags }, { headers: authHeaders() });
      setText('');
      setFlags({ important: false, pinned: false });
      await load();
      toast.success('Update posted');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    try { await API.delete(`/news/${article._id}/live/${id}`, { headers: authHeaders() }); await load(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const togglePin = async (u) => {
    try { await API.put(`/news/${article._id}/live/${u._id}`, { important: u.important, pinned: !u.pinned }, { headers: authHeaders() }); await load(); } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <section className="live-blog" aria-labelledby="live-h">
      <h2 id="live-h" className="section-title-sm"><span className="live-dot" aria-hidden="true" /> Live updates</h2>
      <p className="visually-hidden" role="status" aria-live="polite">{fresh ? `${fresh} new ${fresh === 1 ? 'update' : 'updates'} arrived` : ''}</p>
      {canPost && (
        <form className="panel live-compose" onSubmit={post}>
          <div className="field">
            <label htmlFor="live-text">Post an update</label>
            <textarea id="live-text" className="input" rows="3" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          </div>
          <label className="check"><input type="checkbox" checked={flags.important} onChange={(e) => setFlags({ ...flags, important: e.target.checked })} /> Mark as important</label>
          <label className="check"><input type="checkbox" checked={flags.pinned} onChange={(e) => setFlags({ ...flags, pinned: e.target.checked })} /> Pin to the top</label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Posting…' : 'Post update'}</button>
        </form>
      )}
      {updates === null ? <p className="muted">Loading updates…</p> : updates.length === 0 ? <p className="muted">No updates yet. This page refreshes by itself when one arrives.</p> : (
        <ol className="timeline">
          {updates.map((u) => (
            <li key={u._id} className={`timeline-item ${u.important ? 'is-important' : ''} ${u.pinned ? 'is-pinned' : ''}`}>
              <p className="timeline-meta">
                <time dateTime={u.createdAt} title={formatDateTime(u.createdAt)}>{timeAgo(u.createdAt)}</time>
                {u.pinned && <span className="badge badge-scheduled">Pinned</span>}
                {u.important && <span className="badge badge-rejected">Important</span>}
              </p>
              <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(u.body) }} />
              {canPost && (
                <p className="timeline-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => togglePin(u)}>{u.pinned ? 'Unpin' : 'Pin'}</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(u._id)}>Delete</button>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
