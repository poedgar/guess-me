// Must unmock before importing — jest.setup.js mocks SoundContext globally
jest.unmock('@/contexts/SoundContext');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { SoundProvider, useSound } from '../contexts/SoundContext';

jest.mock('expo-av', () => ({
  Audio: { Sound: { createAsync: jest.fn() } },
}));

// Stub Web Audio API — SoundContext calls new window.AudioContext()
const mockAudioContext = {
  createOscillator: jest.fn(() => ({
    connect: jest.fn(),
    frequency: { value: 0 },
    type: 'sine' as OscillatorType,
    start: jest.fn(),
    stop: jest.fn(),
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
  })),
  destination: {},
  currentTime: 0,
};

beforeEach(() => {
  (global as any).window = { AudioContext: jest.fn(() => mockAudioContext) };
  // Restore AsyncStorage mock after resetMocks clears it
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  delete (global as any).window;
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SoundProvider>{children}</SoundProvider>
);

describe('SoundContext', () => {
  describe('useSound', () => {
    it('throws when used outside SoundProvider', () => {
      // Call renderHook without wrapper so the hook runs with no context
      const { result } = renderHook(() => {
        try { return useSound(); } catch (e) { return e as Error; }
      });
      expect((result.current as Error).message).toContain('useSound must be used within a SoundProvider');
    });
  });

  describe('SoundProvider', () => {
    it('provides isSoundEnabled as true by default', async () => {
      const { result } = renderHook(() => useSound(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isSoundEnabled).toBe(true);
    });

    it('reads stored preference from AsyncStorage on mount', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('false');
      renderHook(() => useSound(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('sound_enabled');
    });

    it('sets isSoundEnabled to false when AsyncStorage has "false"', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('false');
      const { result } = renderHook(() => useSound(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isSoundEnabled).toBe(false);
    });

    it('keeps isSoundEnabled true when AsyncStorage returns null', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      const { result } = renderHook(() => useSound(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isSoundEnabled).toBe(true);
    });

    it('toggleSound flips from true to false and persists to AsyncStorage', async () => {
      const { result } = renderHook(() => useSound(), { wrapper });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isSoundEnabled).toBe(true);

      await act(async () => { result.current.toggleSound(); });

      expect(result.current.isSoundEnabled).toBe(false);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('sound_enabled', 'false');
    });

    it('toggleSound flips from false back to true', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('false');
      const { result } = renderHook(() => useSound(), { wrapper });
      await act(async () => { await Promise.resolve(); });

      await act(async () => { result.current.toggleSound(); });

      expect(result.current.isSoundEnabled).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('sound_enabled', 'true');
    });

    it('playSound does not call AudioContext when sound is disabled', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('false');
      const { result } = renderHook(() => useSound(), { wrapper });
      await act(async () => { await Promise.resolve(); });

      mockAudioContext.createOscillator.mockClear();
      await act(async () => { await result.current.playSound('success'); });

      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    });

    it('playSound does not throw for any valid sound type', async () => {
      const { result } = renderHook(() => useSound(), { wrapper });
      await act(async () => { await Promise.resolve(); });

      const sounds = [
        'success', 'error', 'click', 'gameStart', 'points', 'notification',
        'copy', 'correctGuess', 'wrongGuess', 'roundComplete', 'gameOver',
        'timerWarning', 'achievement',
      ] as const;

      for (const s of sounds) {
        await expect(
          act(async () => { await result.current.playSound(s); })
        ).resolves.not.toThrow();
      }
    });
  });
});
