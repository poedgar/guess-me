import { AuthScreen } from '@/components/auth/AuthScreen';
import { ThemedView } from '@/components/themed-view';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

export default function Index() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AuthScreen />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});