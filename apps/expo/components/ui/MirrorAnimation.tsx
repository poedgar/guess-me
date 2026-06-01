import React from "react";
import { StyleSheet, View } from "react-native";
import { LottieAnimation } from "./LottieAnimation";

export const OwlsAnimation: React.FC = () => {
  return (
    <View style={styles.container}>
      <LottieAnimation
        source={require("../../assets/animations/Mirror.json")}
        autoPlay={true}
        loop={false}
        style={styles.animation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  animation: {
    width: 120,
    height: 120,
  },
});
