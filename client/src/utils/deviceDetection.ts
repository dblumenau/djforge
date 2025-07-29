export const isMobileDevice = (): boolean => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

export const isSafari = (): boolean => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

export const supportsWebPlaybackSDK = (): boolean => {
  // Check for EME support
  return !!(window.MediaKeys || (window as any).WebKitMediaKeys || (window as any).MSMediaKeys);
};

export const needsUserInteraction = (): boolean => {
  // Mobile devices and Safari require user interaction for autoplay
  return isMobileDevice() || isSafari();
};