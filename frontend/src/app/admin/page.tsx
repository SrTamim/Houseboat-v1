import { redirect } from 'next/navigation';
import { DASHBOARD_PATH } from '@/lib/admin/login-url';

/**
 * Lives OUTSIDE the (console) route group on purpose.
 *
 * Inside it, this inherited the console's auth gate, so hitting /admin ran
 * getAdminSession() here, redirected to /admin/dashboard, and ran it again —
 * two backend round-trips and a visible flash for a single navigation. Route
 * groups don't affect the URL, so this still serves /admin.
 */
export default function AdminIndex() {
  redirect(DASHBOARD_PATH);
}
