// HAULO Mobile Rendering Configuration
// Centralizes mobile detection, DPR resolution targets, and antialiasing settings.
// Preserves 100% desktop fidelity while optimizing mobile GPU pixel fill-rate.

export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return (
    window.innerWidth <= 900 ||
    (window.innerWidth / (window.innerHeight || 1)) < 1.0 ||
    (('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 1024)
  );
}

export function getTargetDPR() {
  if (typeof window === 'undefined') return 1;

  // Support URL experimental override: e.g. ?dpr=1.0, ?dpr=1.25, ?dpr=1.5, ?dpr=2.0
  const searchParams = new URLSearchParams(window.location.search);
  const dprParam = searchParams.get('dpr');
  if (dprParam) {
    const val = parseFloat(dprParam);
    if (!isNaN(val) && val >= 0.75 && val <= 3.0) {
      return val;
    }
  }

  const deviceDPR = window.devicePixelRatio || 1;

  if (!isMobileDevice()) {
    // Desktop: full native fidelity capped at DPR 2.0
    return Math.min(deviceDPR, 2.0);
  }

  // Mobile: default candidate is DPR 1.25.
  // Provides sharp text/silhouettes on high-DPI phone screens while cutting pixel shading workload by >30% vs DPR 1.5 and >60% vs DPR 2.0.
  return Math.min(deviceDPR, 1.25);
}

export function getAntialiasSetting() {
  if (typeof window === 'undefined') return true;

  // Support URL experimental override: e.g. ?aa=false or ?aa=true
  const searchParams = new URLSearchParams(window.location.search);
  const aaParam = searchParams.get('aa');
  if (aaParam === 'false' || aaParam === '0') return false;
  if (aaParam === 'true' || aaParam === '1') return true;

  if (!isMobileDevice()) {
    // Desktop: full hardware MSAA enabled
    return true;
  }

  // Mobile: antialiasing enabled by default unless overridden via ?aa=false for testing
  return true;
}
