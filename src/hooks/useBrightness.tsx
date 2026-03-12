import { useState, useEffect, useCallback } from 'react';

const BRIGHTNESS_KEY = 'aura-vtc-brightness';
const DEFAULT_BRIGHTNESS = 1;
const MIN_BRIGHTNESS = 0.7;
const MAX_BRIGHTNESS = 1.3;
const STEP = 0.05;

export function useBrightness() {
  const [brightness, setBrightnessState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(BRIGHTNESS_KEY);
      return stored ? parseFloat(stored) : DEFAULT_BRIGHTNESS;
    }
    return DEFAULT_BRIGHTNESS;
  });

  // Apply brightness to CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--brightness', brightness.toString());
    localStorage.setItem(BRIGHTNESS_KEY, brightness.toString());
  }, [brightness]);

  const setBrightness = useCallback((value: number) => {
    const clamped = Math.max(MIN_BRIGHTNESS, Math.min(MAX_BRIGHTNESS, value));
    setBrightnessState(clamped);
  }, []);

  const increaseBrightness = useCallback(() => {
    setBrightnessState(prev => Math.min(MAX_BRIGHTNESS, prev + STEP));
  }, []);

  const decreaseBrightness = useCallback(() => {
    setBrightnessState(prev => Math.max(MIN_BRIGHTNESS, prev - STEP));
  }, []);

  const resetBrightness = useCallback(() => {
    setBrightnessState(DEFAULT_BRIGHTNESS);
  }, []);

  return {
    brightness,
    setBrightness,
    increaseBrightness,
    decreaseBrightness,
    resetBrightness,
    MIN_BRIGHTNESS,
    MAX_BRIGHTNESS,
    STEP,
  };
}
