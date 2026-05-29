const Stripe = require('stripe');
const { google } = require('googleapis');
const { Resend } = require('resend');

const EXPERIENCES = {
  genoa: { name: 'Genoa Private Walk', slots: ['9:30', '14:30', '18:00'], fullDay: false },
  portofino: { name: 'Portofino Full-Day Experience', slots: ['9:30'], fullDay: true },
  'cinque-terre': { name: 'Cinque Terre Full-Day Experience', slots: ['7:30', '8:30'], fullDay: true },
};

const BLOCK_KEYWORDS = ['UNAVAILABLE', 'PERSONAL DAY', 'VACATION', 'OUT OF OFFICE', 'APPOINTMENT'];

function getGoogleAuth(scopes) {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  return new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    privateKey,
    scopes
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

async function checkAvailability(experience, date, time) {
  const auth = getGoogleAuth(['https://www.googleapis.com/auth/calendar.readonly']);
  const calendar = google.calendar({ version: 'v3', auth });

  const startOfDay = new Date(`${date}T00:00:00+02:00`).toISOString();
  const endOfDay = new Date(`${date}T23:59:59+02:00`).toISOString();

  const response = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    timeMin: startOfDay,
    timeMax: endOfDay,
    singleEvents: true,
  });

  const events = response.data.items || [];

  for (const event of events) {
    const title = event.summary || '';
    if (isManualBlock(title) || isFullDayExperience(title)) return false;
  }

  const bookedTimes = events.map(event => {
    if (!event.start?.dateTime) return null;
    const d = new Date(event.start.dateTime);
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  }).filter(Boolean);

  return !bookedTimes.includes(time);
}

async function createCalendarEvent(experience, date, time, customerName, guestCount, customerEmail, customerPhone) {
  const auth = getGoogleAuth(['https://www.googleapis.com/auth/calendar']);
  const calendar = google.calendar({ version: 'v3', auth });
  const expData = EXPERIENCES[experience];

  const [hours, minutes] = time.split(':').map(Number);
  const startDateTime = new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);

  // Full-day experiences last ~10 hours, Genoa walk is 3 hours
  const durationHours = expData.fullDay ? 10 : 3;
  const endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000);

  await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: `${expData.name} - ${customerName} (${guestCount} guest${guestCount > 1 ? 's' : ''})`,
      description: `Email: ${customerEmail}\nPhone: ${customerPhone || 'N/A'}\nDeposit: €100 paid`,
      start: { dateTime: startDateTime.toISOString(), timeZone: 'Europe/Rome' },
      end: { dateTime: endDateTime.toISOString(), timeZone: 'Europe/Rome' },
    },
  });
}

async function appendToSheets(data) {
  const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
  const sheets = google.sheets({ version: 'v4', auth });

  const { experience, date, time, guestCount, customerName, customerEmail, customerPhone, totalPrice, deposit } = data;
  const expData = EXPERIENCES[experience];
  const bookingDate = new Date().toISOString().split('T')[0];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Sheet1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        date, time, expData.name, guestCount,
        customerName, customerEmail, customerPhone || '',
        `€${totalPrice}`, `€${deposit}`,
        'Confirmed', bookingDate,
      ]],
    },
  });
}

async function sendConfirmationEmail(data) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { experience, date, time, guestCount, customerName, customerEmail, totalPrice, deposit } = data;
  const expData = EXPERIENCES[experience];

  const [year, month, day] = date.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const formattedDate = `${day} ${months[parseInt(month) - 1]} ${year}`;

  await resend.emails.send({
    from: 'Genoa by Local <bookings@genoabylocal.com>',
    to: customerEmail,
    subject: `Booking Confirmed — ${expData.name}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #2c2c2c;">
        <div style="background: #1a3a2a; padding: 32px; text-align: center;">
          <h1 style="color: #d4a853; margin: 0; font-size: 28px;">Genoa by Local</h1>
          <p style="color: #a8c4a0; margin: 8px 0 0;">Your booking is confirmed</p>
        </div>

        <div style="padding: 40px 32px;">
          <p style="font-size: 18px;">Dear ${customerName},</p>
          <p>Thank you for booking with Genoa by Local. We're excited to show you the best of the Italian Riviera!</p>

          <div style="background: #f8f4ee; border-left: 4px solid #d4a853; padding: 24px; margin: 32px 0;">
            <h2 style="color: #1a3a2a; margin: 0 0 16px; font-size: 20px;">Booking Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #666;">Experience</td><td style="padding: 6px 0; font-weight: bold;">${expData.name}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Date</td><td style="padding: 6px 0; font-weight: bold;">${formattedDate}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Time</td><td style="padding: 6px 0; font-weight: bold;">${time}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Guests</td><td style="padding: 6px 0; font-weight: bold;">${guestCount}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Total Price</td><td style="padding: 6px 0; font-weight: bold;">€${totalPrice}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Deposit Paid</td><td style="padding: 6px 0; font-weight: bold; color: #2a7a4a;">€${deposit} ✓</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Remaining Balance</td><td style="padding: 6px 0; font-weight: bold;">€${totalPrice - deposit} (payable on the day)</td></tr>
            </table>
          </div>

          <p>We'll meet you at the agreed meeting point 10 minutes before your tour begins. You'll receive detailed meeting point instructions 48 hours before your experience.</p>

          <p>If you have any questions, please don't hesitate to contact us.</p>

          <p style="margin-top: 40px;">With warmth,<br><strong>The Genoa by Local Team</strong></p>
        </div>

        <div style="background: #1a3a2a; padding: 24px; text-align: center;">
          <p style="color: #a8c4a0; margin: 0; font-size: 14px;">© Genoa by Local · genoabylocal.com</p>
        </div>
      </div>
    `,
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: JSON.stringify({ status: 'ignored' }) };
  }

  const session = stripeEvent.data.object;

  if (session.payment_status !== 'paid') {
    return { statusCode: 200, body: JSON.stringify({ status: 'not paid' }) };
  }

  const { experience, date, time, guestCount, customerName, customerEmail, customerPhone, totalPrice, deposit } = session.metadata;

  try {
    // Final availability check before confirming
    const isAvailable = await checkAvailability(experience, date, time);
    if (!isAvailable) {
      console.error(`Slot no longer available: ${experience} on ${date} at ${time}`);
      // Payment was taken — flag for manual review, don't fail silently
    }

    // Create calendar event
    await createCalendarEvent(experience, date, time, customerName, parseInt(guestCount), customerEmail, customerPhone);

    // Record in Google Sheets
    await appendToSheets({ experience, date, time, guestCount: parseInt(guestCount), customerName, customerEmail, customerPhone, totalPrice, deposit });

    // Send confirmation email
    await sendConfirmationEmail({ experience, date, time, guestCount, customerName, customerEmail, totalPrice, deposit });

    console.log(`Booking confirmed: ${experience} for ${customerName} on ${date} at ${time}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'success' }),
    };
  } catch (error) {
    console.error('stripe-webhook processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message }),
    };
  }
};
