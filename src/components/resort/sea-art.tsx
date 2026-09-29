'use client';

import { motion } from 'motion/react';

/** Original vector scenery used wherever a photo is not uploaded: sun, layered Ionian waves. */
export function SeaHero({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="size-full">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b1e2d" />
            <stop offset="0.55" stopColor="#1b4d72" />
            <stop offset="1" stopColor="#e0b354" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff3c9" />
            <stop offset="0.35" stopColor="#f2c45f" stopOpacity="0.9" />
            <stop offset="1" stopColor="#e0b354" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sea1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2e78ad" stopOpacity="0.85" />
            <stop offset="1" stopColor="#143a56" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#sky)" />
        <motion.circle cx="800" cy="520" initial={{ r: 250 }} fill="url(#sun)" animate={{ r: [250, 275, 250] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }} />
        <circle cx="800" cy="520" r="74" fill="#fff3c9" opacity="0.95" />
        {[0, 1, 2, 3].map((i) => (
          <motion.path
            key={i}
            d={`M-200 ${560 + i * 70} C 100 ${520 + i * 70}, 300 ${610 + i * 70}, 600 ${565 + i * 70} S 1100 ${520 + i * 70}, 1400 ${575 + i * 70} S 1700 ${540 + i * 70}, 1800 ${560 + i * 70} V 900 H -200 Z`}
            fill={['#2e78ad', '#23618f', '#1b4d72', '#0f2a3f'][i]}
            opacity={[0.55, 0.7, 0.85, 1][i]}
            animate={{ x: [0, i % 2 ? 40 : -40, 0] }}
            transition={{ duration: 10 + i * 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
        <path d="M600 560 L1000 560 L960 585 L640 585 Z" fill="#fff3c9" opacity="0.18" />
        <path d="M700 590 L900 590 L880 610 L720 610 Z" fill="#fff3c9" opacity="0.12" />
      </svg>
    </div>
  );
}

const PALETTES = [
  ['#143a56', '#2e78ad', '#e0b354'],
  ['#463d2f', '#a8977a', '#f6e1d7'],
  ['#0f2a3f', '#5b97c4', '#f7ecd2'],
  ['#4a5a26', '#8a9e57', '#e8edd9'],
  ['#93452a', '#d8805f', '#f7ecd2'],
];

/** Deterministic generative card art for room types that have no photo yet. */
export function RoomArt({ seed, className }: { seed: number; className?: string }) {
  const [a, b, c] = PALETTES[seed % PALETTES.length]!;
  const id = `ra-${seed}`;
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id})`} />
      <circle cx={300 - (seed % 3) * 40} cy="90" r="42" fill={c} opacity="0.9" />
      <path d="M0 210 C 80 180, 140 230, 220 205 S 340 190, 400 210 V300 H0Z" fill="#fff" opacity="0.12" />
      <path d="M0 240 C 90 215, 160 262, 250 238 S 350 228, 400 244 V300 H0Z" fill="#000" opacity="0.18" />
      <rect x="58" y="150" width="120" height="6" rx="3" fill="#fff" opacity="0.5" />
      <rect x="70" y="128" width="96" height="24" rx="8" fill="#fff" opacity="0.28" />
    </svg>
  );
}
