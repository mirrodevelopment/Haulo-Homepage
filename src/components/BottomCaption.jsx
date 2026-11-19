import React, { forwardRef } from 'react';
import { HeroButtons } from './HeroButtons';
import '../styles/buttons.css';

export const BottomCaption = forwardRef(function BottomCaption(props, ref) {
  const handleWorkClick = (e) => {
    e.stopPropagation();
    window.__hauloScrollTo?.('work');
  };

  const handleServicesClick = (e) => {
    e.stopPropagation();
    window.__hauloScrollTo?.('service');
  };

  return (
    <div className="bottom-caption-container" ref={ref}>
      {/* Hero Tech Buttons */}
      <HeroButtons
        onViewWork={handleWorkClick}
        onExplore={handleServicesClick}
      />
    </div>
  );
});

