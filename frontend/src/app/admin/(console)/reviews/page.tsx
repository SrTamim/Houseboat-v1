import { PageHead, Card, TableWrap, Search } from '@/components/admin/ui';
import { Pill } from '@/components/admin/Pill';

export default function Reviews() {
  return (
    <>
      <PageHead
        title="Reviews moderation"
        desc="Reviews come only from verified, completed bookings. Hide abuse; the eligibility gate blocks fakes at the source."
      />
      <div className="filterbar">
        <div className="seg">
          <button className="seg-b on">All<span className="ct">214</span></button>
          <button className="seg-b">Flagged<span className="ct">3</span></button>
          <button className="seg-b">Hidden<span className="ct">1</span></button>
          <button className="seg-b">No reply<span className="ct">40</span></button>
        </div>
        <Search placeholder="Search text or boat…" />
      </div>
      <Card flush>
        <TableWrap>
          <thead>
            <tr><th>Boat</th><th>Rating</th><th>Review</th><th>Owner reply</th><th></th></tr>
          </thead>
          <tbody>
            <tr><td className="t1">Jol Kolol</td><td><span style={{ color: 'var(--amber)' }}>★★★★★</span></td><td>Crew was fantastic, sunrise over the haor was unreal.<div className="t2">Tanvir H. · verified</div></td><td className="t2">Thank you!</td><td className="rowact"><button className="btn btn-sm btn-o">Hide</button></td></tr>
            <tr><td className="t1">Haor Bilash</td><td><span style={{ color: 'var(--amber)' }}>★★★★</span>☆</td><td>Good food, cabin AC was weak on day 2.<div className="t2">Sadia R. · verified</div></td><td className="t2">—</td><td className="rowact"><button className="btn btn-sm btn-o">Hide</button></td></tr>
            <tr><td className="t1">Bhela</td><td><span style={{ color: 'var(--amber)' }}>★</span>☆☆☆☆</td><td>Contact me on WhatsApp 013… for cheaper direct booking.<div className="t2"><Pill tone="danger">flagged · spam</Pill></div></td><td className="t2">—</td><td className="rowact"><button className="btn btn-sm btn-danger">Take down</button></td></tr>
            <tr><td className="t1">Meghduar</td><td><span style={{ color: 'var(--amber)' }}>★★★★★</span></td><td>Best trip of the year. Highly recommend the upper deck.<div className="t2">Imran K. · verified</div></td><td className="t2">🙏</td><td className="rowact"><button className="btn btn-sm btn-o">Hide</button></td></tr>
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
