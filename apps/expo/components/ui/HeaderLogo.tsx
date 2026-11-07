import { Image } from "expo-image";
import { StyleSheet, useWindowDimensions, View } from "react-native";

const HERO_DESKTOP = require("../../assets/images/hero-desktop.png");
const HERO_MOBILE = require("../../assets/images/hero-mobile.png");
const LOGO = require("../../assets/images/logo.png");

// Source image aspect ratios (width / height)
const DESKTOP_RATIO = 1024 / 553;
const MOBILE_RATIO = 556 / 544;
const HERO_MAX_HEIGHT = 180;
const WIDE_BREAKPOINT = 768;

interface HeaderLogoProps {
  /** `hero` = full illustration for landing screens, `icon` = compact app icon. */
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

  const isWide = width >= WIDE_BREAKPOINT;
  const ratio = isWide ? DESKTOP_RATIO : MOBILE_RATIO;
  const heroWidth = Math.min(width - 40, HERO_MAX_HEIGHT * ratio);

  return (
    <View style={styles.container} testID="header-logo">
      <Image
        source={isWide ? HERO_DESKTOP : HERO_MOBILE}
        style={[styles.hero, { width: heroWidth, height: heroWidth / ratio }]}
        contentFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  hero: {
    borderRadius: 16,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
});
