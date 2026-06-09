const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { google } = require('googleapis');
const { Resend } = require('resend');
const { confirmEvent, markEventProcessed, deleteEvent } = require('./lib/calendar');

const resend = new Resend(process.env.RESEND_API_KEY);
const HOST_EMAIL = process.env.HOST_EMAIL || 'nefset@proton.me';
const FROM_EMAIL = process.env.FROM_EMAIL || 'bookings@genoabylocal.com';

const MEETING_POINTS = {
  genoa: 'Via della Mercanzia, 2, 16124 Genova GE',
  'genoa-half': 'Via della Mercanzia, 2, 16124 Genova GE',
  'genoa-full': 'Via della Mercanzia, 2, 16124 Genova GE',
  portofino: 'Via della Mercanzia, 2, 16124 Genova GE',
  cinque: 'Genova Brignole Railway Station'
};

function euro(value) { return '€' + Math.round(Number(value) || 0); }

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeSubject(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function guestSummary(m) {
  const adults = parseInt(m.adults) || 0;
  const children = parseInt(m.children) || 0;
  const parts = [`${adults} adult${adults !== 1 ? 's' : ''}`];
  if (children) parts.push(`${children} child${children !== 1 ? 'ren' : ''} under 12`);
  return parts.join(', ');
}

function addMinutesToCalendarDate(date, time, minutes) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const value = new Date(y, m - 1, d, h, min);
  value.setMinutes(value.getMinutes() + minutes);
  const pad = n => String(n).padStart(2, '0');
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}T${pad(value.getHours())}${pad(value.getMinutes())}00`;
}

function formatCustomerDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function hostEmailHtml(m) {
  const meeting = escapeHtml(MEETING_POINTS[m.tourId] || '');
  const tourName = escapeHtml(m.tourName);
  const date = escapeHtml(m.date);
  const time = escapeHtml(m.time);
  const customerName = escapeHtml(m.customerName);
  const phone = escapeHtml(m.phone);
  const stay = escapeHtml(m.stay);
  const requests = escapeHtml(m.requests);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf7f3;color:#17120c;margin:0;padding:0">
<div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #ece6dd;border-radius:12px;overflow:hidden">
  <div style="background:#b8935a;padding:24px 32px">
    <p style="color:#fff;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin:0 0 6px">New booking</p>
    <h1 style="color:#fff;font-size:28px;font-weight:400;margin:0;font-family:inherit">${tourName}</h1>
  </div>
  <div style="padding:32px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Date</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${date}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Start time</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${time}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Guests</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${guestSummary(m)}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Transport add-on</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${m.logistics === 'yes' ? 'Yes' : 'No'}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Meeting point</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${meeting}</td></tr>
    </table>
    <h2 style="font-family:inherit;font-size:18px;font-weight:400;margin:24px 0 12px">Client</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Name</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${customerName}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Phone / WhatsApp</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${phone}</td></tr>
      ${stay ? `<tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Hotel / cruise ship</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${stay}</td></tr>` : ''}
      ${requests ? `<tr><td style="padding:9px 0;font-size:13px;color:#7a7268">Special requests</td><td style="padding:9px 0;font-size:13px;font-weight:600;text-align:right">${requests}</td></tr>` : ''}
    </table>
    <h2 style="font-family:inherit;font-size:18px;font-weight:400;margin:24px 0 12px">Payment</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Total</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${euro(m.total)}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Paid online</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${euro(m.paid)}</td></tr>
      <tr><td style="padding:9px 0;font-size:13px;color:#7a7268">Remaining</td><td style="padding:9px 0;font-size:13px;font-weight:600;text-align:right">${euro(m.remaining)}</td></tr>
    </table>
  </div>
</div></body></html>`;
}

function customerEmailHtml(m) {
  const meeting = MEETING_POINTS[m.tourId] || '';
  const safeMeeting = escapeHtml(meeting);
  const safeTourName = escapeHtml(m.tourName);
  const safeDate = escapeHtml(formatCustomerDate(m.date));
  const safeTime = escapeHtml(m.time);
  const isDeposit = m.paymentMode !== 'full';
  const hasRemaining = Number(m.remaining) > 0;
  const firstName = m.customerName ? escapeHtml(m.customerName.split(' ')[0]) : '';
  const paidLabel = isDeposit ? 'Deposit paid' : 'Fully paid';
  const adults = parseInt(m.adults) || 1;
  const perPerson = Number(m.total) > 0 ? Math.round(Number(m.total) / adults) : 0;
  const siteUrl = 'https://genoabylocal.com';
  const icalUrl = siteUrl + '/.netlify/functions/get-ical?tour=' + m.tourId + '&date=' + m.date + '&time=' + encodeURIComponent(m.time) + '&guests=' + encodeURIComponent(guestSummary(m));
  const gcalDate = m.date.replace(/-/g,'') + 'T' + m.time.replace(':','') + '00';
  const gcalMinutes = {genoa:210, 'genoa-half':210, 'genoa-full':420, portofino:660, cinque:660}[m.tourId] || 210;
  const gcalEnd = addMinutesToCalendarDate(m.date, m.time, gcalMinutes);
  const gcalUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(m.tourName) + '&dates=' + gcalDate + '/' + gcalEnd + '&location=' + encodeURIComponent(meeting) + '&details=' + encodeURIComponent('Private experience with Nefset · genoabylocal.com');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Booking Confirmed — Genoa by Local</title>
</head>
<body style="margin:0;padding:0;background:#faf7f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#17120c">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f3;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #ece6dd;border-radius:14px;overflow:hidden">

  <!-- HEADER -->
  <tr>
    <td style="background:linear-gradient(135deg,#ffffff,#faf6f0);padding:36px 40px 28px;border-bottom:1px solid #ece6dd">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;padding-right:20px">
            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#b8935a">Booking confirmed</p>
            <h1 style="margin:0 0 10px;font-family:inherit;font-size:30px;font-weight:800;color:#17120c;line-height:1.12">You're all set${firstName ? ',&nbsp;' + firstName : ''}.</h1>
            <p style="margin:0;font-size:16px;color:#5f564c;line-height:1.65">Your private experience is reserved.<br/>I look forward to meeting you in Genoa.</p>
          </td>
          <td style="vertical-align:top;text-align:center;min-width:90px">
            <div style="width:70px;height:70px;border-radius:50%;background:#f5efe6;display:inline-flex;align-items:center;justify-content:center;border:1px solid #ece6dd;font-size:28px;line-height:70px;text-align:center">✓</div>
            <p style="margin:8px 0 0;font-size:11px;color:#b8935a;font-weight:600">${paidLabel}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#7a7268">${euro(m.paid)} paid</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- EXPERIENCE DETAILS -->
  <tr>
    <td style="padding:32px 40px 0">
      <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#b8935a">Experience details</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Experience</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${safeTourName}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Date</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${safeDate}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Start time</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${safeTime}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Guests</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${guestSummary(m)}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Total price</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${euro(m.total)}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">${paidLabel}</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${euro(m.paid)}</td></tr>
        ${hasRemaining ? `<tr><td style="padding:10px 0;font-size:13px;color:#7a7268">Remaining balance</td><td style="padding:10px 0;font-size:13px;font-weight:600;text-align:right;color:#17120c">${euro(m.remaining)}</td></tr>` : ''}
        <tr><td style="padding:10px 0;font-size:13px;color:#7a7268">Approx. per adult</td><td style="padding:10px 0;font-size:13px;font-weight:600;text-align:right;color:#17120c">€${perPerson}</td></tr>
      </table>
    </td>
  </tr>

  ${isDeposit && hasRemaining ? `
  <!-- DEPOSIT NOTE -->
  <tr>
    <td style="padding:20px 40px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#faf6f0;border:1px solid #ece6dd;border-radius:10px;padding:16px;font-size:13px;color:#7a7268;line-height:1.7">
            The remaining balance of <strong style="color:#17120c">${euro(m.remaining)}</strong> is paid online before the experience. I will send you a secure payment link by email in advance.
          </td>
        </tr>
      </table>
    </td>
  </tr>` : ''}

  <!-- MEETING POINT -->
  <tr>
    <td style="padding:24px 40px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#faf6f0;border:1px solid #ece6dd;border-radius:10px;padding:18px">
            <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#b8935a">Meeting point</p>
            <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#17120c">${safeMeeting}</p>
            <p style="margin:0;font-size:12px;color:#7a7268;line-height:1.6">The exact spot may be adjusted depending on your hotel or cruise terminal — I will confirm before we meet.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  ${isDeposit ? `
  <!-- DEPOSIT CANCELLATION -->
  <tr>
    <td style="padding:16px 40px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#faf6f0;border:1px solid #ece6dd;border-radius:10px;padding:18px">
            <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#b8935a">Cancellation policy</p>
            <p style="margin:0;font-size:13px;color:#7a7268;line-height:1.7">The €100 deposit is fully refundable if you cancel at least 48 hours before the scheduled experience. If you cancel less than 48 hours before, the deposit is non-refundable. Rescheduling is possible whenever availability allows.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>` : ''}

  <!-- ADD TO CALENDAR -->
  <tr>
    <td style="padding:24px 40px 0">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#b8935a">Add to calendar</p>
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right:10px"><a href="${gcalUrl}" style="display:inline-block;background:#fff;border:1px solid #ece6dd;color:#17120c;text-decoration:none;border-radius:8px;padding:11px 18px;font-size:12px;font-weight:600">Google Calendar</a></td>
          <td><a href="${icalUrl}" style="display:inline-block;background:#fff;border:1px solid #ece6dd;color:#17120c;text-decoration:none;border-radius:8px;padding:11px 18px;font-size:12px;font-weight:600">Apple / Outlook (.ics)</a></td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- WHATSAPP CTA -->
  <tr>
    <td style="padding:28px 40px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;border:1px solid #ece6dd;border-radius:12px">
        <tr>
          <td style="padding:28px 32px;text-align:center">
            <p style="margin:0 0 4px;font-family:inherit;font-size:20px;font-weight:780;color:#17120c">Stay in touch</p>
            <p style="margin:0 0 20px;font-size:13px;color:#7a7268;line-height:1.7">Message me if you need help getting to the meeting point, want local tips, or have any questions before we meet.</p>
            <a href="https://wa.me/393203723453" style="display:inline-block;background:#b8935a;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 28px;font-size:15px;font-weight:700">Message me on WhatsApp</a>
            <p style="margin:16px 0 0;font-size:12px;color:#a09890">+39 320 372 3453 · nefset@proton.me</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:20px 40px;border-top:1px solid #ece6dd;text-align:center">
      <p style="margin:0;font-size:11px;color:#a09890;line-height:1.6">Genoa by Local · <a href="https://genoabylocal.com" style="color:#a09890">genoabylocal.com</a> · Your host: Nefset</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}


const SHEET_HEADERS = [
  'Timestamp','Tour','Date','Time','Adults','Children','Infants',
  'Name','Email','Phone','Hotel / Cruise','Special requests',
  'Total (€)','Paid (€)','Remaining (€)','Payment type','CT Logistics'
];

async function appendToSheet(m, customerEmail) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return;
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });

    // Add headers if sheet is empty
    const meta = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Sheet1!A1' });
    if (!meta.data.values || meta.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId, range: 'Sheet1!A1',
        valueInputOption: 'RAW',
        resource: { values: [SHEET_HEADERS] }
      });
    }

    const now = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
    const row = [
      now, m.tourName, m.date, m.time,
      m.adults || '0', m.children || '0', m.infants || '0',
      m.customerName || '', customerEmail || '', m.phone || '',
      m.stay || '', m.requests || '',
      m.total || '0', m.paid || '0', m.remaining || '0',
      m.paymentMode === 'full' ? 'Full payment' : 'Deposit',
      m.logistics === 'yes' ? 'Yes' : 'No'
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [row] }
    });
  } catch (e) {
    console.error('Sheets append error:', e.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const sig = event.headers['stripe-signature'];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : Buffer.from(event.body);

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const session = stripeEvent.data.object;
  const m = session.metadata || {};

  if (stripeEvent.type === 'checkout.session.completed') {
    // Confirm calendar event
    let alreadyProcessed = false;
    if (m.calendarEventId) {
      try {
        alreadyProcessed = await confirmEvent(m.calendarEventId, {
          tourName: m.tourName,
          customerName: m.customerName,
          guestSummary: guestSummary(m),
          paymentMode: m.paymentMode
        });
      } catch (e) {
        console.error('Calendar confirm failed:', e.message);
      }
    }
    if (alreadyProcessed) return { statusCode: 200, body: 'Already processed' };

    // Send emails
    const customerEmail = session.customer_email || session.customer_details?.email;
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: HOST_EMAIL,
        replyTo: customerEmail || HOST_EMAIL,
        subject: safeSubject(`New booking: ${m.tourName} — ${m.date} — ${m.customerName}`),
        html: hostEmailHtml(m)
      });
      if (customerEmail) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: customerEmail,
          replyTo: HOST_EMAIL,
          subject: safeSubject(`Booking confirmed — ${m.tourName} on ${m.date}`),
          html: customerEmailHtml(m)
        });
      }
    } catch (e) {
      console.error('Email send error:', e);
      return { statusCode: 500, body: 'Email delivery failed; Stripe should retry the webhook' };
    }

    // Log to Google Sheets
    await appendToSheet(m, customerEmail);

    if (m.calendarEventId) {
      try {
        await markEventProcessed(m.calendarEventId);
      } catch (e) {
        console.error('Could not mark webhook as processed:', e.message);
      }
    }
  }

  if (stripeEvent.type === 'checkout.session.expired') {
    if (m.calendarEventId) {
      try {
        await deleteEvent(m.calendarEventId);
      } catch (e) {
        console.error('Calendar delete failed:', e.message);
      }
    }
  }

  return { statusCode: 200, body: 'OK' };
};
