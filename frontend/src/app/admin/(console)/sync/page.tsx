import { PageHead } from '@/components/admin/ui';
import { NotWiredYet } from '@/components/admin/NotWiredYet';

export default function Sync() {
  return (
    <>
      <PageHead
        title="Offline-sync conflicts"
        desc="Replayed intents are re-authorized against permissions as of device time. Failures land here for a human — never silently applied or dropped."
      />
      <NotWiredYet
        what="Sync conflict review"
        detail="The sync module accepts offline replays, but a conflict queue (rejected intents held for review) is not stored yet, so there is nothing truthful to display here."
      />
    </>
  );
}
