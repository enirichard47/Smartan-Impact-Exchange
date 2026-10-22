// Facts used by the Terms and Privacy pages. Those pages are switched off for now (app/_legal,
// a folder Next.js does not serve); to bring them back, see "Legal pages" in the README.
// CONFIRM WITH SMARTAN HOUSE before launch. Blank values are left out of the pages.
export const LEGAL = {
  entity: 'The Smartan House',          // the organisation's full legal name, as registered
  registration: '',                     // e.g. 'CAC RC 1234567' or 'IT 123456'
  address: '',                          // registered address
  email: 'builders@smartanhouse.org',   // an inbox someone reads: questions, refunds, privacy requests
  effective: '25 September 2026',       // date these versions take effect
  refundDays: 14,                       // window for duplicate / mistaken payments
};
