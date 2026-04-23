import { OwlsAnimation } from "@/components/ui/OwlsAnimation";
import { Platform, StyleSheet, View } from "react-native";

export function HeaderLogo() {
  const source =
    Platform.OS === "web"
      ? require("../../assets/images/logo.svg")
      : require("../../assets/images/icon.png");

  return (
    <View style={styles.container}>
      <OwlsAnimation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: -50,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  logo: {
    width: 220,
    height: 220,
  },
});
