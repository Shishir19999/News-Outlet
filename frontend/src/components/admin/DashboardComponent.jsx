import { Link, Navigate } from 'react-router-dom';
import API, { authHeaders } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { AreaChart, BarChart } from '../charts/Charts';
import { ErrorState, Skeleton } from '../ui/States';
import { formatNumber } from '../../lib/text';
import { SOURCES, DEPTHS } from '../../shared/rules';

const SOURCE_LABEL = { direct: 'Direct', search: 'Search engines', social: 'Social networks', newsletter: 'Newsletter', internal: 'This site', other: 'Other sites' };

function Stat({ icon, value, label, to, alert }) {
  const inner = (<><i className={`bi ${icon}`} aria-hidden="true" /><span className="stat-value">{value}</span><span className="stat-label">{label}</span></>);
  return to ? <Link to={to} className={`stat ${alert ? 'stat-alert' : ''}`}>{inner}</Link> : <div className={`stat ${alert ? 'stat-alert' : ''}`}>{inner}</div>;
}

function Loading() {
  return <div role="status" aria-label="Loading dashboard"><div className="stat-grid">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="skeleton-stat" />)}</div><Skeleton className="skeleton-chart" /></div>;
}

function Analytics() {
  const { isAdmin } = useAuth();
  const stats = useAsync(() => API.get('/stats', { params: { days: 14 }, headers: authHeaders() }).then((r) => r.data), []);
  if (stats.error) return <ErrorState onRetry={stats.reload} message="The analytics could not be loaded." />;
  if (!stats.data) return <Loading />;
  const s = stats.data;
  const t = s.totals;
  const depthBase = Math.max(1, s.depth[25]);
  const growthTotal = s.newsletterGrowth[s.newsletterGrowth.length - 1].subscribers;
  return (
    <>
      <div className="page-head"><h1>Analytics</h1><p className="muted">The last 14 days, all sections</p></div>
      <div className="stat-grid">
        <Stat icon="bi-eye" value={formatNumber(t.views)} label="Total views" />
        <Stat icon="bi-send-check" value={t.inReview} label="In the review pipeline" to="/admin/review" alert={t.inReview > 0} />
        <Stat icon="bi-newspaper" value={`${t.published}`} label={`Published (${t.drafts} drafts, ${t.scheduled} scheduled)`} to="/admin/show-news" />
        <Stat icon="bi-chat-left-dots" value={t.pendingComments + t.reportedComments} label={`To moderate (${t.reportedComments} reported)`} to="/admin/comments" alert={t.pendingComments + t.reportedComments > 0} />
        <Stat icon="bi-envelope-paper" value={t.subscribers} label={`Subscribers (${t.pendingSubscribers} unconfirmed)`} to={isAdmin ? '/admin/newsletter' : undefined} />
        <Stat icon="bi-people" value={t.users} label="Accounts" to={isAdmin ? '/admin/users-list' : undefined} />
      </div>
      <div className="admin-grid">
        <section className="panel" aria-labelledby="h-views"><h2 id="h-views">Views per day</h2><AreaChart label="Views per day over the last 14 days" points={s.viewsByDay.map((d) => ({ label: d.date.slice(5), value: d.views }))} /></section>
        <section className="panel" aria-labelledby="h-cat"><h2 id="h-cat">Views per section</h2><BarChart label="Total views per section" rows={s.viewsByCategory.map((c) => ({ label: c.name, value: c.views }))} column="Views" /></section>
        <section className="panel" aria-labelledby="h-src"><h2 id="h-src">Where readers come from</h2><BarChart label="Views by traffic source" valueLabel="views" column="Views" rows={SOURCES.map((k) => ({ label: SOURCE_LABEL[k], value: s.sources[k] || 0 }))} /></section>
        <section className="panel" aria-labelledby="h-depth">
          <h2 id="h-depth">How far readers scroll</h2>
          <BarChart label="Share of readers who reached each point of an article" unit="%" valueLabel="percent of readers" column="Share of readers" max={100} rows={DEPTHS.map((d) => ({ label: `${d}% of the story`, value: Math.round(((s.depth[d] || 0) / depthBase) * 100) }))} />
          <p className="muted small">Based on readers who passed the first quarter.</p>
        </section>
        <section className="panel" aria-labelledby="h-news"><h2 id="h-news">Newsletter growth</h2><AreaChart label={`Confirmed subscribers over the last 14 days (now ${growthTotal})`} column="Subscribers" points={s.newsletterGrowth.map((d) => ({ label: d.date.slice(5), value: d.subscribers }))} /></section>
        <section className="panel" aria-labelledby="h-top">
          <h2 id="h-top">Most read stories</h2>
          <ol className="top-list">{s.topArticles.map((a) => <li key={a._id}><Link to={`/news-details/${a.slug}`}>{a.title}</Link> <span className="muted">{formatNumber(a.views)} views</span></li>)}</ol>
        </section>
      </div>
    </>
  );
}

function AuthorBoard() {
  const { user } = useAuth();
  const stats = useAsync(() => API.get('/stats/me', { headers: authHeaders() }).then((r) => r.data), []);
  if (stats.error) return <ErrorState onRetry={stats.reload} />;
  if (!stats.data) return <Loading />;
  const t = stats.data.totals;
  const base = Math.max(1, stats.data.depth[25]);
  return (
    <>
      <div className="page-head"><h1>Welcome, {user.name}</h1><Link to="/admin/add-news" className="btn btn-primary"><i className="bi bi-plus-circle" aria-hidden="true" /> New article</Link></div>
      <div className="stat-grid">
        <Stat icon="bi-eye" value={formatNumber(t.views)} label="Views of your stories" />
        <Stat icon="bi-newspaper" value={t.published} label="Published" to="/admin/show-news" />
        <Stat icon="bi-pencil" value={t.drafts} label="Drafts" to="/admin/show-news?status=draft" />
        <Stat icon="bi-send" value={t.inReview} label="With the editors" to="/admin/show-news?status=review" />
        <Stat icon="bi-arrow-return-left" value={t.changesRequested} label="Need changes" to="/admin/show-news?status=changes_requested" alert={t.changesRequested > 0} />
        <Stat icon="bi-person-heart" value={t.followers} label="Followers" />
        <Stat icon="bi-chat-left-text" value={t.comments} label="Comments on your stories" />
        <Stat icon="bi-emoji-smile" value={t.reactions} label="Reactions" />
      </div>
      <div className="admin-grid two">
        <section className="panel" aria-labelledby="a-top"><h2 id="a-top">Your top stories</h2>
          {stats.data.top.length === 0 ? <p className="muted">Nothing published yet.</p> : <ol className="top-list">{stats.data.top.map((a) => <li key={a._id}><Link to={`/news-details/${a.slug}`}>{a.title}</Link> <span className="muted">{formatNumber(a.views)} views</span></li>)}</ol>}
        </section>
        <section className="panel" aria-labelledby="a-depth"><h2 id="a-depth">How far readers get</h2>
          <BarChart label="Share of readers who reached each point of your stories" unit="%" valueLabel="percent of readers" column="Share of readers" max={100} rows={DEPTHS.map((d) => ({ label: `${d}% of the story`, value: Math.round(((stats.data.depth[d] || 0) / base) * 100) }))} />
        </section>
      </div>
    </>
  );
}

export default function DashboardComponent() {
  const { isEditor, isAuthor } = useAuth();
  if (isEditor) return <Analytics />;
  if (isAuthor) return <AuthorBoard />;
  return <Navigate to="/admin/my-profile" replace />;
}
