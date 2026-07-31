import { PageHead } from '@/components/admin/ui';
import { NotWiredYet } from '@/components/admin/NotWiredYet';

export default function Disputes() {
  return (
    <>
      <PageHead
        title="Reported invoices"
        desc="Invoices flagged by a customer or a boat owner, with their note. Resolution edits are logged to the append-only audit trail."
      />
      <NotWiredYet
        what="Dispute intake"
        detail="There is no dispute/report table in the schema yet, so nothing can be flagged from the customer or owner side. Once an invoice-report model and endpoints exist, this queue lights up."
      />
    </>
  );
}
