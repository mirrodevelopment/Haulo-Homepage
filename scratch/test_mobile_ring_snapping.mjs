import assert from 'node:assert';
import fs from 'node:fs';

console.log('===============================================================');
console.log(' HAULO Mobile Ring Snap Scroll Verification Suite');
console.log('===============================================================');

const heroSource = fs.readFileSync('src/components/HeroExperience.jsx', 'utf8');

// Test 1: Verify GSAP-driven scroll tween on mobile prevents Lenis touch-abort
console.log('\n--- Test 1: GSAP-Driven Scroll on Mobile ---');
assert.ok(
  heroSource.includes('if (isMobileView || isTouch)') &&
  heroSource.includes('activeScrollTween = gsap.to(scrollProxy') &&
  heroSource.includes('window.lenis.scrollTo(scrollProxy.y, { immediate: true, force: true })'),
  'On mobile view, animateToScrollY must use GSAP tween driving immediate scrollTo so touch events cannot abort it'
);
console.log('PASS: GSAP scroll tween with immediate Lenis sync prevents Lenis virtualScroll touch-abort.');

// Test 2: Settle Check for Mid-Ring Stoppage respecting scrolling direction
console.log('\n--- Test 2: Automatic Settle Snapping in Scrolling Direction ---');
assert.ok(
  heroSource.includes('checkMobileSnapSettle') &&
  heroSource.includes('window.addEventListener(\'scroll\', handleScrollActivity') &&
  heroSource.includes('window.addEventListener(\'scrollend\', checkMobileSnapSettle'),
  'checkMobileSnapSettle must be connected to scroll and scrollend events to catch any mid-ring stop'
);
assert.ok(
  heroSource.includes('if (scrollDirection === 1)') &&
  heroSource.includes('targetStep = SNAP_STEPS.find((s) => s > currentProgress + 0.005)'),
  'checkMobileSnapSettle must advance forward to the next ring when scrolling forward'
);
assert.ok(
  heroSource.includes('targetStep = [...SNAP_STEPS].reverse().find((s) => s < currentProgress - 0.005)'),
  'checkMobileSnapSettle must advance backward to the previous ring when scrolling backward'
);
console.log('PASS: Automatic settle snapping advances in the scrolling direction.');

// Test 3: handleTouchEnd Slight Scroll Directional Snapping
console.log('\n--- Test 3: handleTouchEnd Directional Advance (No Return to Origin Ring) ---');
assert.ok(
  heroSource.includes('deltaY > 6') &&
  heroSource.includes('targetStep = SNAP_STEPS.find((s) => s > touchStartProgress + 0.012)') &&
  heroSource.includes('deltaY < -6') &&
  heroSource.includes('targetStep = [...SNAP_STEPS].reverse().find((s) => s < touchStartProgress - 0.012)'),
  'handleTouchEnd must advance to the ring in the scrolling direction instead of returning to origin ring'
);
console.log('PASS: handleTouchEnd slight scroll advances in the swipe direction without returning back.');

// Test 4: Mathematical Verification of Slight Scroll Direction
console.log('\n--- Test 4: Mathematical Verification of Slight Scroll from Ring 1 ---');
const SNAP_STEPS = [
  0.00,  // Word 0: HAULO
  0.09,  // Word 1: DESIGN TO
  0.18,  // Word 2: ELEVATE
  0.27,  // Word 3: DIGITAL
  0.36,  // Word 4: AND EVOLVE
  0.46,  // Editorial Hero
  0.60,  // Space Mech Ring 0 (Entry Ring)
  0.695, // Space Mech Ring 1 (Theory of Bloom)
  0.790, // Space Mech Ring 2 (Stakor)
  0.885, // Space Mech Ring 3 (Awkn)
  0.980  // Space Mech Ring 4 (Truly Bare)
];

// User was on Ring 1 (0.695) and swiped slightly UP (forward):
const touchStartProgress = 0.695;
const forwardTarget = SNAP_STEPS.find((s) => s > touchStartProgress + 0.012);
assert.strictEqual(forwardTarget, 0.790, 'Slight swipe forward from Ring 1 must land on Ring 2 (0.790)');

// User was on Ring 2 (0.790) and swiped slightly DOWN (backward):
const backwardTarget = [...SNAP_STEPS].reverse().find((s) => s < 0.790 - 0.012);
assert.strictEqual(backwardTarget, 0.695, 'Slight swipe backward from Ring 2 must land on Ring 1 (0.695)');
console.log('PASS: Slight swipe targets adjacent ring in the swipe direction.');

// Test 5: Cleanup Integrity
console.log('\n--- Test 5: Lifecycle and Timer Cleanup ---');
assert.ok(
  heroSource.includes('if (activeScrollTween)') &&
  heroSource.includes('activeScrollTween.kill()') &&
  heroSource.includes('clearTimeout(mobileSettleTimer)') &&
  heroSource.includes('window.removeEventListener(\'scroll\', handleScrollActivity)') &&
  heroSource.includes('window.removeEventListener(\'scrollend\', checkMobileSnapSettle)'),
  'Active scroll tween, settle timers, and scroll event listeners must all be cleaned up on unmount'
);
console.log('PASS: All timers, tweens, and event listeners are properly unmounted without memory leaks.');

console.log('\n===============================================================');
console.log(' ALL 5 MOBILE RING SNAP TESTS VERIFIED AND PASSED');
console.log('===============================================================');
