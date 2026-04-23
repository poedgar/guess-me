import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface SoundContextType {
  isSoundEnabled: boolean;
  toggleSound: () => void;
  playSound: (soundType: 'success' | 'error' | 'click' | 'gameStart' | 'points' | 'notification' | 'copy' | 'correctGuess' | 'wrongGuess' | 'roundComplete' | 'gameOver' | 'timerWarning' | 'achievement') => Promise<void>;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

const SOUND_STORAGE_KEY = 'sound_enabled';

function buildWavBase64(frequency: number, duration: number, type: 'sine' | 'square' | 'sawtooth'): string {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fade = 1 - i / numSamples;
    let s: number;
    if (type === 'sine') s = Math.sin(2 * Math.PI * frequency * t);
    else if (type === 'square') s = Math.sin(2 * Math.PI * frequency * t) >= 0 ? 1 : -1;
    else s = 2 * ((frequency * t) % 1) - 1;
    view.setInt16(44 + i * 2, Math.round(s * fade * 0.3 * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function playNativeTone(frequency: number, duration: number, type: 'sine' | 'square' | 'sawtooth' = 'sine') {
  try {
    const base64 = buildWavBase64(frequency, duration, type);
    const uri = `${FileSystem.cacheDirectory}tone_${frequency}_${Date.now()}.wav`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    const { sound } = await Audio.Sound.createAsync({ uri });
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        FileSystem.deleteAsync(uri, { idempotent: true });
      }
    });
  } catch {
    // silent fail
  }
}

function playWebTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = type;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // silent fail
  }
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  useEffect(() => {
    loadSoundPreference();
    if (Platform.OS !== 'web') {
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
    }
  }, []);

  const loadSoundPreference = async () => {
    try {
      const stored = await AsyncStorage.getItem(SOUND_STORAGE_KEY);
      if (stored !== null) setIsSoundEnabled(stored === 'true');
    } catch {
      // silent fail
    }
  };

  const toggleSound = async () => {
    const newValue = !isSoundEnabled;
    setIsSoundEnabled(newValue);
    try {
      await AsyncStorage.setItem(SOUND_STORAGE_KEY, newValue.toString());
    } catch {
      // silent fail
    }
  };

  const tone = (freq: number, dur: number, type: 'sine' | 'square' | 'sawtooth' = 'sine', delayMs = 0) => {
    const play = () => Platform.OS === 'web' ? playWebTone(freq, dur, type) : playNativeTone(freq, dur, type);
    if (delayMs > 0) setTimeout(play, delayMs);
    else play();
  };

  const playSound = async (soundType: 'success' | 'error' | 'click' | 'gameStart' | 'points' | 'notification' | 'copy' | 'correctGuess' | 'wrongGuess' | 'roundComplete' | 'gameOver' | 'timerWarning' | 'achievement') => {
    if (!isSoundEnabled) return;

    switch (soundType) {
      case 'success':
        tone(523, 0.1); tone(659, 0.1, 'sine', 100); tone(784, 0.2, 'sine', 200); break;
      case 'error':
        tone(400, 0.2, 'sawtooth'); tone(300, 0.3, 'sawtooth', 150); break;
      case 'click':
        tone(800, 0.05, 'square'); break;
      case 'gameStart':
        tone(440, 0.15); tone(554, 0.15, 'sine', 150); tone(659, 0.15, 'sine', 300); tone(880, 0.3, 'sine', 450); break;
      case 'points':
        tone(1047, 0.1); tone(1319, 0.1, 'sine', 50); tone(1568, 0.1, 'sine', 100); tone(2093, 0.2, 'sine', 150); break;
      case 'notification':
        tone(660, 0.15); tone(880, 0.15, 'sine', 150); break;
      case 'copy':
        tone(600, 0.08); tone(800, 0.08, 'sine', 80); break;
      case 'correctGuess':
        tone(523, 0.15); tone(659, 0.15, 'sine', 100); tone(784, 0.2, 'sine', 200); break;
      case 'wrongGuess':
        tone(200, 0.2, 'sawtooth'); tone(150, 0.3, 'sawtooth', 150); break;
      case 'roundComplete':
        tone(440, 0.2); tone(554, 0.2, 'sine', 200); tone(659, 0.2, 'sine', 400); tone(880, 0.3, 'sine', 600); break;
      case 'gameOver':
        tone(440, 0.3); tone(349, 0.3, 'sine', 200); tone(262, 0.4, 'sine', 400); tone(196, 0.5, 'sine', 600); break;
      case 'timerWarning':
        tone(880, 0.1, 'square'); tone(880, 0.1, 'square', 150); tone(880, 0.1, 'square', 300); tone(1047, 0.15, 'square', 450); break;
      case 'achievement':
        tone(523, 0.1); tone(659, 0.1, 'sine', 50); tone(784, 0.1, 'sine', 100);
        tone(1047, 0.1, 'sine', 150); tone(1319, 0.15, 'sine', 200); tone(1568, 0.2, 'sine', 300); break;
    }
  };

  return (
    <SoundContext.Provider value={{ isSoundEnabled, toggleSound, playSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (context === undefined) throw new Error('useSound must be used within a SoundProvider');
  return context;
}
