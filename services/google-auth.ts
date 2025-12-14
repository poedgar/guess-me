import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, User } from "firebase/auth";
import { auth } from "../config/firebase";
import { googleAuthConfig } from "../config/google-auth";

WebBrowser.maybeCompleteAuthSession();

export interface UserInfo {
    email: string | null;
    name: string | null;
    picture: string | null;
    verified_email: boolean;
}

/**
 * Get the redirect URI for the current platform
 */
export const getRedirectUri = (): string => {
    const uri = AuthSession.makeRedirectUri({
        useProxy: true,
    });
    console.log("[GoogleAuth] Redirect URI:", uri);
    return uri;
};

/**
 * Initialize Google Auth Request Hook
 * This should be used in a React component
 */
export const useGoogleAuth = () => {
    const redirectUri = getRedirectUri();

    console.log("[GoogleAuth] Initializing auth request with config:", {
        webClientId: googleAuthConfig.webClientId,
        expoClientId: googleAuthConfig.expoClientId,
        androidClientId: googleAuthConfig.androidClientId,
        redirectUri,
        scopes: googleAuthConfig.scopes,
    });

    return Google.useAuthRequest({
        webClientId: googleAuthConfig.webClientId,
        expoClientId: googleAuthConfig.expoClientId,
        androidClientId: googleAuthConfig.androidClientId,
        scopes: googleAuthConfig.scopes,
        redirectUri,
    });
};

/**
 * Handle Google Sign In with Firebase
 * @param response - The response from expo-auth-session (can be null for web)
 * @returns Promise<User> Firebase user object
 */
export const signInWithGoogle = async (response: AuthSession.AuthRequestResponse | null = null): Promise<User> => {
    try {
        // For web, use Firebase's signInWithPopup
        if (Platform.OS === "web") {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            return result.user;
        }

        // For native platforms (iOS/Android), use expo-auth-session response
        if (!response || response.type !== "success") {
            throw new Error("Authentication response is invalid");
        }

        const idToken = response?.authentication?.idToken;

        if (!idToken) {
            console.error("Response structure:", {
                authentication: response?.authentication,
                params: response?.params,
                fullResponse: response,
            });
            throw new Error("ID token is missing from authentication response");
        }

        const credential = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(auth, credential);
        return result.user;
    } catch (error) {
        console.error("Google Sign In Error:", error);
        throw error;
    }
};

/**
 * Get user info from Firebase user
 * @param user - Firebase user object
 * @returns User info object or null
 */
export const getUserInfo = (user: User | null): UserInfo | null => {
    if (!user) return null;

    return {
        email: user.email,
        name: user.displayName,
        picture: user.photoURL,
        verified_email: user.emailVerified,
    };
};

