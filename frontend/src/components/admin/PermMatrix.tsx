// Platform permission matrix: nav groups → tabs → real operations.
// Ported from content-system.js permMatrix(). Sample ticks = "Finance Officer".

type Tab = [tab: string, ops: string[], on: string[]];
type Group = [group: string, tabs: Tab[]];

const GROUPS: Group[] = [
  ['Overview', [
    ['Dashboard', ['view'], ['view']],
    ['Analytics', ['view', 'export'], ['view']],
  ]],
  ['Operations', [
    ['Boats', ['view', 'approve', 'suspend', 'reinstate'], ['view']],
    ['Routes', ['view', 'create', 'retire'], []],
    ['Bookings', ['view', 'cancel', 'reschedule'], ['view']],
    ['Reviews', ['view', 'hide', 'takedown'], []],
    ['Accounts', ['view', 'remove-access', 'force-verify'], ['view']],
    ['Memberships', ['view'], ['view']],
    ['Waitlist', ['view', 'reconcile'], []],
  ]],
  ['Finance', [
    ['Verify', ['view', 'mark-verified', 'flag-fraud'], ['view', 'mark-verified']],
    ['Refunds', ['view', 'verify', 'complete', 'reveal-bank'], ['view', 'verify']],
    ['Payouts', ['view', 'prepare', 'approve', 'pay', 'pull-from-batch'], ['view', 'prepare', 'approve']],
    ['Overpayments', ['view', 'refund', 'credit'], ['view', 'credit']],
    ['Credits', ['view', 'process'], ['view', 'process']],
    ['Commission', ['view', 'export'], ['view']],
    ['Subscriptions', ['view', 'issue', 'mark-paid'], ['view', 'issue', 'mark-paid']],
    ['Billing config', ['view', 'edit'], ['view', 'edit']],
    ['Debtors', ['view', 'deny', 'restore'], ['view']],
  ]],
  ['System', [
    ['Jobs & health', ['view', 'run'], []],
    ['Audit log', ['view', 'export'], ['view']],
    ['Sync conflicts', ['view', 'resolve', 'discard'], []],
    ['Notifications', ['view', 'resend'], []],
    ['Gateway', ['view'], ['view']],
    ['Settings', ['view', 'edit'], []],
    ['Roles', ['view', 'edit'], []],
  ]],
  ['Disputes & risk', [
    ['Disputes', ['view', 'edit-invoice', 'resolve'], ['view', 'edit-invoice']],
    ['Security', ['view'], ['view']],
    ['Coupons', ['view', 'create'], []],
    ['Reschedules', ['view'], ['view']],
    ['Cutoff', ['view', 'finalize'], []],
  ]],
];

export function PermMatrix() {
  return (
    <>
      {GROUPS.map(([group, tabs]) => (
        <div className="perm-grp" key={group}>
          <h5>{group}</h5>
          {tabs.map(([tab, ops, on]) => {
            const allOn = ops.every((o) => on.includes(o));
            return (
              <div className="perm" key={tab}>
                <div className="tab">
                  <label className="cbx parent">
                    <input type="checkbox" defaultChecked={allOn} /> {tab}
                  </label>
                </div>
                <div className="ops">
                  {ops.map((o) => (
                    <label className="cbx" key={o}>
                      <input type="checkbox" defaultChecked={on.includes(o)} /> {o}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
