const MAPS_URL = 'https://maps.app.goo.gl/fb5JWYKorDAH574f7';

// PDF annotations are measured from these rendered elements, never guessed from CSS coordinates.
const LINK_TARGETS = [
  { file: '01-cover.html', selector: '#envelope-target', target: { type: 'internal', pageIndex: 1 } },
  { file: '03-route.html', selector: '#loc-link', target: { type: 'external', url: MAPS_URL } },
];

module.exports = { LINK_TARGETS, MAPS_URL };
