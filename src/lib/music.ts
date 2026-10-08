// Scales and kits. Pitches are MIDI numbers; a peg's column position picks
// the scale degree, so the melody contour is literally the marble's path.

export const SCALES = {
  'major-pent': { name: 'major pentatonic', iv: [0, 2, 4, 7, 9] },
  'minor-pent': { name: 'minor pentatonic', iv: [0, 3, 5, 7, 10] },
  hirajoshi: { name: 'hirajoshi', iv: [0, 2, 3, 7, 8] },
  'suspended': { name: 'suspended pentatonic', iv: [0, 2, 5, 7, 10] },
} as const;

export type ScaleName = keyof typeof SCALES;
export const SCALE_NAMES = Object.keys(SCALES) as ScaleName[];

export const KITS = {
  kalimba: { name: 'kalimba', damp: 0.996, bright: 0.55, stretch: 1.0 },
  marimba: { name: 'marimba', damp: 0.985, bright: 0.35, stretch: 1.0 },
  celesta: { name: 'celesta', damp: 0.9985, bright: 0.75, stretch: 1.4 },
} as const;

export type KitName = keyof typeof KITS;
export const KIT_NAMES = Object.keys(KITS) as KitName[];

export function degreeToMidi(root: number, scale: ScaleName, degree: number): number {
  const iv = SCALES[scale].iv;
  const oct = Math.floor(degree / iv.length);
  const deg = ((degree % iv.length) + iv.length) % iv.length;
  return root + oct * 12 + iv[deg];
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function midiName(m: number): string {
  const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  return names[m % 12] + (Math.floor(m / 12) - 1);
}
