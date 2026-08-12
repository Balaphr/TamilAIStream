/* Smoke test: home-music rendering block (extracted from script.js)
   Verifies Trending + AI Recommended render SONGS (not stations) and
   that the empty fallback works, with zero exceptions.          */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

// Extract the appended home-music block (song-based renderers).
const start = src.indexOf('function renderSongTrack');
if (start === -1) throw new Error('Could not locate renderSongTrack block');
const block = src.slice(start);

// Mock DOM elements
function makeEl() {
  return { innerHTML: '', querySelectorAll: () => [], addEventListener: () => {} };
}
const trendingEl = makeEl();
const aiEl = makeEl();

// Mock document.querySelector to route to our fake track elements
global.document = { querySelector(sel) {
  if (sel === '#trendingScroll .stations-track') return trendingEl;
  if (sel === '[data-section="ai-recommended"] .stations-track') return aiEl;
  return null;
}};

let played = null;
let toasted = null;
global.playSong = (s) => { played = s && s.title; };
global.showToast = (m) => { toasted = m; };

// DataStore stub with published + non-published songs
let songs = [
  { id: '1', title: 'Song One', artist: 'Artist A', albumCover: 'a.jpg', status: 'published', movie: 'Movie X' },
  { id: '2', title: 'Song Two', artist: 'Artist B', status: 'published' },
  { id: '3', title: 'Draft Song', status: 'draft' }
];
global.DataStore = { getSongs: () => songs };

// Evaluate the block and grab the three functions
const factory = new Function(block + '; return { renderSongTrack: typeof renderSongTrack !== "undefined" ? renderSongTrack : null, ' +
  'renderTrendingDynamic: typeof renderTrendingDynamic !== "undefined" ? renderTrendingDynamic : null, ' +
  'renderAIRecommendedDynamic: typeof renderAIRecommendedDynamic !== "undefined" ? renderAIRecommendedDynamic : null };');
const api = factory();

const failures = [];
function assert(cond, msg) { if (!cond) failures.push(msg); }

// 1) Trending renders published songs only
api.renderTrendingDynamic();
assert(trendingEl.innerHTML.includes('song-card'), 'Trending should render song-card items');
assert(trendingEl.innerHTML.includes('Song One'), 'Trending should include "Song One"');
assert(trendingEl.innerHTML.includes('Song Two'), 'Trending should include "Song Two"');
assert(!trendingEl.innerHTML.includes('Draft Song'), 'Trending must NOT include draft songs');
assert(/data-song-id="1"/.test(trendingEl.innerHTML) || trendingEl.innerHTML.includes('data-song-id="1"'), 'Trending card should carry data-song-id');

// 2) AI Recommended renders a subset of songs
aiEl.innerHTML = '';
api.renderAIRecommendedDynamic();
assert(aiEl.innerHTML.includes('song-card'), 'AI Recommended should render song-card items');
assert(aiEl.innerHTML.includes('data-song-id'), 'AI Recommended cards should carry data-song-id');

// 3) Playback wiring: clicking card calls playSong + showToast
songs = [ { id: '9', title: 'Playable', artist: 'A', status: 'published' } ];
trendingEl.innerHTML = '';
const cardMock = { dataset: { songId: '9' } };
cardMock.addEventListener = (t, h) => { if (t === 'click') h.call(cardMock, { target: { closest: () => null } }); };
trendingEl.querySelectorAll = (sel) => {
  if (sel === '.song-card') return [cardMock];
  if (sel === '.song-play-overlay') return [];
  return [];
};
api.renderTrendingDynamic();
assert(played === 'Playable', 'Clicking a song card should call playSong (got: ' + played + ')');
assert(toasted && toasted.includes('Playable'), 'Clicking a song card should fire a Now Playing toast');

// 4) Empty fallback
songs = [];
trendingEl.innerHTML = '';
api.renderTrendingDynamic();
assert(trendingEl.innerHTML.includes('No songs yet'), 'Empty Trending should render fallback copy');

// 5) Empty throws no exception when DataStore missing
global.DataStore = undefined;
let threw = false;
try { api.renderAIRecommendedDynamic(); } catch (e) { threw = true; }
assert(!threw, 'renderAIRecommendedDynamic should not throw when DataStore is absent');

if (failures.length) {
  console.error('SMOKE TEST FAILED:\n - ' + failures.join('\n - '));
  process.exit(1);
} else {
  console.log('SMOKE TEST PASSED: home song rendering OK (0 exceptions, music-only).');
}
