import { AdminChrome } from '@/components/admin/AdminChrome';

// Console chrome (sidebar + topbar) for all admin pages except login.
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}
