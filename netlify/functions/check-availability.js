const { getEventsForDate, parseBookingEvent } = require('./lib/calendar');

const ALL_GENOA_SLOTS = { '09:30': true, '14:30': true, '18:00': true };

function ferryRunsOn(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (y !== 2026) return false;
  const SPECIFIC = {
    3:  [28, 29],
    4:  [2,4,5,6,9,11,12,14,16,18,19,21,23,25,26,27,28,29,30],
    5:  [1,2,3,5,7,8,9,10,12,14,16,17,19,21,23,24,26,28,30,31],
    10: [1,3,4,6,8,10,11,13,15,17,18,22,24]
  };
  if (SPECIFIC[m]) return SPECIFIC[m].includes(d);
  if (m >= 6 && m <= 9) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 1) return true;
    if (m === 6 && d === 1) return true;
    if (m === 8 && (d === 10 || d === 17)) return true;
    return false;
  }
  return false;
}

exports.handler = async (event) => {
  const date = event.queryStringParameters?.date;
  const tourId = event.queryStringParameters?.tour;

  if (!date) return { statusCode: 400, body: JSON.stringify({ error: 'Missing date' }) };

  try {
    const events = await getEventsForDate(date);

    // Check for manual all-day blocks
    const hasManualBlock = events.some(e => e.start?.date && !e.extendedProperties?.private?.tourId);
    if (hasManualBlock) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: false }) };
    }

    const bookings = events.map(parseBookingEvent).filter(Boolean);
    const hasPortofinoCT = bookings.some(b => b.tourId === 'portofino' || b.tourId === 'cinque');
    const genoaBookings = bookings.filter(b => b.tourId === 'genoa');

    if (hasPortofinoCT) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: false }) };
    }

    if (tourId === 'portofino') {
      if (!ferryRunsOn(date)) return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: false }) };
      const available = genoaBookings.length === 0;
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available }) };
    }

    if (tourId === 'cinque') {
      const available = genoaBookings.length === 0;
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available }) };
    }

    const takenSlots = new Set(genoaBookings.map(b => b.slot).filter(Boolean));
    const slots = {};
    for (const slot of Object.keys(ALL_GENOA_SLOTS)) {
      slots[slot] = !takenSlots.has(slot);
    }
    const anyAvailable = Object.values(slots).some(Boolean);

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: anyAvailable, slots }) };
  } catch (err) {
    console.error('check-availability error:', err);
    return { statusCode: 200, body: JSON.stringify({ available: true }) };
  }
};
