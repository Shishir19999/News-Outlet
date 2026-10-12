import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import HeaderComponent from './HeaderComponent';
import FooterComponent from './FooterComponent';
import DemoBanner from './DemoBanner';
import { AlertBanner, BreakingTicker, OfflineNotice } from './Banners';

export default function PublicLayout() {
  const { pathname } = useLocation();
  // new page: start at the top and move focus to the content for keyboard and screen reader users
  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.getElementById('main');
    if (main) main.focus({ preventScroll: true });
  }, [pathname]);
  const skip = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.focus(); };
  return (
    <div className="site">
      <a className="skip-link" href="#main" onClick={skip('main')}>Skip to content</a>
      <a className="skip-link skip-link-2" href="#site-nav" onClick={(e) => { e.preventDefault(); document.querySelector('#site-nav a, #site-nav button')?.focus(); }}>Skip to navigation</a>
      <DemoBanner />
      <OfflineNotice />
      <AlertBanner />
      <HeaderComponent />
      <BreakingTicker />
      <main id="main" tabIndex={-1} className="site-main">
        <Outlet />
      </main>
      <FooterComponent />
    </div>
  );
}
