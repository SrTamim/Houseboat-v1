import { PageHead } from '@/components/admin/ui';
import { NotWiredYet } from '@/components/admin/NotWiredYet';

export default function Gateway() {
  return (
    <>
      <PageHead
        title="Payment gateway"
        desc="SSLCommerz. IPN is authoritative — the raw callback is never trusted, only re-validation by val_id. Replays are idempotent no-ops via the unique gateway token."
      />
      <NotWiredYet
        what="IPN event monitoring"
        detail="Gateway callbacks are processed and recorded as invoice payments (visible in the finance queues), but raw IPN events are not stored in their own table yet — so there is no truthful event feed to show."
      />
    </>
  );
}
