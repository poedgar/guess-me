import { Image as ExpoImage } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';

const HEADER_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs><linearGradient id="mysteryGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6a11cb;stop-opacity:1" /><stop offset="100%" style="stop-color:#2575fc;stop-opacity:1" /></linearGradient></defs><g transform="translate(512 512) scale(5) translate(0 -70)"><path d="M-25,-20 C-45,-20 -60,-5 -60,20 C-60,45 -40,55 -25,70 C-15,80 -5,95 0,110" fill="none" stroke="url(#mysteryGradient)" stroke-width="16" stroke-linecap="round"/><path d="M-25,-20 C-5,-20 25,-15 40,5 C55,25 50,50 30,70 C15,85 -10,95 -15,120" fill="none" stroke="url(#mysteryGradient)" stroke-width="16" stroke-linecap="round"/><circle cx="0" cy="155" r="12" fill="url(#mysteryGradient)"/></g></svg>`;

export function HeaderLogo() {
  const source =
    Platform.OS === 'web'
      ? { uri: `data:image/svg+xml;utf8,${encodeURIComponent(HEADER_LOGO_SVG)}` }
      : require('../../assets/images/icon.png');

  return (
    <View style={styles.headerLogoContainer}>
      <ExpoImage 
        source={source} 
        style={styles.headerLogo} 
        contentFit="contain" 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerLogoContainer: { 
    height: 60, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
});
