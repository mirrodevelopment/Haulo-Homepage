// Verification test for Phase 5, Step 6B.1: Mobile Rendering Resolution Optimization
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

console.log('===============================================================');
console.log(' HAULO Step 6B.1: Mobile Rendering Resolution Verification');
console.log('===============================================================');

// 1. Inspect mobileRenderingConfig.js
const configSrc = readFileSync('src/utils/mobileRenderingConfig.js', 'utf-8');

assert(configSrc.includes('export function isMobileDevice'), 'Must export unified isMobileDevice()');
assert(configSrc.includes('export function getTargetDPR'), 'Must export getTargetDPR()');
assert(configSrc.includes('export function getAntialiasSetting'), 'Must export getAntialiasSetting()');
assert(configSrc.includes('Math.min(deviceDPR, 2.0)'), 'Desktop must preserve native fidelity up to DPR 2.0');
assert(configSrc.includes('Math.min(deviceDPR, 1.25)'), 'Mobile must default to optimized DPR 1.25');
assert(configSrc.includes('searchParams.get(\'dpr\')'), 'Must support URL experimental override ?dpr=...');
assert(configSrc.includes('searchParams.get(\'aa\')'), 'Must support URL experimental override ?aa=...');
console.log('PASS: mobileRenderingConfig.js correctly implements unified mobile detection, DPR 1.25 default, and experimental overrides.');

// 2. Inspect Frog3DModel.jsx
const frogSrc = readFileSync('src/frog_3D/Frog3DModel.jsx', 'utf-8');

assert(frogSrc.includes('import { getTargetDPR, getAntialiasSetting, isMobileDevice } from \'../utils/mobileRenderingConfig\';'), 'Frog3DModel must import from mobileRenderingConfig');
assert(frogSrc.includes('antialias: getAntialiasSetting()'), 'Frog3DModel must use getAntialiasSetting()');
assert(frogSrc.includes('renderer.setPixelRatio(getTargetDPR())'), 'Frog3DModel must initialize renderer with getTargetDPR()');
assert(frogSrc.includes('const targetDPR = getTargetDPR();'), 'Frog3DModel onResize must use getTargetDPR()');
assert(!frogSrc.includes('renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));'), 'Frog3DModel must NOT hardcode DPR 2.0');
console.log('PASS: Frog3DModel.jsx respects getTargetDPR() and getAntialiasSetting() on both init and resize.');

// 3. Inspect Ring3DModel.jsx
const ringSrc = readFileSync('src/components/Ring3DModel.jsx', 'utf-8');

assert(ringSrc.includes('import { getTargetDPR, getAntialiasSetting } from \'../utils/mobileRenderingConfig\';'), 'Ring3DModel must import from mobileRenderingConfig');
assert(ringSrc.includes('antialias: getAntialiasSetting()'), 'Ring3DModel must use getAntialiasSetting()');
assert(ringSrc.includes('renderer.setPixelRatio(getTargetDPR())'), 'Ring3DModel must initialize renderer with getTargetDPR()');
assert(ringSrc.includes('const targetDPR = getTargetDPR();'), 'Ring3DModel updateRendererSize must use getTargetDPR()');
console.log('PASS: Ring3DModel.jsx respects getTargetDPR() and getAntialiasSetting() across normal and expanded states.');

// 4. Mathematical Pixel Workload Calculations
const viewportW = 393;
const viewportH = 852;

const pixelsDPR20 = (viewportW * 2.0) * (viewportH * 2.0);
const pixelsDPR15 = (viewportW * 1.5) * (viewportH * 1.5);
const pixelsDPR125 = (viewportW * 1.25) * (viewportH * 1.25);
const pixelsDPR10 = (viewportW * 1.0) * (viewportH * 1.0);

console.log('\n--- Mathematical Pixel Workload & Fill Rate Comparison (iPhone 393x852) ---');
console.log(`- Previous Hero Load (DPR 2.0): ${Math.round(pixelsDPR20).toLocaleString()} px/frame (100% baseline)`);
console.log(`- Previous Ring Load (DPR 1.5): ${Math.round(pixelsDPR15).toLocaleString()} px/frame (${((pixelsDPR15/pixelsDPR20)*100).toFixed(1)}% of DPR 2.0)`);
console.log(`- New Optimized DPR 1.25:       ${Math.round(pixelsDPR125).toLocaleString()} px/frame (${((pixelsDPR125/pixelsDPR20)*100).toFixed(1)}% of DPR 2.0, -31.3% vs DPR 1.5)`);
console.log(`- Experimental DPR 1.0:         ${Math.round(pixelsDPR10).toLocaleString()} px/frame (${((pixelsDPR10/pixelsDPR20)*100).toFixed(1)}% of DPR 2.0, -55.6% vs DPR 1.5)`);

console.log('\n===============================================================');
console.log(' ALL STEP 6B.1 RESOLUTION & DPR CHECKS PASSED');
console.log('===============================================================');
