import { CustomerNav } from '@/components/customer/CustomerNav';
import { CustomerFooter } from '@/components/customer/CustomerFooter';
import { getCustomerSession } from '@/lib/customer/session';
import { HomeHero } from './_home/HomeHero';
import { FeaturedBoats } from './_home/FeaturedBoats';
import { TrustCounter } from './_home/TrustCounter';
import { HomeOffers } from './_home/HomeOffers';

/**
 * Customer home (design: haorboat-home-v2.html). Server component: resolves the
 * session so the nav shows the account entry when signed in, then renders the
 * hero+search, trust strip, featured boats and offers. The interactive/animated
 * pieces are client islands under _home/.
 */
export default async function HomePage() {
  const session = await getCustomerSession();
  const user = session.status === 'authenticated' ? session.user : null;

  return (
    <>
      <div className="aurora-move" aria-hidden="true" />
      <div className="orbfield" aria-hidden="true">
        <span className="orb o-a" />
        <span className="orb o-b" />
        <span className="orb o-c" />
      </div>

      <CustomerNav user={user} />
      <HomeHero />
      <TrustCounter />
      <FeaturedBoats />
      <HomeOffers />
      <CustomerFooter />
    </>
  );
}
