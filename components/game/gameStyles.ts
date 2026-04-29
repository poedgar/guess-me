import { Fonts, GameColors } from '@/constants/theme';
import { StyleSheet } from 'react-native';

export const gameStyles = StyleSheet.create({
  gameFlowContainer: { marginTop: 24, marginBottom: 24 },
  buttonDisabled: { opacity: 0.6 },
  statusLabel: { marginRight: 12, fontSize: 16, fontFamily: Fonts.sans },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { color: GameColors.white, fontSize: 12, fontWeight: '700' },
});
