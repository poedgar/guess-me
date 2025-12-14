import {
    GoogleSignin,
    GoogleSigninButton
} from '@react-native-google-signin/google-signin';
import React from 'react';

GoogleSignin.configure({
    webClientId: "627274303735-t5egjmpffjsg29qoco7nv7lqjlqlt02s.apps.googleusercontent.com",
  scopes: ['profile', 'email'], // what API you want to access on behalf of the user, default is email and profile
  offlineAccess: true, // if you want to access Google API on behalf of the user FROM YOUR SERVER
  forceCodeForRefreshToken: false,
    androidClientId: "726884000116-mfedbdu3fkb8knq3v6u8hequ0oab68s9.apps.googleusercontent.com",
});

const GoogleLogin = async () => {
  // check if users' device has google play services
  await GoogleSignin.hasPlayServices();

  // initiates signIn process
  const userInfo = await GoogleSignin.signIn();
  return userInfo;
};

const googleSignIn = async () => {
  try {
    const response = await GoogleLogin();

    // retrieve user data
    const { idToken, user } = response.data ?? {};
    if (idToken) {
      await processUserData(idToken, user); // Server call to validate the token & process the user data for signing In
    }
  } catch (error) {
    console.log('Error', error);
  }
};

export default function index() {
  return (
    <GoogleSigninButton onPress={googleSignIn} />
  )
}