export interface Palette {
  bg: string;
  bgSoft: string;
  card: string;
  border: string;
  text: string;
  textSoft: string;
  textFaint: string;
  sakura: string;
  sakuraSoft: string;
  matcha: string;
  matchaSoft: string;
  yuzu: string;
  yuzuSoft: string;
  sora: string;
  soraSoft: string;
  danger: string;
  onAccent: string;
  shadow: string;
  ringTrack: string;
}

/** Washi paper by day. */
export const light: Palette = {
  bg: '#FFF8F2',
  bgSoft: '#FCEFE6',
  card: '#FFFFFF',
  border: '#F1E3DA',
  text: '#3A3335',
  textSoft: '#7A6E70',
  textFaint: '#B4A8A6',
  sakura: '#F09AB0',
  sakuraSoft: '#FDE4EA',
  matcha: '#8DBB8A',
  matchaSoft: '#E5F1E2',
  yuzu: '#F2C66D',
  yuzuSoft: '#FDF1D6',
  sora: '#8DB8E0',
  soraSoft: '#E3EFFA',
  danger: '#E07A7A',
  onAccent: '#FFFFFF',
  shadow: 'rgba(120, 80, 70, 0.10)',
  ringTrack: '#F6E7E0',
};

/** Yoru (night) indigo. */
export const dark: Palette = {
  bg: '#1C1A26',
  bgSoft: '#232031',
  card: '#2A2738',
  border: '#36324A',
  text: '#F3EDE7',
  textSoft: '#B9B0BE',
  textFaint: '#7D7590',
  sakura: '#F29BB2',
  sakuraSoft: '#46303F',
  matcha: '#8FBF8C',
  matchaSoft: '#2C3B33',
  yuzu: '#EBC46F',
  yuzuSoft: '#433A2C',
  sora: '#92B9E2',
  soraSoft: '#2D3550',
  danger: '#EB8C8C',
  onAccent: '#1C1A26',
  shadow: 'rgba(0, 0, 0, 0.35)',
  ringTrack: '#36324A',
};

export const fonts = {
  regular: 'MPLUSRounded1c_400Regular',
  medium: 'MPLUSRounded1c_500Medium',
  bold: 'MPLUSRounded1c_700Bold',
  heavy: 'MPLUSRounded1c_800ExtraBold',
};

export const radius = { sm: 12, md: 18, lg: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
