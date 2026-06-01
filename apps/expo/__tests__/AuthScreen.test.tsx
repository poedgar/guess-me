import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mutable auth state — updated per describe via beforeEach
let mockUser: any = null;
let mockIsSignedIn = false;
let mockLoading = false;
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();

// All jest.mock() at module level (babel-jest hoists these before imports)
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    isSignedIn: mockIsSignedIn,
    signIn: mockSignIn,
    signOut: mockSignOut,
  }),
}));

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: jest.fn() }),
}));

jest.mock('@/i18n', () => ({ t: (key: string) => key }));

jest.mock('@/components/LanguageSelector', () => ({
  LanguageSelector: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/ui/icon-symbol', () => {
  const { Text } = require('react-native');
  return { IconSymbol: ({ name }: { name: string }) => <Text>{name}</Text> };
});

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: ({ testID }: any) => <View testID={testID ?? 'expo-image'} /> };
});

// GoogleSigninButton is only used on the signed-out screen
jest.mock('@react-native-google-signin/google-signin', () => {
  const { TouchableOpacity, Text } = require('react-native');
  const GoogleSigninButton = ({ onPress }: any) => (
    <TouchableOpacity testID="google-btn" onPress={onPress}>
      <Text>Google</Text>
    </TouchableOpacity>
  );
  // Static enum properties accessed by the component
  GoogleSigninButton.Size = { Wide: 'Wide', Standard: 'Standard', Icon: 'Icon' };
  GoogleSigninButton.Color = { Dark: 'Dark', Light: 'Light' };
  return {
    GoogleSigninButton,
    GoogleSignin: {
      configure: jest.fn(),
      hasPlayServices: jest.fn(() => Promise.resolve(true)),
      signIn: jest.fn(),
      signOut: jest.fn(),
    },
  };
});

// Load the component AFTER all mocks are in place
// (resetMocks:true only resets mock *implementations*, not the module registry)
const { AuthScreen } = require('../components/auth/AuthScreen');

function renderScreen() {
  return render(<SafeAreaProvider><AuthScreen /></SafeAreaProvider>);
}

// resetMocks:true wipes mock return values between tests.
// Restore the stateless mocks that need to return values every test.
beforeEach(() => {
  // expo-image mock is stateless JSX — no restoration needed.
  // GoogleSigninButton mock is a factory function — Jest keeps the factory,
  // only clears calls/instances. Nothing to restore here.
  mockSignIn.mockReset();
  mockSignOut.mockReset();
});

// ── signed out ────────────────────────────────────────────────────────────────
describe('AuthScreen — signed out', () => {
  beforeEach(() => {
    mockUser = null;
    mockIsSignedIn = false;
    mockLoading = false;
  });

  it('renders without crashing', () => {
    const { root } = renderScreen();
    expect(root).toBeTruthy();
  });

  it('shows the Google sign-in button', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('google-btn')).toBeTruthy();
  });

  it('calls signIn when Google button is pressed', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('google-btn'));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
  });
});

// ── loading ───────────────────────────────────────────────────────────────────
describe('AuthScreen — loading', () => {
  beforeEach(() => {
    mockUser = null;
    mockIsSignedIn = false;
    mockLoading = true;
  });

  it('renders without crashing while loading', () => {
    const { root } = renderScreen();
    expect(root).toBeTruthy();
  });

  it('shows loading indicator', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('does not show Google button while loading', () => {
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('google-btn')).toBeNull();
  });
});

// ── signed in ─────────────────────────────────────────────────────────────────
describe('AuthScreen — signed in', () => {
  beforeEach(() => {
    mockUser = { uid: 'u1', displayName: 'Alice', email: 'alice@test.com', photoURL: null };
    mockIsSignedIn = true;
    mockLoading = false;
  });

  it('renders without crashing', () => {
    const { root } = renderScreen();
    expect(root).toBeTruthy();
  });

  it('shows the user name', () => {
    const { getByText } = renderScreen();
    expect(getByText('Alice')).toBeTruthy();
  });

  it('shows the user email', () => {
    const { getByText } = renderScreen();
    expect(getByText('alice@test.com')).toBeTruthy();
  });

  it('shows sign-out button', () => {
    const { getByText } = renderScreen();
    expect(getByText('auth.signOut')).toBeTruthy();
  });

  it('does not show Google sign-in button', () => {
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('google-btn')).toBeNull();
  });
});
