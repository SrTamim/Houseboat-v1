import { CustomerNav } from '@/components/customer/CustomerNav';
import { CustomerFooter } from '@/components/customer/CustomerFooter';
import { getCustomerSession } from '@/lib/customer/session';
import { CheckoutFlow } from './CheckoutFlow';

/** One node of the funnel rail (design: haorboat-checkout.html 394–402). */
function Step({
  n,
  label,
  state,
}: {
  n: string;
  label: string;
  state: 'done' | 'on' | 'todo';
}) {
  const tone =
    state === 'done'
      ? 'text-ok'
      : state === 'on'
        ? 'text-blue'
        : 'text-muted';
  const bubble =
    state === 'done'
      ? 'border-ok bg-ok text-white'
      : state === 'on'
        ? 'border-blue bg-blue text-white'
        : 'border-hair bg-chip text-muted';
  return (
    <div className={`flex items-center gap-[9px] text-sm font-bold ${tone}`}>
      <span
        className={`grid h-[26px] w-[26px] place-items-center rounded-full border-[1.5px] text-[13px] ${bubble}`}
      >
        {n}
      </span>
      {/* Numbers alone on the narrowest screens, as in the preview. */}
      <span className="max-[560px]:hidden">{label}</span>
    </div>
  );
}

/**
 * Checkout (design: haorboat-checkout.html). The login wall lives in the flow:
 * the page renders for everyone, but paying requires a signed-in customer. A
 * signed-out visitor gets the auth modal in place — no navigation, so both the
 * form state and the live cabin holds survive. The selection itself lives in
 * sessionStorage (client-side, since it is built anonymously on the boat page).
 *
 * The shell — ambient layers, nav, step rail, footer — is server-rendered; only
 * the form and summary are a client island.
 */
export default async function CheckoutPage() {
  const session = await getCustomerSession();
  const user = session.status === 'authenticated' ? session.user : null;
  return (
    <>
      {/* ambient layers — hooks live in _home/home-effects.css (preview 375–376) */}
      <div className="aurora-move" aria-hidden="true" />
      <div className="orbfield" aria-hidden="true">
        <span className="orb o-a" />
        <span className="orb o-b" />
        <span className="orb o-c" />
      </div>

      <CustomerNav user={user} />

      <div className="mx-auto max-w-wrap px-6">
        <div className="flex flex-wrap items-center justify-center gap-2 pb-2 pt-[26px]">
          <Step n="✓" label="Choose cabins" state="done" />
          <span className="h-0.5 w-10 rounded-sm bg-hair" />
          <Step n="2" label="Guest & payment" state="on" />
          <span className="h-0.5 w-10 rounded-sm bg-hair" />
          <Step n="3" label="Confirmation" state="todo" />
        </div>
      </div>

      <CheckoutFlow
        signedIn={!!user}
        defaultName={user?.name ?? ''}
        defaultPhone={user?.phone ?? ''}
        defaultEmail={user?.email ?? ''}
      />

      <CustomerFooter />
    </>
  );
}
