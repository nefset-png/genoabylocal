const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getEventsForDate, createTentativeEvent, deleteEvent } = require('./lib/calendar');
const { normalizeTourId, isBookableDate, getAvailability, isAllowedSlot } = require('./lib/availability');

const DEPOSIT = 100;
const PROMO_CODE = 'FRIEND26';
const PROMO_DISCOUNT_RATE = 0.1;

const TOURS = {
  'genoa-half': { name: 'Genoa Highlights & Hidden Corners · Half Day', base: 240, extra: 30, includedAdults: 4, max: 12 },
  'genoa-full': { name: 'Genoa Highlights & Hidden Corners · Full Day', base: 440, extra: 50, includedAdults: 4, max: 12 },
  portofino: { name: 'Portofino & Beyond', base: 650, extra: 100, includedAdults: 4, max: 12 },
  cinque: { name: 'Cinque Terre Day Experience', base: 650, extra: 130, includedAdults: 4, max: 12, logisticsPerGuest: 100 }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const data = JSON.parse(event.body);
    const { tourId, date, time, adults, children, logistics, paymentMode, name, email, phone, stay, requests, promoCode } = data;
    const normalizedTourId = normalizeTourId(tourId);

    const tour = TOURS[normalizedTourId];
    if (!tour) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid tour' }) };

    const adultsNum = Number(adults);
    const childrenNum = Number(children);
    const totalGuests = adultsNum + childrenNum;
    const customerName = String(name || '').trim();
    const customerEmail = String(email || '').trim();
    const customerPhone = String(phone || '').trim();
    const customerStay = String(stay || '').trim();
    const customerRequests = String(requests || '').trim();
    const emailOk = customerEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);

    if (!isBookableDate(date) || !isAllowedSlot(normalizedTourId, time)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid date or start time' }) };
    }
    if (!Number.isInteger(adultsNum) || adultsNum < 1 || !Number.isInteger(childrenNum) || childrenNum < 0 || totalGuests > tour.max) {
      return { statusCode: 400, body: JSON.stringify({ error: `Private groups can include up to ${tour.max} guests` }) };
    }
    if (!customerName || customerName.length > 100 || !emailOk || !customerPhone || customerPhone.length > 50) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid customer details' }) };
    }
    if (customerStay.length > 200 || customerRequests.length > 500) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Some booking details are too long' }) };
    }
    if (!['full', 'deposit'].includes(paymentMode)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payment option' }) };
    }

    let events;
    try {
      events = await getEventsForDate(date);
    } catch (calendarError) {
      console.error('Availability check failed:', calendarError.message);
      return { statusCode: 503, body: JSON.stringify({ error: 'Availability is temporarily unavailable' }) };
    }
    const availability = getAvailability(date, normalizedTourId, events);
    const selectedSlotAvailable = normalizedTourId !== 'genoa-half' || availability.slots[time] !== false;
    if (!availability.available || !selectedSlotAvailable) {
      return { statusCode: 409, body: JSON.stringify({ error: 'This date or start time is no longer available' }) };
    }

    const extras = Math.max(0, adultsNum - tour.includedAdults);
    const logisticsTotal = normalizedTourId === 'cinque' && logistics === 'yes'
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
    if (childrenNum) guestParts.push(`${childrenNum} child${childrenNum !== 1 ? 'ren' : ''} under 12`);
    const guestDesc = guestParts.join(', ');

    // Create tentative calendar hold first so we get the event ID
    let calendarEventId;
    try {
      calendarEventId = await createTentativeEvent({
        date, time, tourId: normalizedTourId,
        tourName: tour.name,
        customerName,
        sessionId: 'pending'
      });
    } catch (calErr) {
      console.error('Calendar hold failed:', calErr.message);
      return { statusCode: 503, body: JSON.stringify({ error: 'Could not reserve this time. Please try again.' }) };
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail,
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
        tourId: normalizedTourId, tourName: tour.name, date, time,
        adults: String(adultsNum), children: String(childrenNum), infants: '0',
        logistics: logistics === 'yes' ? 'yes' : 'no',
        paymentMode,
        subtotal: String(subtotal), discount: String(discount),
        promoCode: discountApplied ? PROMO_CODE : '',
        total: String(total), paid: String(amountToPay), remaining: String(remaining),
        customerName, phone: customerPhone,
        stay: customerStay, requests: customerRequests,
        calendarEventId: calendarEventId || ''
      },
      success_url: `${siteUrl}/booking-confirmed/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/booking/?tour=${normalizedTourId}`
      });
    } catch (stripeError) {
      await deleteEvent(calendarEventId);
      throw stripeError;
    }

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
