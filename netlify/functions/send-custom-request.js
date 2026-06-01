const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const HOST_EMAIL = process.env.HOST_EMAIL || 'nefset@proton.me';
const FROM_EMAIL = process.env.FROM_EMAIL || 'bookings@genoabylocal.com';

function clean(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function escapeHtml(value) {
  return clean(value, 2000)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

function row(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;color:#7a7268">${label}</td><td style="padding:10px 0;border-bottom:1px solid #ece6dd;font-size:13px;font-weight:600;text-align:right;color:#17120c">${escapeHtml(value)}</td></tr>`;
}

function hostEmailHtml(data) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf7f3;color:#17120c;margin:0;padding:0">
<div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #ece6dd;border-radius:12px;overflow:hidden">
  <div style="background:#b8935a;padding:24px 32px">
    <p style="color:#fff;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin:0 0 6px">New custom request</p>
    <h1 style="color:#fff;font-size:28px;font-weight:400;margin:0;font-family:Georgia,serif">${escapeHtml(data.name || 'New lead')}</h1>
  </div>
  <div style="padding:32px">
    <h2 style="font-family:Georgia,serif;font-size:18px;font-weight:400;margin:0 0 12px">Client</h2>
    <table style="width:100%;border-collapse:collapse">
      ${row('Name', data.name)}
      ${row('Email', data.email)}
      ${row('Phone / WhatsApp', data.phone)}
      ${row('Preferred contact', data.contactMethod)}
    </table>

    <h2 style="font-family:Georgia,serif;font-size:18px;font-weight:400;margin:24px 0 12px">Trip idea</h2>
    <table style="width:100%;border-collapse:collapse">
      ${row('Preferred date', data.date)}
      ${row('Timing flexibility', data.flexibility)}
      ${row('Group size', data.groupSize)}
      ${row('Interests', data.interests)}
      ${row('Hotel / cruise ship', data.stay)}
    </table>

    ${data.message ? `<div style="margin-top:24px;background:#faf6f0;border:1px solid #ece6dd;border-radius:10px;padding:18px">
      <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#b8935a">Message</p>
      <p style="margin:0;font-size:14px;line-height:1.75;color:#3d3025">${escapeHtml(data.message)}</p>
    </div>` : ''}
  </div>
</div></body></html>`;
}

function customerEmailHtml(data) {
  const firstName = clean(data.name).split(' ')[0];
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf7f3;color:#17120c;margin:0;padding:0">
<div style="max-width:580px;margin:32px auto;background:#fff;border:1px solid #ece6dd;border-radius:12px;overflow:hidden">
  <div style="padding:34px 38px;background:linear-gradient(135deg,#fff,#faf6f0);border-bottom:1px solid #ece6dd">
    <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#b8935a">Request received</p>
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;line-height:1.2;margin:0 0 12px;color:#17120c">Thank you${firstName ? ', ' + escapeHtml(firstName) : ''}.</h1>
    <p style="margin:0;font-size:14px;color:#7a7268;line-height:1.75">I received your custom experience request and will reply within 24 hours. If your timing is urgent, message me directly on WhatsApp.</p>
  </div>
  <div style="padding:28px 38px">
    <p style="margin:0 0 18px;font-size:14px;color:#7a7268;line-height:1.75">I'll look at your date, group size and interests, then suggest the best private route or experience for you.</p>
    <a href="https://wa.me/393203723453" style="display:inline-block;background:#b8935a;color:#fff;text-decoration:none;border-radius:8px;padding:14px 28px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;font-weight:700">Message on WhatsApp</a>
    <p style="margin:18px 0 0;font-size:12px;color:#a09890">Genoa Local Experiences · nefset@proton.me · +39 320 372 3453</p>
  </div>
</div></body></html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    if (clean(data.website)) {
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    const request = {
      name: clean(data.name, 120),
      email: clean(data.email, 160),
      phone: clean(data.phone, 80),
      contactMethod: clean(data.contactMethod, 40),
      date: clean(data.date, 80),
      flexibility: clean(data.flexibility, 80),
      groupSize: clean(data.groupSize, 40),
      interests: Array.isArray(data.interests) ? data.interests.map((i) => clean(i, 40)).filter(Boolean).join(', ') : clean(data.interests, 240),
      stay: clean(data.stay, 160),
      message: clean(data.message, 1800),
      consent: Boolean(data.consent)
    };

    if (!request.name || !request.email || !request.message || !request.consent) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: HOST_EMAIL,
      subject: `Custom request: ${request.name}${request.date ? ' — ' + request.date : ''}`,
      html: hostEmailHtml(request)
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: request.email,
      subject: 'I received your custom experience request',
      html: customerEmailHtml(request)
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error('send-custom-request error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not send request' }) };
  }
};
