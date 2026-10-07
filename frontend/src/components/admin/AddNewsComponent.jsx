import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoriesContext';
import { useToast } from '../../context/ToastContext';
import { ErrorState, Skeleton } from '../ui/States';
import { renderMarkdown } from '../../lib/markdown';
import { fromLocalInput, readingTime, slugify, toLocalInput, wordCount } from '../../lib/text';
import { hasImage } from '../../lib/cover';

const EMPTY = { title: '', slug: '', categoryId: '', summary: '', description: '', status: 'draft', publishedAt: '', featured: false };
const MAX_IMAGE = 8 * 1024 * 1024;

const TOOLS = [
  ['bi-type-bold', 'Bold', (s) => [`**${s || 'bold text'}**`, 2, s ? 0 : 9]],
  ['bi-type-italic', 'Italic', (s) => [`*${s || 'italic text'}*`, 1, s ? 0 : 11]],
  ['bi-type-h2', 'Heading', (s) => [`\n## ${s || 'Heading'}\n`, 4, s ? 0 : 7]],
  ['bi-link-45deg', 'Link', (s) => [`[${s || 'link text'}](https://example.com)`, 1, s ? 0 : 9]],
  ['bi-list-ul', 'Bulleted list', (s) => [`\n- ${s || 'item'}\n`, 3, s ? 0 : 4]],
  ['bi-quote', 'Quote', (s) => [`\n> ${s || 'quote'}\n`, 3, s ? 0 : 5]],
];

function Editor({ initial, id }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { categories } = useCategories();
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(null);
  const file = picked && picked.file;
  const preview = picked ? picked.url : '';
  const [tab, setTab] = useState('write');
  const area = useRef(null);

  // the object URL is released when a new file replaces it or the editor closes
  useEffect(() => (picked ? () => URL.revokeObjectURL(picked.url) : undefined), [picked]);

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
    const next = v.description.slice(0, start) + text + v.description.slice(end);
    setV((x) => ({ ...x, description: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + pre, start + pre + (sel || (end - start)));
    });
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
    if (!v.categoryId) f.categoryId = 'Choose a category';
    if (!v.summary.trim()) f.summary = 'A short summary is required';
    else if (v.summary.length > 1000) f.summary = 'Keep the summary under 1000 characters';
    if (v.status === 'scheduled') {
      if (!v.publishedAt) f.publishedAt = 'Choose when the article should go live';
      else if (new Date(v.publishedAt).getTime() <= Date.now()) f.publishedAt = 'Pick a time in the future, or publish now';
    }
    return f;
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`e-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    const form = new FormData();
    ['title', 'slug', 'categoryId', 'summary', 'description', 'status'].forEach((k) => form.append(k, v[k].trim ? v[k].trim() : v[k]));
    form.append('featured', v.featured ? 'true' : 'false');
    if (v.status === 'scheduled') form.append('publishedAt', fromLocalInput(v.publishedAt));
    if (file) form.append('image', file);
    setBusy(true);
    try {
      const res = id
        ? await API.put(`/news/${id}`, form, { headers: authHeaders() })
        : await API.post('/news', form, { headers: authHeaders() });
      toast.success(res.data.message || 'Saved');
      navigate('/admin/show-news');
    } catch (err) {
      const data = err.response && err.response.data;
      if (data && data.errors) setErrors(data.errors);
      else if (data && data.slug) setErrors({ slug: data.slug });
      else toast.error(errorMessage(err, 'The article could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const shownImage = preview || (hasImage(initial.image) ? initial.image : '');
  const err = (k) => errors[k] && <p id={`e-${k}-err`} className="field-error">{errors[k]}</p>;
  const props = (k) => ({ id: `e-${k}`, className: `input ${errors[k] ? 'is-invalid' : ''}`, value: v[k], onChange: set(k), 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `e-${k}-err` : undefined });

  return (
    <form onSubmit={submit} noValidate className="editor">
      <div className="editor-main">
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
              <label htmlFor="e-categoryId">Category</label>
              <select {...props('categoryId')}>
                <option value="">Select…</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              {err('categoryId')}
            </div>
          </div>
          <div className="field">
            <label htmlFor="e-summary">Summary</label>
            <textarea {...props('summary')} rows="3" />
            <p className="field-hint">{v.summary.length}/1000. Shown on cards and in search results.</p>
            {err('summary')}
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
              {v.description.trim()
                ? <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(v.description) }} />
                : <p className="muted">Nothing to preview yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <aside className="editor-side">
        <div className="panel">
          <h2>Publishing</h2>
          <div className="field">
            <label htmlFor="e-status">Status</label>
            <select {...props('status')}>
              <option value="draft">Draft (hidden)</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
          {v.status === 'scheduled' && (
            <div className="field">
              <label htmlFor="e-publishedAt">Go live at</label>
              <input {...props('publishedAt')} type="datetime-local" />
              {err('publishedAt')}
            </div>
          )}
          <label className="check"><input type="checkbox" checked={v.featured} onChange={set('featured')} /> Feature on the homepage</label>
          <div className="editor-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : v.status === 'published' ? 'Publish' : v.status === 'scheduled' ? 'Schedule' : 'Save draft'}</button>
            <Link to="/admin/show-news" className="btn btn-secondary">Cancel</Link>
          </div>
        </div>
        <div className="panel">
          <h2>Cover image</h2>
          {shownImage ? <img className="image-preview" src={shownImage} alt="Cover preview" /> : <p className="muted">No image: artwork is drawn from the headline.</p>}
          <div className="field">
            <label htmlFor="e-image" className="btn btn-secondary btn-sm">{shownImage ? 'Replace image' : 'Upload image'}</label>
            <input id="e-image" className="visually-hidden" type="file" accept="image/*" onChange={pickFile} />
            {err('image')}
          </div>
        </div>
      </aside>
    </form>
  );
}

export default function AddNewsComponent() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const article = useAsync(() => (id ? API.get(`/news/${id}`, { headers: authHeaders() }).then((r) => r.data) : null), [id]);

  if (id && !isAdmin) return <ErrorState title="Admins only" message="Only administrators can edit existing articles." />;
  if (article.error) return <ErrorState onRetry={article.reload} message="This article could not be loaded." />;
  if (id && !article.data) return <div role="status" aria-label="Loading"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-chart" /></div>;

  const a = article.data;
  const initial = a
    ? { ...EMPTY, ...a, description: a.description || '', publishedAt: a.status === 'scheduled' ? toLocalInput(a.publishedAt) : '', featured: !!a.featured }
    : EMPTY;
  return (
    <>
      <div className="page-head"><h1>{id ? 'Edit article' : 'New article'}</h1></div>
      <Editor key={id || 'new'} initial={initial} id={id} />
    </>
  );
}
