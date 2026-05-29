const Stripe = require('stripe');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const EXPERIENCES = {
  genoa: { name: 'Genoa Private Walk', base: 240, extra: 30, duration: '3 hours' },
  portofino: { name: 'Portofino Full-Day Experience', base: 650, extra: 100, duration: 'Full day' },
  'cinque-terre': { name: 'Cinque Terre Full-Day Experience', base: 650, extra: 130, duration: 'Full day' },
};

const DEPOSIT = 100;

function calculatePrice(experience, guestCount) {
  const data = EXPERIENCES[experience];
  if (guestCount <= 4) return data.base;
  return data.base + (guestCount - 4) * data.extra;
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${day} ${months[parseInt(month) - 1]} ${year}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) };
  }

  const { experience, date, time, guestCount, customerName, customerEmail, customerPhone } = body;

  if (!experience || !date || !time || !guestCount || !customerName || !customerEmail) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Missing required fields' }),
    };
  }

  if (!EXPERIENCES[experience]) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Invalid experience' }),
    };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const expData = EXPERIENCES[experience];
    const totalPrice = calculatePrice(experience, guestCount);
    const formattedDate = formatDate(date);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${expData.name} — Deposit`,
              description: `${formattedDate} at ${time} · ${guestCount} guest${guestCount > 1 ? 's' : ''} · Total: €${totalPrice}`,
            },
            unit_amount: DEPOSIT * 100, // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      customer_email: customerEmail,
      success_url: `https://genoabylocal.com/booking-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://genoabylocal.com/booking-cancelled`,
      metadata: {
        experience,
        date,
        time,
        guestCount: String(guestCount),
        customerName,
        customerEmail,
        customerPhone: customerPhone || '',
        totalPrice: String(totalPrice),
        deposit: String(DEPOSIT),
      },
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        checkoutUrl: session.url,
        totalPrice,
        deposit: DEPOSIT,
        sessionId: session.id,
      }),
    };
  } catch (error) {
    console.error('create-checkout error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Failed to create checkout session' }),
    };
  }
};
