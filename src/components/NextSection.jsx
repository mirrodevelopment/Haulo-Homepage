import React from 'react';
import { SPACE_ITEMS } from '../data/projects';
import { Ring3DModel } from './Ring3DModel';

/**
 * NextSection - 3D Continuous Space Conveyor World
 * Renders the 5 space mech rings along the 3D spline conveyor trajectory.
 * Eliminates discrete page jumps and enables seamless continuous 3D scrolling.
 */
export function NextSection({
  preparedRings,
  stageRef,
  ringRefs,
  cylinderRefs,
  badgeRefs,
  onRingMouseEnter,
  onRingMouseLeave,
  // Backwards compatibility props
  space0Ref,
  space1Ref,
  space2Ref,
  space3Ref,
  space4Ref,
}) {
  return (
    <div className="portfolio-world space-portfolio-world" ref={stageRef}>
      <div className="portfolio-ring-track space-portfolio-track">
        {SPACE_ITEMS.map((item, index) => {
          const isIntro = !!item.isIntro;
          return (
            <div
              key={item.id}
              className={`project-ring-track-item space-ring-item ${isIntro ? 'space-ring-item--intro' : ''}`}
              ref={(el) => {
                if (ringRefs && ringRefs.current) ringRefs.current[index] = el;
                // Wire back to legacy refs if provided
                if (index === 0 && space0Ref) { if (typeof space0Ref === 'function') space0Ref(el); else space0Ref.current = el; }
                if (index === 1 && space1Ref) { if (typeof space1Ref === 'function') space1Ref(el); else space1Ref.current = el; }
                if (index === 2 && space2Ref) { if (typeof space2Ref === 'function') space2Ref(el); else space2Ref.current = el; }
                if (index === 3 && space3Ref) { if (typeof space3Ref === 'function') space3Ref(el); else space3Ref.current = el; }
                if (index === 4 && space4Ref) { if (typeof space4Ref === 'function') space4Ref(el); else space4Ref.current = el; }
              }}
            >
              {/* 3D Cylindrical Solid Body (Rotates in 3D perspective) */}
              <div
                className="ring-cylinder space-ring-cylinder"
                ref={(el) => {
                  if (cylinderRefs && cylinderRefs.current) cylinderRefs.current[index] = el;
                }}
              >
                {isIntro ? (
                  <div className="space-intro-split">
                    <div className="space-intro-mech-box">
                      <Ring3DModel
                        enabled={!preparedRings || preparedRings.has(index)}
                        glbUrl={item.glb}
                        alt="HAULO Space Mech Ring"
                        className="space-intro-mech-img"
                        variant="intro"
                        buttonText="EXPLORE WORK ↗"
                        onButtonClick={() => {
                          window.__hauloScrollTo?.('work');
                        }}
                      />
                    </div>
                    <div className="next-portfolio-box next-portfolio-box--featured">
                      <div className="statement-header-line">
                        <span className="statement-label">+ PORTFOLIO</span>
                      </div>
                      <h2 className="next-statement-title">
                        BROWSE OUR<br />PORTFOLIO
                      </h2>
                      <p className="next-statement-desc">
                        Explore how we turn ideas into intelligent systems that inspire, engage, and create real impact.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className={`space-ring-showcase-box space-ring-showcase-box--${item.id}`}>
                      <div className="space-ring-media-wrapper">
                        <Ring3DModel
                          enabled={!preparedRings || preparedRings.has(index)}
                          glbUrl={item.glb}
                          alt={`HAULO Space Project ${item.num} - ${item.title}`}
                          className="space-ring-showcase-img"
                          textContent={item.ringText}
                          buttonText="VIEW PROJECT ↗"
                          projectUrl={item.href}
                          onButtonClick={() => {
                            if (item.href && item.href !== '#') {
                              window.open(item.href, '_blank', 'noopener,noreferrer');
                            } else {
                              window.__hauloScrollTo?.('work');
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
              </div>

              {/* Floating Circular HUD 'VIEW PROJECT' Badge (Anchored in front space) */}
              {item.href && item.href !== '#' ? (
                <a
                  className="ring-view-case-badge"
                  ref={(el) => {
                    if (badgeRefs && badgeRefs.current) badgeRefs.current[index] = el;
                  }}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View Project: ${item.title}`}
                  onClick={() => {
                    const container = ringRefs.current[index]?.querySelector('.ring-3d-model-container');
                    if (container?.pressRingButton) {
                      container.pressRingButton();
                    }
                  }}
                >
                  <div className="badge-inner">
                    <span className="badge-text-line">VIEW</span>
                    <span className="badge-text-line">PROJECT ↗</span>
                  </div>
                </a>
              ) : (
                <a
                  className="ring-view-case-badge"
                  ref={(el) => {
                    if (badgeRefs && badgeRefs.current) badgeRefs.current[index] = el;
                  }}
                  href="#work"
                  aria-label={`View Project: ${item.title}`}
                  onClick={(e) => {
                    e.preventDefault();
                    window.__hauloScrollTo?.('work');
                    const container = ringRefs.current[index]?.querySelector('.ring-3d-model-container');
                    if (container?.pressRingButton) {
                      container.pressRingButton();
                    }
                  }}
                >
                  <div className="badge-inner">
                    <span className="badge-text-line">VIEW</span>
                    <span className="badge-text-line">PROJECT ↗</span>
                  </div>
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Backwards-compatible named exports
export function NextSectionLeft({ cardRef }) {
  return (
    <div className="next-space-box" ref={cardRef}>
      <Ring3DModel
        glbUrl="/Models/HAULO_portfolio_ring.glb"
        alt="HAULO Space Mech Ring"
        className="next-space-box__img"
        variant="intro"
        buttonText="EXPLORE WORK ↗"
        onButtonClick={() => {
          window.__hauloScrollTo?.('work');
        }}
      />
    </div>
  );
}

export function NextSectionRight({ cardRef }) {
  return (
    <div className="next-portfolio-box next-portfolio-box--featured" ref={cardRef}>
      <div className="statement-header-line">
        <span className="statement-label">+ PORTFOLIO</span>
      </div>
      <h2 className="next-statement-title">
        BROWSE OUR<br />PORTFOLIO
      </h2>
      <p className="next-statement-desc">
        Explore how we turn ideas into intelligent systems that inspire, engage, and create real impact.
      </p>
    </div>
  );
}

export default NextSection;
