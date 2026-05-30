const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createTentativeEvent } = require('./lib/calendar');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const siteUrl = process.env.URL || 'https://genoabylocal.com';

  let calendarEventId = '';
  try {
    calendarEventId = await createTentativeEvent({
      date: '2026-07-01', time: '09:30', tourId: 'genoa',
      tourName: 'Genoa Must-Sees & Tastings',
      customerName: 'Test Client', sessionId: 'test'
    });
  } catch (e) {
    console.error('Test calendar hold failed:', e.message);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: 'nefset@proton.me',
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: 'TEST — Genoa Must-Sees & Tastings',
          description: 'Test booking · 2026-07-01 at 09:30 · 2 adults'
        },
        unit_amount: 100
      },
      quantity: 1
    }],
    metadata: {
      tourId: 'genoa',
      tourName: 'Genoa Must-Sees & Tastings',
      date: '2026-07-01',
      time: '09:30',
      adults: '2', children: '0', infants: '0',
      logistics: 'no',
      paymentMode: 'deposit',
      total: '1', paid: '1', remaining: '0',
      customerName: 'Test Client',
      phone: '+39 000 000 0000',
      stay: 'Test Hotel',
      requests: 'This is a test booking',
      calendarEventId: calendarEventId
    },
    success_url: `${siteUrl}/booking-confirmed/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/test-payment/`
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: session.url })
  };
};
