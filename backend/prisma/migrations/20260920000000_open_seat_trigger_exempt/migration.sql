-- Open-seat join fix (audit #5 / F10).
--
-- The one-active-cabin trigger (00000000000001_constraints) rejects any second
-- active booking_cabin for the same cabin on a departure. That is correct for
-- normal cabins, but it ALSO blocked the open-seat feature: a joiner inserts a
-- second booking_cabin on the seat's cabin (the first booker's row still exists),
-- so every joinOpenSeat threw unique_violation and the feature never worked.
--
-- Fix: exclude the EXISTING open-seat row (is_open_seat = true) from the clash
-- count. So:
--   * a joiner onto an open seat is allowed (the existing open-seat row is not
--     counted);
--   * a SECOND joiner is still blocked — joinOpenSeat flips the seat to
--     is_open_seat = false once filled, so the existing row is then counted;
--   * two regular bookings on a normal cabin are still blocked (neither row is an
--     open seat), so no oversell hole is opened.
-- Room capacity is separately enforced in BookingService.joinOpenSeat.
--
-- Function replacement only — the trigger binding is unchanged. Reversible by
-- restoring the previous function body.
CREATE OR REPLACE FUNCTION enforce_one_active_cabin_per_departure()
RETURNS TRIGGER AS $$
DECLARE
  dep uuid;
  clash int;
BEGIN
  -- The rule protects against a NEW active booking_cabin colliding with an
  -- existing one on the same cabin+departure. An UPDATE that does not move the
  -- row to a different cabin cannot create a new collision (the row was already
  -- accepted), so skip it. This is what lets joinOpenSeat flip the filled seat's
  -- own row to is_open_seat = false without the check re-firing against the
  -- joiner's row it just inserted.
  IF (TG_OP = 'UPDATE' AND NEW.cabin_id = OLD.cabin_id) THEN
    RETURN NEW;
  END IF;

  SELECT departure_id INTO dep FROM booking WHERE id = NEW.booking_id;

  SELECT count(*) INTO clash
  FROM booking_cabin bc
  JOIN booking b ON b.id = bc.booking_id
  WHERE bc.cabin_id = NEW.cabin_id
    AND b.departure_id = dep
    AND b.status NOT IN ('cancelled')
    AND bc.id <> NEW.id
    -- An open-seat cabin is deliberately shareable: don't count the seat's own
    -- (still-open) row against a joiner INSERT. Once the seat is filled it is
    -- flipped to is_open_seat = false, but that flip is an in-place UPDATE which
    -- is skipped above, so a later genuine second INSERT on a filled cabin is
    -- still blocked (the existing row is then is_open_seat = false and counted).
    AND bc.is_open_seat = false;

  IF clash > 0 THEN
    RAISE EXCEPTION 'cabin % already booked on this departure', NEW.cabin_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
