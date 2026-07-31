import { redirect } from 'next/navigation';
import { OWNER_DASHBOARD_PATH } from '@/lib/owner/login-url';

/** /owner has no content of its own — the console starts at the dashboard. */
export default function OwnerIndexPage() {
  redirect(OWNER_DASHBOARD_PATH);
}
