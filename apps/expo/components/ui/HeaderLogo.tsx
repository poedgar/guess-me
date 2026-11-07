import { Image } from "expo-image";
import { StyleSheet, useWindowDimensions, View } from "react-native";

const HERO = require("../../assets/images/hero.png");
const LOGO = require("../../assets/images/logo.png");

const HERO_MAX_SIZE = 200;

interface HeaderLogoProps {
  /** `hero` = large logo for landing screens, `icon` = compact app icon. */
  variant?: "hero" | "icon";
}

export function HeaderLogo({ variant = "hero" }: HeaderLogoProps) {
  const { width } = useWindowDimensions();

  if (variant === "icon") {
    return (
      <View style={styles.container} testID="header-logo">
        <Image source={LOGO} style={styles.icon} contentFit="contain" />
      </View>
    );
  }

  const size = Math.min(width - 40, HERO_MAX_SIZE);

  return (
    <View style={styles.container} testID="header-logo">
      <Image source={HERO} style={{ width: size, height: size }} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
});
