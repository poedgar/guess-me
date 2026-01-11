import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/i18n';
import { useState } from 'react';
import { Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Only import BarCodeScanner on native platforms
let BarCodeScannerComponent: any = null;
if (Platform.OS !== 'web') {
  BarCodeScannerComponent = require('react-native-camera').BarCodeScanner;
}

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (gameId: string) => void;
}

export default function QRScanner({ visible, onClose, onScanSuccess }: QRScannerProps) {
  const { locale } = useLanguage();
  const [scanning, setScanning] = useState(true);

  // On web, show a message instead of camera
  if (Platform.OS === 'web') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('qr.scanTitle', { locale })}</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.webScannerContainer}>
            <Text style={styles.webMessage}>
              {t('qr.webNotSupported', { locale })}
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.webButton]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>
                {t('common.ok', { locale })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const handleBarCodeRead = ({ data }: { data: string }) => {
    if (!scanning) return;
    
    setScanning(false);
    
    // Check if the scanned data matches our game ID format
    // Game IDs are typically alphanumeric strings
    const gameIdRegex = /^[A-Za-z0-9]+$/;
    
    if (gameIdRegex.test(data)) {
      onScanSuccess(data);
      onClose();
    } else {
      Alert.alert(
        t('qr.invalidTitle', { locale }),
        t('qr.invalidMessage', { locale }),
        [{ text: t('common.ok', { locale }), onPress: () => setScanning(true) }]
      );
    }
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
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('qr.scanTitle', { locale })}</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.scannerContainer}>
          {BarCodeScannerComponent && (
            <>
              <BarCodeScannerComponent
                onBarCodeRead={scanning ? handleBarCodeRead : undefined}
                style={StyleSheet.absoluteFillObject as any}
                barCodeTypes={[BarCodeScannerComponent.Constants.BarCodeType.qr]}
              />
              
              <View style={styles.overlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.instruction}>
                  {t('qr.instruction', { locale })}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  scannerContainer: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  instruction: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  webScannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  webMessage: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 20,
    color: '#fff',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  webButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
