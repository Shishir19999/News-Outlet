import { useState } from 'react';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useCategories } from '../../context/CategoriesContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, TableSkeleton } from '../ui/States';
import { formatDate } from '../../lib/text';
import { DEMO } from '../../config/env';
import { Link } from 'react-router-dom';

function Compose({ articles, onSent }) {
  const toast = useToast();
  const { categories } = useCategories();
  const [v, setV] = useState({ subject: '', intro: '', articleIds: [], topics: [] });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const toggle = (k, id) => setV((x) => ({ ...x, [k]: x[k].includes(id) ? x[k].filter((i) => i !== id) : [...x[k], id] }));
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await API.post('/newsletter/send', v, { headers: authHeaders() });
      toast.success(`Sent to ${res.data.sent} ${res.data.sent === 1 ? 'subscriber' : 'subscribers'}${res.data.failed ? `, ${res.data.failed} failed` : ''}`);
      onSent();
    } catch (err) {
      const data = err.response && err.response.data;
      if (data && data.errors) setErrors(data.errors);
      toast.error(errorMessage(err));
    } finally { setBusy(false); }
  };
  return (
    <form className="panel" onSubmit={send} noValidate>
      <h2>Send a digest</h2>
      <p className="muted small">{DEMO ? <>In the live preview the messages go to the <Link to="/inbox">Preview inbox</Link>.</> : 'Goes to confirmed subscribers through your SMTP settings.'}</p>
      <div className="field"><label htmlFor="n-subject">Subject</label><input id="n-subject" className={`input ${errors.subject ? 'is-invalid' : ''}`} value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} />{errors.subject && <p className="field-error">{errors.subject}</p>}</div>
      <div className="field"><label htmlFor="n-intro">Introduction (optional)</label><textarea id="n-intro" className="input" rows="3" value={v.intro} onChange={(e) => setV({ ...v, intro: e.target.value })} /></div>
      <fieldset className="plain-fieldset">
        <legend className="small"><strong>Only subscribers interested in</strong> (none selected: everyone)</legend>
        {categories.map((c) => <label key={c._id} className="check"><input type="checkbox" checked={v.topics.includes(c._id)} onChange={() => toggle('topics', c._id)} /> {c.name}</label>)}
      </fieldset>
      <fieldset className="plain-fieldset">
        <legend className="small"><strong>Stories to include</strong></legend>
        {articles.map((a) => <label key={a._id} className="check"><input type="checkbox" checked={v.articleIds.includes(a._id)} onChange={() => toggle('articleIds', a._id)} /> {a.title}</label>)}
        {errors.articleIds && <p className="field-error">{errors.articleIds}</p>}
      </fieldset>
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send digest'}</button>
    </form>
  );
}

export default function SubscribersComponent() {
  const toast = useToast();
  const confirm = useConfirm();
  const list = useAsync(() => API.get('/newsletter', { headers: authHeaders() }).then((r) => r.data), []);
  const latest = useAsync(() => API.get('/news', { params: { limit: 8 } }).then((r) => r.data.news), []);
  const { byId } = useCategories();
  const remove = async (s) => {
    if (!await confirm({ title: 'Remove this subscriber?', message: `${s.email} will no longer receive the newsletter.`, confirmLabel: 'Remove', danger: true })) return;
    try { await API.delete(`/newsletter/${s._id}`, { headers: authHeaders() }); toast.success('Subscriber removed'); list.reload(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const data = list.data;
  return (
    <>
      <div className="page-head"><h1>Newsletter</h1>{data && <p className="muted">{data.filter((s) => s.confirmed).length} confirmed · {data.filter((s) => !s.confirmed).length} waiting for confirmation</p>}</div>
      <div className="admin-grid two">
        {latest.data ? <Compose articles={latest.data} onSent={list.reload} /> : <TableSkeleton rows={3} />}
        <div className="panel">
          <h2>Subscribers</h2>
          {list.error ? <ErrorState onRetry={list.reload} /> : !data ? <TableSkeleton /> : data.length === 0 ? <EmptyState icon="bi-envelope" title="No subscribers yet">Sign-ups from the website appear here.</EmptyState> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Topics</th><th scope="col">Joined</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
                <tbody>
                  {data.map((s) => (
                    <tr key={s._id}>
                      <td data-label="Name">{s.email}</td>
                      <td data-label="Status"><span className={`badge ${s.confirmed ? 'badge-published' : 'badge-pending'}`}>{s.confirmed ? 'confirmed' : 'pending'}</span></td>
                      <td data-label="Topics">{s.topics && s.topics.length ? s.topics.map((t) => (byId(t) || {}).name).filter(Boolean).join(', ') : 'Everything'}</td>
                      <td data-label="Joined">{formatDate(s.createdAt)}</td>
                      <td className="row-actions"><button type="button" className="btn btn-danger btn-sm" onClick={() => remove(s)}>Remove<span className="visually-hidden"> {s.email}</span></button></td>
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
