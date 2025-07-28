interface VisualViewport extends EventTarget {
  readonly height: number;
  readonly width: number;
  readonly offsetLeft: number;
  readonly offsetTop: number;
  readonly pageLeft: number;
  readonly pageTop: number;
  readonly scale: number;
  addEventListener(type: 'resize' | 'scroll', listener: (event: Event) => void): void;
  removeEventListener(type: 'resize' | 'scroll', listener: (event: Event) => void): void;
}

interface Window {
  visualViewport: VisualViewport;
}