# UX Direction Notes

Date: 2026-06-02

## Current Direction

We are moving the site toward:

- Apple/iOS-like mobile clarity, not a literal Apple copy.
- Larger, more accessible typography for users with weaker vision.
- Personal brand trust: Nefset as a real local host, not a ghost company.
- Clearer, warmer copy with less water and more useful reassurance.
- A booking flow that gives two calm paths:
  - book online with secure Stripe payment;
  - chat directly on WhatsApp and arrange details together.

## Design Principles

- Keep the boutique Genoa/local mood, but make the UI more readable and confident.
- Use system font stack and iPhone-like rhythm where possible.
- Reduce tiny uppercase labels and excessive letter spacing.
- Body text should generally be around 16-17px or larger.
- Secondary text must be darker and readable.
- Buttons need visible normal, hover, active, and focus states.
- Primary CTAs should be direct: "Book experience" instead of vague wording like "Check availability" when the action is booking.
- WhatsApp is a safety option, not a blocker before booking.
- Personalized request is a separate path for people who need a different pace, timing, date, route, group setup, or logistics.

## Copy Tone

Target tone:

- clear
- human
- warm
- useful
- personal
- not corporate
- not AI-travel-brochure

Useful phrases:

- "I host..."
- "We'll shape the day together."
- "You can book online with a secure Stripe deposit, or chat with me and arrange the details directly."
- "Request a personalized experience."
- "Instant confirmation."

Avoid:

- wording that makes ready-to-book users hesitate, such as "Message me first";
- repeating the same booking CTA in multiple nearby blocks;
- vague CTAs like "Check availability" when the user can actually book;
- too much poetic/watery copy.

## Current Experiment State

The Apple/iOS-like typography experiment has been applied only to:

- `tours/genoa-must-see/index.html`

The Genoa tour page currently has:

- system-font style instead of Georgia-heavy typography;
- larger body, itinerary, FAQ, and booking text;
- `Book experience` as the primary booking CTA;
- `Instant confirmation` under the main booking button;
- `Request a personalized experience` as a secondary/custom path;
- WhatsApp as a secondary question path;
- bottom CTA changed from repeated booking to personalized-request logic:
  - "Want to adjust this tour?"
  - "Almost right, but not exactly?"
  - CTA: "Request a personalized experience"

Other pages still have only the earlier UX/accessibility pass, not the full Apple-like typography pass.

## References and Reasoning

- Apple/Shopify inspiration: mobile readability, clean product-card logic, strong CTAs, familiar iPhone-like interaction feel.
- GOV.UK inspiration: accessibility rules, clarity, contrast, plain language.
- Baymard-style thinking: reduce checkout/product-page confusion; make price, deposit, next steps, trust and payment security clear.
- Withlocals-style thinking: personalized/private experience path and local-host trust.

## Next Likely Steps

1. Review Genoa page visually on mobile.
2. Decide whether the Apple-like typography direction feels right.
3. If yes, extend the typography system to:
   - homepage;
   - booking page;
   - Portofino;
   - Cinque Terre.
4. Then refine tour cards into clearer product cards:
   - View experience;
   - Book experience.
5. Continue copy pass for clarity, SEO, and personal host trust.
