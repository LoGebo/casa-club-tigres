// Identidad Tigres (azul marino + oro) sobre la estructura de colores de iOS.
// Aproximación de marca: Tigres UANL no publica manual con hex oficiales.
import '@/global.css';

export const brand = { navy: '#0B2265', navyDeep: '#071647', gold: '#F2C230', goldSoft: '#FBEBB4' } as const;

export const Colors = {
  light: {
    bg: '#F2F2F7', // systemGroupedBackground
    surface: '#FFFFFF',
    fill: '#EEEEF3',
    label: '#000000',
    label2: '#6C6C70',
    label3: '#AEAEB2',
    sep: '#D8D8DD',
    tint: brand.navy,
    tintWeak: 'rgba(11,34,101,0.09)',
    gold: brand.gold,
    onGold: brand.navyDeep,
    ok: '#1E8E4E',
    okWeak: 'rgba(30,142,78,0.13)',
    warn: '#B26A00',
    warnWeak: 'rgba(214,134,0,0.15)',
    bad: '#D13438',
    badWeak: 'rgba(209,52,56,0.12)',
    hero: brand.navy,
    onHero: '#FFFFFF',
    onHero2: 'rgba(255,255,255,0.68)',
  },
  dark: {
    bg: '#000000',
    surface: '#1C1C1E',
    fill: '#2C2C2E',
    label: '#FFFFFF',
    label2: '#A1A1A6',
    label3: '#636366',
    sep: '#38383A',
    tint: '#8FB0FF',
    tintWeak: 'rgba(143,176,255,0.16)',
    gold: brand.gold,
    onGold: brand.navyDeep,
    ok: '#4CC77F',
    okWeak: 'rgba(76,199,127,0.16)',
    warn: '#F0A030',
    warnWeak: 'rgba(240,160,48,0.16)',
    bad: '#FF6B6B',
    badWeak: 'rgba(255,107,107,0.16)',
    hero: '#0F2F8A',
    onHero: '#FFFFFF',
    onHero2: 'rgba(255,255,255,0.68)',
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };

export const Space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const Radius = { s: 10, m: 14, l: 20, pill: 999 } as const;
export const MaxWidth = 560; // en web el contenido se centra como en un teléfono grande
