import { Card, EmptyState } from './ui';

/**
 * Honest placeholder for a console page whose backend does not exist yet.
 *
 * Replaces the design-preview mock screens: an admin must never mistake
 * sample rows for live data, so until an endpoint backs the page it renders
 * this state instead of fake numbers.
 */
export function NotWiredYet({ what, detail }: { what: string; detail?: string }) {
  return (
    <Card flush>
      <EmptyState
        icon="🔌"
        title={`${what} is not wired to the backend yet`}
        desc={
          detail ??
          'This screen will light up when the corresponding backend endpoints ship. No sample data is shown here on purpose — what you see in this console is always real.'
        }
      />
    </Card>
  );
}
