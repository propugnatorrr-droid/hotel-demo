-- A room cannot have overlapping active reservations.
-- Half-open ranges mean checkout on the 12th and check-in on the 12th are valid.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM bookings a
    JOIN bookings b
      ON a.org_id = b.org_id
     AND a.room_id = b.room_id
     AND a.id < b.id
     AND a.check_in < b.check_out
     AND b.check_in < a.check_out
    WHERE a.room_id IS NOT NULL
      AND a.status IN ('tentative', 'confirmed', 'checked_in')
      AND b.status IN ('tentative', 'confirmed', 'checked_in')
  ) THEN
    RAISE EXCEPTION
      'Existing bookings overlap. Resolve them before adding the room availability constraint.';
  END IF;
END $$;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_valid_stay
  CHECK (check_out > check_in);

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_room_overlap
  EXCLUDE USING gist (
    org_id WITH =,
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (
    room_id IS NOT NULL
    AND status IN ('tentative', 'confirmed', 'checked_in')
  );

-- One folio for a booking. Multiple folios for unbooked walk-in accounting
-- remain possible because PostgreSQL unique indexes allow multiple NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS folios_one_per_booking
  ON folios (org_id, booking_id)
  WHERE booking_id IS NOT NULL;
