import Link from 'next/link';

/** Special offers strip (design: haorboat-home-v2.html `.offers`). Static. */
export function HomeOffers() {
  return (
    <section className="offers-sec" id="offers">
      <div className="wrap">
        <div className="row-head">
          <div>
            <span className="eb">Limited time</span>
            <h2>Special offers</h2>
          </div>
          <Link className="more" href="/search">
            All offers <span>→</span>
          </Link>
        </div>
        <div className="offers">
          <Link className="offer o1" href="/search">
            <span className="otag">Eid special</span>
            <h3>Up to 25% off Tanguar Haor cruises</h3>
            <p>Book a 2-night monsoon trip and save on every AC cabin.</p>
            <span className="olink">Grab deal →</span>
          </Link>
          <Link className="offer o2" href="/search">
            <span className="otag">Group saver</span>
            <h3>Charter a full boat, pay for 8</h3>
            <p>Groups of 10+ get two seats free on Nikli &amp; Padma routes.</p>
            <span className="olink">See group rates →</span>
          </Link>
          <Link className="offer o3" href="/search">
            <span className="otag">First trip</span>
            <h3>৳500 off your first booking</h3>
            <p>
              New to HaorBoat? Use code <b>HAOR500</b> at checkout.
            </p>
            <span className="olink">Start booking →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
