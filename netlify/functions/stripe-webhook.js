const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const { confirmEvent, deleteEvent } = require('./lib/calendar');

const resend = new Resend(process.env.RESEND_API_KEY);
const HOST_EMAIL = process.env.HOST_EMAIL || 'nefset@proton.me';
const FROM_EMAIL = process.env.FROM_EMAIL || 'bookings@genoabylocal.com';

const MEETING_POINTS = {
  genoa: 'Via della Mercanzia, 2, 16124 Genova GE',
  portofino: 'Via della Mercanzia, 2, 16124 Genova GE',
  cinque: 'Genova Brignole Railway Station'
};

function euro(value) { return '€' + Math.round(Number(value) || 0); }

function guestSummary(m) {
  const adults = parseInt(m.adults) || 0;
  const children = parseInt(m.children) || 0;
  const infants = parseInt(m.infants) || 0;
  const parts = [`${adults} adult${adults !== 1 ? 's' : ''}`];
  if (children) parts.push(`${children} child${children !== 1 ? 'ren' : ''} 4-11`);
  if (infants) parts.push(`${infants} infant${infants !== 1 ? 's' : ''} 0-3`);
  return parts.join(', ');
}

function hostEmailHtml(m) {
  const meeting = MEETING_POINTS[m.tourId] || '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf7f3;color:#17120c;margin:0;padding:0">
<div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #ece6dd;border-radius:12px;overflow:hidden">
  <div style="background:#b8935a;padding:24px 32px">
    <p style="color:#fff;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin:0 0 6px">New booking</p>
    <h1 style="color:#fff;font-size:28px;font-weight:400;margin:0;font-family:Georgia,serif">${m.tourName}</h1>
  </div>
  <div style="padding:32px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Date</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${m.date}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Start time</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${m.time}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Guests</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${guestSummary(m)}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Transport add-on</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${m.logistics === 'yes' ? 'Yes' : 'No'}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Meeting point</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${meeting}</td></tr>
    </table>
    <h2 style="font-family:Georgia,serif;font-size:18px;font-weight:400;margin:24px 0 12px">Client</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Name</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${m.customerName}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Phone / WhatsApp</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${m.phone}</td></tr>
      ${m.stay ? `<tr><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Hotel / cruise ship</td><td style="padding:9px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right">${m.stay}</td></tr>` : ''}
      ${m.requests ? `<tr><td style="padding:9px 0;font-size:13px;color:#7a7268">Special requests</td><td style="padding:9px 0;font-size:13px;font-weight:600;text-align:right">${m.requests}</td></tr>` : ''}
    </table>
    <h2 style="font-family:Georgia,serif;font-size:18px;font-weight:400;margin:24px 0 12px">Payment</h2>
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
  const isDeposit = m.paymentMode !== 'full';
  const firstName = m.customerName ? m.customerName.split(' ')[0] : '';
  const paidLabel = isDeposit ? 'Deposit paid' : 'Fully paid';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Booking Confirmed — Genoa Local Experiences</title>
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
            <p style="margin:0 0 14px;font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:#b8935a">Booking confirmed</p>
            <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:28px;font-weight:400;color:#17120c;line-height:1.15">You're all set${firstName ? ',&nbsp;' + firstName : ''}.</h1>
            <p style="margin:0;font-size:14px;color:#7a7268;line-height:1.75">Your private experience is reserved.<br/>I look forward to meeting you in Genoa.</p>
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
      <p style="margin:0 0 14px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#b8935a">Experience details</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Experience</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${m.tourName}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Date</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${m.date}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Start time</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${m.time}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Guests</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${guestSummary(m)}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">Total price</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${euro(m.total)}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">${paidLabel}</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${euro(m.paid)}</td></tr>
        <tr><td style="padding:10px 0;font-size:13px;color:#7a7268">Remaining balance</td><td style="padding:10px 0;font-size:13px;font-weight:600;text-align:right;color:#17120c">${euro(m.remaining)}</td></tr>
      </table>
    </td>
  </tr>

  ${isDeposit ? `
  <!-- DEPOSIT NOTE -->
  <tr>
    <td style="padding:20px 40px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#faf6f0;border:1px solid #ece6dd;border-radius:10px;padding:16px;font-size:13px;color:#7a7268;line-height:1.7">
            The remaining balance of <strong style="color:#17120c">${euro(m.remaining)}</strong> is due no later than 7 days before the experience. I will send you a secure payment link by email in advance.
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
            <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#b8935a">Meeting point</p>
            <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#17120c">${meeting}</p>
            <p style="margin:0;font-size:12px;color:#7a7268;line-height:1.6">The exact spot may be adjusted depending on your hotel or cruise terminal — I will confirm before we meet.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CANCELLATION -->
  <tr>
    <td style="padding:16px 40px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#faf6f0;border:1px solid #ece6dd;border-radius:10px;padding:18px">
            <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#b8935a">Cancellation policy</p>
            <p style="margin:0;font-size:13px;color:#7a7268;line-height:1.7">Full refund up to 7 days before the experience. No refund within 7 days. Rescheduling is possible whenever availability allows.</p>
          </td>
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
            <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:20px;font-weight:400;color:#17120c">Stay in touch</p>
            <p style="margin:0 0 20px;font-size:13px;color:#7a7268;line-height:1.7">Message me if you need help getting to the meeting point, want local tips, or have any questions before we meet.</p>
            <a href="https://wa.me/393203723453" style="display:inline-block;background:#b8935a;color:#ffffff;text-decoration:none;border-radius:8px;padding:14px 32px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700">Message me on WhatsApp</a>
            <p style="margin:16px 0 0;font-size:12px;color:#a09890">+39 320 372 3453 · nefset@proton.me</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:20px 40px;border-top:1px solid #ece6dd;text-align:center">
      <p style="margin:0;font-size:11px;color:#a09890;line-height:1.6">Genoa Local Experiences · <a href="https://genoabylocal.com" style="color:#a09890">genoabylocal.com</a> · Your host: Nefset</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
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
    if (m.calendarEventId) {
      try {
        await confirmEvent(m.calendarEventId, {
          tourName: m.tourName,
          customerName: m.customerName,
          guestSummary: guestSummary(m),
          paymentMode: m.paymentMode
        });
      } catch (e) {
        console.error('Calendar confirm failed:', e.message);
      }
    }

    // Send emails
    const customerEmail = session.customer_email || session.customer_details?.email;
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: HOST_EMAIL,
        subject: `New booking: ${m.tourName} — ${m.date} — ${m.customerName}`,
        html: hostEmailHtml(m)
      });
      if (customerEmail) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: customerEmail,
          subject: `Booking confirmed — ${m.tourName} on ${m.date}`,
          html: customerEmailHtml(m)
        });
      }
    } catch (e) {
      console.error('Email send error:', e);
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
