import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useSound } from '@/contexts/SoundContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

export const SoundToggle: React.FC = () => {
  const { isSoundEnabled, toggleSound } = useSound();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      onPress={toggleSound}
      style={[styles.container, { borderColor: isDark ? '#444' : '#ddd' }]}
      accessibilityLabel={isSoundEnabled ? 'Disable sound' : 'Enable sound'}
      accessibilityRole="button"
    >
      <ThemedView style={styles.iconContainer}>
        <IconSymbol
          name={isSoundEnabled ? 'speaker.2.fill' : 'speaker.slash.fill'}
          size={20}
          color={isSoundEnabled ? (isDark ? Colors.dark.text : Colors.light.text) : (isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault)}
        />
      </ThemedView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
