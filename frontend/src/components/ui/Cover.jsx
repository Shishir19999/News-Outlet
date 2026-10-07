import { useId, useMemo } from 'react';
import { coverSpec, hasImage } from '../../lib/cover';

// Article image, or drawn artwork when the article has no picture.
export default function Cover({ article, categoryName, className = '', eager = false }) {
  const gid = useId().replace(/:/g, '');
  const seed = article ? article.slug || article.title : 'news';
  const spec = useMemo(() => coverSpec(seed, categoryName), [seed, categoryName]);

  if (article && hasImage(article.image)) {
    return (
      <div className={`cover ${className}`}>
        <img src={article.image} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" />
      </div>
    );
  }
  return (
    <div className={`cover ${className}`} aria-hidden="true">
      <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={spec.from} />
            <stop offset="1" stopColor={spec.to} />
          </linearGradient>
        </defs>
        <rect width="800" height="450" fill={`url(#g${gid})`} />
        {spec.shapes.map((s, i) => (s.kind === 'ring'
          ? <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="none" stroke="#fff" strokeWidth="14" opacity={s.opacity} />
          : <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" opacity={s.opacity} />))}
        <path d={`M0 ${spec.wave} C 200 ${spec.wave - 70}, 420 ${spec.wave + 60}, 800 ${spec.wave - 30} L800 450 L0 450 Z`} fill="#000" opacity="0.18" />
        <text x="740" y="420" textAnchor="end" fontSize="260" fontWeight="800" fill="#fff" opacity="0.1" fontFamily="Georgia, serif">{spec.letter}</text>
      </svg>
    </div>
  );
}
