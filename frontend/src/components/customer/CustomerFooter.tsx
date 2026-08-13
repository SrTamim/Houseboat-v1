import Link from 'next/link';

/**
 * Layered brand footer shared by public customer pages. Ported verbatim from the
 * design previews (`.foot`). Pure server component — static content only.
 */
export function CustomerFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="inner">
          <div className="cols">
            <div>
              <Link className="logo" href="/">
                <span className="mark">🛥</span>Haor<span className="b">Boat</span>
              </Link>
              <p className="about">
                Bangladesh&apos;s houseboat booking platform. Real-time cabin
                availability, honest ৳ pricing, and boats we safety-check
                ourselves.
              </p>
              <div className="contact">
                <a href="#">📍 Banani, Dhaka 1213, Bangladesh</a>
                <a href="tel:+8809600000000">📞 +880 9600 000 000</a>
                <a href="mailto:hello@haorboat.com">✉️ hello@haorboat.com</a>
              </div>
              <div className="pay">
                <span>bKash</span>
                <span>Nagad</span>
                <span>Card</span>
              </div>
            </div>
            <div>
              <h4>Explore</h4>
              <ul>
                <li><Link href="/search">Houseboats</Link></li>
                <li><Link href="/search">Group trips</Link></li>
                <li><Link href="/search">Destinations</Link></li>
                <li><Link href="/#offers">Offers</Link></li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><a href="#">About us</a></li>
                <li><a href="#">Become a host</a></li>
                <li><a href="#">Safety standards</a></li>
                <li><a href="#">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4>Support</h4>
              <ul>
                <li><a href="#">Help center</a></li>
                <li><a href="#">Cancellation</a></li>
                <li><a href="#">Terms</a></li>
                <li><a href="#">Privacy</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bot">
          <span>© 2026 HaorBoat. All rights reserved. · Made in Bangladesh 🇧🇩</span>
          <div className="socials">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">◎</a>
            <a href="#" aria-label="YouTube">▶</a>
            <a href="#" aria-label="WhatsApp">✆</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
