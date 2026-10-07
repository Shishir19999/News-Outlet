import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import API, { authHeaders, errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import useSeo from '../../hooks/useSeo';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoriesContext';
import { useToast } from '../../context/ToastContext';
import ArticleCard from '../ui/ArticleCard';
import BookmarkButton from '../ui/BookmarkButton';
import Breadcrumbs from '../ui/Breadcrumbs';
import Cover from '../ui/Cover';
import ShareBar from '../ui/ShareBar';
import { BackHome, EmptyState, ErrorState, Skeleton } from '../ui/States';
import { renderMarkdown } from '../../lib/markdown';
import { formatDate, formatDateTime, formatNumber, readingTime, statusOf, timeAgo } from '../../lib/text';
import { hasImage } from '../../lib/cover';

function Comments({ newsId }) {
  const { user } = useAuth();
  const toast = useToast();
  const list = useAsync(() => API.get('/comments', { params: { newsId } }).then((r) => r.data), [newsId]);
  const [values, setValues] = useState({ name: '', body: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const f = {};
    if (!user && !values.name.trim()) f.name = 'Please tell us your name';
    if (!values.body.trim()) f.body = 'Write a comment first';
    else if (values.body.length > 1000) f.body = 'Comments can be at most 1000 characters';
    setErrors(f);
    if (Object.keys(f).length) return;
    setBusy(true);
    try {
      const res = await API.post('/comments', { newsId, name: user ? undefined : values.name.trim(), body: values.body.trim() }, { headers: authHeaders() });
      setValues({ name: values.name, body: '' });
      setNotice(res.data.message);
      toast.success(res.data.message);
      if (res.data.status === 'approved') list.reload();
    } catch (err) {
      const data = err.response && err.response.data;
      if (data && data.errors) setErrors(data.errors);
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const comments = list.data || [];
  return (
    <section className="comments" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="section-title">Comments{list.data ? ` (${comments.length})` : ''}</h2>
      {list.error ? <ErrorState title="Comments could not be loaded" onRetry={list.reload} /> : !list.data ? <Skeleton className="skeleton-row" /> : comments.length === 0 ? (
        <p className="muted">No comments yet. Be the first to share a thought.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c._id} className="comment">
              <span className="comment-avatar" aria-hidden="true">{c.name.charAt(0).toUpperCase()}</span>
              <div>
                <p className="comment-head"><strong>{c.name}</strong> <time dateTime={c.createdAt} title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</time></p>
                <p className="comment-body">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="card form-card comment-form" onSubmit={submit} noValidate>
        <h3>Leave a comment</h3>
        <p className="muted">Comments appear after a moderator has approved them.</p>
        {!user && (
          <div className="field">
            <label htmlFor="cm-name">Name</label>
            <input id="cm-name" className={`input ${errors.name ? 'is-invalid' : ''}`} maxLength={60} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} aria-invalid={!!errors.name} />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>
        )}
        <div className="field">
          <label htmlFor="cm-body">Comment{user ? ` as ${user.name}` : ''}</label>
          <textarea id="cm-body" rows="4" className={`input ${errors.body ? 'is-invalid' : ''}`} value={values.body} onChange={(e) => setValues({ ...values, body: e.target.value })} aria-invalid={!!errors.body} />
          <p className="field-hint">{values.body.length}/1000</p>
          {errors.body && <p className="field-error">{errors.body}</p>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post comment'}</button>
        {notice && <p className="notice" role="status">{notice}</p>}
      </form>
    </section>
  );
}

export default function NewsDetatilsComponent() {
  const { slug } = useParams();
  const { byId } = useCategories();
  const detail = useAsync(() => API.get(`/news/news-details/${slug}`, { headers: authHeaders() }).then((r) => r.data), [slug]);
  const article = detail.data ? detail.data.findNews : null;
  const related = detail.data ? detail.data.relatedNews : [];
  const category = article ? byId(article.categoryId) : null;

  useSeo({
    title: article ? article.title : 'Article',
    description: article ? article.summary : undefined,
    image: article && hasImage(article.image) ? article.image : undefined,
    type: 'article',
  });

  // count a view once per visit to a published article
  const viewId = article && statusOf(article) === 'published' ? article._id : null;
  useEffect(() => {
    if (viewId) API.post(`/news/${viewId}/view`).catch(() => {});
  }, [viewId]);

  if (detail.error) {
    const missing = detail.error.response && detail.error.response.status === 404;
    return (
      <div className="container section">
        {missing
          ? <EmptyState icon="bi-file-earmark-x" title="Article not found" action={<BackHome />}>It may have been unpublished or the link is wrong.</EmptyState>
          : <ErrorState onRetry={detail.reload} />}
      </div>
    );
  }
  if (!article) {
    return (
      <div className="container section page-narrow" role="status" aria-label="Loading article">
        <Skeleton className="skeleton-line short" />
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-cover skeleton-wide" />
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="skeleton-line" />)}
      </div>
    );
  }

  const state = statusOf(article);
  const minutes = readingTime(article.description || article.summary);
  return (
    <article className="container section article">
      <Breadcrumbs items={[
        { label: 'Home', to: '/' },
        ...(category ? [{ label: category.name, to: `/category/${category.slug}` }] : []),
        { label: article.title },
      ]}
      />
      {state !== 'published' && <p className="notice notice-warn" role="status"><i className="bi bi-eye-slash" aria-hidden="true" /> Preview: this article is a {state} and is not visible to the public.</p>}
      <header className="article-head">
        {category && <Link to={`/category/${category.slug}`} className="kicker">{category.name}</Link>}
        <h1 className="article-title">{article.title}</h1>
        <p className="article-summary">{article.summary}</p>
        <p className="meta">
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt || article.createdAt)}</time>
          <span aria-hidden="true">·</span><span>{minutes} min read</span>
          <span aria-hidden="true">·</span><span><i className="bi bi-eye" aria-hidden="true" /> {formatNumber(article.views)} views</span>
        </p>
        <div className="article-actions">
          <BookmarkButton id={article._id} title={article.title} variant="full" />
          <ShareBar title={article.title} summary={article.summary} />
        </div>
      </header>
      <Cover article={article} categoryName={category ? category.name : ''} className="article-cover" eager />
      <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(article.description || article.summary) }} />

      {article.description && <div className="article-foot"><ShareBar title={article.title} summary={article.summary} /></div>}

      {related.length > 0 && (
        <section className="related" aria-labelledby="related-heading">
          <h2 id="related-heading" className="section-title">Related articles</h2>
          <div className="grid grid-2">
            {related.map((a) => <ArticleCard key={a._id} article={a} category={byId(a.categoryId)} />)}
          </div>
        </section>
      )}
      {state === 'published' && <Comments newsId={article._id} />}
    </article>
  );
}
