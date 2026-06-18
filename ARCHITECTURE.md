# Genoa by Local code structure

This is a custom static website hosted on Netlify. The public pages are plain HTML, with shared assets and serverless booking functions.

## Main folders

- / - homepage and top-level static pages.
- /tours/ - experience pages.
- /travel-tips/ - SEO articles and travel guide pages.
- /booking/ - booking interface.
- /booking-confirmed/ - payment success page.
- /custom-request/ - custom experience request form.
- /images/ - local image assets.
- /assets/js/site.js - shared frontend behavior used across public pages.
- /analytics-consent.js - analytics consent behavior.
- /netlify/functions/ - serverless backend for Stripe, Resend, Google Calendar and Sheets.

## Current styling approach

Most page-specific CSS still lives inside each HTML file in a single style block. This is valid and works for SEO, but it is not ideal long term. The next architecture step should be extracting shared design tokens, header, buttons, cards, typography and footer styles into a common CSS file.

## Refactor rules

- Keep SEO-critical tags in every HTML page: one title, one visible H1, and one meta description unless the page is intentionally noindex.
- Keep only one FAQPage schema per page. Prefer JSON-LD in head; do not duplicate it with visible microdata.
- Shared JavaScript belongs in /assets/js/site.js unless it is truly page-specific.
- Page-specific booking logic can stay inside the booking page or Netlify functions.
- Avoid committing macOS metadata files such as .DS_Store.
