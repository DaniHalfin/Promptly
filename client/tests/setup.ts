import '@testing-library/jest-dom';

// jsdom does not implement ResizeObserver (used by Recharts).
// Provide a minimal no-op mock so component tests don't fail on it.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
