/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { IconLeft, IconRight } from '@arco-design/web-react/icon';
import React, { useRef, useState, useEffect } from 'react';

interface HorizontalFileListProps {
  children: React.ReactNode;
}

/**
 */
const HorizontalFileList: React.FC<HorizontalFileListProps> = ({ children }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  /**
   */
  const checkScroll = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const hasScroll = container.scrollWidth > container.clientWidth;
    const isAtStart = container.scrollLeft <= 1;
    const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;

    const nextShowScrollButton = hasScroll;
    const nextCanScrollRight = hasScroll && !isAtEnd;
    const nextCanScrollLeft = hasScroll && !isAtStart;

    setShowScrollButton((prev) => (prev !== nextShowScrollButton ? nextShowScrollButton : prev));
    setCanScrollRight((prev) => (prev !== nextCanScrollRight ? nextCanScrollRight : prev));
    setCanScrollLeft((prev) => (prev !== nextCanScrollLeft ? nextCanScrollLeft : prev));
  }, []);

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    const scheduleCheck = () => {
      if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(checkScroll);
      } else {
        checkScroll();
      }
    };

    const resizeObserver = new ResizeObserver(scheduleCheck);
    resizeObserver.observe(container);

    container.addEventListener('scroll', checkScroll, { passive: true });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
      container.removeEventListener('scroll', checkScroll);
    };
  }, [checkScroll]);

  // children useEffect
  useEffect(() => {
    checkScroll();
  }, [children, checkScroll]);

  /**
   */
  const handleScrollRight = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollBy({
      left: 200,
      behavior: 'smooth',
    });
  };

  /**
   */
  const handleScrollLeft = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollBy({
      left: -200,
      behavior: 'smooth',
    });
  };

  return (
    <div className='relative'>
      {}
      <div
        ref={scrollContainerRef}
        className='flex items-center gap-8px overflow-x-auto overflow-y-hidden scrollbar-hide pt-5px pb-5px'
        style={{
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
        }}
      >
        {children}
      </div>
      {}
      {showScrollButton && canScrollLeft && (
        <div
          className='absolute left-0 top-0 h-full flex items-center cursor-pointer'
          style={{
            background: 'linear-gradient(to left, transparent, var(--dialog-fill-0) 30%)',
            width: '60px',
            pointerEvents: 'none',
          }}
        >
          <button
            onClick={handleScrollLeft}
            className='ml-0px w-28px h-28px rd-50% bg-1 flex items-center justify-center hover:bg-2 transition-colors border-1 border-solid b-color-border-2'
            style={{
              pointerEvents: 'auto',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            <IconLeft style={{ fontSize: '14px', color: 'var(--text-t-primary)' }} />
          </button>
        </div>
      )}
      {}
      {showScrollButton && canScrollRight && (
        <div
          className='absolute right-0 top-0 h-full flex items-center cursor-pointer'
          style={{
            background: 'linear-gradient(to right, transparent, var(--dialog-fill-0) 30%)',
            width: '60px',
            pointerEvents: 'none',
          }}
        >
          <button
            onClick={handleScrollRight}
            className='ml-auto mr-0px w-28px h-28px rd-50% bg-1 flex items-center justify-center hover:bg-2 transition-colors border-1 border-solid b-color-border-2'
            style={{
              pointerEvents: 'auto',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            <IconRight style={{ fontSize: '14px', color: 'var(--text-t-primary)' }} />
          </button>
        </div>
      )}
    </div>
  );
};

export default HorizontalFileList;
