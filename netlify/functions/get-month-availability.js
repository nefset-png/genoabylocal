const { google } = require('googleapis');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const GENOA_SLOTS = ['09:30', '14:30', '18:00'];

// Golfo Paradiso ferry schedule 2026 — when ferry runs for Portofino
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
    const dow = new Date(y, m - 1, d).getDay(); // 0=Sun, 1=Mon
    if (dow !== 1) return true;
    if (m === 6 && d === 1) return true;  // June 1 exception
    if (m === 8 && (d === 10 || d === 17)) return true; // Aug 10,17 exception
    return false;
  }

  return false;
}

function getCalendar() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/calendar'] });
  return google.calendar({ version: 'v3', auth });
}

exports.handler = async (event) => {
  const { year, month, tour } = event.queryStringParameters || {};
  if (!year || !month || !tour) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing params' }) };
  }

  const y = parseInt(year);
  const m = parseInt(month);
  const lastDay = new Date(y, m, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  const monthStr = pad(m);

  const timeMin = new Date(`${year}-${monthStr}-01T00:00:00+01:00`).toISOString();
  const timeMax = new Date(`${year}-${monthStr}-${lastDay}T23:59:59+02:00`).toISOString();

  let calendarEvents = [];
  try {
    const cal = getCalendar();
    const res = await cal.events.list({ calendarId: CALENDAR_ID, timeMin, timeMax, singleEvents: true });
    calendarEvents = res.data.items || [];
  } catch (e) {
    console.error('Calendar error:', e.message);
  }

  // Build per-date booking info
  const dateMap = {};
  for (const event of calendarEvents) {
    const props = event.extendedProperties?.private || {};
    const dateStr = event.start?.date || (event.start?.dateTime || '').split('T')[0];
    if (!dateStr) continue;
    if (!dateMap[dateStr]) dateMap[dateStr] = { hasPortofinoCT: false, genoaSlots: new Set(), hasManualBlock: false };

    const isAllDay = !!event.start?.date;
    if (!props.tourId) {
      if (isAllDay) dateMap[dateStr].hasManualBlock = true;
    } else {
      if (props.status === 'tentative' && props.expiresAt && Date.now() > parseInt(props.expiresAt)) continue;
      if (props.tourId === 'portofino' || props.tourId === 'cinque') dateMap[dateStr].hasPortofinoCT = true;
      if (props.tourId === 'genoa' && props.slot) dateMap[dateStr].genoaSlots.add(props.slot);
    }
  }

  const blockedDates = [];
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${monthStr}-${pad(day)}`;
    const info = dateMap[dateStr] || {};

    let blocked = false;
    if (info.hasManualBlock) {
      blocked = true;
    } else if (info.hasPortofinoCT) {
      blocked = true;
    } else if (tour === 'portofino') {
      if (!ferryRunsOn(dateStr)) blocked = true;
      else if (info.genoaSlots?.size > 0) blocked = true;
    } else if (tour === 'cinque') {
      if (info.genoaSlots?.size > 0) blocked = true;
    } else if (tour === 'genoa') {
      if ((info.genoaSlots?.size || 0) >= GENOA_SLOTS.length) blocked = true;
    }

    if (blocked) blockedDates.push(dateStr);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blockedDates })
  };
};
