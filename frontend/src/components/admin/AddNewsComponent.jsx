import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoriesContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { ErrorState, Skeleton } from '../ui/States';
import { StatusBadge } from '../ui/Labels';
import LiveBlog from '../article/LiveBlog';
import { renderMarkdown } from '../../lib/markdown';
import { fromLocalInput, formatDateTime, readingTime, slugify, toLocalInput, wordCount } from '../../lib/text';
import { hasImage } from '../../lib/cover';
import { fileToDataUrl } from '../../demo/images';
import {
  KINDS, KIND_LABEL, RATINGS, RATING_LABEL, FIELD_LABEL, canEditArticle, diffSnapshots, transitionsFor, TRANSITION_LABEL, parseEmbed,
} from '../../shared/rules';
import { DEMO } from '../../config/env';

const EMPTY = {
  title: '', slug: '', categoryId: '', summary: '', description: '', kind: 'news', tags: '', sponsor: '', factClaim: '', factRating: 'mixed',
  embedUrl: '', embedTitle: '', imageAlt: '', headlineB: '', featured: false, breaking: false, pollQuestion: '', pollOptions: ['', ''], pollCloses: '', gallery: [],
};
const MAX_IMAGE = 8 * 1024 * 1024;
const TOOLS = [
  ['bi-type-bold', 'Bold', (s) => [`**${s || 'bold text'}**`, 2, s ? 0 : 9]],
  ['bi-type-italic', 'Italic', (s) => [`*${s || 'italic text'}*`, 1, s ? 0 : 11]],
  ['bi-type-h2', 'Heading', (s) => [`\n## ${s || 'Heading'}\n`, 4, s ? 0 : 7]],
  ['bi-link-45deg', 'Link', (s) => [`[${s || 'link text'}](https://example.com)`, 1, s ? 0 : 9]],
  ['bi-list-ul', 'Bulleted list', (s) => [`\n- ${s || 'item'}\n`, 3, s ? 0 : 4]],
  ['bi-quote', 'Quote', (s) => [`\n> ${s || 'quote'}\n`, 3, s ? 0 : 5]],
];

function fromArticle(a) {
  return {
    ...EMPTY, title: a.title, slug: a.slug, categoryId: a.categoryId, summary: a.summary, description: a.description || '', kind: a.kind || 'news', tags: (a.tags || []).join(', '),
    sponsor: a.sponsor || '', factClaim: a.factCheck ? a.factCheck.claim : '', factRating: a.factCheck ? a.factCheck.rating : 'mixed',
    embedUrl: a.embed ? a.embed.url : '', embedTitle: a.embed ? a.embed.title || '' : '', imageAlt: a.imageAlt || '', headlineB: a.headlineB || '', featured: !!a.featured, breaking: !!a.breaking,
    pollQuestion: a.poll ? a.poll.question : '', pollOptions: a.poll ? a.poll.options.map((o) => o.label) : ['', ''], pollCloses: a.poll && a.poll.closesAt ? toLocalInput(a.poll.closesAt) : '', gallery: a.gallery || [],
  };
}

// ---- diff view -------------------------------------------------------------------------------
function Words({ diff }) {
  return diff.map((d, i) => (d.type === 'add' ? <ins key={i}>{d.text}</ins> : d.type === 'del' ? <del key={i}>{d.text}</del> : <span key={i}>{d.text}</span>));
}
export function DiffView({ prev, next }) {
  const changes = diffSnapshots(prev, next);
  if (!changes.length) return <p className="muted">No differences.</p>;
  return (
    <div className="diff">
      {changes.map((c) => (
        <section key={c.field} className="diff-field">
          <h4>{FIELD_LABEL[c.field] || c.field}</h4>
          {c.kind === 'words' && <p className="diff-words"><Words diff={c.diff} /></p>}
          {c.kind === 'lines' && (
            <pre className="diff-lines">{c.diff.map((d, i) => <span key={i} className={`diff-${d.type}`}>{d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  '}{d.text}{'\n'}</span>)}</pre>
          )}
          {c.kind === 'value' && <p className="diff-values"><del>{JSON.stringify(c.from)}</del> <ins>{JSON.stringify(c.to)}</ins></p>}
        </section>
      ))}
    </div>
  );
}

function RevisionsPanel({ article, editable, onRestored }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(null);
  const list = useAsync(() => API.get(`/news/${article._id}/revisions`, { headers: authHeaders() }).then((r) => r.data.revisions), [article._id, article.updatedAt]);
  const revisions = list.data || [];
  const restore = async (r) => {
    if (!await confirm({ title: `Restore version ${r.version}?`, message: 'The current text is kept in the history, so you can go back again.', confirmLabel: 'Restore' })) return;
    try {
      const res = await API.post(`/news/${article._id}/revisions/${r._id}/restore`, null, { headers: authHeaders() });
      toast.success(res.data.message);
      onRestored();
    } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <div className="panel">
      <h2>Version history</h2>
      {list.error ? <p className="field-error">The history could not be loaded.</p> : !list.data ? <Skeleton className="skeleton-row" /> : (
        <ol className="revisions">
          {revisions.map((r, i) => (
            <li key={r._id}>
              <p><strong>Version {r.version}</strong> <span className="muted small">{r.byName || 'Unknown'} · {formatDateTime(r.createdAt)}</span><br />{r.note && <span className="small">{r.note}</span>}</p>
              <p className="row-actions">
                <button type="button" className="btn btn-secondary btn-sm" aria-expanded={open === r._id} onClick={() => setOpen(open === r._id ? null : r._id)}>{open === r._id ? 'Hide changes' : 'Show changes'}</button>
                {editable && i > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => restore(r)}>Restore</button>}
              </p>
              {open === r._id && <DiffView prev={revisions[i + 1] ? revisions[i + 1].snapshot : null} next={r.snapshot} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---- workflow ---------------------------------------------------------------------------------
function WorkflowPanel({ article, onChanged }) {
  const { user, isEditor } = useAuth();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [replyBusy, setReplyBusy] = useState(false);
  const editors = useAsync(() => (isEditor ? API.get('/authors').then((r) => r.data.filter((a) => a.role === 'editor' || a.role === 'admin')) : []), [isEditor]);
  const options = transitionsFor(article, user);
  const needsDate = options.some((o) => o.needsDate);

  const go = async (to) => {
    setErrors({});
    setBusy(true);
    try {
      const res = await API.post(`/news/${article._id}/transition`, { to, note, publishedAt: to === 'scheduled' ? fromLocalInput(when) : undefined }, { headers: authHeaders() });
      toast.success(`${TRANSITION_LABEL[to] || 'Updated'}: done`);
      setNote('');
      onChanged(res.data.article);
    } catch (err) {
      const data = err.response && err.response.data;
      if (data && data.errors) setErrors(data.errors);
      toast.error(errorMessage(err));
    } finally { setBusy(false); }
  };
  const addNote = async () => {
    if (!note.trim()) { setErrors({ note: 'Write a note first' }); return; }
    setReplyBusy(true);
    try {
      await API.post(`/news/${article._id}/notes`, { body: note }, { headers: authHeaders() });
      setNote('');
      onChanged();
    } catch (err) { toast.error(errorMessage(err)); } finally { setReplyBusy(false); }
  };
  const assign = async (editorId) => {
    try { await API.put(`/news/${article._id}/assign`, { editorId: editorId || null }, { headers: authHeaders() }); onChanged(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const notes = article.reviewNotes || [];
  return (
    <div className="panel workflow">
      <h2>Editorial workflow</h2>
      <p>Status: <StatusBadge status={article.status} />{article.status === 'scheduled' && <span className="muted small"> for {formatDateTime(article.publishedAt)}</span>}</p>
      {article.assignedEditor && <p className="small muted">Editor: {article.assignedEditor.name}</p>}
      {isEditor && (
        <div className="field">
          <label htmlFor="assign">Assigned editor</label>
          <select id="assign" className="input input-sm" value={article.assignedEditor ? article.assignedEditor._id : ''} onChange={(e) => assign(e.target.value)}>
            <option value="">Unassigned</option>
            {user && !(editors.data || []).some((x) => x._id === user._id) && user.role !== 'author' && <option value={user._id}>{user.name} (me)</option>}
            {(editors.data || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="wf-note">Note for the {isEditor ? 'author' : 'editor'}</label>
        <textarea id="wf-note" className={`input ${errors.note ? 'is-invalid' : ''}`} rows="3" value={note} onChange={(e) => setNote(e.target.value)} />
        {errors.note && <p className="field-error">{errors.note}</p>}
      </div>
      {needsDate && (
        <div className="field">
          <label htmlFor="wf-when">Schedule for</label>
          <input id="wf-when" type="datetime-local" className={`input ${errors.publishedAt ? 'is-invalid' : ''}`} value={when} onChange={(e) => setWhen(e.target.value)} />
          {errors.publishedAt && <p className="field-error">{errors.publishedAt}</p>}
        </div>
      )}
      <div className="editor-actions">
        {options.map((o) => (
          <button key={o.to} type="button" className={`btn btn-sm ${['published', 'approved', 'submitted', 'scheduled'].includes(o.to) ? 'btn-primary' : 'btn-secondary'}`} disabled={busy} onClick={() => go(o.to)}>{o.label}</button>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" disabled={replyBusy} onClick={addNote}>Add note only</button>
      </div>
      {options.length === 0 && <p className="muted small">No workflow actions are available to you for this article right now.</p>}
      {notes.length > 0 && (
        <ul className="notes" aria-label="Review conversation">
          {[...notes].reverse().map((n) => (
            <li key={n._id || n.at} className={`note note-${n.type}`}>
              <p className="small"><strong>{n.byName}</strong> <span className="badge">{n.byRole}</span> <span className="muted">{formatDateTime(n.at)}</span></p>
              <p>{n.type === 'changes' && <strong>Changes requested: </strong>}{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- gallery and poll -------------------------------------------------------------------------
function GalleryEditor({ items, onChange, disabled }) {
  const toast = useToast();
  const add = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    const next = [...items];
    for (const f of files) {
      if (next.length >= 20) { toast.error('A gallery can hold at most 20 pictures'); break; }
      if (!f.type.startsWith('image/') || f.size > MAX_IMAGE) { toast.error(`${f.name} is not an image up to 8 MB`); continue; }
      try {
        let src;
        if (DEMO) src = await fileToDataUrl(f);
        else {
          const form = new FormData();
          form.append('image', f);
          src = (await API.post('/upload', form, { headers: authHeaders() })).data.url;
        }
        if (src) next.push({ src, alt: '', caption: '' });
      } catch (err) { toast.error(errorMessage(err, 'The picture could not be added.')); }
    }
    onChange(next);
  };
  const patch = (i, p) => onChange(items.map((g, j) => (j === i ? { ...g, ...p } : g)));
  return (
    <div className="panel">
      <h2>Photo gallery</h2>
      {items.length === 0 && <p className="muted">No pictures. Add some to show a gallery under the story.</p>}
      <ul className="gallery-edit">
        {items.map((g, i) => (
          <li key={g.src.slice(-30) + i}>
            <img src={g.src} alt="" />
            <div>
              <label htmlFor={`g-alt-${i}`} className="small">Describe the picture (alternative text)</label>
              <input id={`g-alt-${i}`} className="input input-sm" value={g.alt} onChange={(e) => patch(i, { alt: e.target.value })} disabled={disabled} />
              <label htmlFor={`g-cap-${i}`} className="small">Caption</label>
              <input id={`g-cap-${i}`} className="input input-sm" value={g.caption || ''} onChange={(e) => patch(i, { caption: e.target.value })} disabled={disabled} />
              <button type="button" className="btn btn-danger btn-sm" disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove<span className="visually-hidden"> picture {i + 1}</span></button>
            </div>
          </li>
        ))}
      </ul>
      <label htmlFor="g-add" className={`btn btn-secondary btn-sm ${disabled ? 'is-disabled' : ''}`}>Add pictures</label>
      <input id="g-add" className="visually-hidden" type="file" accept="image/*" multiple disabled={disabled} onChange={add} />
    </div>
  );
}

// ---- main editor ------------------------------------------------------------------------------
function Editor({ article, id, onReload }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isEditor } = useAuth();
  const { categories } = useCategories();
  const [v, setV] = useState(() => (article ? fromArticle(article) : EMPTY));
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(null);
  const [tab, setTab] = useState('write');
  const area = useRef(null);
  const file = picked && picked.file;
  const editable = article ? canEditArticle(article, user) : true;
  const dirtyKey = JSON.stringify(v);
  const [saved, setSaved] = useState(dirtyKey);
  const dirty = dirtyKey !== saved || !!picked;

  useEffect(() => (picked ? () => URL.revokeObjectURL(picked.url) : undefined), [picked]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (k) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setV((x) => ({ ...x, [k]: value }));
    setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x));
  };
  const onTitle = (e) => {
    const title = e.target.value;
    setErrors((x) => ({ ...x, title: undefined, slug: undefined }));
    setV((x) => ({ ...x, title, slug: slugTouched ? x.slug : slugify(title) }));
  };
  const apply = (make) => {
    const el = area.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const [text, pre, sel] = make(v.description.slice(start, end));
    setV((x) => ({ ...x, description: v.description.slice(0, start) + text + v.description.slice(end) }));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + pre, start + pre + (sel || (end - start))); });
  };
  const pickFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErrors((x) => ({ ...x, image: 'Please choose an image file' })); return; }
    if (f.size > MAX_IMAGE) { setErrors((x) => ({ ...x, image: 'The image is larger than 8 MB' })); return; }
    setErrors((x) => ({ ...x, image: undefined }));
    setPicked({ file: f, url: URL.createObjectURL(f) });
  };

  const validate = () => {
    const f = {};
    if (!v.title.trim()) f.title = 'A headline is required';
    else if (v.title.length > 200) f.title = 'Keep the headline under 200 characters';
    if (!v.slug.trim()) f.slug = 'A URL slug is required';
    if (!v.categoryId) f.categoryId = 'Choose a section';
    if (!v.summary.trim()) f.summary = 'A short summary is required';
    else if (v.summary.length > 1000) f.summary = 'Keep the summary under 1000 characters';
    if (v.kind === 'sponsored' && !v.sponsor.trim()) f.sponsor = 'Name the sponsor';
    if (v.kind === 'fact-check' && !v.factClaim.trim()) f.factCheck = 'State the claim that was checked';
    if (v.embedUrl.trim() && !parseEmbed(v.embedUrl)) f.embed = 'Use a YouTube, Vimeo or direct audio file (https) link';
    if (v.gallery.some((g) => !g.alt.trim())) f.gallery = 'Describe every gallery picture';
    return f;
  };

  const save = async (submitAfter = false) => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) { document.getElementById(`e-${Object.keys(found)[0]}`)?.focus(); return; }
    const form = new FormData();
    const add = (k, val) => form.append(k, val);
    add('title', v.title.trim()); add('slug', v.slug.trim()); add('categoryId', v.categoryId); add('summary', v.summary.trim()); add('description', v.description);
    add('kind', v.kind); add('tags', JSON.stringify(v.tags.split(',').map((t) => t.trim()).filter(Boolean))); add('imageAlt', v.imageAlt.trim()); add('sponsor', v.kind === 'sponsored' ? v.sponsor.trim() : '');
    add('factCheck', v.kind === 'fact-check' ? JSON.stringify({ claim: v.factClaim.trim(), rating: v.factRating }) : 'null');
    add('embed', v.embedUrl.trim() ? JSON.stringify({ url: v.embedUrl.trim(), title: v.embedTitle.trim() }) : 'null');
    add('gallery', JSON.stringify(v.gallery));
    if (isEditor) {
      add('featured', v.featured ? 'true' : 'false'); add('breaking', v.breaking ? 'true' : 'false'); add('headlineB', v.headlineB.trim());
      const opts = v.pollOptions.map((o) => o.trim()).filter(Boolean);
      add('poll', v.pollQuestion.trim() || opts.length ? JSON.stringify({ question: v.pollQuestion.trim(), options: opts.map((label) => ({ label })), closesAt: v.pollCloses ? fromLocalInput(v.pollCloses) : null }) : 'null');
    }
    if (!id && submitAfter) add('status', 'submitted');
    if (file) add('image', file);
    setBusy(true);
    try {
      const res = id ? await API.put(`/news/${id}`, form, { headers: authHeaders() }) : await API.post('/news', form, { headers: authHeaders() });
      toast.success(res.data.message || 'Saved');
      setSaved(dirtyKey);
      setPicked(null);
      if (!id) navigate(`/admin/edit-news/${res.data.id}`, { replace: true });
      else onReload();
    } catch (err) {
      const data = err.response && err.response.data;
      if (data && data.errors) setErrors(data.errors);
      else toast.error(errorMessage(err, 'The article could not be saved.'));
    } finally { setBusy(false); }
  };

  const shownImage = picked ? picked.url : (article && hasImage(article.image) ? article.image : '');
  const err = (k) => errors[k] && <p id={`e-${k}-err`} className="field-error">{errors[k]}</p>;
  const props = (k) => ({ id: `e-${k}`, className: `input ${errors[k] ? 'is-invalid' : ''}`, value: v[k], onChange: set(k), 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `e-${k}-err` : undefined });

  return (
    <div className="editor">
      <div className="editor-main">
        {!editable && <p className="notice notice-warn" role="status"><i className="bi bi-lock" aria-hidden="true" /> This article is locked for you ({article.status.replace('_', ' ')}). {isEditor ? '' : 'Ask an editor, or use the workflow panel to withdraw it.'}</p>}
        <form onSubmit={(e) => { e.preventDefault(); save(false); }} noValidate>
          <fieldset className="plain-fieldset" disabled={!editable}>
            <div className="panel">
              <div className="field">
                <label htmlFor="e-title">Headline</label>
                <input {...props('title')} onChange={onTitle} maxLength={200} />
                {err('title')}
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="e-slug">URL slug</label>
                  <input {...props('slug')} onChange={(e) => { setSlugTouched(true); set('slug')(e); }} />
                  {err('slug')}
                </div>
                <div className="field">
                  <label htmlFor="e-categoryId">Section</label>
                  <select {...props('categoryId')}>
                    <option value="">Select…</option>
                    {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                  {err('categoryId')}
                </div>
                <div className="field">
                  <label htmlFor="e-kind">Type</label>
                  <select {...props('kind')}>
                    {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                </div>
              </div>
              {v.kind === 'sponsored' && (
                <div className="field"><label htmlFor="e-sponsor">Sponsor</label><input {...props('sponsor')} maxLength={100} />{err('sponsor')}</div>
              )}
              {v.kind === 'fact-check' && (
                <div className="form-row">
                  <div className="field"><label htmlFor="e-factClaim">Claim that was checked</label><input {...props('factClaim')} maxLength={300} />{err('factCheck')}</div>
                  <div className="field"><label htmlFor="e-factRating">Verdict</label><select {...props('factRating')}>{RATINGS.map((r) => <option key={r} value={r}>{RATING_LABEL[r]}</option>)}</select></div>
                </div>
              )}
              <div className="field">
                <label htmlFor="e-summary">Summary</label>
                <textarea {...props('summary')} rows="3" />
                <p className="field-hint">{v.summary.length}/1000. Shown on cards and in search results.</p>
                {err('summary')}
              </div>
              <div className="field">
                <label htmlFor="e-tags">Tags</label>
                <input {...props('tags')} />
                <p className="field-hint">Separate with commas. Tags make topic pages and improve search. Leave empty to derive them from the headline.</p>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>Article body</h2>
                <div className="seg" role="tablist" aria-label="Editor view">
                  <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'is-on' : ''} onClick={() => setTab('write')}>Write</button>
                  <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'is-on' : ''} onClick={() => setTab('preview')}>Preview</button>
                </div>
              </div>
              <div className="md-toolbar" role="toolbar" aria-label="Formatting">
                {TOOLS.map(([icon, label, make]) => (
                  <button key={label} type="button" className="icon-btn" title={label} aria-label={label} onClick={() => apply(make)}><i className={`bi ${icon}`} aria-hidden="true" /></button>
                ))}
                <span className="md-count">{wordCount(v.description)} words · {readingTime(v.description)} min read</span>
              </div>
              <div className={`md-split show-${tab}`}>
                <div className="md-pane md-write">
                  <label htmlFor="e-description" className="visually-hidden">Article body in Markdown</label>
                  <textarea id="e-description" ref={area} className="input md-input" rows="16" value={v.description} onChange={set('description')} placeholder="Write in Markdown. Use # headings, **bold**, lists and > quotes." />
                </div>
                <div className="md-pane md-preview" aria-live="polite">
                  <p className="md-preview-label">Live preview</p>
                  {v.description.trim() ? <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(v.description) }} /> : <p className="muted">Nothing to preview yet.</p>}
                </div>
              </div>
            </div>

            <div className="panel">
              <h2>Video or audio</h2>
              <div className="form-row">
                <div className="field"><label htmlFor="e-embedUrl">YouTube, Vimeo or audio file link</label><input {...props('embedUrl')} placeholder="https://…" />{err('embed')}</div>
                <div className="field"><label htmlFor="e-embedTitle">Title of the media</label><input {...props('embedTitle')} maxLength={120} /></div>
              </div>
              <p className="field-hint">Embeds load only when a reader presses play (privacy-enhanced, no tracking before that).</p>
            </div>

            <GalleryEditor items={v.gallery} onChange={(gallery) => setV((x) => ({ ...x, gallery }))} disabled={!editable} />
            {errors.gallery && <p className="field-error" role="alert">{errors.gallery}</p>}

            {isEditor && (
              <div className="panel">
                <h2>Reader poll</h2>
                <div className="field"><label htmlFor="e-pollQuestion">Question</label><input {...props('pollQuestion')} maxLength={200} />{err('poll')}</div>
                {v.pollOptions.map((o, i) => (
                  <div className="field" key={i}>
                    <label htmlFor={`poll-o-${i}`}>Answer {i + 1}</label>
                    <input id={`poll-o-${i}`} className="input" value={o} maxLength={80} onChange={(e) => setV((x) => ({ ...x, pollOptions: x.pollOptions.map((p, j) => (j === i ? e.target.value : p)) }))} />
                  </div>
                ))}
                <p className="editor-actions">
                  {v.pollOptions.length < 6 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setV((x) => ({ ...x, pollOptions: [...x.pollOptions, ''] }))}>Add answer</button>}
                  {v.pollOptions.length > 2 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setV((x) => ({ ...x, pollOptions: x.pollOptions.slice(0, -1) }))}>Remove last answer</button>}
                </p>
                <div className="field"><label htmlFor="e-pollCloses">Closes at (optional)</label><input {...props('pollCloses')} type="datetime-local" /></div>
              </div>
            )}

            <div className="editor-actions sticky-actions">
              <button type="submit" className="btn btn-primary" disabled={busy || !editable}>{busy ? 'Saving…' : id ? 'Save changes' : 'Save draft'}</button>
              {!id && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => save(true)}>Save and submit for review</button>}
              <Link to="/admin/show-news" className="btn btn-secondary">{dirty ? 'Discard' : 'Close'}</Link>
              {dirty && <span className="muted small" role="status">Unsaved changes</span>}
            </div>
          </fieldset>
        </form>
      </div>

      <aside className="editor-side">
        {article && <WorkflowPanel article={article} onChanged={onReload} />}
        {!article && <div className="panel"><h2>Workflow</h2><p className="muted small">Save the draft first. Then you can submit it for review, discuss it with an editor and see the version history.</p></div>}
        <div className="panel">
          <h2>Cover image</h2>
          {shownImage ? <img className="image-preview" src={shownImage} alt="Cover preview" /> : <p className="muted">No image: artwork is drawn from the headline.</p>}
          <div className="field">
            <label htmlFor="e-image" className="btn btn-secondary btn-sm">{shownImage ? 'Replace image' : 'Upload image'}</label>
            <input id="e-image" className="visually-hidden" type="file" accept="image/*" onChange={pickFile} disabled={!editable} />
            {err('image')}
          </div>
          <div className="field">
            <label htmlFor="e-imageAlt">Image description (alternative text)</label>
            <input {...props('imageAlt')} maxLength={200} disabled={!editable} />
          </div>
        </div>
        {isEditor && (
          <div className="panel">
            <h2>Front page</h2>
            <label className="check"><input type="checkbox" checked={v.featured} onChange={set('featured')} /> Feature on the homepage</label>
            <label className="check"><input type="checkbox" checked={v.breaking} onChange={set('breaking')} /> Breaking news (ticker)</label>
            <div className="field">
              <label htmlFor="e-headlineB">Alternative headline (A/B test)</label>
              <input {...props('headlineB')} maxLength={200} />
              <p className="field-hint">Half of the readers see this one on cards. Results appear in the Review desk. Saving a new alternative restarts the test.</p>
            </div>
          </div>
        )}
        {article && article.kind === 'live' && <div className="panel"><LiveBlog article={article} /></div>}
        {article && <RevisionsPanel article={article} editable={editable} onRestored={onReload} />}
      </aside>
    </div>
  );
}

export default function AddNewsComponent() {
  const { id } = useParams();
  const { isAuthor } = useAuth();
  const article = useAsync(() => (id ? API.get(`/news/${id}`, { headers: authHeaders() }).then((r) => r.data) : null), [id]);
  if (!isAuthor) return <><div className="page-head"><h1>Article</h1></div><ErrorState title="Writers only" message="Your account can read and comment. Ask an admin for author access to write articles." /></>;
  if (article.error) return <><div className="page-head"><h1>Article</h1></div><ErrorState onRetry={article.reload} message="This article could not be loaded, or you do not have access to it." /></>;
  if (id && !article.data) return <div role="status" aria-label="Loading"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-chart" /></div>;
  const a = article.data;
  return (
    <>
      <div className="page-head"><h1>{id ? 'Edit article' : 'New article'}</h1>{a && <Link to={`/news-details/${a.slug}`} className="btn btn-secondary btn-sm"><i className="bi bi-eye" aria-hidden="true" /> View</Link>}</div>
      <Editor key={id ? `${id}-${a.updatedAt}-${a.status}-${(a.reviewNotes || []).length}-${a.assignedEditor ? a.assignedEditor._id : ''}` : 'new'} article={a} id={id} onReload={article.reload} />
    </>
  );
}
