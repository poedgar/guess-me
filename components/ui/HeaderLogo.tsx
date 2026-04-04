import { Image as ExpoImage } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';

export function HeaderLogo() {
  const source =
    Platform.OS === 'web'
      ? require('../../assets/images/logo.svg')
      : require('../../assets/images/icon.png');

  return (
    <View style={styles.container}>
      <ExpoImage source={source} style={styles.logo} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    marginTop: -60,
  },
  logo: {
    width: 80,
    height: 80,
  },
});
