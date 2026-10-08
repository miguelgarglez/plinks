import { ramp, type Skin } from './render';

export const skinA: Skin = { // "The Bean Machine" — light crafted walnut
  bg: '#EFE7DA',
  panel: '#33261B',
  panelEdge: '#20180F',
  peg: '#8a6b45',
  pegRing: '#5a4429',
  marble: '#2b2118',
  marbleGlint: '#f5ead6',
  flashColors: (m, lo, hi) => ramp((m - lo) / Math.max(1, hi - lo)),
  text: '#2A2018',
  dim: '#8a7a66',
  glyphNotes: false,
  constellation: false,
  tines: false,
  vignette: false,
};

export const skinB: Skin = { // "Night Marimba" — dark lacquer planetarium
  bg: '#131020',
  panel: '#181527',
  panelEdge: '#2a2545',
  peg: '#3d3760',
  pegRing: '#4a4478',
  marble: '#efeaff',
  marbleGlint: '#ffffff',
  flashColors: (m, lo, hi) => ramp((m - lo) / Math.max(1, hi - lo), '#7cd8ff', '#ffb84d'),
  text: '#efeaff',
  dim: '#6f689a',
  glyphNotes: true,
  constellation: true,
  tines: false,
  vignette: true,
};

export const skinC: Skin = { // "The Plate" — engraved sheet-music paper
  bg: '#F3EDDE',
  panel: '#fbf7ec',
  panelEdge: '#b8a77f',
  peg: '#4a3b28',
  pegRing: '#7a6844',
  marble: '#241b10',
  marbleGlint: '#c9b98f',
  flashColors: (m, lo, hi) => ramp((m - lo) / Math.max(1, hi - lo), '#1f6f66', '#c27a1e'),
  text: '#241b10',
  dim: '#9a8a68',
  glyphNotes: false,
  constellation: false,
  tines: true,
  vignette: false,
};
