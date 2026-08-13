import { Suspense } from 'react';
import { CustomerNav } from '@/components/customer/CustomerNav';
import { CustomerFooter } from '@/components/customer/CustomerFooter';
import { getCustomerSession } from '@/lib/customer/session';
import { SearchResults } from './SearchResults';

/**
 * Search results (design: haorboat-search.html). Server shell resolves the
 * session for the nav; the interactive filter/result view is a client island
 * (it reads the URL query and refetches).
 */
export default async function SearchPage() {
  const session = await getCustomerSession();
  const user = session.status === 'authenticated' ? session.user : null;
  return (
    <>
      <CustomerNav user={user} />
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
      <CustomerFooter />
    </>
  );
}
