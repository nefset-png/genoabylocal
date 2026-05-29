const { google } = require('googleapis');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const EXPERIENCES = {
  genoa: { slots: ['9:30', '14:30', '18:00'], fullDay: false },
  portofino: { slots: ['9:30'], fullDay: true },
  'cinque-terre': { slots: ['7:30', '8:30'], fullDay: true },
};

const BLOCK_KEYWORDS = ['UNAVAILABLE', 'PERSONAL DAY', 'VACATION', 'OUT OF OFFICE', 'APPOINTMENT'];

function getGoogleAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  return new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/calendar.readonly']
  );
}

function isManualBlock(title) {
  if (!title) return false;
  return BLOCK_KEYWORDS.some(keyword => title.toUpperCase().includes(keyword));
}

function isFullDayExperience(title) {
  if (!title) return false;
  return title.toLowerCase().includes('portofino') || title.toLowerCase().includes('cinque terre');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  const { date, experience } = event.queryStringParameters || {};

  if (!date || !experience) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ available: false, error: 'Missing date or experience parameter' }),
    };
  }

  if (!EXPERIENCES[experience]) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ available: false, error: 'Invalid experience' }),
    };
  }

  try {
    const auth = getGoogleAuth();
    const calendar = google.calendar({ version: 'v3', auth });

    // Query all events for the selected date
    const startOfDay = new Date(`${date}T00:00:00+02:00`).toISOString();
    const endOfDay = new Date(`${date}T23:59:59+02:00`).toISOString();

    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: startOfDay,
      timeMax: endOfDay,
      singleEvents: true,
    });

    const events = response.data.items || [];

    // Check for manual blocks or full-day blockers
    for (const event of events) {
      const title = event.summary || '';
      if (isManualBlock(title) || isFullDayExperience(title)) {
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ available: false, slots: [], experience, date }),
        };
      }
    }

    // Get booked time slots for this experience
    const bookedTimes = events.map(event => {
      if (!event.start || !event.start.dateTime) return null;
      const startTime = new Date(event.start.dateTime);
      const hours = startTime.getHours();
      const minutes = startTime.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }).filter(Boolean);

    // Filter out already booked slots
    const allSlots = EXPERIENCES[experience].slots;
    const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        available: availableSlots.length > 0,
        slots: availableSlots,
        experience,
        date,
      }),
    };
  } catch (error) {
    console.error('check-availability error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ available: false, error: 'Failed to check availability' }),
    };
  }
};
