const { getEventsForDate } = require('./lib/calendar');

exports.handler = async () => {
  try {
    const events = await getEventsForDate('2026-07-01');
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, eventCount: events.length, events: events.map(e => e.summary) })
    };
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, error: err.message, stack: err.stack })
    };
  }
};
