import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface SoundContextType {
  isSoundEnabled: boolean;
  toggleSound: () => void;
  playSound: (soundType: 'success' | 'error' | 'click' | 'gameStart' | 'points' | 'notification' | 'copy' | 'correctGuess' | 'wrongGuess' | 'roundComplete' | 'gameOver' | 'timerWarning' | 'achievement') => Promise<void>;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

const SOUND_STORAGE_KEY = 'sound_enabled';

interface WebkitWindow extends Window {
  webkitAudioContext: typeof AudioContext;
}

function playWebTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as WebkitWindow).webkitAudioContext;
    const ctx = new AudioCtx();
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

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => { pendingTimers.current.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    loadSoundPreference();
  }, []);

  const loadSoundPreference = () => {
    try {
      const stored = localStorage.getItem(SOUND_STORAGE_KEY);
      if (stored !== null) setIsSoundEnabled(stored === 'true');
    } catch {
      // silent fail
    }
  };

  const toggleSound = () => {
    const newValue = !isSoundEnabled;
    setIsSoundEnabled(newValue);
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, newValue.toString());
    } catch {
      // silent fail
    }
  };

  const tone = (freq: number, dur: number, type: OscillatorType = 'sine', delayMs = 0) => {
    const play = () => playWebTone(freq, dur, type);
    if (delayMs > 0) {
      const id = setTimeout(play, delayMs);
      pendingTimers.current.push(id);
    } else play();
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
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}
