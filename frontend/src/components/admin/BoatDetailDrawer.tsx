import { Drawer } from './Drawer';
import { Pill } from './Pill';

// Full boat record drawer (everything except booking data). Ported from content-operations.js.
export function BoatDetailDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const footer = (
    <>
      <button className="btn btn-o" onClick={onClose}>Close</button>
      <button className="btn btn-danger">Reject</button>
      <button className="btn btn-ok">Approve → live</button>
    </>
  );
  return (
    <Drawer open={open} onClose={onClose} wide title="Meghduar · boat record" footer={footer}>
      <div className="dsec">
        <h4>Status</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <Pill tone="warn">pending approval</Pill><Pill tone="ok">profile 100%</Pill><Pill tone="ok">bank on file</Pill>
        </div>
        <div className="note ok"><span className="ic">✓</span><span>Go-live checklist met — profile complete and a bank account is on file.</span></div>
      </div>

      <div className="dsec">
        <h4>Profile</h4>
        <dl className="kv">
          <dt>Name</dt><dd>Meghduar</dd>
          <dt>Public URL</dt><dd>/houseboat/meghduar</dd>
          <dt>Status</dt><dd>pending</dd>
          <dt>Profile complete</dt><dd>100%</dd>
          <dt>Created</dt><dd>02 Jun 2026</dd>
        </dl>
        <p className="prose" style={{ marginTop: 10 }}><b>Description:</b> A two-deck houseboat built for Tanguar Haor sunrises, with an open upper deck and eight cabins.</p>
        <p className="prose" style={{ marginTop: 8 }}><b>Safety:</b> 24 life jackets, 2 life buoys, fire extinguisher, first-aid kit, licensed sukani.</p>
        <p className="prose" style={{ marginTop: 8 }}><b>Food menu:</b> Welcome tea · BBQ dinner · hilsa lunch · breakfast khichuri. Vegetarian on request.</p>
      </div>

      <div className="dsec">
        <h4>Bank &amp; billing</h4>
        <dl className="kv">
          <dt>Bank account</dt><dd>City Bank ••4821</dd>
          <dt>Account name</dt><dd>Meghduar Houseboat</dd>
          <dt>Commission</dt><dd>5.0%</dd>
          <dt>Monthly fee</dt><dd>৳ 5,000</dd>
          <dt>Trial</dt><dd>01–30 Jun 2026</dd>
          <dt>Platform balance</dt><dd>৳ 0</dd>
        </dl>
      </div>

      <div className="dsec">
        <h4>Routes</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="tag">Tanguar Haor · Sunamganj</span><span className="tag">Tahirpur · Sunamganj</span>
        </div>
      </div>

      <div className="dsec">
        <h4>Decks &amp; cabins</h4>
        <table className="mini">
          <thead><tr><th>Cabin</th><th>Deck</th><th>Category</th><th>AC</th><th>Capacity</th></tr></thead>
          <tbody>
            <tr><td className="t1">101</td><td>Lower</td><td>Luxury AC</td><td>Yes</td><td>2 (ext 3)</td></tr>
            <tr><td className="t1">102</td><td>Lower</td><td>Luxury AC</td><td>Yes</td><td>2 (ext 3)</td></tr>
            <tr><td className="t1">103</td><td>Lower</td><td>Family</td><td>Yes</td><td>4 (ext 5)</td></tr>
            <tr><td className="t1">201</td><td>Upper</td><td>Family</td><td>No</td><td>4 (ext 5)</td></tr>
          </tbody>
        </table>
        <p className="prose" style={{ marginTop: 8 }}><b>Categories:</b> Luxury AC — attached bath, balcony · Family — attached bath, twin bunk. 2 decks · 8 cabins total.</p>
      </div>

      <div className="dsec">
        <h4>Trip packages</h4>
        <table className="mini">
          <thead><tr><th>Package</th><th>Duration</th><th>Departure → return</th><th>Policy</th></tr></thead>
          <tbody>
            <tr><td className="t1">Tanguar 2D1N</td><td>2 days 1 night</td><td>Tahirpur → Tahirpur</td><td>Moderate</td></tr>
            <tr><td className="t1">Tanguar day trip</td><td>1 day</td><td>Tahirpur → Tahirpur</td><td>Moderate</td></tr>
          </tbody>
        </table>
        <p className="prose" style={{ marginTop: 8 }}><b>Included:</b> all meals, guide, life jackets. <b>Excluded:</b> personal expenses, entry fees.</p>
      </div>

      <div className="dsec">
        <h4>Pricing</h4>
        <table className="mini">
          <thead><tr><th>Profile</th><th>Category</th><th>Occupancy</th><th className="num">Per person</th></tr></thead>
          <tbody>
            <tr><td className="t1">General Day</td><td>Luxury AC</td><td>2</td><td className="num">৳ 5,000</td></tr>
            <tr><td className="t1">General Day</td><td>Family</td><td>4</td><td className="num">৳ 4,200</td></tr>
            <tr><td className="t1">Eid</td><td>Luxury AC</td><td>2</td><td className="num">৳ 7,600</td></tr>
            <tr><td className="t1">Full Moon</td><td>Luxury AC</td><td>2</td><td className="num">৳ 6,400</td></tr>
          </tbody>
        </table>
        <p className="prose" style={{ marginTop: 8 }}><b>Group bands:</b> 15–20 people ৳150,000 · 21–28 people ৳195,000 (full-boat buyout).</p>
      </div>

      <div className="dsec">
        <h4>Cancellation policy</h4>
        <dl className="kv">
          <dt>Template</dt><dd>Moderate</dd>
          <dt>Deposit</dt><dd>30%</dd>
          <dt>Shown at checkout</dt><dd>Yes</dd>
          <dt>Tiers</dt><dd>&gt;7 days 50% · &lt;7 days 0%</dd>
          <dt>Blackout</dt><dd>Eid 0% · Full moon 0%</dd>
        </dl>
        <div className="note info" style={{ marginTop: 10 }}><span className="ic">ℹ</span><span>Blackout dates are set per boat by the owner. The platform reviews them here but does not edit.</span></div>
      </div>

      <div className="dsec">
        <h4>Operating dates</h4>
        <p className="prose">Jul 2026 — 18, 19, 20, 21, 24, 25, 26, 28, 31 · Aug 2026 — 01, 02, 05, 08, 09. Only these dates generate bookable departures.</p>
      </div>

      <div className="dsec">
        <h4>Crew</h4>
        <table className="mini">
          <thead><tr><th>Name</th><th>Role</th><th>Pay</th><th>Default crew</th></tr></thead>
          <tbody>
            <tr><td className="t1">Abdul Karim</td><td>Sukani</td><td>৳ 1,200 / trip</td><td>Yes</td></tr>
            <tr><td className="t1">Rustom Ali</td><td>Cook</td><td>৳ 900 / trip</td><td>Yes</td></tr>
            <tr><td className="t1">Jamal Hossain</td><td>Helper</td><td>৳ 12,000 / month</td><td>Yes</td></tr>
          </tbody>
        </table>
      </div>

      <div className="dsec">
        <h4>Members &amp; shareholders</h4>
        <table className="mini">
          <thead><tr><th>Member</th><th>Role</th><th className="num">Share</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td className="t1">Shahin Alam</td><td>Owner</td><td className="num">60%</td><td>active</td></tr>
            <tr><td className="t1">Nazmul Haque</td><td>Shareholder</td><td className="num">40%</td><td>active</td></tr>
          </tbody>
        </table>
      </div>
    </Drawer>
  );
}
