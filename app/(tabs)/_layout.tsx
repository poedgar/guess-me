import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/i18n';

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
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color='orange' />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: t('navigation.results', { locale }),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color='orange' />,
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          title: t('navigation.rules', { locale }),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color='orange' />,
        }}
      />
    </Tabs>
  );
}


