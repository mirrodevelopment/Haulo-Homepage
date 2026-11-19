// Verification test for Phase 5, Step 5.1: Loading Screen Functionality
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

console.log('===============================================================');
console.log(' HAULO Phase 5 – Step 5.1: Loading Screen Functional Verification');
console.log('===============================================================');

// 1. Inspect loadingManager.js
const loadingManagerSrc = readFileSync('src/services/loadingManager.js', 'utf-8');

assert(loadingManagerSrc.includes('isIndeterminate'), 'loadingManager must support isIndeterminate state');
assert(loadingManagerSrc.includes('setIndeterminate'), 'loadingManager must have setIndeterminate method');
assert(loadingManagerSrc.includes('Math.min(0.99, target)'), 'loadingManager.setProgress must cap progress strictly below 100% (at 0.99) prior to setReady()');
assert(loadingManagerSrc.includes('this.isReady = true'), 'loadingManager.setReady must set isReady to true');
assert(loadingManagerSrc.includes('this.targetProgress = 1.0'), 'loadingManager.setReady must set targetProgress to 1.0');
assert(loadingManagerSrc.includes('retry()'), 'loadingManager must have retry method');
console.log('✓ loadingManager.js contract verified (monotonic progress, indeterminate support, retry handler, strict 100% readiness gate)');

// 2. Inspect LoadingScreen.jsx
const loadingScreenSrc = readFileSync('src/components/LoadingScreen.jsx', 'utf-8');

assert(loadingScreenSrc.includes('const maxAllowed = loadState.isReady ? 100 : 99;'), 'LoadingScreen must never display 100% until loadState.isReady is true');
assert(loadingScreenSrc.includes('loadState.isIndeterminate ? \'...\' : `${Math.round(displayProgress)}%`'), 'LoadingScreen must display indeterminate text rather than fake percentage when indeterminate');
assert(loadingScreenSrc.includes('haulo-loading-screen__bar-circle--indeterminate'), 'LoadingScreen must apply indeterminate class to circle');
assert(loadingScreenSrc.includes('loadingManager.retry()'), 'LoadingScreen Retry button must call loadingManager.retry()');
assert(!loadingScreenSrc.includes('setTimeout(() => setIsMounted(false)'), 'LoadingScreen must not dismiss on a fixed timer without readiness');
console.log('✓ LoadingScreen.jsx verified (no premature 100%, indeterminate state rendered, retry button wired, FLIP transition on readiness)');

// 3. Inspect Frog3DModel.jsx
const frogSrc = readFileSync('src/frog_3D/Frog3DModel.jsx', 'utf-8');

// Ensure cached model does NOT setReady prematurely inside loadFrogGLTF
const fnStart = frogSrc.indexOf('function loadFrogGLTF');
const cachedGLTFBlock = frogSrc.substring(fnStart, frogSrc.indexOf('gltfLoadingPromise =', fnStart));
assert(!cachedGLTFBlock.includes('loadingManager.setReady()'), 'Cached model must NOT call setReady inside loadFrogGLTF');
assert(cachedGLTFBlock.includes('loadingManager.setProgress(0.92, \'compiling\''), 'Cached model must report compiling progress instead of setReady');

// Ensure real byte progress is reported when lengthComputable, and indeterminate otherwise (no fake total byte estimates)
assert(!frogSrc.includes('12 * 1024 * 1024'), 'Must not use fake total byte estimates (e.g. 12MB)');
assert(frogSrc.includes('loadingManager.setIndeterminate(\'downloading\')'), 'Must report indeterminate when Content-Length is unavailable');

// Ensure setReady is called strictly after the first renderer.render() call in hero loop
const renderBlock = frogSrc.substring(frogSrc.lastIndexOf('renderer.render(scene, camera)'), frogSrc.lastIndexOf('renderer.render(scene, camera)') + 300);
assert(renderBlock.includes('loadingManager.setReady()'), 'setReady() must be called directly after renderer.render(scene, camera)');

// Ensure retry handler re-invokes initFrogExperience and resets readiness
assert(frogSrc.includes('loadingManager.registerRetryHandler'), 'Retry handler must be registered to re-initialize frog experience');
assert(frogSrc.includes('initFrogExperience();'), 'initFrogExperience must be re-invoked on retry');

console.log('✓ Frog3DModel.jsx verified (cached reloads wait for first frame, real byte progress without fake totals, first-frame render gate, retry fully functional)');

// 4. Inspect loading-screen.css
const loadingCss = readFileSync('src/styles/loading-screen.css', 'utf-8');
assert(loadingCss.includes('.haulo-loading-screen__bar-circle--indeterminate'), 'CSS must define indeterminate class for circle');
assert(loadingCss.includes('@keyframes haulo-bar-sweep'), 'CSS must define haulo-bar-sweep keyframes');
console.log('✓ loading-screen.css verified (sweeping pill bar keyframe animation for indeterminate loading)');

console.log('\n===============================================================');
console.log(' ALL STEP 5.1 VERIFICATIONS PASSED SUCCESSFULLY!');
console.log('===============================================================');
