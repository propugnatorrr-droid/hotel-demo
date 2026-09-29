/**
 * Haptic feedback that works on both platforms.
 *  - Android / Chromium: navigator.vibrate patterns.
 *  - iOS Safari 17.4+: toggling a hidden <input type="checkbox" switch> fires the system "tick".
 * Everything is best effort and silent when unsupported. Users can turn it off (localStorage).
 */

export type Haptic = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const PATTERNS: Record<Haptic, number[]> = {
  selection: [8],
  light: [12],
  medium: [22],
  heavy: [38],
  success: [12, 55, 20],
  warning: [28, 60, 28],
  error: [36, 55, 36, 55, 36],
};

const KEY = 'iliria.haptics';
let iosLabel: HTMLLabelElement | null = null;

export function hapticsEnabled() {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* private mode */
  }
}

export function hapticsSupported() {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.vibrate === 'function' || /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function ensureIosSwitch() {
  if (iosLabel?.isConnected) return iosLabel;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  iosLabel = label;
  return label;
}

export function haptic(kind: Haptic = 'selection') {
  if (typeof window === 'undefined' || !hapticsEnabled()) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && kind !== 'error') return;
  const pattern = PATTERNS[kind];

  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
    return;
  }
  // iOS: one tick per switch toggle; vibration patterns are (pulse, gap, pulse, ...).
  try {
    const label = ensureIosSwitch();
    pattern.forEach((v, i) => {
      if (i % 2 === 1) return; // gaps
      const delay = pattern.slice(0, i).reduce((a, b) => a + b, 0);
      if (delay === 0) label.click();
      else window.setTimeout(() => label.click(), delay);
    });
  } catch {
    /* unsupported */
  }
}
