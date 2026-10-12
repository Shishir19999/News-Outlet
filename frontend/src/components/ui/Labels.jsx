import { KIND_LABEL, KIND_NOTE, RATING_LABEL, RATING_VALUE, STATUS_LABEL } from '../../shared/rules';

// Editorial label next to the section name: Analysis, Opinion, Fact check, Sponsored, Live.
export function KindBadge({ article, className = '' }) {
  const kind = article.kind || 'news';
  if (kind === 'news') return article.breaking ? <span className={`kind-badge kind-breaking ${className}`}>Breaking</span> : null;
  return (
    <span className={`kind-badge kind-${kind} ${className}`} title={KIND_NOTE[kind]}>
      {kind === 'live' && <span className="live-dot" aria-hidden="true" />}
      {KIND_LABEL[kind]}{kind === 'sponsored' && article.sponsor ? ` by ${article.sponsor}` : ''}
    </span>
  );
}

// Notice at the top of an article for the labelled formats.
export function KindNotice({ article }) {
  const kind = article.kind || 'news';
  if (kind === 'news' || !KIND_NOTE[kind]) return null;
  const sponsored = kind === 'sponsored';
  return (
    <p className={`notice kind-notice kind-notice-${kind}`} role={sponsored ? 'note' : undefined}>
      <i className={`bi ${sponsored ? 'bi-cash-coin' : kind === 'fact-check' ? 'bi-patch-check' : kind === 'opinion' ? 'bi-chat-quote' : kind === 'live' ? 'bi-broadcast' : 'bi-lightbulb'}`} aria-hidden="true" />
      <span>{sponsored && article.sponsor ? `Sponsored content from ${article.sponsor}. The newsroom did not write or edit it.` : KIND_NOTE[kind]}</span>
    </p>
  );
}

export function RatingBox({ factCheck }) {
  if (!factCheck) return null;
  const value = RATING_VALUE[factCheck.rating] || 3;
  return (
    <section className={`rating-box rating-${factCheck.rating}`} aria-label="Fact check verdict">
      <p className="rating-claim"><span className="kicker">Claim checked</span><br />{factCheck.claim}</p>
      <p className="rating-verdict">
        <strong>Verdict: {RATING_LABEL[factCheck.rating]}</strong>
        <span className="rating-meter" role="img" aria-label={`${value} out of 5`}>
          {[1, 2, 3, 4, 5].map((i) => <i key={i} className={`rating-dot ${i <= value ? 'is-on' : ''}`} />)}
        </span>
      </p>
    </section>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status] || status}</span>;
}
