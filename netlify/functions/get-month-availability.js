const { google } = require('googleapis');
const { TOUR_SLOTS, normalizeTourId, getAvailability } = require('./lib/availability');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

function getCalendar() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/calendar'] });
  return google.calendar({ version: 'v3', auth });
}

exports.handler = async (event) => {
  const { year, month, tour } = event.queryStringParameters || {};
  const requestedTour = normalizeTourId(tour);
  if (!year || !month || !tour) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing params' }) };
  }

  const y = parseInt(year);
  const m = parseInt(month);
  if (!Number.isInteger(y) || y < 2026 || y > 2030 || !Number.isInteger(m) || m < 1 || m > 12 || !TOUR_SLOTS[requestedTour]) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid params' }) };
  }
  const lastDay = new Date(y, m, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  const monthStr = pad(m);

  const timeMin = new Date(`${year}-${monthStr}-01T00:00:00+01:00`).toISOString();
  const timeMax = new Date(`${year}-${monthStr}-${lastDay}T23:59:59+02:00`).toISOString();

  let calendarEvents;
  try {
    const cal = getCalendar();
    const res = await cal.events.list({ calendarId: CALENDAR_ID, timeMin, timeMax, singleEvents: true });
    calendarEvents = res.data.items || [];
  } catch (e) {
    console.error('Calendar error:', e.message);
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Availability is temporarily unavailable' })
    };
  }

  const eventsByDate = {};
  for (const event of calendarEvents) {
    const dateStr = event.start?.date || (event.start?.dateTime || '').split('T')[0];
    if (!dateStr) continue;
    if (!eventsByDate[dateStr]) eventsByDate[dateStr] = [];
    eventsByDate[dateStr].push(event);
  }

  const blockedDates = [];
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${monthStr}-${pad(day)}`;
    if (!getAvailability(dateStr, requestedTour, eventsByDate[dateStr] || []).available) blockedDates.push(dateStr);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blockedDates })
  };
};
