import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mutable auth state — updated per describe via beforeEach
let mockUser: any = null;
let mockIsSignedIn = false;
let mockLoading = false;
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockRegisterWithEmail = jest.fn();
const mockSignInWithEmail = jest.fn();
const mockResetPassword = jest.fn();

// All jest.mock() at module level (babel-jest hoists these before imports)
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    isSignedIn: mockIsSignedIn,
    signIn: mockSignIn,
    signOut: mockSignOut,
    registerWithEmail: mockRegisterWithEmail,
    signInWithEmail: mockSignInWithEmail,
    resetPassword: mockResetPassword,
  }),
}));

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: jest.fn() }),
}));

jest.mock('@/i18n', () => ({ t: (key: string) => key }));

// Real `@mirror/shared` transitively imports firebase (via its ./firebase
// submodule, re-exported from the package index), which jest cannot parse
// (ESM syntax outside transformIgnorePatterns' babel transform reach for
// @firebase/* scoped packages). Mock it with a lightweight stand-in for the
// one export AuthScreen uses directly.
jest.mock('@mirror/shared', () => ({
  mapFirebaseAuthErrorToKey: jest.fn(() => 'auth.errorGeneric'),
}));

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
  mockRegisterWithEmail.mockReset();
  mockSignInWithEmail.mockReset();
  mockResetPassword.mockReset();
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

// ── signed out — email/password forms ──────────────────────────────────────────
describe('AuthScreen — email/password forms', () => {
  beforeEach(() => {
    mockUser = null;
    mockIsSignedIn = false;
    mockLoading = false;
  });

  it('defaults to the Sign In tab, showing email/password fields but not confirm-password or display-name', () => {
    const { getByTestId, queryByTestId } = renderScreen();
    expect(getByTestId('email-input')).toBeTruthy();
    expect(getByTestId('password-input')).toBeTruthy();
    expect(queryByTestId('confirm-password-input')).toBeNull();
    expect(queryByTestId('display-name-input')).toBeNull();
  });

  it('switching to the Register tab reveals display-name and confirm-password fields', () => {
    const { getByTestId, queryByTestId } = renderScreen();
    fireEvent.press(getByTestId('register-tab'));
    expect(getByTestId('display-name-input')).toBeTruthy();
    expect(getByTestId('confirm-password-input')).toBeTruthy();
    expect(queryByTestId('forgot-password-link')).toBeNull();
  });

  it('calls signInWithEmail with the entered credentials on Sign In submit', async () => {
    mockSignInWithEmail.mockResolvedValueOnce(undefined);
    const { getByTestId } = renderScreen();
    fireEvent.changeText(getByTestId('email-input'), 'alice@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.press(getByTestId('email-signin-submit-button'));
    await waitFor(() =>
      expect(mockSignInWithEmail).toHaveBeenCalledWith('alice@example.com', 'password123'),
    );
  });

  it('does not call signInWithEmail when a field is empty', async () => {
    const { getByTestId } = renderScreen();
    fireEvent.changeText(getByTestId('email-input'), 'alice@example.com');
    // password left empty
    fireEvent.press(getByTestId('email-signin-submit-button'));
    await waitFor(() => expect(mockSignInWithEmail).not.toHaveBeenCalled());
  });

  it('calls registerWithEmail with trimmed email/name and the password on valid Register submit', async () => {
    mockRegisterWithEmail.mockResolvedValueOnce(undefined);
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('register-tab'));
    fireEvent.changeText(getByTestId('display-name-input'), '  Alice  ');
    fireEvent.changeText(getByTestId('email-input'), '  alice@example.com  ');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.changeText(getByTestId('confirm-password-input'), 'password123');
    fireEvent.press(getByTestId('register-submit-button'));
    await waitFor(() =>
      expect(mockRegisterWithEmail).toHaveBeenCalledWith('alice@example.com', 'password123', 'Alice'),
    );
  });

  it('does not call registerWithEmail when passwords do not match', async () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('register-tab'));
    fireEvent.changeText(getByTestId('display-name-input'), 'Alice');
    fireEvent.changeText(getByTestId('email-input'), 'alice@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.changeText(getByTestId('confirm-password-input'), 'different');
    fireEvent.press(getByTestId('register-submit-button'));
    await waitFor(() => expect(mockRegisterWithEmail).not.toHaveBeenCalled());
  });

  it('does not call registerWithEmail when the password is shorter than 6 characters', async () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('register-tab'));
    fireEvent.changeText(getByTestId('display-name-input'), 'Alice');
    fireEvent.changeText(getByTestId('email-input'), 'alice@example.com');
    fireEvent.changeText(getByTestId('password-input'), '123');
    fireEvent.changeText(getByTestId('confirm-password-input'), '123');
    fireEvent.press(getByTestId('register-submit-button'));
    await waitFor(() => expect(mockRegisterWithEmail).not.toHaveBeenCalled());
  });

  it('forgot-password link switches to a single email field and calls resetPassword on submit', async () => {
    mockResetPassword.mockResolvedValueOnce(undefined);
    const { getByTestId, queryByTestId } = renderScreen();
    fireEvent.press(getByTestId('forgot-password-link'));
    expect(queryByTestId('password-input')).toBeNull();
    fireEvent.changeText(getByTestId('reset-email-input'), 'alice@example.com');
    fireEvent.press(getByTestId('send-reset-button'));
    await waitFor(() => expect(mockResetPassword).toHaveBeenCalledWith('alice@example.com'));
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
