const { google } = require('googleapis');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const HOLD_MINUTES = 35;

const TOUR_DURATION_HOURS = { genoa: 3, portofino: 11, cinque: 12 };

function getCalendar() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
  return google.calendar({ version: 'v3', auth });
}

function getEventTimes(date, time, tourId) {
  const [h, m] = time.split(':').map(Number);
  const start = new Date(`${date}T${time}:00+02:00`);
  const hours = TOUR_DURATION_HOURS[tourId] || 3;
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  return {
    start: { dateTime: start.toISOString(), timeZone: 'Europe/Rome' },
    end: { dateTime: end.toISOString(), timeZone: 'Europe/Rome' }
  };
}

async function createTentativeEvent({ date, time, tourId, tourName, customerName, sessionId }) {
  const cal = getCalendar();
  const times = getEventTimes(date, time, tourId);
  const expiresAt = String(Date.now() + HOLD_MINUTES * 60 * 1000);

  const res = await cal.events.insert({
    calendarId: CALENDAR_ID,
    resource: {
      summary: `[HOLD] ${tourName} — ${customerName}`,
      ...times,
      colorId: '5',
      extendedProperties: {
        private: { tourId, slot: time, date, sessionId, status: 'tentative', expiresAt }
      }
    }
  });

  return res.data.id;
}

async function confirmEvent(eventId, { tourName, customerName, guestSummary, paymentMode }) {
  const cal = getCalendar();
  const existing = (await cal.events.get({ calendarId: CALENDAR_ID, eventId })).data;
  const paid = paymentMode === 'full' ? 'Fully paid' : 'Deposit paid';

  await cal.events.update({
    calendarId: CALENDAR_ID,
    eventId,
    resource: {
      ...existing,
      summary: `${tourName} — ${customerName}`,
      description: `${guestSummary} · ${paid}`,
      colorId: '10',
      extendedProperties: {
        private: { ...existing.extendedProperties?.private, status: 'confirmed' }
      }
    }
  });
}

async function deleteEvent(eventId) {
  const cal = getCalendar();
  try {
    await cal.events.delete({ calendarId: CALENDAR_ID, eventId });
  } catch (e) {
    console.error('Could not delete calendar event:', e.message);
  }
}

async function getEventsForDate(dateStr) {
  const cal = getCalendar();
  const timeMin = new Date(`${dateStr}T00:00:00+01:00`).toISOString();
  const timeMax = new Date(`${dateStr}T23:59:59+02:00`).toISOString();

  const res = await cal.events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime'
  });

  return res.data.items || [];
}

function parseBookingEvent(event) {
  const props = event.extendedProperties?.private || {};
  if (!props.tourId) return null;

  if (props.status === 'tentative' && props.expiresAt) {
    if (Date.now() > parseInt(props.expiresAt)) return null;
  }

  return { tourId: props.tourId, slot: props.slot || null, status: props.status || 'confirmed' };
}

module.exports = { getEventsForDate, parseBookingEvent, createTentativeEvent, confirmEvent, deleteEvent };
