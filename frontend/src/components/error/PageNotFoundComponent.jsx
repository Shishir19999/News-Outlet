import { Link } from 'react-router-dom';
import useSeo from '../../hooks/useSeo';
import { EmptyState } from '../ui/States';

export default function PageNotFoundComponent() {
  useSeo({ title: 'Page not found' });
  return (
    <div className="container section">
      <EmptyState icon="bi-compass" title="404: this page could not be found" action={<Link to="/" className="btn btn-primary">Back to the homepage</Link>}>
        The link may be broken, or the page may have been moved or removed.
      </EmptyState>
    </div>
  );
}
