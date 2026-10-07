import { Link } from 'react-router-dom';
import useSeo from '../../hooks/useSeo';
import Breadcrumbs from '../ui/Breadcrumbs';
import { Reveal } from '../ui/Motion';
import { SITE_NAME } from '../../config/env';

const VALUES = [
  ['bi-search', 'Verified first', 'Every claim is checked against at least two sources before it is published.'],
  ['bi-clock', 'Short and clear', 'Stories are written to be understood in a few minutes, without jargon.'],
  ['bi-shield-check', 'Independent', 'Our reporting is funded by readers. Advertisers never see a story before you do.'],
];

export default function AboutComponent() {
  useSeo({ title: 'About', description: `${SITE_NAME} is an independent newsroom covering technology, business, science, sports, culture and the world.` });
  return (
    <div className="container section page-narrow">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'About' }]} />
      <h1 className="page-title">About {SITE_NAME}</h1>
      <p className="lead">We are a small independent newsroom that explains what is happening in technology, business, science, sports, culture and the wider world, in plain language.</p>
      <p>The site began as a weekly briefing for friends and grew into a daily publication. Today a handful of editors and freelance reporters publish original stories, short explainers and long reads, and every article shows how long it takes to read before you start.</p>
      <div className="grid grid-3 values">
        {VALUES.map(([icon, title, text], i) => (
          <Reveal key={title} delay={i * 90} className="card value-card">
            <i className={`bi ${icon}`} aria-hidden="true" />
            <h2>{title}</h2>
            <p>{text}</p>
          </Reveal>
        ))}
      </div>
      <p>Have a tip, a correction or a story idea? <Link to="/contact">Get in touch</Link>.</p>
    </div>
  );
}
