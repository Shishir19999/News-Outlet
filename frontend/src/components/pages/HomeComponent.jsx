import { Link } from 'react-router-dom';
import API from '../../config/API';
import useAsync from '../../hooks/useAsync';
import useSeo from '../../hooks/useSeo';
import { useCategories } from '../../context/CategoriesContext';
import { useFollows } from '../../context/FollowsContext';
import ArticleCard, { articleLink } from '../ui/ArticleCard';
import BookmarkButton from '../ui/BookmarkButton';
import Cover from '../ui/Cover';
import { KindBadge } from '../ui/Labels';
import NewsletterForm from '../ui/NewsletterForm';
import { Parallax, Reveal } from '../ui/Motion';
import { CardGridSkeleton, ErrorState, EmptyState, Skeleton } from '../ui/States';
import { formatDate, formatNumber, readingTime } from '../../lib/text';
import { titleFor } from '../../lib/ab';

function HeroSkeleton() {
  return (
    <div className="container hero-grid" role="status" aria-label="Loading top stories">
      <Skeleton className="skeleton-hero" />
      <div className="hero-side">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="skeleton-side" />)}
      </div>
    </div>
  );
}

function ForYouRail({ byId }) {
  const f = useFollows();
  const q = { topics: f.topics.join(','), authors: f.authors.join(','), limit: 3 };
  const list = useAsync(() => (f.count ? API.get('/news/for-you', { params: q }).then((r) => r.data.news) : []), [q.topics, q.authors]);
  return (
    <section className="container section-tight" aria-labelledby="fy-heading">
      <div className="section-head">
        <h2 id="fy-heading" className="section-title"><i className="bi bi-stars" aria-hidden="true" /> For you</h2>
        <Link to="/for-you" className="link-more">{f.count ? 'See your feed' : 'Choose what to follow'} <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
      </div>
      {f.count === 0 ? (
        <p className="panel muted">Follow sections and writers and this strip fills with stories picked for you. <Link to="/for-you">Pick your topics</Link>.</p>
      ) : !list.data ? <CardGridSkeleton count={3} /> : (
        <div className="grid grid-3">{list.data.map((a) => <ArticleCard key={a._id} article={a} category={byId(a.categoryId)} />)}</div>
      )}
    </section>
  );
}

export default function HomeComponent() {
  useSeo({ description: 'Top stories, trending reads and the latest reporting across technology, business, science, sports, culture and the world.' });
  const { categories, byId } = useCategories();
  const featured = useAsync(() => API.get('/news', { params: { featured: 1, limit: 4 } }).then((r) => r.data.news), []);
  const latest = useAsync(() => API.get('/news', { params: { limit: 12 } }).then((r) => r.data.news), []);
  const trending = useAsync(() => API.get('/news/trending', { params: { limit: 5 } }).then((r) => r.data.news), []);
  const voices = useAsync(() => Promise.all(['opinion', 'analysis', 'fact-check'].map((kind) => API.get('/news', { params: { kind, limit: 2 } }).then((r) => r.data.news))).then((a) => a.flat()), []);
  const liveNow = useAsync(() => API.get('/news', { params: { kind: 'live', limit: 1 } }).then((r) => r.data.news[0] || null), []);

  const error = featured.error || latest.error || trending.error;
  const loading = featured.loading || latest.loading || trending.loading;
  const retry = () => { featured.reload(); latest.reload(); trending.reload(); };
  if (error) return <div className="container section"><ErrorState onRetry={retry} /></div>;

  const pool = [];
  [...(featured.data || []), ...(latest.data || [])].forEach((a) => { if (!pool.some((p) => p._id === a._id)) pool.push(a); });
  const lead = pool[0];
  const side = pool.slice(1, 4);
  const shown = new Set(pool.slice(0, 4).map((a) => a._id));
  const rest = (latest.data || []).filter((a) => !shown.has(a._id)).slice(0, 6);
  const live = liveNow.data;

  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <Parallax speed={0.16} className="hero-blob hero-blob-a" />
        <Parallax speed={-0.1} className="hero-blob hero-blob-b" />
        <h1 id="hero-heading" className="visually-hidden">Top stories</h1>
        {loading && !lead ? <HeroSkeleton /> : lead ? (
          <div className="container hero-grid">
            <Reveal as="article" className="hero-lead">
              <Link to={articleLink(lead)} className="hero-lead-link" aria-label={titleFor(lead)}>
                <Cover article={lead} categoryName={(byId(lead.categoryId) || {}).name} eager />
              </Link>
              <div className="hero-lead-body">
                <p className="card-labels">
                  {byId(lead.categoryId) && <Link to={`/category/${byId(lead.categoryId).slug}`} className="kicker kicker-light">{byId(lead.categoryId).name}</Link>}
                  <KindBadge article={lead} />
                </p>
                <h2 className="hero-title"><Link to={articleLink(lead)}>{titleFor(lead)}</Link></h2>
                <p className="hero-summary">{lead.summary}</p>
                <p className="meta meta-light">{formatDate(lead.publishedAt)} · {readingTime(lead.description || lead.summary)} min read</p>
              </div>
              <BookmarkButton id={lead._id} title={lead.title} article={lead} className="hero-bookmark" />
            </Reveal>
            <div className="hero-side">
              {side.map((a, i) => (
                <Reveal key={a._id} delay={i * 90}>
                  <ArticleCard article={a} category={byId(a.categoryId)} variant="row" />
                </Reveal>
              ))}
            </div>
          </div>
        ) : (
          <div className="container"><EmptyState icon="bi-newspaper" title="No stories yet">Check back soon for new reporting.</EmptyState></div>
        )}
      </section>

      {live && (
        <section className="container live-strip" aria-label="Live now">
          <Link to={`/news-details/${live.slug}`} className="live-strip-link"><span className="live-dot" aria-hidden="true" /> <strong>Live now</strong> <span>{live.title}</span> <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
        </section>
      )}

      {categories.length > 0 && (
        <section className="container chip-section" aria-label="Browse sections">
          <ul className="chips">
            {categories.map((c) => (
              <li key={c._id}><Link className="chip" to={`/category/${c.slug}`}>{c.name} <span className="chip-count">{c.newsCount}</span></Link></li>
            ))}
          </ul>
        </section>
      )}

      <section className="container section home-columns" aria-labelledby="latest-heading">
        <div>
          <Reveal className="section-head">
            <h2 id="latest-heading" className="section-title">Latest news</h2>
            <Link to="/news" className="link-more">All stories <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
          </Reveal>
          {loading && !rest.length ? <CardGridSkeleton count={6} /> : rest.length ? (
            <div className="grid grid-2">
              {rest.map((a, i) => (
                <Reveal key={a._id} delay={(i % 2) * 90}>
                  <ArticleCard article={a} category={byId(a.categoryId)} />
                </Reveal>
              ))}
            </div>
          ) : <EmptyState icon="bi-newspaper" title="Nothing new right now">Browse all stories or pick a section above.</EmptyState>}
        </div>

        <aside aria-labelledby="trending-heading" className="trending">
          <Reveal className="panel">
            <h2 id="trending-heading" className="section-title section-title-sm"><i className="bi bi-graph-up-arrow" aria-hidden="true" /> Trending</h2>
            {trending.loading && !trending.data ? (
              <div role="status" aria-label="Loading trending">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="skeleton-row" />)}</div>
            ) : (
              <ol className="trending-list">
                {(trending.data || []).map((a) => (
                  <li key={a._id}>
                    <Link to={`/news-details/${a.slug}`}>{a.title}</Link>
                    <span className="meta">{(byId(a.categoryId) || {}).name} · <i className="bi bi-eye" aria-hidden="true" /> {formatNumber(a.views)}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="muted small">Ranked by recent reads, newer reads count more.</p>
          </Reveal>
        </aside>
      </section>

      <ForYouRail byId={byId} />

      {voices.data && voices.data.length > 0 && (
        <section className="container section-tight" aria-labelledby="voices-heading">
          <div className="section-head"><h2 id="voices-heading" className="section-title">Opinion, analysis and fact checks</h2></div>
          <div className="grid grid-3">{voices.data.slice(0, 6).map((a) => <ArticleCard key={a._id} article={a} category={byId(a.categoryId)} />)}</div>
        </section>
      )}

      <section className="newsletter-band" aria-labelledby="newsletter-heading">
        <Parallax speed={0.14} className="band-shape band-shape-a" />
        <Parallax speed={-0.08} className="band-shape band-shape-b" />
        <Reveal className="container newsletter-inner">
          <h2 id="newsletter-heading" className="section-title">Get the weekly briefing</h2>
          <p>One short email with the stories worth your time. Choose your topics, confirm by e-mail, unsubscribe whenever you like.</p>
          <NewsletterForm idPrefix="home-nl" topics />
        </Reveal>
      </section>
    </>
  );
}
