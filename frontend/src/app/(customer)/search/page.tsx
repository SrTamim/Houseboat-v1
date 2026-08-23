import { Suspense } from 'react';
import { CustomerNav } from '@/components/customer/CustomerNav';
import { CustomerFooter } from '@/components/customer/CustomerFooter';
import { getCustomerSession } from '@/lib/customer/session';
import { SearchResults } from './SearchResults';

/**
 * Search results (design: haorboat-search.html). Server shell resolves the
 * session for the nav and renders the ambient motion layers; the interactive
 * search bar / filters / results view is a client island (it reads the URL
 * query, so it needs the Suspense boundary).
 */
export default async function SearchPage() {
  const session = await getCustomerSession();
  const user = session.status === 'authenticated' ? session.user : null;
  return (
    <>
      {/* ambient layers — hooks live in _home/home-effects.css (preview 380–382) */}
      <div className="aurora-move" aria-hidden="true" />
      <div className="orbfield" aria-hidden="true">
        <span className="orb o-a" />
        <span className="orb o-b" />
        <span className="orb o-c" />
      </div>

      <CustomerNav user={user} />
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
      <CustomerFooter />
    </>
  );
}
