import { useEffect, useRef, useState } from 'react';
import { addParallax, revealAllowed } from '../../lib/motion';

// Decorative layer that drifts slowly while its section scrolls. Nothing is rendered for
// assistive technology, and the effect is off for reduced motion / small / low-power devices.
export function Parallax({ speed = 0.12, className = '', children }) {
  const layer = useRef(null);
  useEffect(() => addParallax(layer.current, speed), [speed]);
  return (
    <div className="parallax-frame" aria-hidden="true">
      <div ref={layer} className={`parallax-layer ${className}`}>{children}</div>
    </div>
  );
}

// Fades and slides content in once when it enters the viewport.
export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  // the decision is taken once per mount; with no motion the content is simply visible
  const [animate] = useState(revealAllowed);
  useEffect(() => {
    const el = ref.current;
    if (!animate || !el) return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, [animate]);
  return (
    <Tag
      ref={ref}
      className={`${animate ? 'reveal' : ''} ${className}`.trim()}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
