import { Link } from 'react-router-dom';
import API from '../../config/API';
import useAsync from '../../hooks/useAsync';
import useSeo from '../../hooks/useSeo';
import { useBookmarks } from '../../context/BookmarksContext';
import { useCategories } from '../../context/CategoriesContext';
import ArticleCard from '../ui/ArticleCard';
import Breadcrumbs from '../ui/Breadcrumbs';
import { CardGridSkeleton, EmptyState, ErrorState } from '../ui/States';

export default function BookmarksComponent() {
  useSeo({ title: 'Reading list', description: 'Articles you saved to read later.' });
  const { ids } = useBookmarks();
  const { byId } = useCategories();
  const key = ids.join(',');
  const list = useAsync(() => (ids.length
    ? API.get('/news', { params: { ids: key, limit: 50 } }).then((r) => r.data.news)
    : []), [key]);

  // keep the order the reader saved them in
  const articles = (list.data || []).slice().sort((a, b) => ids.indexOf(a._id) - ids.indexOf(b._id)).filter((a) => ids.includes(a._id));

  return (
    <div className="container section">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Reading list' }]} />
      <h1 className="page-title">Reading list</h1>
      <p className="lead">Stories you saved to read later{ids.length ? ` (${ids.length})` : ''}. Sign in to keep the list across devices.</p>
      {list.error ? <ErrorState onRetry={list.reload} /> : list.loading && ids.length ? <CardGridSkeleton count={Math.min(ids.length, 6)} /> : articles.length === 0 ? (
        <EmptyState icon="bi-bookmark" title="Nothing saved yet" action={<Link to="/news" className="btn btn-primary">Browse the latest news</Link>}>
          Tap the bookmark on any story to keep it here.
        </EmptyState>
      ) : (
        <div className="grid grid-3">
          {articles.map((a) => <ArticleCard key={a._id} article={a} category={byId(a.categoryId)} />)}
        </div>
      )}
    </div>
  );
}
