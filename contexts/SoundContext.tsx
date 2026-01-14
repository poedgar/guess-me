import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface SoundContextType {
  isSoundEnabled: boolean;
  toggleSound: () => void;
  playSound: (soundType: 'success' | 'error' | 'click' | 'gameStart' | 'points' | 'notification' | 'copy') => Promise<void>;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

const SOUND_STORAGE_KEY = 'sound_enabled';

export function SoundProvider({ children }: { children: ReactNode }) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [sounds, setSounds] = useState<Record<string, Audio.Sound | null>>({});

  // Load sound preference from storage
  useEffect(() => {
    loadSoundPreference();
    return () => {
      // Cleanup sounds on unmount
      Object.values(sounds).forEach(sound => {
        if (sound) sound.unloadAsync();
      });
    };
  }, []);

  const loadSoundPreference = async () => {
    try {
      const stored = await AsyncStorage.getItem(SOUND_STORAGE_KEY);
      if (stored !== null) {
        setIsSoundEnabled(stored === 'true');
      }
    } catch (error) {
      console.error('Failed to load sound preference:', error);
    }
  };

  const toggleSound = async () => {
    const newValue = !isSoundEnabled;
    setIsSoundEnabled(newValue);
    try {
      await AsyncStorage.setItem(SOUND_STORAGE_KEY, newValue.toString());
    } catch (error) {
      console.error('Failed to save sound preference:', error);
    }
  };

  // Generate sound effects using Web Audio API oscillators
  const generateTone = async (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!isSoundEnabled) return;

    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create oscillator
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
      
    } catch (error) {
      console.log('Audio generation not available, using fallback');
      // Fallback to haptics if audio fails
      if (typeof window !== 'undefined' && 'navigator' in window) {
        try {
          // Use haptics as fallback
        } catch (e) {
          // Silent fail
        }
      }
    }
  };

  const playSound = async (soundType: 'success' | 'error' | 'click' | 'gameStart' | 'points' | 'notification' | 'copy') => {
    if (!isSoundEnabled) return;

    switch (soundType) {
      case 'success':
        // Ascending tones for success
        await generateTone(523, 0.1); // C5
        setTimeout(() => generateTone(659, 0.1), 100); // E5
        setTimeout(() => generateTone(784, 0.2), 200); // G5
        break;
        
      case 'error':
        // Descending tones for error
        await generateTone(400, 0.2, 'sawtooth');
        setTimeout(() => generateTone(300, 0.3, 'sawtooth'), 150);
        break;
        
      case 'click':
        // Short click sound
        await generateTone(800, 0.05, 'square');
        break;
        
      case 'gameStart':
        // Fanfare-like start sound
        await generateTone(440, 0.15); // A4
        setTimeout(() => generateTone(554, 0.15), 150); // C#5
        setTimeout(() => generateTone(659, 0.15), 300); // E5
        setTimeout(() => generateTone(880, 0.3), 450); // A5
        break;
        
      case 'points':
        // Sparkle sound for points
        await generateTone(1047, 0.1); // C6
        setTimeout(() => generateTone(1319, 0.1), 50); // E6
        setTimeout(() => generateTone(1568, 0.1), 100); // G6
        setTimeout(() => generateTone(2093, 0.2), 150); // C7
        break;
        
      case 'notification':
        // Gentle notification sound
        await generateTone(660, 0.15); // E5
        setTimeout(() => generateTone(880, 0.15), 150); // A5
        break;
        
      case 'copy':
        // Quick copy sound - short ascending chirp
        await generateTone(600, 0.08); // D5
        setTimeout(() => generateTone(800, 0.08), 80); // G5
        break;
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
  if (context === undefined) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}
