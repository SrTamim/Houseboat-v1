import Link from 'next/link';
import { PageHead } from '@/components/admin/ui';
import { DashboardOverview } from '@/components/admin/DashboardOverview';
import { getAdminSession } from '@/lib/admin/session';

/** Dhaka-local time of day — the console audience operates on UTC+6. */
function timeOfDayGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Dhaka',
    }).format(new Date()),
  );
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function Dashboard() {
  const session = await getAdminSession();
  const name =
    session.status === 'authenticated' && session.user.name
      ? `, ${session.user.name.split(' ')[0]}`
      : '';

  return (
    <>
      <PageHead
        title={`${timeOfDayGreeting()}${name}`}
        desc="What needs a human right now across all boats."
        actions={
          <>
            <Link className="btn btn-o" href="/admin/analytics">📈 Analytics</Link>
            <Link className="btn btn-b" href="/admin/finance/verify">Verification queue →</Link>
          </>
        }
      />
      <DashboardOverview />
    </>
  );
}
