const { getEventsForDate, parseBookingEvent } = require('./lib/calendar');

const ALL_GENOA_SLOTS = { '09:30': true, '14:30': true, '18:00': true };

exports.handler = async (event) => {
  const date = event.queryStringParameters?.date;
  const tourId = event.queryStringParameters?.tour;

  if (!date) return { statusCode: 400, body: JSON.stringify({ error: 'Missing date' }) };

  try {
    const events = await getEventsForDate(date);
    const bookings = events.map(parseBookingEvent).filter(Boolean);

    const hasPortofinoCT = bookings.some(b => b.tourId === 'portofino' || b.tourId === 'cinque');
    const genoaBookings = bookings.filter(b => b.tourId === 'genoa');

    // Portofino or CT booked → whole day blocked
    if (hasPortofinoCT) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: false }) };
    }

    // Checking Portofino or CT: blocked if any Genoa booking exists
    if (tourId === 'portofino' || tourId === 'cinque') {
      const available = genoaBookings.length === 0;
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available }) };
    }

    // Checking Genoa: return slot-level availability
    const takenSlots = new Set(genoaBookings.map(b => b.slot).filter(Boolean));
    const slots = {};
    for (const slot of Object.keys(ALL_GENOA_SLOTS)) {
      slots[slot] = !takenSlots.has(slot);
    }
    const anyAvailable = Object.values(slots).some(Boolean);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: anyAvailable, slots })
    };
  } catch (err) {
    console.error('check-availability error:', err);
    // On error, don't block bookings — let Stripe handle worst case
    return { statusCode: 200, body: JSON.stringify({ available: true }) };
  }
};
