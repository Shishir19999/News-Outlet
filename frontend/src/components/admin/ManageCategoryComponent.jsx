import { useState } from 'react';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoriesContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, TableSkeleton } from '../ui/States';

const BLANK = { name: '', description: '' };

export default function ManageCategoryComponent() {
  const { isAdmin } = useAuth();
  const shared = useCategories();
  const confirm = useConfirm();
  const toast = useToast();
  const list = useAsync(() => API.get('/category').then((r) => r.data), []);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return <ErrorState title="Admins only" message="Only administrators can manage categories." />;

  const refresh = () => { list.reload(); shared.reload(); };
  const reset = () => { setForm(BLANK); setEditing(null); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('A category name is required'); return; }
    setError('');
    setBusy(true);
    try {
      const body = { name: form.name.trim(), description: form.description.trim() };
      if (editing) await API.put(`/category/${editing}`, body, { headers: authHeaders() });
      else await API.post('/category', body, { headers: authHeaders() });
      toast.success(editing ? 'Category updated' : 'Category created');
      reset();
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    if (!await confirm({ title: `Delete "${c.name}"?`, message: 'Categories that still contain articles cannot be deleted.', confirmLabel: 'Delete', danger: true })) return;
    try {
      await API.delete(`/category/${c._id}`, { headers: authHeaders() });
      toast.success('Category deleted');
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, 'The category could not be deleted.'));
    }
  };

  return (
    <>
      <div className="page-head"><h1>Categories</h1></div>
      <div className="admin-grid two">
        <form className="panel" onSubmit={submit} noValidate>
          <h2>{editing ? 'Edit category' : 'Add a category'}</h2>
          <div className="field">
            <label htmlFor="cat-name">Name</label>
            <input id="cat-name" className={`input ${error ? 'is-invalid' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!error} aria-describedby={error ? 'cat-err' : undefined} />
            {error && <p id="cat-err" className="field-error" role="alert">{error}</p>}
          </div>
          <div className="field">
            <label htmlFor="cat-desc">Description</label>
            <textarea id="cat-desc" className="input" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="editor-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>{editing ? 'Save changes' : 'Add category'}</button>
            {editing && <button type="button" className="btn btn-secondary" onClick={reset}>Cancel</button>}
          </div>
        </form>
        <div className="panel">
          <h2>All categories</h2>
          {list.error ? <ErrorState onRetry={list.reload} /> : !list.data ? <TableSkeleton rows={4} /> : list.data.length === 0 ? (
            <EmptyState icon="bi-tags" title="No categories yet">Add the first one with the form.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <caption className="visually-hidden">Categories</caption>
                <thead><tr><th scope="col">Name</th><th scope="col" className="num">Articles</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>
                  {list.data.map((c) => (
                    <tr key={c._id}>
                      <td data-label="Name"><span className="cell-title">{c.name}</span><span className="meta">{c.description}</span></td>
                      <td data-label="Articles" className="num">{c.newsCount}</td>
                      <td className="row-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditing(c._id); setForm({ name: c.name, description: c.description || '' }); setError(''); }} aria-label={`Edit ${c.name}`}><i className="bi bi-pencil" aria-hidden="true" /> Edit</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><i className="bi bi-trash" aria-hidden="true" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
