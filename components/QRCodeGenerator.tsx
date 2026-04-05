import { GameColors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/i18n';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface QRCodeGeneratorProps {
  gameId: string;
  visible: boolean;
  onClose: () => void;
}

export default function QRCodeGenerator({ gameId, visible, onClose }: QRCodeGeneratorProps) {
  const { locale } = useLanguage();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const shareGameId = async () => {
    try {
      await Share.share({
        message: t('qr.shareMessage', { gameId, locale }),
        title: t('qr.shareTitle', { locale }),
      });
    } catch (error) {
      console.error('Error sharing game ID:', error);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {t('qr.shareTitle', { locale })}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.qrContainer}>
          <View style={[styles.qrBox, isDark && styles.qrBoxDark]}>
            <QRCode
              value={gameId}
              size={200}
              color={isDark ? '#fff' : '#000'}
              backgroundColor={isDark ? GameColors.inputDark : '#fff'}
            />
          </View>
          
          <Text style={styles.gameIdText}>
            {t('qr.gameIdLabel', { locale })}: {gameId}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.shareButton]}
            onPress={shareGameId}
          >
            <Text style={styles.buttonText}>↑ {t('qr.shareButton', { locale })}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.closeButtonAction]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>✓ {t('common.done', { locale })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 320,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  containerDark: {
    backgroundColor: GameColors.inputDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
  },
  closeButton: {
    padding: 4,
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  qrBoxDark: {
    backgroundColor: '#333',
  },
  gameIdText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  shareButton: {
    backgroundColor: GameColors.green,
  },
  closeButtonAction: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
