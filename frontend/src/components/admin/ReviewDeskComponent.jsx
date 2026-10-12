import { useState } from 'react';
import { Link } from 'react-router-dom';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoriesContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../ui/Labels';
import { EmptyState, ErrorState, TableSkeleton } from '../ui/States';
import { formatDateTime, timeAgo } from '../../lib/text';
import { REVIEW_STATUSES, STATUS_LABEL, abCtr, abLeader, transitionsFor } from '../../shared/rules';

// The editor's desk: what waits for review, who has it, and the running headline tests.
export default function ReviewDeskComponent() {
  const { user } = useAuth();
  const { byId } = useCategories();
  const toast = useToast();
  const [view, setView] = useState('all');
  const queue = useAsync(() => API.get('/news/manage/list', { params: { status: 'review', limit: 50, assignee: view === 'mine' ? 'me' : view === 'unassigned' ? 'none' : undefined }, headers: authHeaders() }).then((r) => r.data.news), [view]);
  const tests = useAsync(() => API.get('/news/manage/list', { params: { status: 'published', limit: 50 }, headers: authHeaders() }).then((r) => r.data.news.filter((a) => a.headlineB && !(a.abTest && a.abTest.winner))), []);

  const quick = async (a, to) => {
    try { await API.post(`/news/${a._id}/transition`, { to }, { headers: authHeaders() }); toast.success('Done'); queue.reload(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const winner = async (a, variant) => {
    try { await API.post(`/news/${a._id}/ab/winner`, { variant }, { headers: authHeaders() }); toast.success('Headline test finished'); tests.reload(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const pct = (v) => `${(abCtr(v) * 100).toFixed(1)}%`;
  const groups = REVIEW_STATUSES.map((s) => ({ s, items: (queue.data || []).filter((a) => a.status === s) }));

  return (
    <>
      <div className="page-head"><h1>Review desk</h1>
        <div className="seg" role="group" aria-label="Show">
          {[['all', 'Everything'], ['mine', 'Assigned to me'], ['unassigned', 'Unassigned']].map(([k, l]) => <button key={k} type="button" className={view === k ? 'is-on' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}
        </div>
      </div>
      {queue.error ? <ErrorState onRetry={queue.reload} /> : !queue.data ? <TableSkeleton /> : queue.data.length === 0 ? (
        <EmptyState icon="bi-inbox" title="Nothing waiting for review">Submitted articles appear here.</EmptyState>
      ) : groups.map((g) => g.items.length > 0 && (
        <section key={g.s} className="panel" aria-labelledby={`q-${g.s}`}>
          <h2 id={`q-${g.s}`}>{STATUS_LABEL[g.s]} <span className="chip-count">{g.items.length}</span></h2>
          <ul className="queue">
            {g.items.map((a) => {
              const opts = transitionsFor(a, user).filter((o) => ['in_review', 'approved', 'published'].includes(o.to));
              const last = (a.reviewNotes || []).at(-1);
              return (
                <li key={a._id} className="queue-item">
                  <div className="queue-body">
                    <p className="queue-head"><StatusBadge status={a.status} /><Link className="cell-title" to={`/admin/edit-news/${a._id}`}>{a.title}</Link></p>
                    <p className="meta">{(byId(a.categoryId) || {}).name} · by {a.author && a.author.name} · {a.submittedAt ? `submitted ${timeAgo(a.submittedAt)}` : `updated ${timeAgo(a.updatedAt)}`} · {a.assignedEditor ? `editor ${a.assignedEditor.name}` : 'unassigned'}</p>
                    {last && <p className="small muted">Last note ({last.byName}): {last.body}</p>}
                  </div>
                  <div className="row-actions">
                    {opts.map((o) => <button key={o.to} type="button" className="btn btn-secondary btn-sm" onClick={() => quick(a, o.to)}>{o.label}</button>)}
                    <Link to={`/admin/edit-news/${a._id}`} className="btn btn-primary btn-sm">Open</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="panel" aria-labelledby="ab-h">
        <h2 id="ab-h">Headline tests</h2>
        {!tests.data ? <TableSkeleton rows={2} /> : tests.data.length === 0 ? <p className="muted">No test is running. Add an alternative headline in the editor of a published story.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">Running headline tests</caption>
              <thead><tr><th scope="col">Headline A (shown to half)</th><th scope="col">Headline B</th><th scope="col" className="num">A: clicks / views</th><th scope="col" className="num">B: clicks / views</th><th scope="col"><span className="visually-hidden">Choose</span></th></tr></thead>
              <tbody>
                {tests.data.map((a) => {
                  const lead = abLeader(a.abTest);
                  return (
                    <tr key={a._id}>
                      <td data-label="Name"><Link to={`/admin/edit-news/${a._id}`}>{a.title}</Link></td>
                      <td data-label="B">{a.headlineB}</td>
                      <td data-label="A" className="num">{a.abTest.a.clicks} / {a.abTest.a.impressions} ({pct(a.abTest.a)}){lead === 'a' && <span className="badge badge-published">Leading</span>}</td>
                      <td data-label="B result" className="num">{a.abTest.b.clicks} / {a.abTest.b.impressions} ({pct(a.abTest.b)}){lead === 'b' && <span className="badge badge-published">Leading</span>}</td>
                      <td className="row-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => winner(a, 'a')}>Keep A</button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => winner(a, 'b')}>Use B</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">A leader is shown once both headlines have at least 20 impressions. Last refreshed {formatDateTime(new Date())}.</p>
      </section>
    </>
  );
}
