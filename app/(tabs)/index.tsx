import {
  GoogleSignin,
  GoogleSigninButton
} from '@react-native-google-signin/google-signin';
import React from 'react';

GoogleSignin.configure({
  webClientId: "841856303776-n0qnohvvtecnmgj9a8dk2q0s16k820ol.apps.googleusercontent.com",
  scopes: ['profile', 'email'], // what API you want to access on behalf of the user, default is email and profile
  offlineAccess: true, // if you want to access Google API on behalf of the user FROM YOUR SERVER
  forceCodeForRefreshToken: false,
});

const GoogleLogin = async () => {
  console.log('GoogleLogin', 9);
  // check if users' device has google play services
  await GoogleSignin.hasPlayServices();

  // initiates signIn process
  const userInfo = await GoogleSignin.signIn();
  console.log('userInfo', userInfo);
  return userInfo;
};

const googleSignIn = async () => {
  try {
    console.log('googleSignIn');
    const response = await GoogleLogin();

    const { idToken, user } = response;

    if (idToken) {
      console.log("Google user:", user);
      // await processUserData(idToken, user); // if you create this
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