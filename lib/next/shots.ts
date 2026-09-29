import type { DateString } from './model.ts';

/**
 * Sample proof screenshots drawn as inline SVG data URIs, so the sample world needs no image files
 * and no network. They imitate a phone's step count and screen time screens.
 */

const FONT = `-apple-system, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif`;

const toUri = (body: string) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" font-family="${FONT}">${body}</svg>`,
  );

const thousands = (n: number) => n.toLocaleString('en-US');

/** "Thursday, Nov 19" without depending on the device's locale. */
function longDate(day: DateString) {
  return new Date(day + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Status bar with the clock, signal, wifi and battery. */
const statusBar = (clock: string) => `
  <text x="36" y="36" font-size="17" font-weight="600" fill="#000">${clock}</text>
  <g fill="#000">
    <rect x="292" y="26" width="3.5" height="6" rx="1"/><rect x="298" y="23" width="3.5" height="9" rx="1"/>
    <rect x="304" y="20" width="3.5" height="12" rx="1"/><rect x="310" y="17" width="3.5" height="15" rx="1"/>
    <path d="M325 22a11 11 0 0 1 15 0l-2 2a8 8 0 0 0-11 0zm3.5 3.5a6 6 0 0 1 8 0l-4 4z"/>
    <rect x="347" y="18" width="25" height="13" rx="4" fill="none" stroke="#000" stroke-opacity=".4"/>
    <rect x="349" y="20" width="19" height="9" rx="2"/><rect x="373.5" y="22" width="2" height="5" rx="1" opacity=".4"/>
  </g>`;

/** Deterministic pseudo-random numbers from a seed, for chart bars. */
function bars(seed: number, count: number) {
  const out: number[] = [];
  let x = seed % 2147483647 || 1;
  for (let i = 0; i < count; i++) {
    x = (x * 48271) % 2147483647;
    out.push((x % 1000) / 1000);
  }
  return out;
}

/** A phone step-count screen showing `steps` for `day`. */
export function stepsShot(steps: number, day: DateString) {
  const hours = bars(steps, 24).map((r, h) =>
    h < 6 || h > 22
      ? r * 0.08
      : h === 8 || h === 12 || h === 18
        ? 0.6 + r * 0.4
        : 0.1 + r * 0.45,
  );
  const chart = hours
    .map((v, h) => {
      const height = Math.max(3, Math.round(v * 150));
      return `<rect x="${44 + h * 12.6}" y="${566 - height}" width="8" height="${height}" rx="2.5" fill="#ff5e3a"/>`;
    })
    .join('');
  return toUri(`
  <rect width="390" height="844" fill="#f2f2f7"/>
  ${statusBar('9:41')}
  <text x="20" y="98" font-size="17" fill="#ff5e3a">‹ Activity</text>
  <text x="20" y="152" font-size="34" font-weight="700" fill="#000">Steps</text>
  <rect x="16" y="176" width="358" height="36" rx="9" fill="#e3e3e8"/>
  <rect x="18" y="178" width="70" height="32" rx="8" fill="#fff"/>
  <g font-size="14" font-weight="600" fill="#000" text-anchor="middle">
    <text x="53" y="199">D</text><text x="124" y="199" font-weight="400">W</text><text x="195" y="199" font-weight="400">M</text>
    <text x="266" y="199" font-weight="400">6M</text><text x="337" y="199" font-weight="400">Y</text>
  </g>
  <rect x="16" y="232" width="358" height="380" rx="14" fill="#fff"/>
  <text x="36" y="268" font-size="13" font-weight="600" fill="#8e8e93" letter-spacing=".6">TOTAL</text>
  <text x="36" y="316" font-size="42" font-weight="700" fill="#000">${thousands(steps)}<tspan font-size="20" font-weight="600" fill="#8e8e93"> steps</tspan></text>
  <text x="36" y="344" font-size="16" fill="#8e8e93">${longDate(day)}</text>
  <line x1="36" y1="566.5" x2="354" y2="566.5" stroke="#d1d1d6"/>
  ${chart}
  <g font-size="12" fill="#8e8e93"><text x="40" y="590">12 AM</text><text x="115" y="590">6</text><text x="190" y="590">12 PM</text><text x="266" y="590">6</text></g>
  <rect x="16" y="632" width="358" height="112" rx="14" fill="#fff"/>
  <text x="36" y="668" font-size="17" fill="#000">Distance</text>
  <text x="354" y="668" font-size="17" fill="#8e8e93" text-anchor="end">${(steps * 0.00074).toFixed(1)} km</text>
  <line x1="36" y1="688.5" x2="374" y2="688.5" stroke="#e5e5ea"/>
  <text x="36" y="722" font-size="17" fill="#000">Flights climbed</text>
  <text x="354" y="722" font-size="17" fill="#8e8e93" text-anchor="end">${3 + (steps % 9)}</text>`);
}

const hm = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m`;

/** A phone screen-time screen where social apps and games add up to `minutes` on `day`. */
export function screenTimeShot(minutes: number, day: DateString) {
  const social = Math.round(minutes * 0.65),
    games = minutes - social,
    work = 45 + ((minutes * 7) % 50),
    total = social + games + work;
  const hours = bars(minutes * 31 + 7, 24).map((r, h) =>
    h < 7 ? 0 : h > 22 ? r * 0.2 : 0.15 + r * 0.85,
  );
  const scale = 110 / Math.max(...hours);
  const chart = hours
    .map((v, h) => {
      const height = Math.round(v * scale),
        blue = Math.round(height * 0.55),
        teal = Math.round(height * 0.2);
      const x = 40 + h * 13;
      return height < 2
        ? ''
        : `<rect x="${x}" y="${470 - height}" width="9" height="${height - blue - teal}" fill="#ff9f0a"/>` +
            `<rect x="${x}" y="${470 - blue - teal}" width="9" height="${teal}" fill="#30b0c7"/>` +
            `<rect x="${x}" y="${470 - blue}" width="9" height="${blue}" fill="#0a84ff"/>`;
    })
    .join('');
  const row = (y: number, color: string, name: string, time: string) => `
    <rect x="36" y="${y - 16}" width="30" height="30" rx="7" fill="${color}"/>
    <text x="80" y="${y + 5}" font-size="17" fill="#000">${name}</text>
    <text x="354" y="${y + 5}" font-size="17" fill="#8e8e93" text-anchor="end">${time}</text>`;
  return toUri(`
  <rect width="390" height="844" fill="#f2f2f7"/>
  ${statusBar('8:12')}
  <text x="20" y="98" font-size="17" fill="#0a84ff">‹ Settings</text>
  <text x="20" y="152" font-size="34" font-weight="700" fill="#000">Screen Time</text>
  <rect x="16" y="176" width="358" height="36" rx="9" fill="#e3e3e8"/>
  <rect x="18" y="178" width="176" height="32" rx="8" fill="#fff"/>
  <text x="106" y="199" font-size="14" font-weight="600" fill="#000" text-anchor="middle">Day</text>
  <text x="284" y="199" font-size="14" fill="#000" text-anchor="middle">Week</text>
  <rect x="16" y="232" width="358" height="290" rx="14" fill="#fff"/>
  <text x="36" y="266" font-size="15" fill="#8e8e93">${longDate(day)}</text>
  <text x="36" y="310" font-size="38" font-weight="700" fill="#000">${hm(total)}</text>
  <line x1="36" y1="470.5" x2="354" y2="470.5" stroke="#d1d1d6"/>
  ${chart}
  <g font-size="12" fill="#8e8e93"><text x="38" y="492">12 AM</text><text x="114" y="492">6 AM</text><text x="192" y="492">12 PM</text><text x="270" y="492">6 PM</text></g>
  <text x="20" y="562" font-size="13" font-weight="600" fill="#8e8e93" letter-spacing=".6">CATEGORIES</text>
  <rect x="16" y="574" width="358" height="190" rx="14" fill="#fff"/>
  ${row(606, '#0a84ff', 'Social', hm(social))}
  <line x1="80" y1="637.5" x2="374" y2="637.5" stroke="#e5e5ea"/>
  ${row(668, '#30b0c7', 'Games', hm(games))}
  <line x1="80" y1="699.5" x2="374" y2="699.5" stroke="#e5e5ea"/>
  ${row(730, '#ff9f0a', 'Productivity', hm(work))}`);
}
