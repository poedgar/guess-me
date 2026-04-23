import { GameColors } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (gameId: string) => void;
}

export default function QRScanner({ visible, onClose, onScanSuccess }: QRScannerProps) {
  const { locale } = useLanguage();
  const { playSound } = useSound();

  // For now, show a message that QR scanning is not available
  // We can implement this later with a proper camera solution
  const handleManualInput = () => {
    Alert.prompt(
      t('qr.manualTitle', { locale }),
      t('qr.manualMessage', { locale }),
      [
        {
          text: t('common.cancel', { locale }),
          style: 'cancel',
          onPress: async () => { await playSound('click'); }
        },
        {
          text: t('common.ok', { locale }),
          onPress: async (text?: string) => {
            await playSound('click');
            if (text && /^[A-Za-z0-9]+$/.test(text)) {
              playSound('success');
              onScanSuccess(text);
              onClose();
            } else {
              playSound('error');
              Alert.alert(
                t('qr.invalidTitle', { locale }),
                t('qr.invalidMessage', { locale })
              );
            }
          }
        }
      ],
      'plain-text'
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={async () => { await playSound('click'); onClose(); }} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('qr.scanTitle', { locale })}</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          <View style={styles.scanFrame} />
          <Text style={styles.message}>
            {t('qr.cameraNotAvailable', { locale })}
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.manualButton]}
            onPress={handleManualInput}
          >
            <Text style={styles.buttonText}>
              {t('qr.manualInput', { locale })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GameColors.shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: GameColors.overlayBgDark,
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: GameColors.white,
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    color: GameColors.white,
    fontSize: 20,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GameColors.white,
    marginBottom: 20,
  },
  message: {
    color: GameColors.white,
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GameColors.green,
    shadowColor: GameColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  manualButton: {
    backgroundColor: GameColors.blue,
  },
  buttonText: {
    color: GameColors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
