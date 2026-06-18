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
- /assets/css/site.css - shared site-wide component styles.
- /assets/css/pages/ - page-specific stylesheets extracted from HTML.
- /assets/js/site.js - shared frontend behavior used across public pages.
- /analytics-consent.js - analytics consent behavior.
- /netlify/functions/ - serverless backend for Stripe, Resend, Google Calendar and Sheets.

## Current styling approach

Large CSS blocks have been extracted from HTML into external stylesheets. Shared site-wide component styles live in /assets/css/site.css. Page-specific CSS lives in /assets/css/pages/. Some inline style attributes still exist for small one-off or dynamic states; these should be reduced gradually when touching those sections.

## Refactor rules

- Keep SEO-critical tags in every HTML page: one title, one visible H1, and one meta description unless the page is intentionally noindex.
- Keep only one FAQPage schema per page. Prefer JSON-LD in head; do not duplicate it with visible microdata.
- Shared JavaScript belongs in /assets/js/site.js unless it is truly page-specific.
- Page-specific booking logic can stay inside the booking page or Netlify functions.
- Avoid committing macOS metadata files such as .DS_Store.
