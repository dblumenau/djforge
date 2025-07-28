import { useEffect } from 'react';

export const useIOSKeyboardFix = () => {
  useEffect(() => {
    // Check if running as PWA on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;

    if (isIOS && isStandalone) {
      // Use Visual Viewport API to detect keyboard state
      if (!window.visualViewport) {
        console.warn('Visual Viewport API not supported');
        return;
      }

      const updateViewportState = () => {
        const vh = window.visualViewport?.height || window.innerHeight;
        const windowHeight = window.innerHeight;
        
        // Detect keyboard with 150px threshold
        const isKeyboardVisible = (windowHeight - vh) > 150;
        const keyboardHeight = isKeyboardVisible ? windowHeight - vh : 0;

        // Use CSS custom properties instead of transforms
        document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
        document.documentElement.classList.toggle('keyboard-visible', isKeyboardVisible);
      };

      // Initialize state
      updateViewportState();

      // Listen for viewport changes
      window.visualViewport?.addEventListener('resize', updateViewportState);
      window.visualViewport?.addEventListener('scroll', updateViewportState);

      return () => {
        window.visualViewport?.removeEventListener('resize', updateViewportState);
        window.visualViewport?.removeEventListener('scroll', updateViewportState);
      };
    }
  }, []);
};