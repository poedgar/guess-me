// Pre-setup file to ensure modules are available before jest-expo runs
// This file runs before jest-expo's setup

// Ensure React Native modules exist before jest-expo tries to set them up
if (typeof global !== 'undefined') {
  // Pre-initialize modules that jest-expo expects
  global.__DEV__ = true;
}

