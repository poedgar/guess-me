import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemedText } from '@/components/themed-text';
import { HeaderLogo } from '@/components/ui/HeaderLogo';
import { GameColors } from '@/constants/theme';
import { Game } from '@/contexts/GameContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/i18n';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { FancyAlertButton } from '@/components/ui/FancyAlert';

export type ShowFancyAlertFn = (
  title: string,
  message?: string | null,
  buttons?: FancyAlertButton[]
) => void;

interface Props {
  game: Game;
  isAdmin: boolean;
  onCopyGameId: () => void;
}

export const GameHeader: React.FC<Props> = ({ game, isAdmin, onCopyGameId }) => {
  const { locale } = useLanguage();

  return (
    <View style={styles.gameHeader}>
      <ThemedText type="title" style={styles.gameTitle}>
        <HeaderLogo />
      </ThemedText>
      <View style={styles.gameHeaderRight}>
        <View style={{ marginTop: 12, display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', gap: 12 }}>
          <LanguageSelector />
          {/* <SoundToggle /> */}
          {isAdmin && (
            <View style={styles.adminBadge}>
              <ThemedText style={styles.adminBadgeText}>{t('game.ui.adminBadge', { locale })}</ThemedText>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gameHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  gameTitle: { flex: 1 },
  gameHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  adminBadge: { height: 'max-content', backgroundColor: GameColors.waiting, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginLeft: 12 },
  adminBadgeText: { color: '#fff', fontSize: 8, fontWeight: '700' },
});
