const GENOA_HALF_SLOTS = ['09:30', '14:30'];
const DAY_BLOCKING_TOURS = new Set(['portofino', 'cinque', 'genoa-full']);
const TOUR_SLOTS = {
  'genoa-half': GENOA_HALF_SLOTS,
  'genoa-full': ['09:30'],
  portofino: ['09:30'],
  cinque: ['07:30', '08:30']
};

function normalizeTourId(tourId) {
  return tourId === 'genoa' ? 'genoa-half' : tourId;
}

function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const value = new Date(Date.UTC(y, m - 1, d));
  return value.getUTCFullYear() === y && value.getUTCMonth() === m - 1 && value.getUTCDate() === d;
}

function todayInRome(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function isBookableDate(dateStr, now = new Date()) {
  return isValidDate(dateStr) && dateStr >= todayInRome(now);
}

function ferryRunsOn(dateStr) {
  if (!isValidDate(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (y !== 2026) return false;
  const specific = {
    3: [28, 29],
    4: [2, 4, 5, 6, 9, 11, 12, 14, 16, 18, 19, 21, 23, 25, 26, 27, 28, 29, 30],
    5: [1, 2, 3, 5, 7, 8, 9, 10, 12, 14, 16, 17, 19, 21, 23, 24, 26, 28, 30, 31],
    10: [1, 3, 4, 6, 8, 10, 11, 13, 15, 17, 18, 22, 24]
  };
  if (specific[m]) return specific[m].includes(d);
  if (m >= 6 && m <= 9) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow !== 1) return true;
    return (m === 6 && d === 1) || (m === 8 && (d === 10 || d === 17));
  }
  return false;
}

function parseActiveBooking(event, now = Date.now()) {
  const props = event.extendedProperties?.private || {};
  if (!props.tourId) return null;
  if (props.status === 'tentative' && props.expiresAt && now > parseInt(props.expiresAt, 10)) return null;
  return {
    tourId: normalizeTourId(props.tourId),
    slot: props.slot || null
  };
}

function getAvailability(dateStr, tourId, events, now = Date.now()) {
  const normalizedTourId = normalizeTourId(tourId);
  const allowedSlots = TOUR_SLOTS[normalizedTourId];
  if (!isValidDate(dateStr) || !allowedSlots) return { available: false, slots: {} };

  const eventsForDate = events.filter(event => {
    const eventDate = event.start?.date || (event.start?.dateTime || '').split('T')[0];
    return eventDate === dateStr;
  });

  const hasManualBlock = eventsForDate.some(event => event.start?.date && !event.extendedProperties?.private?.tourId);
  if (hasManualBlock) return { available: false, slots: {} };

  const bookings = eventsForDate.map(event => parseActiveBooking(event, now)).filter(Boolean);
  if (bookings.some(booking => DAY_BLOCKING_TOURS.has(booking.tourId))) {
    return { available: false, slots: {} };
  }

  const halfBookings = bookings.filter(booking => booking.tourId === 'genoa-half');
  if (normalizedTourId === 'portofino') {
    return { available: ferryRunsOn(dateStr) && halfBookings.length === 0, slots: {} };
  }
  if (normalizedTourId === 'cinque' || normalizedTourId === 'genoa-full') {
    return { available: halfBookings.length === 0, slots: {} };
  }

  const takenSlots = new Set(halfBookings.map(booking => booking.slot).filter(Boolean));
  const slots = Object.fromEntries(allowedSlots.map(slot => [slot, !takenSlots.has(slot)]));
  return { available: Object.values(slots).some(Boolean), slots };
}

function isAllowedSlot(tourId, time) {
  return (TOUR_SLOTS[normalizeTourId(tourId)] || []).includes(time);
}

module.exports = {
  TOUR_SLOTS,
  normalizeTourId,
  isValidDate,
  isBookableDate,
  ferryRunsOn,
  getAvailability,
  isAllowedSlot
};
