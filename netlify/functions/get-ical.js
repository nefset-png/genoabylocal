const { normalizeTourId, isValidDate, isAllowedSlot } = require('./lib/availability');

const TOUR_DURATIONS = { 'genoa-half': 3.5, 'genoa-full': 7, portofino: 11, cinque: 11 };
const MEETING_POINTS = {
  genoa: 'Via della Mercanzia 2, 16124 Genova GE',
  'genoa-half': 'Via della Mercanzia 2, 16124 Genova GE',
  'genoa-full': 'Via della Mercanzia 2, 16124 Genova GE',
  portofino: 'Via della Mercanzia 2, 16124 Genova GE',
  cinque: 'Genova Brignole Railway Station'
};

function pad(n) { return String(n).padStart(2, '0'); }

function toIcalDate(dateStr, timeStr, addHours = 0) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  const value = new Date(y, m - 1, d, h, min);
  value.setMinutes(value.getMinutes() + Math.round(addHours * 60));
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}T${pad(value.getHours())}${pad(value.getMinutes())}00`;
}

function escape(str) {
  return (str || '').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

exports.handler = async (event) => {
  const p = event.queryStringParameters || {};
  const requestedTour = normalizeTourId(p.tour || 'genoa-half');
  const { date = '', time = '09:30', name = '', guests = '' } = p;
  const tour = requestedTour;
  if (!TOUR_DURATIONS[tour] || !isValidDate(date) || !isAllowedSlot(tour, time)) {
    return { statusCode: 400, body: 'Invalid calendar event parameters' };
  }
  const duration = TOUR_DURATIONS[tour] || 3;
  const location = MEETING_POINTS[tour] || '';
  const tourNames = { genoa: 'Genoa Highlights & Hidden Corners · Half Day', 'genoa-half': 'Genoa Highlights & Hidden Corners · Half Day', 'genoa-full': 'Genoa Highlights & Hidden Corners · Full Day', portofino: 'Portofino & Beyond', cinque: 'Cinque Terre Day Experience' };
  const tourName = tourNames[tour] || 'Genoa Local Experience';
  const dtStart = toIcalDate(date, time);
  const dtEnd = toIcalDate(date, time, duration);
  const uid = `${date}-${tour}-${Date.now()}@genoabylocal.com`;
  const description = `Private experience with Nefset${guests ? ' · ' + guests : ''}\\nGenoabylocal.com`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Genoa by Local//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;TZID=Europe/Rome:${dtStart}`,
    `DTEND;TZID=Europe/Rome:${dtEnd}`,
    `SUMMARY:${escape(tourName + (name ? ' with Nefset' : ''))}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${escape(location)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="genoa-experience-${date}.ics"`
    },
    body: ics
  };
};
