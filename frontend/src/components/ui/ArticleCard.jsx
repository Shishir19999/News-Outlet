/* eslint-disable react-refresh/only-export-components */
import { Link } from 'react-router-dom';
import Cover from './Cover';
import Highlight from './Highlight';
import BookmarkButton from './BookmarkButton';
import { KindBadge } from './Labels';
import { formatDate, readingTime, formatNumber } from '../../lib/text';
import { variantFor, titleFor, useImpression } from '../../lib/ab';

// An article link carries the headline variant so the article page can count the click.
export const articleLink = (article) => {
  const v = variantFor(article);
  return { pathname: `/news-details/${article.slug}`, search: article.headlineB && v ? `?v=${v}` : '' };
};

export default function ArticleCard({ article, category, query = '', variant = 'card' }) {
  const to = articleLink(article);
  const title = titleFor(article);
  const ref = useImpression(article);
  const minutes = readingTime(article.description || article.summary);
  const catName = category ? category.name : '';

  if (variant === 'row') {
    return (
      <article className="row-card" ref={ref}>
        <Link to={to} className="row-card-cover" tabIndex={-1} aria-hidden="true">
          <Cover article={article} categoryName={catName} />
        </Link>
        <div className="row-card-body">
          <p className="card-labels">
            {catName && <Link to={`/category/${category.slug}`} className="kicker">{catName}</Link>}
            <KindBadge article={article} />
          </p>
          <h3 className="row-card-title"><Link to={to}><Highlight text={title} query={query} /></Link></h3>
          <p className="meta">{formatDate(article.publishedAt || article.createdAt)} · {minutes} min read</p>
        </div>
      </article>
    );
  }

  return (
    <article className="card article-card" ref={ref}>
      <Link to={to} className="article-card-cover" tabIndex={-1} aria-hidden="true">
        <Cover article={article} categoryName={catName} />
      </Link>
      <div className="card-body">
        <div className="card-topline">
          <span className="card-labels">
            {catName && <Link to={`/category/${category.slug}`} className="kicker">{catName}</Link>}
            <KindBadge article={article} />
          </span>
          <BookmarkButton id={article._id} title={article.title} article={article} />
        </div>
        <h3 className="card-title"><Link to={to}><Highlight text={title} query={query} /></Link></h3>
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
