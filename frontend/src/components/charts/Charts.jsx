import { formatNumber } from '../../lib/text';

// Every chart is a <figure> with a caption, an aria-label summary and the same numbers in a table
// (shown on request), so the data never depends on seeing the picture.
function DataTable({ caption, columns, rows }) {
  return (
    <details className="chart-data">
      <summary>View as table</summary>
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i} className="num">{cell}</td>))}</tr>)}</tbody>
      </table>
    </details>
  );
}

// Horizontal bars as plain HTML, so they stay readable at any width.
export function BarChart({ rows, label, valueLabel = 'views', unit = '', column = 'Value', max: fixedMax }) {
  const max = fixedMax || Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <figure className="chart">
      <figcaption className="visually-hidden">{label}. Total {total}.</figcaption>
      <ul className="bar-chart" aria-label={label}>
        {rows.map((r, i) => (
          <li key={r.label} className="bar-row">
            <span className="bar-label">{r.label}</span>
            <span className="bar-track" aria-hidden="true">
              <span className={`bar-fill bar-${i % 6}`} style={{ width: `${Math.max((r.value / max) * 100, r.value ? 2 : 0)}%` }} />
            </span>
            <span className="bar-value">{formatNumber(r.value)}{unit}<span className="visually-hidden"> {valueLabel}</span></span>
          </li>
        ))}
      </ul>
      <DataTable caption={label} columns={['Item', column]} rows={rows.map((r) => [r.label, `${r.value}${unit}`])} />
    </figure>
  );
}

const W = 600;
const H = 200;

// Area/line chart of one series. Values are drawn in an SVG; labels are HTML.
export function AreaChart({ points, label, column = 'Views' }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v) => H - 6 - (v / max) * (H - 18);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  const total = points.reduce((a, p) => a + p.value, 0);
  const peak = points.reduce((m, p) => (p.value > m.value ? p : m), points[0]);
  const mid = points[Math.floor(n / 2)];
  return (
    <figure className="area-chart chart">
      <figcaption className="visually-hidden">{label}</figcaption>
      <div className="area-plot">
        <span className="area-max" aria-hidden="true">{formatNumber(max)}</span>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label}. From ${points[0].label} to ${points[n - 1].label}. Total ${total}, highest ${peak.value} on ${peak.label}.`} focusable="false">
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
      <DataTable caption={label} columns={['Day', column]} rows={points.map((p) => [p.label, p.value])} />
    </figure>
  );
}
