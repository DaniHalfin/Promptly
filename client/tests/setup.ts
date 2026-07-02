import '@testing-library/jest-dom';

// jsdom does not implement ResizeObserver (used by Recharts).
// Provide a minimal no-op mock so component tests don't fail on it.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom does not implement window.matchMedia (used by Analysis.tsx for
// prefers-reduced-motion detection). Provide a minimal stub.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
