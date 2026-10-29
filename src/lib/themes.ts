import palettes from './theme-palettes.json';
export type ThemeId = keyof typeof palettes;
export const themeIds = [
  'prism',
  'nova',
  'obsidian',
  'eclipse',
  'original',
  'aqua',
  'spectrum',
  'sage',
] as const;
export const defaultTheme: ThemeId = 'prism';
export const themes = palettes;
export function cityBackground(theme: ThemeId, day = false) {
  return theme === 'original' ? (day ? '#303b35' : '#101514') : themes[theme].scene.background;
}
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themeIds.includes(value as ThemeId);
}
export function themeColor(color: string, theme: ThemeId) {
  if (theme === 'original') return color;
  const config = themes[theme];
  const key = color.toLowerCase();
  if (['#ff8a72', '#f9905a', '#ff927c'].includes(key))
    return config.mode === 'light' ? '#B23B2E' : '#FF9D87';
  if (['#d8ed86', '#b8ca96'].includes(key))
    return config.mode === 'light' ? '#276F5D' : config.secondary;
  if (['#9fcfd3', '#a2ccd0'].includes(key)) return config.mode === 'light' ? '#176F8A' : '#8BD7D2';
  return config.accentInk;
}
