import { Tabs } from 'expo-router';
import { TouchableOpacity } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSound } from '@/contexts/SoundContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/i18n';

const HEADER_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs><linearGradient id="mysteryGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6a11cb;stop-opacity:1" /><stop offset="100%" style="stop-color:#2575fc;stop-opacity:1" /></linearGradient></defs><g transform="translate(512 512) scale(5) translate(0 -70)"><path d="M-25,-20 C-45,-20 -60,-5 -60,20 C-60,45 -40,55 -25,70 C-15,80 -5,95 0,110" fill="none" stroke="url(#mysteryGradient)" stroke-width="16" stroke-linecap="round"/><path d="M-25,-20 C-5,-20 25,-15 40,5 C55,25 50,50 30,70 C15,85 -10,95 -15,120" fill="none" stroke="url(#mysteryGradient)" stroke-width="16" stroke-linecap="round"/><circle cx="0" cy="155" r="12" fill="url(#mysteryGradient)"/></g></svg>`;

function SoundToggle() {
  const { isSoundEnabled, toggleSound, playSound } = useSound();
  const colorScheme = useColorScheme();

  const handleToggle = () => {
    playSound('click');
    toggleSound();
  };

  return (
    <TouchableOpacity
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: isSoundEnabled 
          ? Colors[colorScheme ?? 'light'].tint 
          : Colors[colorScheme ?? 'light'].tabIconDefault 
      }}
      onPress={handleToggle}
      activeOpacity={0.7}
    >
      <IconSymbol 
        name={isSoundEnabled ? "speaker.2.fill" : "speaker.1.fill"} 
        size={20} 
        color="white" 
      />
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { locale } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('navigation.home', { locale }),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: t('navigation.results', { locale }),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          title: t('navigation.rules', { locale }),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}


