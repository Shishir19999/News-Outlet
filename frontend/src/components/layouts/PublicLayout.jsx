import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import HeaderComponent from './HeaderComponent';
import FooterComponent from './FooterComponent';
import DemoBanner from './DemoBanner';

export default function PublicLayout() {
  const { pathname } = useLocation();
  // new page: start at the top and move focus to the content for keyboard and screen reader users
  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.getElementById('main');
    if (main) main.focus({ preventScroll: true });
  }, [pathname]);
  return (
    <div className="site">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <DemoBanner />
      <HeaderComponent />
      <main id="main" tabIndex={-1} className="site-main">
        <Outlet />
      </main>
      <FooterComponent />
    </div>
  );
}
