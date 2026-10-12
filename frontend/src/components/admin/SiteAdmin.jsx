import { useState } from 'react';
import { Link } from 'react-router-dom';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, TableSkeleton } from '../ui/States';
import PaginationComponent from '../layouts/PaginationComponent';
import { formatDateTime } from '../../lib/text';
import { AUDIT_LABEL } from '../../shared/rules';

// Alert banner (editors and admins) and site-wide settings (admins).
export function SettingsPage() {
  const { isAdmin } = useAuth();
  const { settings, reload } = useSettings();
  const toast = useToast();
  const [v, setV] = useState({ siteName: settings.siteName, tagline: settings.tagline, commentsOpen: settings.commentsOpen, newsletterEnabled: settings.newsletterEnabled, registrationOpen: settings.registrationOpen });
  const [a, setA] = useState({ ...settings.alert });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');

  const save = async (kind) => {
    setBusy(kind);
    setErrors({});
    try {
      await API.put('/settings', kind === 'alert' ? { alert: a } : { ...v }, { headers: authHeaders() });
      await reload();
      toast.success(kind === 'alert' ? 'Alert banner updated' : 'Settings saved');
    } catch (err) {
      const data = err.response && err.response.data;
      if (data && data.errors) setErrors(data.errors);
      toast.error(errorMessage(err));
    } finally { setBusy(''); }
  };
  const chk = (k) => (e) => setV({ ...v, [k]: e.target.checked });
  return (
    <>
      <div className="page-head"><h1>{isAdmin ? 'Settings' : 'Alert banner'}</h1></div>
      <div className="admin-grid two">
        <form className="panel" onSubmit={(e) => { e.preventDefault(); save('alert'); }} noValidate>
          <h2>Alert banner</h2>
          <p className="muted small">A bar above every page, updated live for readers who have the site open.</p>
          <label className="check"><input type="checkbox" checked={a.active} onChange={(e) => setA({ ...a, active: e.target.checked })} /> Show the banner</label>
          <div className="field"><label htmlFor="al-text">Text</label><input id="al-text" className={`input ${errors.alert ? 'is-invalid' : ''}`} value={a.text} maxLength={200} onChange={(e) => setA({ ...a, text: e.target.value })} />{errors.alert && <p className="field-error">{errors.alert}</p>}</div>
          <div className="field"><label htmlFor="al-link">Link (optional)</label><input id="al-link" className="input" value={a.link} placeholder="/category/world or https://…" onChange={(e) => setA({ ...a, link: e.target.value })} /></div>
          <div className="field"><label htmlFor="al-level">Style</label><select id="al-level" className="input" value={a.level} onChange={(e) => setA({ ...a, level: e.target.value })}><option value="breaking">Breaking (red)</option><option value="info">Information (blue)</option></select></div>
          <button type="submit" className="btn btn-primary" disabled={busy === 'alert'}>{busy === 'alert' ? 'Saving…' : 'Save banner'}</button>
        </form>
        {isAdmin && (
          <form className="panel" onSubmit={(e) => { e.preventDefault(); save('site'); }} noValidate>
            <h2>Site</h2>
            <div className="field"><label htmlFor="st-name">Site name</label><input id="st-name" className={`input ${errors.siteName ? 'is-invalid' : ''}`} value={v.siteName} onChange={(e) => setV({ ...v, siteName: e.target.value })} />{errors.siteName && <p className="field-error">{errors.siteName}</p>}</div>
            <div className="field"><label htmlFor="st-tag">Tagline</label><input id="st-tag" className="input" value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} />{errors.tagline && <p className="field-error">{errors.tagline}</p>}</div>
            <label className="check"><input type="checkbox" checked={v.commentsOpen} onChange={chk('commentsOpen')} /> Readers can comment</label>
            <label className="check"><input type="checkbox" checked={v.newsletterEnabled} onChange={chk('newsletterEnabled')} /> Newsletter sign-ups are open</label>
            <label className="check"><input type="checkbox" checked={v.registrationOpen} onChange={chk('registrationOpen')} /> New readers can register</label>
            <button type="submit" className="btn btn-primary" disabled={busy === 'site'}>{busy === 'site' ? 'Saving…' : 'Save settings'}</button>
          </form>
        )}
      </div>
    </>
  );
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const list = useAsync(() => API.get('/audit', { params: { page, limit: 25, action: action || undefined }, headers: authHeaders() }).then((r) => r.data), [page, action]);
  const data = list.data;
  return (
    <>
      <div className="page-head"><h1>Audit log</h1></div>
      <div className="panel">
        <div className="toolbar">
          <div className="field"><label htmlFor="au-a">Show</label>
            <select id="au-a" className="input" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">Everything</option>
              {Object.entries(AUDIT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        </div>
        {list.error ? <ErrorState onRetry={list.reload} /> : !data ? <TableSkeleton /> : data.entries.length === 0 ? <EmptyState icon="bi-journal-text" title="No entries yet" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Item</th></tr></thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e._id}>
                    <td data-label="When">{formatDateTime(e.at)}</td>
                    <td data-label="Who">{e.byName || 'Unknown'} <span className="badge">{e.byRole}</span></td>
                    <td data-label="What">{AUDIT_LABEL[e.action] || e.action}{e.detail && <span className="meta">{e.detail}</span>}</td>
                    <td data-label="Item">{e.targetType === 'article' && e.targetId ? <Link to={`/admin/edit-news/${e.targetId}`}>{e.targetLabel}</Link> : e.targetLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <PaginationComponent page={page} pages={data.pages} onChange={setPage} />}
      </div>
    </>
  );
}
