import { useEffect } from 'react';

export const useIOSKeyboardFix = () => {
  useEffect(() => {
    // Check if running as PWA on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;

    if (isIOS && isStandalone) {
      // Force input focus to work properly on iOS PWA
      const handleTouchStart = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          target.style.transform = 'translateZ(0)';
          target.focus();
          
          // Force keyboard to show
          setTimeout(() => {
            target.focus();
            target.click();
          }, 100);
        }
      };

      // Prevent viewport issues when keyboard shows
      const handleFocusIn = () => {
        if (isIOS) {
          window.scrollTo(0, 0);
          document.body.scrollTop = 0;
        }
      };

      // Fix viewport when keyboard hides
      const handleFocusOut = () => {
        if (isIOS) {
          window.scrollTo(0, 0);
          // Force viewport to reset
          const viewport = document.querySelector('meta[name=viewport]');
          if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
          }
        }
      };

      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);

      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
      };
    }
  }, []);
};