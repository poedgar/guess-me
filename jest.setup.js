// Minimal setup file - jest-expo handles most of the setup
// Only add mocks that don't interfere with jest-expo's React Native setup

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
    Warning: 'warning',
  },
}));

// Mock Firebase
jest.mock('@/config/firebase', () => ({
  db: {},
  auth: {},
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Extend jest-native matchers - do this after jest-expo setup completes
// Using a try-catch to avoid breaking if jest-expo hasn't finished setup
try {
  require('@testing-library/jest-native/extend-expect');
} catch (e) {
  // If it fails, the matchers will be available after jest-expo finishes
  // This is a known workaround for jest-expo setup timing
}
