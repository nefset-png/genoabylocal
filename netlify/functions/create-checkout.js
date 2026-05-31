const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createTentativeEvent } = require('./lib/calendar');

const DEPOSIT = 100;
const PROMO_CODE = 'FRIEND26';
const PROMO_DISCOUNT_RATE = 0.1;

const TOURS = {
  genoa: { name: 'Genoa Must-Sees & Tastings', base: 240, extra: 30, includedAdults: 4, max: 12 },
  portofino: { name: 'Portofino & Beyond', base: 650, extra: 100, includedAdults: 4, max: 12 },
  cinque: { name: 'Cinque Terre Day Experience', base: 650, extra: 130, includedAdults: 4, max: 12, logisticsPerGuest: 100 }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const data = JSON.parse(event.body);
    const { tourId, date, time, adults, children, infants, logistics, paymentMode, name, email, phone, stay, requests, promoCode } = data;

    const tour = TOURS[tourId];
    if (!tour) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid tour' }) };

    const adultsNum = Math.max(1, parseInt(adults) || 1);
    const childrenNum = Math.max(0, parseInt(children) || 0);
    const infantsNum = Math.max(0, parseInt(infants) || 0);

    const extras = Math.max(0, adultsNum - tour.includedAdults);
    const logisticsTotal = tourId === 'cinque' && logistics === 'yes'
      ? (adultsNum + childrenNum) * tour.logisticsPerGuest
      : 0;
    const subtotal = tour.base + extras * tour.extra + logisticsTotal;
    const normalizedPromoCode = String(promoCode || '').trim().toUpperCase();
    const discountApplied = normalizedPromoCode === PROMO_CODE;
    const discount = discountApplied ? Math.round(subtotal * PROMO_DISCOUNT_RATE) : 0;
    const total = Math.max(0, subtotal - discount);
    const amountToPay = paymentMode === 'full' ? total : DEPOSIT;
    const remaining = paymentMode === 'full' ? 0 : total - DEPOSIT;

    const siteUrl = process.env.URL || 'https://genoabylocal.com';

    const guestParts = [`${adultsNum} adult${adultsNum !== 1 ? 's' : ''}`];
    if (childrenNum) guestParts.push(`${childrenNum} child${childrenNum !== 1 ? 'ren' : ''} 4-11`);
    if (infantsNum) guestParts.push(`${infantsNum} infant${infantsNum !== 1 ? 's' : ''} 0-3`);
    const guestDesc = guestParts.join(', ');

    // Create tentative calendar hold first so we get the event ID
    let calendarEventId = null;
    try {
      // Stripe session ID not available yet — use a temp placeholder, will use session ID after
      // We create with a temp ID and store the event ID in Stripe metadata
      calendarEventId = await createTentativeEvent({
        date, time, tourId,
        tourName: tour.name,
        customerName: name,
        sessionId: 'pending'
      });
    } catch (calErr) {
      console.error('Calendar hold failed (non-fatal):', calErr.message);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: paymentMode === 'full' ? `${tour.name} — Full payment` : `${tour.name} — Deposit`,
            description: `${date} at ${time} · ${guestDesc}${discountApplied ? ' · FRIEND26 discount applied' : ''}`
          },
          unit_amount: amountToPay * 100
        },
        quantity: 1
      }],
      metadata: {
        tourId, tourName: tour.name, date, time,
        adults: String(adultsNum), children: String(childrenNum), infants: String(infantsNum),
        logistics: logistics === 'yes' ? 'yes' : 'no',
        paymentMode,
        subtotal: String(subtotal), discount: String(discount),
        promoCode: discountApplied ? PROMO_CODE : '',
        total: String(total), paid: String(amountToPay), remaining: String(remaining),
        customerName: name, phone,
        stay: stay || '', requests: requests || '',
        calendarEventId: calendarEventId || ''
      },
      success_url: `${siteUrl}/booking-confirmed/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/booking/?tour=${tourId}`
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error('create-checkout error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
