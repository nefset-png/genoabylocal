const { getEventsForDate } = require('./lib/calendar');
const { normalizeTourId, isValidDate, getAvailability } = require('./lib/availability');

exports.handler = async (event) => {
  const date = event.queryStringParameters?.date;
  const tourId = normalizeTourId(event.queryStringParameters?.tour);

  if (!isValidDate(date) || !tourId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid date or tour' }) };
  }

  try {
    const events = await getEventsForDate(date);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getAvailability(date, tourId, events))
    };
  } catch (err) {
    console.error('check-availability error:', err);
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: false, error: 'Availability is temporarily unavailable' })
    };
  }
};
