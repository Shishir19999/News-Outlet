import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoriesContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import PaginationComponent from '../layouts/PaginationComponent';
import { EmptyState, ErrorState, TableSkeleton } from '../ui/States';
import { formatDateTime, formatNumber, statusOf } from '../../lib/text';

const STATUS_LABEL = { published: 'Published', draft: 'Draft', scheduled: 'Scheduled' };

export default function ShowNewsComponent() {
  const { isAdmin } = useAuth();
  const { byId } = useCategories();
  const confirm = useConfirm();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearch(draft.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [draft]);

  const list = useAsync(() => API.get('/news/manage/list', {
    params: { page, limit: 10, search: search || undefined, status: status || undefined }, headers: authHeaders(),
  }).then((r) => r.data), [page, search, status]);

  const remove = async (item) => {
    const ok = await confirm({ title: 'Delete this article?', message: `"${item.title}" and its comments will be removed permanently.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await API.delete(`/news/${item._id}`, { headers: authHeaders() });
      toast.success('Article deleted');
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err, 'The article could not be deleted.'));
    }
  };

  const publish = async (item) => {
    const form = new FormData();
    form.append('status', 'published');
    try {
      await API.put(`/news/${item._id}`, form, { headers: authHeaders() });
      toast.success('Article published');
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const data = list.data;
  return (
    <>
      <div className="page-head">
        <h1>Articles</h1>
        <Link to="/admin/add-news" className="btn btn-primary"><i className="bi bi-plus-lg" aria-hidden="true" /> New article</Link>
      </div>
      <div className="panel">
        <div className="toolbar">
          <div className="field">
            <label htmlFor="a-search" className="visually-hidden">Search articles</label>
            <input id="a-search" type="search" className="input" placeholder="Search by title or summary" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-status" className="visually-hidden">Filter by status</label>
            <select id="a-status" className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
        </div>
        {list.error ? <ErrorState onRetry={list.reload} /> : !data ? <TableSkeleton rows={6} /> : data.news.length === 0 ? (
          <EmptyState icon="bi-newspaper" title="No articles found" action={<Link to="/admin/add-news" className="btn btn-primary">Write the first one</Link>}>
            Try another search or status filter.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">Articles</caption>
              <thead><tr><th scope="col">Article</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col" className="num">Views</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {data.news.map((item) => {
                  const st = statusOf(item);
                  return (
                    <tr key={item._id}>
                      <td data-label="Article">
                        <Link to={`/news-details/${item.slug}`} className="cell-title">{item.title}</Link>
                        <span className="meta">{item.slug}{item.featured ? ' · featured' : ''}</span>
                      </td>
                      <td data-label="Category">{(byId(item.categoryId) || {}).name || '-'}</td>
                      <td data-label="Status">
                        <span className={`badge badge-${st}`}>{STATUS_LABEL[st]}</span>
                        {st === 'scheduled' && <span className="meta">{formatDateTime(item.publishedAt)}</span>}
                      </td>
                      <td data-label="Views" className="num">{formatNumber(item.views)}</td>
                      <td className="row-actions">
                        {isAdmin ? (
                          <>
                            {st !== 'published' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => publish(item)}>Publish</button>}
                            <Link to={`/admin/edit-news/${item._id}`} className="btn btn-secondary btn-sm" aria-label={`Edit ${item.title}`}><i className="bi bi-pencil" aria-hidden="true" /> Edit</Link>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(item)} aria-label={`Delete ${item.title}`}><i className="bi bi-trash" aria-hidden="true" /></button>
                          </>
                        ) : <span className="muted">Admin only</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && <PaginationComponent page={page} pages={data.pages} onChange={setPage} />}
      </div>
    </>
  );
}
