import fs from 'node:fs';

const SPLINE_NODES = [
  { t: 0.00, yVh: -85.0 },
  { t: 0.15, yVh: -55.0 },
  { t: 0.30, yVh: -26.0 },
  { t: 0.50, yVh: 0.0 },
  { t: 0.70, yVh: 26.0 },
  { t: 0.85, yVh: 55.0 },
  { t: 1.00, yVh: 85.0 }
];

function paceRingProgress(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const delta = t - 0.50;
  const settle = delta * (1 - 0.08 * Math.exp(-24 * delta * delta));
  return Math.max(0, Math.min(1, 0.50 + settle));
}

function getY(t) {
  const clampedT = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < SPLINE_NODES.length - 1 && SPLINE_NODES[i + 1].t < clampedT) i++;
  const k1 = SPLINE_NODES[i];
  const k2 = SPLINE_NODES[Math.min(SPLINE_NODES.length - 1, i + 1)];
  const dt = k2.t - k1.t || 1;
  const u = (clampedT - k1.t) / dt;
  return k1.yVh + u * (k2.yVh - k1.yVh);
}

const RING_OFFSETS = [0.00, 0.80, 1.60, 2.40, 3.20];
const TOTAL_SPACE_TRAVEL = 0.50 + 3.20; // 3.70

console.log('Progress | travel | Ring 1 localT | Ring 1 yVh | Ring 1 Alpha | Ring 2 localT');
for (let p = 0.60; p <= 0.85; p += 0.01) {
  let ringTravel = 0.50 + ((p - 0.60) / 0.38) * (3.70 - 0.50);
  let localT1 = ringTravel - RING_OFFSETS[1];
  let localT2 = ringTravel - RING_OFFSETS[2];
  let yVh1 = getY(paceRingProgress(localT1));
  let alpha1 = 1;
  if (localT1 < 0.08) alpha1 = Math.max(0, localT1 / 0.08);
  else if (localT1 > 0.88) alpha1 = Math.max(0, 1 - (localT1 - 0.88) / 0.16);
  if (localT1 >= 0.50 && localT1 <= 0.95) {
    console.log(`${p.toFixed(3)}   | ${ringTravel.toFixed(3)}  | ${localT1.toFixed(3)}       | ${yVh1.toFixed(1)}       | ${alpha1.toFixed(2)}        | ${localT2.toFixed(3)}`);
  }
}
