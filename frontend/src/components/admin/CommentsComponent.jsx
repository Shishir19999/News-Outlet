import { useState } from 'react';
import { Link } from 'react-router-dom';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import PaginationComponent from '../layouts/PaginationComponent';
import { EmptyState, ErrorState, TableSkeleton } from '../ui/States';
import { timeAgo, formatDateTime } from '../../lib/text';

const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']];

export default function CommentsComponent() {
  const confirm = useConfirm();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const list = useAsync(() => API.get('/comments/manage/list', { params: { status: status || undefined, page, limit: 10 }, headers: authHeaders() }).then((r) => r.data), [status, page]);

  const setState = async (c, next) => {
    try {
      await API.put(`/comments/${c._id}`, { status: next }, { headers: authHeaders() });
      toast.success(next === 'approved' ? 'Comment approved' : 'Comment rejected');
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
      <div className="page-head"><h1>Comments</h1><p className="muted">Comments from readers stay hidden until you approve them.</p></div>
      <div className="panel">
        <div className="seg" role="tablist" aria-label="Comment status">
          {TABS.map(([v, l]) => (
            <button key={l} type="button" role="tab" aria-selected={status === v} className={status === v ? 'is-on' : ''} onClick={() => { setStatus(v); setPage(1); }}>
              {l}{v === 'pending' && data && data.pending > 0 ? ` (${data.pending})` : ''}
            </button>
          ))}
        </div>
        {list.error ? <ErrorState onRetry={list.reload} /> : !data ? <TableSkeleton /> : data.comments.length === 0 ? (
          <EmptyState icon="bi-chat-left" title={status === 'pending' ? 'The queue is empty' : 'No comments here'}>Nothing needs your attention in this view.</EmptyState>
        ) : (
          <ul className="queue">
            {data.comments.map((c) => (
              <li key={c._id} className="queue-item">
                <div className="queue-body">
                  <p className="queue-head"><strong>{c.name}</strong> <span className={`badge badge-${c.status}`}>{c.status}</span> <time dateTime={c.createdAt} title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</time></p>
                  <p>{c.body}</p>
                  {c.news && <p className="meta">On <Link to={`/news-details/${c.news.slug}`}>{c.news.title}</Link></p>}
                </div>
                <div className="row-actions">
                  {c.status !== 'approved' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setState(c, 'approved')}><i className="bi bi-check-lg" aria-hidden="true" /> Approve</button>}
                  {c.status !== 'rejected' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setState(c, 'rejected')}><i className="bi bi-x-lg" aria-hidden="true" /> Reject</button>}
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(c)} aria-label={`Delete comment by ${c.name}`}><i className="bi bi-trash" aria-hidden="true" /></button>
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
