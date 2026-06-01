import { OwlsAnimation } from "@/components/ui/MirrorAnimation";
import { StyleSheet, View } from "react-native";

export function HeaderLogo() {
  return (
    <View style={styles.container}>
      <OwlsAnimation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  logo: {
    width: 220,
    height: 220,
  },
});
