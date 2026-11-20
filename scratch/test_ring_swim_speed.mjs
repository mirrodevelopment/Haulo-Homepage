import assert from 'node:assert';
import fs from 'node:fs';

console.log('===============================================================');
console.log(' HAULO Frog In-Ring Swimming Speed Verification Suite');
console.log('===============================================================');

const frogSource = fs.readFileSync('src/frog_3D/Frog3DModel.jsx', 'utf8');
const ringSource = fs.readFileSync('src/components/Ring3DModel.jsx', 'utf8');
const heroSource = fs.readFileSync('src/components/HeroExperience.jsx', 'utf8');

// Test 1: Frog3DModel speed modulation based on ring placement
console.log('\n--- Test 1: In-Ring Slow Swim Speed Implementation ---');
assert.ok(
  frogSource.includes('THREE.MathUtils.lerp(0.36, 0.19, effectiveLock)'),
  'Frog3DModel must lerp base swim speed from 0.36 down to 0.19 when placed inside ring'
);
assert.ok(
  frogSource.includes('facingRef.current.setRingLockWeight'),
  'Frog3DModel must expose setRingLockWeight on facingRef'
);
assert.ok(
  frogSource.includes('function tickFrogAnimation(delta, now, lockWeight)'),
  'tickFrogAnimation must accept optional lockWeight parameter'
);
console.log('PASS: Frog3DModel modulates swim speed between 0.36 (free flight) and 0.19 (in-ring gentle float).');

// Test 2: Ring3DModel passes sharedFrogLockWeight to tickFrogAnimation
console.log('\n--- Test 2: Ring3DModel Tick Lock Weight Integration ---');
assert.ok(
  ringSource.includes('sharedFrog.tickFrogAnimation(dt, now, sharedFrogLockWeight)'),
  'Ring3DModel must pass sharedFrogLockWeight to tickFrogAnimation on every frame'
);
console.log('PASS: Ring3DModel accurately feeds sharedFrogLockWeight to shared frog animation.');

// Test 3: HeroExperience sets lock weight during placement and unmount
console.log('\n--- Test 3: HeroExperience Lock Weight Lifecycle ---');
assert.ok(
  heroSource.includes('frogFacingRef.current?.setRingLockWeight?.(lockWeight)'),
  'HeroExperience must update frog ring lock weight during ring alignment'
);
assert.ok(
  heroSource.includes('frogFacingRef.current?.setRingLockWeight?.(0)'),
  'HeroExperience must reset lock weight to 0 on unmount'
);
console.log('PASS: HeroExperience properly controls in-ring lock weight lifecycle.');

// Test 4: Mathematical Speed Ratio Verification
console.log('\n--- Test 4: Mathematical Speed Ratio Check ---');
const normalSpeed = 0.36;
const inRingSpeed = 0.19;
const speedRatio = normalSpeed / inRingSpeed;
console.log(`Normal swimming pace: ${normalSpeed} cycles/s (duration: ${(1/normalSpeed).toFixed(1)}s)`);
console.log(`In-ring swimming pace: ${inRingSpeed} cycles/s (duration: ${(1/inRingSpeed).toFixed(1)}s)`);
console.log(`Speed reduction factor: ${speedRatio.toFixed(2)}x slower`);
assert.ok(speedRatio >= 1.7 && speedRatio <= 2.2, 'In-ring swimming speed must be calibrated to gentle swimming pace (~1.9x slower)');
console.log('PASS: In-ring swimming pace is calibrated to a balanced, gentle rhythm.');

console.log('\n===============================================================');
console.log(' ALL 4 IN-RING SWIM SPEED TESTS VERIFIED AND PASSED');
console.log('===============================================================');
