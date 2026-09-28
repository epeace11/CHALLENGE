import assert from 'node:assert/strict';
import {
  MAX_SCALE,
  fitted,
  pinch,
  release,
  settle,
  toggleZoom,
  zoomAt,
} from '../lib/zoom.ts';

// A phone: a 390×700 stage holding a tall screenshot fitted to 324×700.
const stage = { w: 390, h: 700 },
  image = { w: 324, h: 700 };
const close = (a, b) =>
  assert.ok(
    Object.keys(b).every((k) => Math.abs(a[k] - b[k]) < 1e-9),
    `${JSON.stringify(a)} ≈ ${JSON.stringify(b)}`,
  );
// Where a stage point lands on the image (image px from its centre, unscaled), for checking that zooms keep a point in place.
const under = (v, at) => ({
  x: (at.x - v.x) / v.scale,
  y: (at.y - v.y) / v.scale,
});

// Fitted, the image cannot move: nothing overflows.
assert.deepEqual(settle({ scale: 1, x: 40, y: -30 }, image, stage), fitted);
// Zoomed 2×, it pans up to its edges and no further: 648 wide in a 390 stage leaves 129 px each way.
assert.deepEqual(settle({ scale: 2, x: 500, y: -900 }, image, stage), {
  scale: 2,
  x: 129,
  y: -350,
});
// Scale stays between fitted and the maximum.
assert.equal(settle({ scale: 0.5, x: 0, y: 0 }, image, stage).scale, 1);
assert.equal(settle({ scale: 40, x: 0, y: 0 }, image, stage).scale, MAX_SCALE);

// Zooming about a point keeps the image under that point.
const at = { x: 100, y: -200 },
  z = zoomAt(fitted, 3, at);
close(under(z, at), under(fitted, at));
const z2 = zoomAt(z, 1.5, { x: -50, y: 20 });
close(under(z2, { x: -50, y: 20 }), under(z, { x: -50, y: 20 }));

// A pinch: fingers spreading from 100 px to 250 px apart zooms 2.5× and keeps what was between them there…
const m0 = { x: 20, y: 40 },
  p = pinch(fitted, m0, 100, m0, 250);
assert.equal(p.scale, 2.5);
close(under(p, m0), under(fitted, m0));
// …and moving both fingers together drags the image with them.
const moved = pinch(fitted, m0, 100, { x: 80, y: 10 }, 100);
close(moved, { scale: 1, x: 60, y: -30 });
// Pinching in past fitted overshoots a little, then settles back to fit.
const tiny = pinch(fitted, m0, 200, m0, 20);
assert.equal(tiny.scale, 0.7);
assert.deepEqual(settle(tiny, image, stage), fitted);

// Double-tap zooms in on the tapped spot (2.5×, since 390/324 is less), within the edges; a second double-tap fits again.
const tap = { x: 150, y: -300 },
  d = toggleZoom(fitted, tap, image, stage);
assert.equal(d.scale, 2.5);
assert.deepEqual(d, settle(d, image, stage));
assert.deepEqual(toggleZoom(d, tap, image, stage), fitted);
// A long, narrow screenshot (fitted 120 px wide) zooms far enough to fill the width.
assert.equal(
  toggleZoom(fitted, { x: 0, y: 0 }, { w: 120, h: 700 }, stage).scale,
  390 / 120,
);

// Letting go of a drag at fitted size: far or fast enough pages or closes, otherwise it snaps back.
assert.equal(release('x', -120, 400, stage), 'next');
assert.equal(release('x', 120, 400, stage), 'prev');
assert.equal(release('x', -40, 60, stage), 'next'); // a quick flick
assert.equal(release('x', -40, 400, stage), null);
assert.equal(release('y', 160, 500, stage), 'close');
assert.equal(release('y', 40, 400, stage), null);
assert.equal(release('y', -200, 300, stage), null); // pushing up never closes

console.log(
  'PASS: zoom — edges and limits, zooming and pinching about a point, double-tap, swipe and pull-to-close decisions.',
);
