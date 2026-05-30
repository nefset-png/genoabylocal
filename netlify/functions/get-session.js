const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const sessionId = event.queryStringParameters && event.queryStringParameters.id;

  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing session id' }) };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { statusCode: 402, body: JSON.stringify({ error: 'Payment not completed' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: session.metadata })
    };
  } catch (err) {
    console.error('get-session error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
