import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import API, { errorMessage } from '../../config/API';
import useAsync from '../../hooks/useAsync';
import useSeo from '../../hooks/useSeo';
import { useAuth } from '../../context/AuthContext';
import { useBookmarks } from '../../context/BookmarksContext';
import { useCategories } from '../../context/CategoriesContext';
import { useFollows } from '../../context/FollowsContext';
import { useReader } from '../../context/ReaderContext';
import { useToast } from '../../context/ToastContext';
import ArticleCard from '../ui/ArticleCard';
import Avatar from '../ui/Avatar';
import Breadcrumbs from '../ui/Breadcrumbs';
import FollowButton from '../ui/FollowButton';
import PaginationComponent from '../layouts/PaginationComponent';
import { CardGridSkeleton, EmptyState, ErrorState, Skeleton } from '../ui/States';
import { useSpeech } from '../article/ReaderTools';
import { DEMO } from '../../config/env';
import { formatDateTime, monthLabel, timeAgo } from '../../lib/text';

// ---- archive by date ------------------------------------------------------------------------
export function ArchivePage() {
  useSeo({ title: 'Archive', description: 'Browse every story by month.' });
  const [params, setParams] = useSearchParams();
  const { byId } = useCategories();
  const month = params.get('month') || '';
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);
  const months = useAsync(() => API.get('/news/archive').then((r) => r.data.months), []);
  const list = useAsync(() => {
    if (!month) return null;
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return API.get('/news', { params: { archived: 1, from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, page, limit: 12, sort: 'latest' } }).then((r) => r.data);
  }, [month, page]);
  const setMonth = (key) => setParams(key ? { month: key } : {});
  return (
    <div className="container section">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Archive' }]} />
      <h1 className="page-title">Archive</h1>
      <p className="lead">Every published story, by month. Older stories stay available by their link.</p>
      {months.error ? <ErrorState onRetry={months.reload} /> : !months.data ? <Skeleton className="skeleton-row" /> : (
        <nav aria-label="Months" className="month-nav">
          <ul className="chips">
            {months.data.map((m) => (
              <li key={m.key}><button type="button" className={`chip ${month === m.key ? 'is-active' : ''}`} aria-pressed={month === m.key} onClick={() => setMonth(m.key)}>{monthLabel(m.key)} <span className="chip-count">{m.count}</span></button></li>
            ))}
          </ul>
        </nav>
      )}
      {!month ? <EmptyState icon="bi-calendar3" title="Pick a month">Choose a month above to see its stories.</EmptyState> : list.error ? <ErrorState onRetry={list.reload} /> : !list.data ? <CardGridSkeleton count={6} /> : (
        <>
          <h2 className="section-title">{monthLabel(month)} <span className="muted">({list.data.total})</span></h2>
          <div className="grid grid-3">{list.data.news.map((a) => <ArticleCard key={a._id} article={a} category={byId(a.categoryId)} />)}</div>
          <PaginationComponent page={page} pages={list.data.pages} onChange={(p) => setParams({ month, page: String(p) })} />
        </>
      )}
    </div>
  );
}

// ---- writers ----------------------------------------------------------------------------------
export function AuthorsPage() {
  useSeo({ title: 'Our writers', description: 'The reporters, editors and columnists behind the stories.' });
  const list = useAsync(() => API.get('/authors').then((r) => r.data), []);
  return (
    <div className="container section">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Our writers' }]} />
      <h1 className="page-title">Our writers</h1>
      {list.error ? <ErrorState onRetry={list.reload} /> : !list.data ? <CardGridSkeleton count={4} /> : (
        <ul className="grid grid-3 plain-list">
          {list.data.map((a) => (
            <li key={a._id} className="card author-card">
              <Avatar user={a} size="lg" />
              <div>
                <h2 className="author-name"><Link to={`/author/${a._id}`}>{a.name}</Link></h2>
                <p className="meta"><span className="badge">{a.role}</span> {a.articles} {a.articles === 1 ? 'story' : 'stories'} · {a.followers} {a.followers === 1 ? 'follower' : 'followers'}</p>
                <p className="muted">{a.bio}</p>
                <FollowButton kind="author" id={a._id} label={a.name} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AuthorPage() {
  const { id } = useParams();
  const { byId } = useCategories();
  const [page, setPage] = useState(1);
  const author = useAsync(() => API.get(`/authors/${id}`).then((r) => r.data), [id]);
  const list = useAsync(() => API.get('/news', { params: { authorId: id, page, limit: 9 } }).then((r) => r.data), [id, page]);
  useSeo({ title: author.data ? author.data.name : 'Writer', description: author.data ? author.data.bio : undefined });
  if (author.error) return <div className="container section"><EmptyState icon="bi-person-x" title="Writer not found"><Link to="/authors">See all writers</Link></EmptyState></div>;
  const a = author.data;
  return (
    <div className="container section">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Our writers', to: '/authors' }, { label: a ? a.name : '…' }]} />
      {a ? (
        <header className="author-head">
          <Avatar user={a} size="lg" />
          <div>
            <h1 className="page-title">{a.name}</h1>
            <p className="meta"><span className="badge">{a.role}</span> {a.articles} stories · {a.followers} followers</p>
            <p className="lead">{a.bio}</p>
            <FollowButton kind="author" id={a._id} label={a.name} />
          </div>
        </header>
      ) : <Skeleton className="skeleton-title" />}
      {list.error ? <ErrorState onRetry={list.reload} /> : !list.data ? <CardGridSkeleton count={3} /> : list.data.news.length === 0 ? <EmptyState icon="bi-newspaper" title="No published stories yet" /> : (
        <><h2 className="visually-hidden">Stories</h2><div className="grid grid-3">{list.data.news.map((n) => <ArticleCard key={n._id} article={n} category={byId(n.categoryId)} />)}</div></>
      )}
      {list.data && <PaginationComponent page={page} pages={list.data.pages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0 }); }} />}
    </div>
  );
}

// ---- for you ---------------------------------------------------------------------------------
const REASON = { topic: 'Because you follow this section', author: 'Because you follow this writer', tag: 'Matches topics you read' };
export function ForYouPage() {
  useSeo({ title: 'For you', description: 'Stories picked from the sections and writers you follow.' });
  const f = useFollows();
  const { categories, byId } = useCategories();
  const authors = useAsync(() => API.get('/authors').then((r) => r.data), []);
  const { history } = useReader();
  const q = { topics: f.topics.join(','), authors: f.authors.join(','), exclude: history.slice(0, 20).map((h) => h.id).join(','), limit: 12 };
  const feed = useAsync(() => API.get('/news/for-you', { params: q }).then((r) => r.data), [q.topics, q.authors]);
  return (
    <div className="container section">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'For you' }]} />
      <h1 className="page-title">For you</h1>
      <p className="lead">Follow sections and writers to shape this page. {useAuth().user ? 'Your choices are saved to your account.' : 'Your choices are kept in this browser; sign in to keep them everywhere.'}</p>
      <section className="panel" aria-labelledby="follow-topics">
        <h2 id="follow-topics" className="section-title-sm">Sections</h2>
        <ul className="chips">{categories.map((c) => <li key={c._id}><FollowButton kind="topic" id={c._id} label={c.name} className="chip-follow" /> <span className="muted small">{c.name}</span></li>)}</ul>
        <h2 className="section-title-sm follow-gap">Writers</h2>
        {authors.data ? <ul className="chips">{authors.data.map((a) => <li key={a._id}><FollowButton kind="author" id={a._id} label={a.name} className="chip-follow" /> <span className="muted small">{a.name}</span></li>)}</ul> : <Skeleton className="skeleton-row" />}
      </section>
      {feed.error ? <ErrorState onRetry={feed.reload} /> : !feed.data ? <CardGridSkeleton count={6} /> : (
        <>
          <h2 className="section-title">{feed.data.personalised ? 'Picked for you' : 'Top stories while you decide'}</h2>
          <div className="grid grid-3">
            {feed.data.news.map((a) => (
              <div key={a._id}>
                <ArticleCard article={a} category={byId(a.categoryId)} />
                {a.reasons && a.reasons.length > 0 && <p className="why muted small"><i className="bi bi-info-circle" aria-hidden="true" /> {REASON[a.reasons[0]]}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- library: saved, listen later, history ---------------------------------------------------
function Saved() {
  const { ids, copies } = useBookmarks();
  const { byId } = useCategories();
  const key = ids.join(',');
  const list = useAsync(() => (ids.length ? API.get('/news', { params: { ids: key, limit: 50 } }).then((r) => r.data.news) : []), [key]);
  const offline = !!list.error && !list.error.response;
  const articles = offline ? ids.map((id) => copies[id]).filter(Boolean) : (list.data || []).slice().sort((a, b) => ids.indexOf(a._id) - ids.indexOf(b._id)).filter((a) => ids.includes(a._id));
  if (list.error && !offline) return <ErrorState onRetry={list.reload} />;
  if (list.loading && ids.length && !offline) return <CardGridSkeleton count={Math.min(ids.length, 6)} />;
  return (
    <>
      {offline && <p className="notice notice-warn" role="status"><i className="bi bi-wifi-off" aria-hidden="true" /> You are offline. These are the copies saved on this device.</p>}
      {articles.length === 0 ? (
        <EmptyState icon="bi-bookmark" title="Nothing saved yet" action={<Link to="/news" className="btn btn-primary">Browse the latest news</Link>}>Tap the bookmark on any story to keep it here, also for offline reading.</EmptyState>
      ) : <><h2 className="visually-hidden">Saved stories</h2><div className="grid grid-3">{articles.map((a) => <ArticleCard key={a._id} article={a} category={byId(a.categoryId)} />)}</div></>}
    </>
  );
}

function ListenLater() {
  const { queue, removeFromQueue, clearQueue } = useReader();
  const sp = useSpeech();
  const [now, setNow] = useState(-1);
  const playFrom = (i) => {
    if (i >= queue.length) { setNow(-1); return; }
    setNow(i);
    sp.play(queue[i].text, () => playFrom(i + 1));
  };
  if (!sp.supported) return <p className="notice notice-warn">Read aloud is not available in this browser.</p>;
  if (!queue.length) return <EmptyState icon="bi-headphones" title="Your listen queue is empty">Use <strong>Listen later</strong> on a story to add it. Stories are read by your browser&rsquo;s own voice.</EmptyState>;
  return (
    <>
      <p className="editor-actions">
        {sp.state === 'idle' ? <button type="button" className="btn btn-primary" onClick={() => playFrom(0)}><i className="bi bi-play-fill" aria-hidden="true" /> Play all</button> : (
          <>
            {sp.state === 'playing' ? <button type="button" className="btn btn-secondary" onClick={sp.pause}><i className="bi bi-pause-fill" aria-hidden="true" /> Pause</button> : <button type="button" className="btn btn-secondary" onClick={sp.resume}><i className="bi bi-play-fill" aria-hidden="true" /> Resume</button>}
            <button type="button" className="btn btn-secondary" onClick={() => { sp.stop(); setNow(-1); }}><i className="bi bi-stop-fill" aria-hidden="true" /> Stop</button>
          </>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => { sp.stop(); clearQueue(); }}>Clear queue</button>
      </p>
      <ol className="queue-list">
        {queue.map((q, i) => (
          <li key={q.id} className={now === i ? 'is-playing' : ''}>
            <Link to={`/news-details/${q.slug}`}>{q.title}</Link>
            {now === i && <span className="badge badge-published">Playing</span>}
            <span className="row-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => playFrom(i)}>Play</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeFromQueue(q.id)} aria-label={`Remove ${q.title} from the queue`}>Remove</button>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function History() {
  const { history, clearHistory } = useReader();
  if (!history.length) return <EmptyState icon="bi-clock-history" title="No reading history yet">Stories you open appear here. The history stays on this device.</EmptyState>;
  return (
    <>
      <p><button type="button" className="btn btn-secondary btn-sm" onClick={clearHistory}>Clear history</button></p>
      <ul className="history-list">
        {history.map((h) => <li key={h.id}><Link to={`/news-details/${h.slug}`}>{h.title}</Link> <span className="muted small">{timeAgo(h.at)}</span></li>)}
      </ul>
    </>
  );
}

const TABS = [['saved', 'Saved', 'bi-bookmarks'], ['listen', 'Listen later', 'bi-headphones'], ['history', 'History', 'bi-clock-history']];
export function LibraryPage() {
  useSeo({ title: 'Library', description: 'Saved stories, your listen queue and reading history.' });
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t[0] === params.get('tab')) ? params.get('tab') : 'saved';
  const { count } = useBookmarks();
  return (
    <div className="container section">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Library' }]} />
      <h1 className="page-title">Library</h1>
      <p className="lead">Saved stories{count ? ` (${count})` : ''} can be read offline. Sign in to keep the list across devices.</p>
      <div className="seg" role="tablist" aria-label="Library">
        {TABS.map(([k, l, icon]) => (
          <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls="library-panel" tabIndex={tab === k ? 0 : -1} className={tab === k ? 'is-on' : ''} onClick={() => setParams(k === 'saved' ? {} : { tab: k })}>
            <i className={`bi ${icon}`} aria-hidden="true" /> {l}
          </button>
        ))}
      </div>
      <div id="library-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'saved' && <Saved />}
        {tab === 'listen' && <ListenLater />}
        {tab === 'history' && <History />}
      </div>
    </div>
  );
}

// ---- newsletter links ------------------------------------------------------------------------
export function NewsletterConfirmPage() {
  useSeo({ title: 'Confirm subscription', noindex: true });
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const res = useAsync(() => (token ? API.post('/newsletter/confirm', { token }).then((r) => r.data) : Promise.reject(new Error('missing'))), [token]);
  return (
    <div className="container section page-narrow">
      <h1 className="page-title">Newsletter</h1>
      {res.loading && !res.data && !res.error ? <p role="status">Confirming your subscription…</p> : res.error ? (
        <EmptyState icon="bi-envelope-x" title="This link is not valid" action={<Link to="/" className="btn btn-primary">Back to the homepage</Link>}>{errorMessage(res.error, 'The confirmation link is missing or has expired.')} Subscribe again to get a new e-mail.</EmptyState>
      ) : (
        <EmptyState icon="bi-envelope-check" title="You are subscribed" action={<Link to={`/newsletter/preferences?token=${token}`} className="btn btn-primary">Choose your topics</Link>}>{res.data.message}</EmptyState>
      )}
    </div>
  );
}

export function NewsletterPreferencesPage() {
  useSeo({ title: 'Newsletter preferences', noindex: true });
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();
  const { categories } = useCategories();
  const res = useAsync(() => (token ? API.get('/newsletter/preferences', { params: { token } }).then((r) => r.data) : Promise.reject(new Error('missing'))), [token]);
  const [picked, setPicked] = useState(null);
  const topics = picked || (res.data ? res.data.topics : []);
  const save = async () => {
    try {
      await API.put('/newsletter/preferences', { token, topics });
      toast.success('Preferences saved');
    } catch (err) { toast.error(errorMessage(err)); }
  };
  const leave = async () => {
    try {
      await API.post('/newsletter/unsubscribe', { token });
      toast.success('You have been unsubscribed');
      navigate('/');
    } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <div className="container section page-narrow">
      <h1 className="page-title">Newsletter preferences</h1>
      {res.error ? <EmptyState icon="bi-envelope-x" title="This link is not valid">It may have been used already.</EmptyState> : !res.data ? <Skeleton className="skeleton-row" /> : (
        <div className="panel">
          <p>{res.data.email} {res.data.confirmed ? '' : <span className="badge badge-pending">Not confirmed yet</span>}</p>
          <fieldset className="nl-topics nl-topics-page">
            <legend>Topics (leave empty for everything)</legend>
            {categories.map((c) => (
              <label key={c._id} className="check"><input type="checkbox" checked={topics.includes(c._id)} onChange={(e) => setPicked(e.target.checked ? [...topics, c._id] : topics.filter((x) => x !== c._id))} /> {c.name}</label>
            ))}
          </fieldset>
          <p className="editor-actions">
            <button type="button" className="btn btn-primary" onClick={save}>Save preferences</button>
            <button type="button" className="btn btn-danger" onClick={leave}>Unsubscribe</button>
          </p>
        </div>
      )}
    </div>
  );
}

// ---- preview inbox (live preview only) -------------------------------------------------------
function linkify(text) {
  return text.split(/(#\/[^\s]+)/g).map((part, i) => (part.startsWith('#/') ? <Link key={i} to={part.slice(1)}>{part}</Link> : part));
}
export function InboxPage() {
  useSeo({ title: 'Preview inbox', noindex: true });
  const list = useAsync(() => (DEMO ? API.get('/__inbox').then((r) => r.data.messages) : []), []);
  const clear = async () => { await API.delete('/__inbox'); list.reload(); };
  if (!DEMO) return <div className="container section"><EmptyState icon="bi-inbox" title="No preview inbox here">In real mode e-mail is sent through your SMTP settings.</EmptyState></div>;
  return (
    <div className="container section page-narrow">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Preview inbox' }]} />
      <h1 className="page-title">Preview inbox</h1>
      <p className="lead">The live preview sends no real e-mail. Confirmation links, newsletters and contact messages land here instead.</p>
      {list.data && list.data.length > 0 && <p><button type="button" className="btn btn-secondary btn-sm" onClick={clear}>Empty the inbox</button></p>}
      {!list.data ? <Skeleton className="skeleton-row" /> : list.data.length === 0 ? <EmptyState icon="bi-inbox" title="The inbox is empty">Subscribe to the newsletter or send a contact message to see mail arrive here.</EmptyState> : (
        <ul className="inbox-list">
          {list.data.map((m) => (
            <li key={m._id} className="card inbox-item">
              <p className="meta"><span className="badge">{m.kind}</span> To: {m.to} · {formatDateTime(m.at)}</p>
              <h2 className="inbox-subject">{m.subject}</h2>
              <p className="inbox-body">{linkify(m.text)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
