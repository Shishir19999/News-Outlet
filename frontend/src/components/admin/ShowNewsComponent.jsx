import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoriesContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import PaginationComponent from '../layouts/PaginationComponent';
import { StatusBadge } from '../ui/Labels';
import { EmptyState, ErrorState, TableSkeleton } from '../ui/States';
import { formatDate, formatNumber } from '../../lib/text';
import { STATUSES, STATUS_LABEL, KIND_LABEL } from '../../shared/rules';

const TABS = [['', 'All'], ['draft', 'Drafts'], ['review', 'In review'], ['changes_requested', 'Changes requested'], ['approved', 'Approved'], ['scheduled', 'Scheduled'], ['published', 'Published'], ['archived', 'Archived']];

export default function ShowNewsComponent() {
  const { isAdmin, isEditor } = useAuth();
  const { byId } = useCategories();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const list = useAsync(() => API.get('/news/manage/list', { params: { page, limit: 10, search: search || undefined, status: status || undefined }, headers: authHeaders() }).then((r) => r.data), [page, search, status]);
  const data = list.data;
  const counts = data ? data.counts : {};
  const review = ['submitted', 'in_review'].reduce((a, k) => a + (counts[k] || 0), 0);

  const remove = async (a) => {
    if (!await confirm({ title: 'Delete this article?', message: `"${a.title}" and its comments will be removed for good.`, confirmLabel: 'Delete', danger: true })) return;
    try { await API.delete(`/news/${a._id}`, { headers: authHeaders() }); toast.success('Article deleted'); list.reload(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const countFor = (k) => (k === '' ? Object.values(counts).reduce((a, b) => a + b, 0) : k === 'review' ? review : counts[k] || 0);

  return (
    <>
      <div className="page-head">
        <h1>{isEditor ? 'All articles' : 'My articles'}</h1>
        <Link to="/admin/add-news" className="btn btn-primary"><i className="bi bi-plus-circle" aria-hidden="true" /> New article</Link>
      </div>
      <div className="panel">
        <div className="seg seg-wrap" role="group" aria-label="Filter by status">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" className={status === k ? 'is-on' : ''} aria-pressed={status === k} onClick={() => { setPage(1); setParams(k ? { status: k } : {}); }}>{label} <span className="chip-count">{countFor(k)}</span></button>
          ))}
        </div>
        <div className="toolbar">
          <div className="field"><label htmlFor="s-q" className="visually-hidden">Search articles</label><input id="s-q" type="search" className="input" placeholder="Search by headline or summary" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {list.error ? <ErrorState onRetry={list.reload} /> : !data ? <TableSkeleton /> : data.news.length === 0 ? (
          <EmptyState icon="bi-newspaper" title="No articles here" action={<Link to="/admin/add-news" className="btn btn-primary">Write one</Link>}>{status ? 'Nothing has this status.' : 'Create the first article.'}</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Article</th><th scope="col">Status</th><th scope="col">Section</th><th scope="col" className="num">Views</th><th scope="col">Updated</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {data.news.map((a) => (
                  <tr key={a._id}>
                    <td data-label="Article">
                      <Link className="cell-title" to={`/admin/edit-news/${a._id}`}>{a.title}</Link>
                      <span className="meta">{a.author && a.author.name}{a.kind !== 'news' && ` · ${KIND_LABEL[a.kind]}`}{a.breaking ? ' · Breaking' : ''}</span>
                    </td>
                    <td data-label="Status"><StatusBadge status={a.status} />{a.assignedEditor && <span className="meta">Editor: {a.assignedEditor.name}</span>}</td>
                    <td data-label="Section">{(byId(a.categoryId) || {}).name || '-'}</td>
                    <td data-label="Views" className="num">{formatNumber(a.views)}</td>
                    <td data-label="Updated">{formatDate(a.updatedAt)}</td>
                    <td className="row-actions">
                      <Link to={`/admin/edit-news/${a._id}`} className="btn btn-secondary btn-sm">Open<span className="visually-hidden"> {a.title}</span></Link>
                      {isAdmin && <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(a)}>Delete<span className="visually-hidden"> {a.title}</span></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <PaginationComponent page={page} pages={data.pages} onChange={setPage} />}
      </div>
      <p className="muted small">Statuses: {STATUSES.map((s) => STATUS_LABEL[s]).join(' → ')}</p>
    </>
  );
}
