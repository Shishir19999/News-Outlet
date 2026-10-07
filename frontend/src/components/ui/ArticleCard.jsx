import { Link } from 'react-router-dom';
import Cover from './Cover';
import Highlight from './Highlight';
import BookmarkButton from './BookmarkButton';
import { formatDate, readingTime, formatNumber } from '../../lib/text';

export default function ArticleCard({ article, category, query = '', variant = 'card' }) {
  const to = `/news-details/${article.slug}`;
  const minutes = readingTime(article.description || article.summary);
  const catName = category ? category.name : '';

  if (variant === 'row') {
    return (
      <article className="row-card">
        <Link to={to} className="row-card-cover" tabIndex={-1} aria-hidden="true">
          <Cover article={article} categoryName={catName} />
        </Link>
        <div className="row-card-body">
          {catName && <Link to={`/category/${category.slug}`} className="kicker">{catName}</Link>}
          <h3 className="row-card-title"><Link to={to}><Highlight text={article.title} query={query} /></Link></h3>
          <p className="meta">{formatDate(article.publishedAt || article.createdAt)} · {minutes} min read</p>
        </div>
      </article>
    );
  }

  return (
    <article className="card article-card">
      <Link to={to} className="article-card-cover" tabIndex={-1} aria-hidden="true">
        <Cover article={article} categoryName={catName} />
      </Link>
      <div className="card-body">
        <div className="card-topline">
          {catName ? <Link to={`/category/${category.slug}`} className="kicker">{catName}</Link> : <span />}
          <BookmarkButton id={article._id} title={article.title} />
        </div>
        <h3 className="card-title"><Link to={to}><Highlight text={article.title} query={query} /></Link></h3>
        <p className="card-text"><Highlight text={article.summary} query={query} /></p>
        <p className="meta">
          <span>{formatDate(article.publishedAt || article.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{minutes} min read</span>
          {article.views > 0 && (<><span aria-hidden="true">·</span><span><i className="bi bi-eye" aria-hidden="true" /> {formatNumber(article.views)}</span></>)}
        </p>
      </div>
    </article>
  );
}
