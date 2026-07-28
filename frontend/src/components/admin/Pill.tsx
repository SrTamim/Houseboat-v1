import type { PillTone } from '@/lib/admin/status';

export function Pill({
  tone = 'mut',
  lock = false,
  children,
}: {
  tone?: PillTone;
  lock?: boolean;
  children: React.ReactNode;
}) {
  return <span className={`pill ${tone}${lock ? ' lock' : ''}`}>{children}</span>;
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="tag">{children}</span>;
}
