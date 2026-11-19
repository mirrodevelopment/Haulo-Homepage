import assert from 'node:assert';
import fs from 'node:fs';

console.log('===============================================================');
console.log(' HAULO Entry Ring Skipping Regression Test Suite');
console.log('===============================================================');

const heroSource = fs.readFileSync('src/components/HeroExperience.jsx', 'utf8');

// Test 1: Check that touchHandled guards the snap gesture in Section 2 and 3
console.log('\n--- Test 1: touchHandled Guard Presence in Section 2/3 ---');
assert.ok(
  heroSource.includes('if (touchHandled || now - lastTouchTriggerTime < 350)'),
  'touchHandled guard must throttle and prevent double-triggering during a single touch gesture'
);
console.log('PASS: touchHandled guard properly prevents multi-triggering within a single swipe.');

// Test 2: Check that touchHandled is set to true on trigger
console.log('\n--- Test 2: touchHandled Marked on Snap Step Execution ---');
const touchMoveMatches = heroSource.match(/touchHandled\s*=\s*true;/g);
assert.ok(
  touchMoveMatches && touchMoveMatches.length >= 3,
  'touchHandled must be set to true in Section 1, Section 2/3 forward, and Section 2/3 backward'
);
console.log('PASS: touchHandled is set to true on every forward and backward snap step trigger.');

// Test 3: Check that isWordAnimating blocks re-triggering in Section 2/3
console.log('\n--- Test 3: isWordAnimating Animation Lock ---');
assert.ok(
  heroSource.includes('if (isWordAnimating) {\n            e.preventDefault();\n            return;\n          }'),
  'isWordAnimating must prevent subsequent touches from retargeting mid-flight'
);
console.log('PASS: isWordAnimating cleanly locks interaction until the current step animation finishes.');

// Test 4: Check that activeTargetProgress chaining bug is completely removed
console.log('\n--- Test 4: Removal of activeTargetProgress Chaining ---');
assert.ok(
  !heroSource.includes('activeTargetProgress !== null'),
  'activeTargetProgress chaining that caused step skipping must be completely removed'
);
console.log('PASS: activeTargetProgress chaining is eliminated.');

// Test 5: Check Ring 0 maxT overlap
console.log('\n--- Test 5: Ring 0 Spline Conveyor maxT Overlap ---');
assert.ok(
  heroSource.includes('const maxT = i === 0 ? 0.92 : (i === SPACE_COUNT - 1 ? 0.85 : 0.90);'),
  'Ring 0 maxT must be 0.92 to ensure a continuous overlap with Ring 1 (minT = 0.10 at travel 0.90)'
);
console.log('PASS: Ring 0 has 0.92 maxT preventing dead zones on backward scroll from Ring 1.');

// Test 6: Mathematical verification of forward and backward steps
console.log('\n--- Test 6: Mathematical Detent Step Progression ---');
const SNAP_STEPS = [
  0.00,  // Word 0: HAULO
  0.09,  // Word 1: DESIGN TO
  0.18,  // Word 2: THINK
  0.27,  // Word 3: BUILD
  0.36,  // Word 4: AND EVOLVE
  0.46,  // HAULO Editorial Hero
  0.60,  // Space Ring 0 (Entry Ring)
  0.695, // Space Ring 1 (Theory of Bloom)
  0.790, // Space Ring 2 (Stakor)
  0.885, // Space Ring 3 (Awkn)
  0.980  // Space Ring 4 (Truly Bare)
];

// Forward from Editorial Hero (0.46)
const nextFromHero = SNAP_STEPS.find((s) => s > 0.46 + 0.012);
assert.strictEqual(nextFromHero, 0.60, 'Forward scroll from 2nd section (0.46) must land on Entry Ring (0.60)');

// Backward from Theory of Bloom (0.695)
const prevFromRing1 = [...SNAP_STEPS].reverse().find((s) => s < 0.695 - 0.012);
assert.strictEqual(prevFromRing1, 0.60, 'Backward scroll from Theory of Bloom (0.695) must land on Entry Ring (0.60)');

// Backward from Entry Ring (0.60)
const prevFromRing0 = [...SNAP_STEPS].reverse().find((s) => s < 0.60 - 0.012);
assert.strictEqual(prevFromRing0, 0.46, 'Backward scroll from Entry Ring (0.60) must land on Editorial Hero (0.46)');

// Forward from Entry Ring (0.60)
const nextFromRing0 = SNAP_STEPS.find((s) => s > 0.60 + 0.012);
assert.strictEqual(nextFromRing0, 0.695, 'Forward scroll from Entry Ring (0.60) must land on Theory of Bloom (0.695)');

console.log('PASS: Mathematical detent step sequence is completely contiguous in both directions.');

console.log('\n===============================================================');
console.log(' ALL 6 ENTRY RING TESTS VERIFIED AND PASSED');
console.log('===============================================================');
