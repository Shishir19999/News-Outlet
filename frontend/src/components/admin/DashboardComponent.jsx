import { useState } from 'react';
import { Link } from 'react-router-dom';
import API, { authHeaders } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { AreaChart, BarChart } from '../charts/Charts';
import { ErrorState, Skeleton } from '../ui/States';
import { formatNumber } from '../../lib/text';

function Stat({ icon, label, value, to, tone = '' }) {
  const body = (
    <>
      <i className={`bi ${icon}`} aria-hidden="true" />
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </>
  );
  return to ? <Link to={to} className={`stat ${tone}`}>{body}</Link> : <div className={`stat ${tone}`}>{body}</div>;
}

function AdminDashboard() {
  const [days, setDays] = useState(14);
  const stats = useAsync(() => API.get('/stats', { params: { days }, headers: authHeaders() }).then((r) => r.data), [days]);
  if (stats.error) return <ErrorState onRetry={stats.reload} />;
  if (!stats.data) {
    return (
      <div role="status" aria-label="Loading dashboard">
        <div className="stat-grid">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="skeleton-stat" />)}</div>
        <Skeleton className="skeleton-chart" />
      </div>
    );
  }
  const { totals, viewsByCategory, viewsByDay, topArticles } = stats.data;
  return (
    <>
      <div className="stat-grid">
        <Stat icon="bi-eye" label="Total views" value={formatNumber(totals.views)} />
        <Stat icon="bi-newspaper" label={`Published of ${totals.articles}`} value={totals.published} to="/admin/show-news" />
        <Stat icon="bi-pencil-square" label="Drafts and scheduled" value={totals.drafts + totals.scheduled} to="/admin/show-news" />
        <Stat icon="bi-chat-left-text" label="Comments to review" value={totals.pendingComments} to="/admin/comments" tone={totals.pendingComments ? 'stat-alert' : ''} />
        <Stat icon="bi-people" label="Users" value={totals.users} to="/admin/users-list" />
        <Stat icon="bi-envelope-paper" label="Subscribers" value={totals.subscribers} to="/admin/subscribers" />
      </div>
      <div className="admin-grid">
        <section className="panel" aria-labelledby="chart-days">
          <div className="panel-head">
            <h2 id="chart-days">Views per day</h2>
            <label className="visually-hidden" htmlFor="range">Time range</label>
            <select id="range" className="input input-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option>
            </select>
          </div>
          <AreaChart points={viewsByDay.map((d) => ({ label: d.date.slice(5), value: d.views }))} label={`Views per day for the last ${days} days`} />
        </section>
        <section className="panel" aria-labelledby="chart-cats">
          <div className="panel-head"><h2 id="chart-cats">Views per category</h2></div>
          <BarChart rows={viewsByCategory.map((c) => ({ label: c.name, value: c.views }))} label="Views per category" />
        </section>
        <section className="panel" aria-labelledby="top-art">
          <div className="panel-head"><h2 id="top-art">Most read articles</h2></div>
          <ol className="top-list">
            {topArticles.map((a) => (
              <li key={a._id}><Link to={`/news-details/${a.slug}`}>{a.title}</Link><span className="meta">{formatNumber(a.views)} views</span></li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

function UserDashboard() {
  const mine = useAsync(() => API.get('/news/manage/list', { params: { limit: 5 }, headers: authHeaders() }).then((r) => r.data), []);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Your articles</h2><Link to="/admin/add-news" className="btn btn-primary btn-sm">Write an article</Link></div>
      {mine.error ? <ErrorState onRetry={mine.reload} /> : !mine.data ? <Skeleton className="skeleton-row" /> : (
        <p>You have written {mine.data.total} article{mine.data.total === 1 ? '' : 's'}. Statistics, categories and moderation are available to administrators.</p>
      )}
    </section>
  );
}

export default function DashboardComponent() {
  const { user, isAdmin } = useAuth();
  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <p className="muted">Welcome back, {user.name}.</p>
      </div>
      {isAdmin ? <AdminDashboard /> : <UserDashboard />}
    </>
  );
}
