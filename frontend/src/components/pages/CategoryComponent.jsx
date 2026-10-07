import { useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../../config/API';
import useAsync from '../../hooks/useAsync';
import useSeo from '../../hooks/useSeo';
import { useCategories } from '../../context/CategoriesContext';
import PaginationComponent from '../layouts/PaginationComponent';
import ArticleCard from '../ui/ArticleCard';
import Breadcrumbs from '../ui/Breadcrumbs';
import { Parallax, Reveal } from '../ui/Motion';
import { CardGridSkeleton, EmptyState, ErrorState, BackHome } from '../ui/States';
import { hueFor } from '../../lib/cover';

export default function CategoryComponent() {
  const { slug } = useParams();
  const { bySlug, byId, loading: catLoading, error: catError, reload } = useCategories();
  const category = bySlug(slug);
  const [pageState, setPageState] = useState({ slug, page: 1 });
  const page = pageState.slug === slug ? pageState.page : 1;

  useSeo({
    title: category ? category.name : 'Section',
    description: category ? (category.description || `The latest ${category.name} stories.`) : undefined,
  });

  const list = useAsync(() => (category
    ? API.get('/news', { params: { categoryId: category._id, page, limit: 9 } }).then((r) => r.data)
    : null), [category && category._id, page]);

  if (catError) return <div className="container section"><ErrorState onRetry={reload} /></div>;
  if (!catLoading && !category) {
    return <div className="container section"><EmptyState icon="bi-folder-x" title="Section not found" action={<BackHome />}>There is no section with this name.</EmptyState></div>;
  }

  const hue = category ? hueFor(category.name, slug) : 220;
  const data = list.data;
  return (
    <>
      <header className="category-header" style={{ '--cat-hue': hue }}>
        <Parallax speed={0.14} className="category-shape category-shape-a" />
        <Parallax speed={-0.09} className="category-shape category-shape-b" />
        <Reveal className="container">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: category ? category.name : '…' }]} />
          <h1 className="page-title">{category ? category.name : 'Loading…'}</h1>
          {category && <p className="lead">{category.description}</p>}
        </Reveal>
      </header>
      <div className="container section">
        {list.error ? <ErrorState onRetry={list.reload} /> : !data ? <CardGridSkeleton count={6} /> : data.news.length === 0 ? (
          <EmptyState icon="bi-newspaper" title="No stories in this section yet">Check back soon.</EmptyState>
        ) : (
          <div className="grid grid-3">
            {data.news.map((a) => <ArticleCard key={a._id} article={a} category={byId(a.categoryId)} />)}
          </div>
        )}
        {data && <PaginationComponent page={page} pages={data.pages} onChange={(p) => { setPageState({ slug, page: p }); window.scrollTo({ top: 0 }); }} />}
      </div>
    </>
  );
}
