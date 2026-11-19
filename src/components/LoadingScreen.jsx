import React, { useEffect, useState, useRef } from 'react';
import { gsap } from 'gsap';
import { loadingManager } from '../services/loadingManager';
import '../styles/loading-screen.css';

export function LoadingScreen() {
  const [loadState, setLoadState] = useState(() => loadingManager.getState());
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  const logoRef = useRef(null);
  const trackRef = useRef(null);
  const circleRef = useRef(null);
  const animFrameRef = useRef(null);
  const curProgressRef = useRef(0);
  const targetProgressRef = useRef(0);

  // Subscribe to central loading manager
  useEffect(() => {
    const unsubscribe = loadingManager.subscribe((state) => {
      setLoadState(state);
      targetProgressRef.current = state.targetProgress * 100;
    });
    return () => unsubscribe();
  }, []);

  // Smooth 60fps interpolation loop for progress circle and percentage text
  useEffect(() => {
    if (!isMounted) return;

    let fadeTimer = null;
    let unmountTimer = null;
    let hasTriggeredFade = false;

    const tick = () => {
      const target = targetProgressRef.current;
      const current = curProgressRef.current;

      // Lerp towards target smoothly
      const diff = target - current;
      if (Math.abs(diff) > 0.05) {
        curProgressRef.current += diff * 0.12;
      } else {
        curProgressRef.current = target;
      }

      // Cap display progress at 99% until loadState.isReady is strictly true (never show 100% prematurely)
      const maxAllowed = loadState.isReady ? 100 : 99;
      const p = Math.min(maxAllowed, Math.max(0, curProgressRef.current));
      setDisplayProgress(p);

      // Translate circle indicator within the pill track when determinate
      if (trackRef.current && circleRef.current) {
        if (!loadState.isIndeterminate) {
          const trackW = trackRef.current.clientWidth;
          const circleW = circleRef.current.clientWidth;
          // Account for 4px left/right inner track padding
          const maxTravel = Math.max(0, trackW - circleW - 8);
          const curX = (p / 100) * maxTravel;
          circleRef.current.style.transform = `translate3d(${curX}px, -50%, 0)`;
        } else {
          // Clear inline transform so CSS @keyframes haulo-bar-sweep runs freely
          circleRef.current.style.transform = '';
        }
      }

      // Check completion and trigger smooth logo fly-to-hero animation
      if (loadState.isReady && p >= 99.5 && !hasTriggeredFade) {
        hasTriggeredFade = true;
        curProgressRef.current = 100;
        setDisplayProgress(100);

        // Lock scroll during the flight transition to ensure perfect coordinates
        if (typeof document !== 'undefined') {
          document.body.style.overflow = 'hidden';
        }

        // Hold 100% for 180ms before beginning the transition
        fadeTimer = setTimeout(() => {
          const logoEl = logoRef.current;
          const targetEl =
            document.querySelector('.word-haulo .word-layer__img') ||
            document.querySelector('.word-haulo');

          if (logoEl && targetEl) {
            const startRect = logoEl.getBoundingClientRect();
            const endRect = targetEl.getBoundingClientRect();

            if (endRect && endRect.width > 0 && startRect.width > 0) {
              const startCenterX = startRect.left + startRect.width / 2;
              const startCenterY = startRect.top + startRect.height / 2;
              const endCenterX = endRect.left + endRect.width / 2;
              const endCenterY = endRect.top + endRect.height / 2;
              const deltaX = startCenterX - endCenterX;
              const deltaY = startCenterY - endCenterY;
              const scale = startRect.width / endRect.width;

              // Hide the loading screen logo ref so there is zero overlap or double-image
              logoEl.style.opacity = '0';

              // Ensure the hero wordmark and its parent layer are visible
              const hauloParent = targetEl.closest('.word-haulo') || targetEl.parentElement;
              if (hauloParent) {
                hauloParent.style.visibility = 'visible';
                hauloParent.style.opacity = '1';
              }
              targetEl.style.visibility = 'visible';
              targetEl.style.opacity = '1';

              // Set targetEl to the exact position and scale of the loading logo.
              // Note: Because targetEl is inside .word-haulo (z-index: 2), and the 3D frog
              // canvas is inside .word-frog (z-index: 6), targetEl is rendered BEHIND the frog!
              gsap.set(targetEl, {
                x: deltaX,
                y: deltaY,
                scale: scale,
                transformOrigin: '50% 50%',
              });

              // Trigger loading screen background & progress bar fade-out
              setIsTransitioning(true);

              // Smoothly glide and scale targetEl up to its actual Hero resting position & size.
              // The frog stays in the foreground, and the text expands and moves up behind it
              // without overlapping the frog ("place backside and go above the frog").
              gsap.to(targetEl, {
                x: 0,
                y: 0,
                scale: 1,
                duration: 1.05,
                ease: 'power3.inOut',
                transformOrigin: '50% 50%',
                onComplete: () => {
                  // Restore document scroll
                  if (typeof document !== 'undefined') {
                    document.body.style.overflow = '';
                  }
                  // Clear inline transform overrides so HeroExperience conveyor has full native control
                  gsap.set(targetEl, { clearProps: 'transform' });
                  setIsMounted(false);
                },
              });
              return;
            }
          }

          // Fallback if target element rect is not available
          setIsTransitioning(true);
          unmountTimer = setTimeout(() => {
            if (typeof document !== 'undefined') {
              document.body.style.overflow = '';
            }
            setIsMounted(false);
          }, 650);
        }, 180);
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (unmountTimer) clearTimeout(unmountTimer);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, [loadState.isReady, loadState.isIndeterminate, isMounted]);

  // Clean unmount once transition completes
  if (!isMounted) return null;

  return (
    <div
      className={`haulo-loading-screen ${isTransitioning ? 'haulo-loading-screen--transitioning' : ''}`}
      aria-label="Loading HAULO 3D Experience"
      role="progressbar"
      aria-valuenow={loadState.isIndeterminate ? undefined : Math.round(displayProgress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="haulo-loading-screen__content">
        {/* Centered HAULO Logo */}
        <div className="haulo-loading-screen__logo-wrap">
          <img
            ref={logoRef}
            src={`${import.meta.env.BASE_URL}HAULO-LOGO-TEXT.png`}
            alt="HAULO"
            className="haulo-loading-screen__logo"
          />
        </div>

        {/* Normal Loading State vs Error State */}
        {loadState.stage === 'error' ? (
          <div className="haulo-loading-screen__error">
            <h2 className="haulo-loading-screen__error-title">UNABLE TO INITIALIZE 3D EXPERIENCE</h2>
            <p className="haulo-loading-screen__error-desc">
              {loadState.error?.message || 'Please check your connection and try again.'}
            </p>
            <button
              type="button"
              className="haulo-loading-screen__retry-btn"
              onClick={() => loadingManager.retry()}
            >
              [ RETRY ]
            </button>
          </div>
        ) : (
          /* Main Loading Row: LOADING — PILL BAR — 100% */
          <div className="haulo-loading-screen__row">
            <span className="haulo-loading-screen__label">LOADING</span>

            <div className="haulo-loading-screen__bar-track" ref={trackRef}>
              <div
                className={`haulo-loading-screen__bar-circle ${
                  loadState.isIndeterminate ? 'haulo-loading-screen__bar-circle--indeterminate' : ''
                }`}
                ref={circleRef}
              />
            </div>

            <span className="haulo-loading-screen__percent">
              {loadState.isIndeterminate ? '...' : `${Math.round(displayProgress)}%`}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Caption */}
      <div className="haulo-loading-screen__caption">
        CRAFTING YOUR DIGITAL EXPERIENCE
      </div>
    </div>
  );
}
