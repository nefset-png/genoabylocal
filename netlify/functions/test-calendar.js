const { getEventsForDate } = require('./lib/calendar');

exports.handler = async () => {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  try {
    const events = await getEventsForDate('2026-07-01');
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, calendarId, eventCount: events.length })
    };
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, calendarId, error: err.message })
    };
  }
};
