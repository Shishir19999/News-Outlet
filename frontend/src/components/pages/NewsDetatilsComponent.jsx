import { useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import API, { authHeaders } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import useSeo from '../../hooks/useSeo';
import { useAuth } from '../../context/AuthContext';
import { useCategories } from '../../context/CategoriesContext';
import { useReader } from '../../context/ReaderContext';
import { useBookmarks } from '../../context/BookmarksContext';
import ArticleCard from '../ui/ArticleCard';
import BookmarkButton from '../ui/BookmarkButton';
import Breadcrumbs from '../ui/Breadcrumbs';
import Cover from '../ui/Cover';
import FollowButton from '../ui/FollowButton';
import ShareBar from '../ui/ShareBar';
import Avatar from '../ui/Avatar';
import { KindBadge, KindNotice, RatingBox, StatusBadge } from '../ui/Labels';
import { BackHome, EmptyState, ErrorState, Skeleton } from '../ui/States';
import Comments from '../article/Comments';
import LiveBlog from '../article/LiveBlog';
import { Embed, Gallery } from '../article/Media';
import { Poll, Reactions } from '../article/Engage';
import { ProgressBar, ReadAloud, TextControls, useReadingProgress } from '../article/ReaderTools';
import { renderMarkdown } from '../../lib/markdown';
import { formatDate, formatDateTime, formatNumber, readingTime, timeAgo } from '../../lib/text';
import { hasImage } from '../../lib/cover';
import { DEMO, BASE_URL, API_URL, SITE_NAME } from '../../config/env';
import { canEditArticle, classifySource, depthBucket, isLive, inPublicArchive } from '../../shared/rules';
import { articleJsonLd } from '../../shared/feeds';

const shareUrlFor = (slug) => (DEMO ? `${window.location.origin}${BASE_URL}a/${slug}/` : `${API_URL}/share/${slug}`);

function Skel() {
  return (
    <div className="container section page-narrow" role="status" aria-label="Loading article">
      <Skeleton className="skeleton-line short" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line medium" /><Skeleton className="skeleton-wide skeleton-cover" />
    </div>
  );
}

export default function NewsDetatilsComponent() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { byId } = useCategories();
  const { user, isEditor } = useAuth();
  const { addHistory, toggleQueue, inQueue } = useReader();
  const bodyRef = useRef(null);
  const sent = useRef({ id: null, depth: new Set() });
  const result = useAsync(() => API.get(`/news/news-details/${slug}`, { headers: authHeaders() }).then((r) => r.data), [slug, user && user._id]);
  const { copies } = useBookmarks();
  // offline: fall back to the copy kept with the saved story
  const offlineCopy = result.error && !result.error.response ? Object.values(copies).find((a) => a.slug === slug) : null;
  const article = result.data ? result.data.findNews : offlineCopy;
  const category = article ? byId(article.categoryId) : null;
  const live = article ? inPublicArchive(article) : false;
  const pct = useReadingProgress(bodyRef, !!article);

  const ld = article && live ? articleJsonLd(
    { ...article, category: category ? { name: category.name } : undefined, author: article.author },
    { siteUrl: window.location.origin, siteName: SITE_NAME, articleUrl: () => window.location.href.split('#')[0] + window.location.hash.split('?')[0], sectionUrl: () => window.location.origin, feedUrl: () => window.location.origin, imageUrl: hasImage(article.image) && /^https?:/.test(article.image) ? article.image : undefined },
  ) : undefined;
  useSeo({ title: article ? article.title : 'Article', description: article ? article.summary : undefined, image: article ? article.image : undefined, type: 'article', jsonLd: ld, noindex: !!article && !live });

  // one view per visit: history, traffic source and the headline-test click
  useEffect(() => {
    if (!article || sent.current.id === article._id) return;
    sent.current = { id: article._id, depth: new Set() };
    addHistory(article);
    if (!inPublicArchive(article)) return;
    API.post(`/news/${article._id}/view`, { source: classifySource(document.referrer, window.location.hostname, params.get('src')), variant: params.get('v') || undefined }).catch(() => {});
  }, [article, addHistory, params]);
  // reading depth milestones
  useEffect(() => {
    if (!article || !inPublicArchive(article)) return;
    const bucket = depthBucket(pct);
    if (bucket && !sent.current.depth.has(bucket)) {
      for (const d of [25, 50, 75, 100]) {
        if (d <= bucket && !sent.current.depth.has(d)) {
          sent.current.depth.add(d);
          API.post(`/news/${article._id}/depth`, { depth: d }).catch(() => {});
        }
      }
    }
  }, [pct, article]);

  if (result.error && !offlineCopy) {
    const notFound = result.error.response && result.error.response.status === 404;
    return (
      <div className="container section">
        {notFound ? <EmptyState icon="bi-file-earmark-x" title="Story not found" action={<BackHome />}>This story does not exist, or it is not published.</EmptyState> : <ErrorState onRetry={result.reload} />}
      </div>
    );
  }
  if (!article) return <Skel />;

  const related = result.data ? result.data.relatedNews : [];
  const engagement = result.data ? result.data.engagement : { reactions: {}, mine: null, poll: null };
  const html = renderMarkdown(article.description || '');
  const minutes = readingTime(article.description || article.summary);
  const showStatus = !isLive(article) && article.status !== 'archived';
  const editable = !!user && canEditArticle(article, user);
  const author = article.author;
  const showAuthor = author && author.name && author.name !== 'Former contributor';

  return (
    <article className="container section article" aria-labelledby="article-title">
      <ProgressBar pct={pct} />
      {offlineCopy && <p className="notice notice-warn" role="status"><i className="bi bi-wifi-off" aria-hidden="true" /> You are offline. This is the copy saved on your device.</p>}
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, ...(category ? [{ label: category.name, to: `/category/${category.slug}` }] : []), { label: article.title }]} />

      {showStatus && (
        <p className="notice notice-warn" role="status">
          <i className="bi bi-eye-slash" aria-hidden="true" />
          <span><StatusBadge status={article.status} /> This story is not public yet. Only you and the newsroom can see it.{' '}
            {editable && <Link to={`/admin/edit-news/${article._id}`}>Open in the editor</Link>}</span>
        </p>
      )}
      {article.status === 'archived' && <p className="notice" role="note"><i className="bi bi-archive" aria-hidden="true" /> This story is from the archive and may be out of date.</p>}

      <p className="card-labels">
        {category && <Link to={`/category/${category.slug}`} className="kicker">{category.name}</Link>}
        <KindBadge article={article} />
      </p>
      <h1 id="article-title" className="article-title">{article.title}</h1>
      <p className="article-summary">{article.summary}</p>
      <KindNotice article={article} />
      <p className="meta byline">
        {showAuthor && <Link to={`/author/${author._id}`} className="byline-author"><Avatar user={author} size="sm" /> {author.name}</Link>}
        <time dateTime={article.publishedAt || article.createdAt}>{formatDate(article.publishedAt || article.createdAt)}</time>
        <span aria-hidden="true">·</span><span>{minutes} min read</span>
        {article.updatedAt && article.publishedAt && new Date(article.updatedAt) - new Date(article.publishedAt) > 3600000 && <><span aria-hidden="true">·</span><span title={formatDateTime(article.updatedAt)}>Updated {timeAgo(article.updatedAt)}</span></>}
        {article.views > 0 && <><span aria-hidden="true">·</span><span><i className="bi bi-eye" aria-hidden="true" /> {formatNumber(article.views)} views</span></>}
      </p>

      <div className="article-actions">
        <BookmarkButton variant="full" id={article._id} title={article.title} article={article} />
        <button type="button" className={`btn btn-secondary ${inQueue(article._id) ? 'is-active' : ''}`} aria-pressed={inQueue(article._id)} onClick={() => toggleQueue(article)}>
          <i className="bi bi-headphones" aria-hidden="true" /> {inQueue(article._id) ? 'In listen queue' : 'Listen later'}
        </button>
        <ReadAloud article={article} />
        <ShareBar title={article.title} summary={article.summary} shareUrl={live ? shareUrlFor(article.slug) : undefined} />
      </div>
      <TextControls />

      {(hasImage(article.image) || !article.gallery || article.gallery.length === 0) && (
        <figure className="article-cover-fig">
          <Cover article={article} categoryName={category ? category.name : ''} className="article-cover" eager alt={article.imageAlt || ''} />
          {article.imageAlt && <figcaption className="muted small">{article.imageAlt}</figcaption>}
        </figure>
      )}

      {article.kind === 'fact-check' && <RatingBox factCheck={article.factCheck} />}
      {article.kind === 'live' && <LiveBlog article={article} />}
      <Embed embed={article.embed} />

      <div ref={bodyRef} className="prose article-body" dangerouslySetInnerHTML={{ __html: html }} />

      {article.gallery && article.gallery.length > 0 && <Gallery items={article.gallery} />}
      {article.poll && engagement.poll && <Poll newsId={article._id} initial={engagement.poll} />}
      {live && result.data && <Reactions newsId={article._id} initial={engagement} />}

      <footer className="article-foot">
        {article.tags && article.tags.length > 0 && (
          <p className="tags" aria-label="Topics">{article.tags.map((t) => <Link key={t} className="tag" to={`/news?tag=${t}`}>#{t}</Link>)}</p>
        )}
        {showAuthor && (
          <section className="author-box" aria-label={`About ${author.name}`}>
            <Avatar user={author} size="lg" />
            <div>
              <h2 className="author-name"><Link to={`/author/${author._id}`}>{author.name}</Link></h2>
              <p className="muted">{author.bio || 'Contributor'}</p>
              <FollowButton kind="author" id={author._id} label={author.name} />
            </div>
          </section>
        )}
        {category && <p><FollowButton kind="topic" id={category._id} label={category.name} /> <span className="muted small">to see more {category.name} stories in For you</span></p>}
        {isEditor && <p className="small"><Link to={`/admin/edit-news/${article._id}`}><i className="bi bi-pencil" aria-hidden="true" /> Edit this story</Link></p>}
      </footer>

      {live && result.data && <Comments newsId={article._id} />}

      {related.length > 0 && (
        <section className="related" aria-labelledby="related-h">
          <h2 id="related-h" className="section-title">More from {category ? category.name : 'this section'}</h2>
          <div className="grid grid-2">{related.map((r) => <ArticleCard key={r._id} article={r} category={byId(r.categoryId)} />)}</div>
        </section>
      )}
    </article>
  );
}
