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
  auth: {
    currentUser: null,
    signOut: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
  })),
  onAuthStateChanged: jest.fn((auth, callback) => {
    // Call the callback immediately to simulate real Firebase behavior
    callback(null);
    // Return unsubscribe function
    return jest.fn();
  }),
  signInWithPopup: jest.fn(),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
  GoogleAuthProvider: jest.fn(),
  User: {},
}));

jest.mock('firebase/firestore', () => {
  const mockUnsubscribe = jest.fn();
  const mockCallbacks = new Map();
  
  return {
    doc: jest.fn(),
    getDoc: jest.fn(),
    updateDoc: jest.fn(),
    addDoc: jest.fn(),
    collection: jest.fn(),
    runTransaction: jest.fn(),
    arrayUnion: jest.fn((val) => val),
    onSnapshot: jest.fn((docRef, callback) => {
      // Store the callback
      mockCallbacks.set(docRef.path, callback);
      // Return the mock unsubscribe function
      return mockUnsubscribe;
    }),
    serverTimestamp: jest.fn(() => new Date()),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
    // Helper to trigger callbacks
    __triggerCallback: (docRef, data) => {
      const callback = mockCallbacks.get(docRef.path);
      if (callback) {
        callback(data);
      }
    }
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Google Sign-in
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({
      user: {
        email: 'test@example.com',
        name: 'Test User',
        id: '123456789',
      },
    })),
    signOut: jest.fn(() => Promise.resolve()),
  },
}));

// Mock react-native-qrcode-scanner
jest.mock('react-native-qrcode-scanner', () => ({
  RNCamera: {
    Constants: {
      Aspect: { fill: 'fill' },
      BarCodeType: { qr: 'QR_CODE' },
      CaptureMode: { still: 'still' },
      CaptureQuality: { high: 'high' },
      CaptureTarget: { cameraRoll: 'cameraRoll' },
      FlashMode: { on: 'on', off: 'off' },
      Orientation: { auto: 'auto' },
      TorchMode: { on: 'on', off: 'off' },
      Type: { front: 'front', back: 'back' },
    },
  },
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// Mock static assets (images, fonts, etc.)
jest.mock('react-native/Libraries/Image/AssetRegistry', () => ({
  getAssetByID: jest.fn(() => ({ uri: 'mock-uri' })),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  Text: 'Text',
  View: 'View',
}));

// Mock theme-related dependencies
jest.mock('@/hooks/use-theme-color', () => ({
  useThemeColor: jest.fn(() => '#000000'),
}));

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/constants/theme', () => ({
  Colors: {
    light: { text: '#11181C', background: '#fff' },
    dark: { text: '#ECEDEE', background: '#151718' },
  },
  Fonts: {
    sans: 'Arial',
    serif: 'Georgia',
    rounded: 'SF Pro Rounded',
    mono: 'monospace',
  },
}));

// Extend jest-native matchers - do this after jest-expo setup completes
// Using a try-catch to avoid breaking if jest-expo hasn't finished setup
try {
  require('@testing-library/jest-native/extend-expect');
} catch (e) {
  // If it fails, the matchers will be available after jest-expo finishes
  // This is a known workaround for jest-expo setup timing
}
