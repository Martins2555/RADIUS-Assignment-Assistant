// Colours, accent choices and the subject / answer-style lists used across the app.
// Moved out of App.jsx unchanged so each file stays small.

// Chat accent colours. Each has a main shade and a slightly deeper second
// shade (used for the soft gradient on buttons and bubbles), for dark and
// light mode, plus the text colour that reads best on top of it.
// All unlocked for now; this is where a premium lock would slot in later.
export const accentColors = {
  green:   { dark: '#34d27b', dark2: '#1fb862', light: '#16a34a', light2: '#12853b', onDark: '#052412', onLight: '#ffffff', label: 'Emerald' },
  blue:    { dark: '#5b9bff', dark2: '#3a7cf5', light: '#2563eb', light2: '#1d4fd8', onDark: '#ffffff', onLight: '#ffffff', label: 'Ocean' },
  purple:  { dark: '#a877f7', dark2: '#8b4fe6', light: '#9333ea', light2: '#7a24cc', onDark: '#ffffff', onLight: '#ffffff', label: 'Violet' },
  pink:    { dark: '#f45fa8', dark2: '#e03c8d', light: '#db2777', light2: '#bf1d65', onDark: '#ffffff', onLight: '#ffffff', label: 'Rose' },
  orange:  { dark: '#fb923c', dark2: '#f97316', light: '#ea580c', light2: '#cf4a09', onDark: '#1c0b01', onLight: '#ffffff', label: 'Sunset' },
  teal:    { dark: '#2dd4bf', dark2: '#14b8a6', light: '#0d9488', light2: '#0b7a70', onDark: '#022b27', onLight: '#ffffff', label: 'Teal' },
  cyan:    { dark: '#38d4f5', dark2: '#1fb6e0', light: '#0891b2', light2: '#0a7893', onDark: '#03242d', onLight: '#ffffff', label: 'Cyan' },
  indigo:  { dark: '#7c83fd', dark2: '#5b63f0', light: '#4f46e5', light2: '#4038c7', onDark: '#ffffff', onLight: '#ffffff', label: 'Indigo' },
  red:     { dark: '#f5636b', dark2: '#e63946', light: '#dc2626', light2: '#b91c1c', onDark: '#ffffff', onLight: '#ffffff', label: 'Crimson' },
  amber:   { dark: '#fbbf24', dark2: '#f59e0b', light: '#d97706', light2: '#b45309', onDark: '#2b1700', onLight: '#ffffff', label: 'Amber' },
  lime:    { dark: '#a3e635', dark2: '#84cc16', light: '#65a30d', light2: '#4d7c0f', onDark: '#122004', onLight: '#ffffff', label: 'Lime' },
  magenta: { dark: '#e879f9', dark2: '#d946ef', light: '#c026d3', light2: '#a21caf', onDark: '#2b0530', onLight: '#ffffff', label: 'Orchid' },
}
export const accentOrder = ['green', 'blue', 'purple', 'pink', 'orange', 'teal', 'cyan', 'indigo', 'red', 'amber', 'lime', 'magenta']

export const RESPONSE_STYLES = [
  { value: 'concise', label: 'Concise — straight to the point' },
  { value: 'balanced', label: 'Balanced — clear steps' },
  { value: 'detailed', label: 'Detailed — full reasoning' },
]

export const SUBJECTS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Physics', label: 'Physics' },
  { value: 'Chemistry', label: 'Chemistry' },
  { value: 'Engineering', label: 'Engineering' },
  { value: 'Computer Science', label: 'Computer Science' },
  { value: 'Programming', label: 'Programming' },
  { value: 'Biology', label: 'Biology' },
  { value: 'Economics', label: 'Economics' },
  { value: 'Business', label: 'Business' },
  { value: 'English', label: 'English' },
  { value: 'General', label: 'General' },
]

export const modeBase = {
  dark: { bg: '#0a0c12', surface: '#121622', surfaceAlt: '#1a2030', border: '#262d42', text: '#eef1f8', subtext: '#8f98ae' },
  light: { bg: '#f3f5fa', surface: '#ffffff', surfaceAlt: '#eaeef6', border: '#dde2ee', text: '#0f1320', subtext: '#586179' },
}

export function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export function getPalette(theme, accentColor) {
  const base = modeBase[theme] || modeBase.dark
  const ac = accentColors[accentColor] || accentColors.green
  const light = theme === 'light'
  const a1 = light ? ac.light : ac.dark
  const a2 = light ? ac.light2 : ac.dark2
  return {
    ...base,
    accent: a1,
    accent2: a2,
    accentGrad: `linear-gradient(135deg, ${a1}, ${a2})`,
    warn: light ? '#b45309' : '#fbbf24', // friendly amber for error messages
    accentText: light ? ac.onLight : ac.onDark,
    accentSoft: hexToRgba(a1, light ? 0.16 : 0.22),
    accentGlow: hexToRgba(a1, light ? 0.28 : 0.34),
    bgGlow: `radial-gradient(900px 480px at 100% -5%, ${hexToRgba(a1, light ? 0.1 : 0.13)}, transparent 62%), radial-gradient(700px 420px at -10% 105%, ${hexToRgba(a2, light ? 0.07 : 0.09)}, transparent 62%)`,
  }
}
