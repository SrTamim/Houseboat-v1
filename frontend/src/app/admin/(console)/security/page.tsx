import { PageHead, Note } from '@/components/admin/ui';
import { NotWiredYet } from '@/components/admin/NotWiredYet';

export default function Security() {
  return (
    <>
      <PageHead
        title="Security posture"
        desc="Every object fetch re-checks authorization; IDs are non-enumerable UUIDv7; separation-of-duties is enforced down to DB CHECK constraints."
      />
      <NotWiredYet
        what="Denied-attempt monitoring"
        detail="Authorization denials and rate-limit hits are returned to callers but not yet persisted to a reviewable log. Once denials are recorded (e.g. into the audit log), this screen can show them truthfully."
      />
      <Note kind="info" icon="ℹ" style={{ marginTop: 16 }}>
        The protections themselves are live — this page is only the reporting
        view over them.
      </Note>
    </>
  );
}
