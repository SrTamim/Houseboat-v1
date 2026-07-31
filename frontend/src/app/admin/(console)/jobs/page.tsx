import { PageHead } from '@/components/admin/ui';
import { NotWiredYet } from '@/components/admin/NotWiredYet';

export default function Jobs() {
  return (
    <>
      <PageHead
        title="Jobs & system health"
        desc="Cron jobs keep money and inventory correct: the hold sweeper, departure status advance, and subscription overdue marking."
      />
      <NotWiredYet
        what="Job monitoring"
        detail="The cron jobs run inside the backend (see @nestjs/schedule), but there is no run-history table yet, so there is nothing truthful to display. A job_run log table and endpoints are needed first."
      />
    </>
  );
}
