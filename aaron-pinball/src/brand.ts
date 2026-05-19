// Gabb Wireless–inspired brand palette.
// Color choices echo Gabb's kid-friendly, safe-tech identity (deep purple
// primary with bright coral/teal/yellow accents). Not official brand hex values.
export const BRAND = {
  purple: 0x5b2d91,
  purpleDeep: 0x1a0b3d,
  purpleLight: 0x8b5cf6,
  coral: 0xff6b35,
  teal: 0x00c896,
  yellow: 0xffd23f,
  cream: 0xfff8f0,
  pink: 0xff5c8a,
  white: 0xffffff,
  black: 0x000000,
} as const;

export const hex = (n: number) =>
  '#' + n.toString(16).padStart(6, '0');

export const PRODUCTS = [
  { key: 'WATCH', label: 'Gabb Watch', color: BRAND.coral, points: 250 },
  { key: 'PHONE', label: 'Gabb Phone', color: BRAND.teal, points: 250 },
  { key: 'MUSIC', label: 'Gabb Music', color: BRAND.pink, points: 250 },
  { key: 'MSGR', label: 'Gabb Messenger', color: BRAND.yellow, points: 250 },
] as const;

export const TAGLINES = [
  'KIDS WILL BE KIDS.',
  'SAFE TECH. BIG SCORES.',
  'NO INTERNET. NO PROBLEM.',
  'PARENTS APPROVE!',
];
