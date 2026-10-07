import { formatNumber } from '../../lib/text';

// Horizontal bars as plain HTML, so they stay readable at any width.
export function BarChart({ rows, label, valueLabel = 'views' }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="bar-chart" aria-label={label}>
      {rows.map((r, i) => (
        <li key={r.label} className="bar-row">
          <span className="bar-label">{r.label}</span>
          <span className="bar-track" aria-hidden="true">
            <span className={`bar-fill bar-${i % 6}`} style={{ width: `${Math.max((r.value / max) * 100, r.value ? 2 : 0)}%` }} />
          </span>
          <span className="bar-value">{formatNumber(r.value)}<span className="visually-hidden"> {valueLabel}</span></span>
        </li>
      ))}
    </ul>
  );
}

const W = 600;
const H = 200;

// Area/line chart of one series. Values are drawn in an SVG; labels are HTML.
export function AreaChart({ points, label }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v) => H - 6 - (v / max) * (H - 18);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  const total = points.reduce((a, p) => a + p.value, 0);
  const mid = points[Math.floor(n / 2)];
  return (
    <figure className="area-chart">
      <div className="area-plot">
        <span className="area-max" aria-hidden="true">{formatNumber(max)}</span>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label}. Total ${total}, highest day ${max}.`} focusable="false">
          {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} className="grid-line" vectorEffect="non-scaling-stroke" />)}
          <path d={area} className="area-fill" />
          <path d={line} className="area-line" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle key={p.label} cx={x(i)} cy={y(p.value)} r="10" className="area-hit" vectorEffect="non-scaling-stroke">
              <title>{`${p.label}: ${p.value}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="area-axis" aria-hidden="true">
        <span>{points[0].label}</span><span>{mid.label}</span><span>{points[n - 1].label}</span>
      </div>
      <table className="visually-hidden">
        <caption>{label}</caption>
        <thead><tr><th>Day</th><th>Views</th></tr></thead>
        <tbody>{points.map((p) => <tr key={p.label}><td>{p.label}</td><td>{p.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
