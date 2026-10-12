import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import API from '../../config/API';
import useAsync from '../../hooks/useAsync';
import useSeo from '../../hooks/useSeo';
import { useCategories } from '../../context/CategoriesContext';
import PaginationComponent from '../layouts/PaginationComponent';
import ArticleCard from '../ui/ArticleCard';
import Breadcrumbs from '../ui/Breadcrumbs';
import { CardGridSkeleton, EmptyState, ErrorState } from '../ui/States';
import { KINDS, KIND_LABEL } from '../../shared/rules';

const SORTS = [['latest', 'Newest first'], ['popular', 'Most read'], ['oldest', 'Oldest first']];
const PERIODS = [['', 'Any time'], ['1', 'Past 24 hours'], ['7', 'Past week'], ['30', 'Past month']];

// Latest news and search: typo tolerant, with section, type, topic, date and sort filters.
export default function NewsComponent() {
  const [params, setParams] = useSearchParams();
  const { categories, byId, bySlug } = useCategories();
  const search = params.get('search') || '';
  const catSlug = params.get('category') || '';
  const period = params.get('period') || '';
  const kind = params.get('kind') || '';
  const tag = params.get('tag') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const sort = params.get('sort') || 'latest';
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);
  const category = catSlug ? bySlug(catSlug) : null;
  const [draft, setDraft] = useState(search);

  useSeo({ title: search ? `Search: ${search}` : 'Latest news', description: 'Search and filter every story by section, type, date and popularity.' });

  // typing updates the URL after a short pause, so each keystroke does not hit the API
  useEffect(() => {
    if (draft === search) return undefined;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (draft.trim()) next.set('search', draft.trim()); else next.delete('search');
      next.delete('page');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [draft, search, params, setParams]);

  const [prevSearch, setPrevSearch] = useState(search);
  if (prevSearch !== search) {
    setPrevSearch(search);
    setDraft(search);
  }

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setParams(next);
  };
  const setPage = (p) => {
    const next = new URLSearchParams(params);
    if (p > 1) next.set('page', String(p)); else next.delete('page');
    setParams(next);
    window.scrollTo({ top: 0 });
  };

  const waitingForCategory = catSlug && !category && categories.length === 0;
  const list = useAsync(() => (waitingForCategory ? null : API.get('/news', {
    params: { page, limit: 9, search: search || undefined, categoryId: category ? category._id : undefined, period: period || undefined, kind: kind || undefined, tag: tag || undefined, from: from || undefined, to: to || undefined, sort },
  }).then((r) => r.data)), [page, search, category && category._id, period, kind, tag, from, to, sort, waitingForCategory]);

  const clear = () => { setDraft(''); setParams({}); };
  const filtered = !!(search || catSlug || period || kind || tag || from || to || sort !== 'latest');
  const data = list.data;

  return (
    <div className="container section">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: search ? 'Search' : 'Latest news' }]} />
      <h1 className="page-title">{search ? <>Results for &ldquo;{search}&rdquo;</> : tag ? <>Topic: #{tag}</> : 'Latest news'}</h1>

      <form className="filters card" role="search" aria-label="Filter stories" onSubmit={(e) => e.preventDefault()}>
        <div className="field filter-search">
          <label htmlFor="f-search">Search</label>
          <input id="f-search" type="search" className="input" placeholder="Search headlines, summaries and topics" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="f-cat">Section</label>
          <select id="f-cat" className="input" value={catSlug} onChange={(e) => update('category', e.target.value)}>
            <option value="">All sections</option>
            {categories.map((c) => <option key={c._id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-kind">Type</label>
          <select id="f-kind" className="input" value={kind} onChange={(e) => update('kind', e.target.value)}>
            <option value="">All types</option>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-period">Date</label>
          <select id="f-period" className="input" value={period} onChange={(e) => update('period', e.target.value)}>
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-sort">Sort by</label>
          <select id="f-sort" className="input" value={sort} onChange={(e) => update('sort', e.target.value === 'latest' ? '' : e.target.value)}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-from">From</label>
          <input id="f-from" type="date" className="input" value={from} onChange={(e) => update('from', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="f-to">To</label>
          <input id="f-to" type="date" className="input" value={to} onChange={(e) => update('to', e.target.value)} />
        </div>
        {filtered && <button type="button" className="btn btn-secondary" onClick={clear}>Clear filters</button>}
      </form>

      <p className="result-count" role="status" aria-live="polite">
        {data ? `${data.total} ${data.total === 1 ? 'story' : 'stories'}${data.fuzzy ? ' (including close matches for your spelling)' : ''}` : ' '}
      </p>
      {data && data.suggestion && (
        <p className="notice">Did you mean <Link to={`/news?search=${encodeURIComponent(data.suggestion)}`}><strong>{data.suggestion}</strong></Link>?</p>
      )}

      {list.error ? <ErrorState onRetry={list.reload} /> : (list.loading && !data) || !data ? <CardGridSkeleton count={9} /> : data.news.length === 0 ? (
        <EmptyState icon="bi-search" title="No stories match" action={filtered ? <button type="button" className="btn btn-primary" onClick={clear}>Clear filters</button> : null}>
          Try a different keyword or widen the filters.
        </EmptyState>
      ) : (
        <>
        <h2 className="visually-hidden">Stories</h2>
        <div className={`grid grid-3 ${list.loading ? 'is-loading' : ''}`}>
          {data.news.map((a) => <ArticleCard key={a._id} article={a} category={byId(a.categoryId)} query={search} />)}
        </div>
        </>
      )}
      {data && <PaginationComponent page={page} pages={data.pages} onChange={setPage} />}
    </div>
  );
}
