const RSVP_URL = 'https://forms.gle/tnZxmdZ5R93eFUj19';
const MAPS_URL = 'https://maps.app.goo.gl/fb5JWYKorDAH574f7';

// PDF annotations are measured from these rendered elements, never guessed from CSS coordinates.
const LINK_TARGETS = [
  { file: '01-cover.html', selector: '#envelope-target', target: { type: 'internal', pageIndex: 2 } },
  { file: '02-save-the-date.html', selector: '#invitation-badge', target: { type: 'internal', pageIndex: 2 } },
  { file: '04-invitation.html', selector: '#rsvp-invite', target: { type: 'external', url: RSVP_URL } },
  { file: '05-details.html', selector: '#rsvp-btn-detail', target: { type: 'external', url: RSVP_URL } },
  { file: '06-route.html', selector: '#map-link', target: { type: 'external', url: MAPS_URL } },
  { file: '06-route.html', selector: '#loc-link', target: { type: 'external', url: MAPS_URL } },
  { file: '06-route.html', selector: '#rsvp-route', target: { type: 'external', url: RSVP_URL } },
];

module.exports = { LINK_TARGETS, MAPS_URL, RSVP_URL };
