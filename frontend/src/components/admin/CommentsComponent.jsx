import { useState } from 'react';
import { Link } from 'react-router-dom';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import PaginationComponent from '../layouts/PaginationComponent';
import { EmptyState, ErrorState, TableSkeleton } from '../ui/States';
import { timeAgo, formatDateTime } from '../../lib/text';

const TABS = [['pending', 'Pending'], ['reported', 'Reported'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']];

export default function CommentsComponent() {
  const confirm = useConfirm();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const list = useAsync(() => API.get('/comments/manage/list', { params: { status: status || undefined, page, limit: 10 }, headers: authHeaders() }).then((r) => r.data), [status, page]);

  const update = async (c, body, message) => {
    try {
      await API.put(`/comments/${c._id}`, body, { headers: authHeaders() });
      toast.success(message);
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const remove = async (c) => {
    if (!await confirm({ title: 'Delete this comment?', message: `The comment by ${c.name} will be removed permanently.`, confirmLabel: 'Delete', danger: true })) return;
    try {
      await API.delete(`/comments/${c._id}`, { headers: authHeaders() });
      toast.success('Comment deleted');
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const data = list.data;
  return (
    <>
      <div className="page-head"><h1>Comments</h1>{data && <p className="muted">{data.pending} waiting · {data.reported} reported</p>}</div>
      <div className="panel">
        <div className="seg seg-wrap" role="group" aria-label="Filter comments">
          {TABS.map(([k, l]) => <button key={k} type="button" className={status === k ? 'is-on' : ''} aria-pressed={status === k} onClick={() => { setStatus(k); setPage(1); }}>{l}</button>)}
        </div>
        {list.error ? <ErrorState onRetry={list.reload} /> : !data ? <TableSkeleton /> : data.comments.length === 0 ? (
          <EmptyState icon="bi-chat-left" title="Nothing here">No comments in this list.</EmptyState>
        ) : (
          <ul className="queue">
            {data.comments.map((c) => (
              <li key={c._id} className="queue-item">
                <div className="queue-body">
                  <p className="queue-head">
                    <strong>{c.name}</strong>
                    <span className={`badge badge-${c.status}`}>{c.status}</span>
                    {c.parentId && <span className="badge">reply</span>}
                    {c.reports.length > 0 && <span className="badge badge-rejected">{c.reports.length} {c.reports.length === 1 ? 'report' : 'reports'}: {[...new Set(c.reports.map((r) => r.reason))].join(', ')}</span>}
                    <time dateTime={c.createdAt} title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</time>
                  </p>
                  <p>{c.body}</p>
                  {c.news && <p className="meta">On <Link to={`/news-details/${c.news.slug}`}>{c.news.title}</Link></p>}
                </div>
                <div className="row-actions">
                  {c.status !== 'approved' && <button type="button" className="btn btn-primary btn-sm" onClick={() => update(c, { status: 'approved', clearReports: true }, 'Comment approved')}>Approve</button>}
                  {c.status !== 'rejected' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => update(c, { status: 'rejected' }, 'Comment rejected')}>Reject</button>}
                  {c.reports.length > 0 && c.status === 'approved' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => update(c, { clearReports: true }, 'Reports dismissed')}>Dismiss reports</button>}
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(c)}>Delete<span className="visually-hidden"> comment by {c.name}</span></button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && <PaginationComponent page={page} pages={data.pages} onChange={setPage} />}
      </div>
    </>
  );
}
