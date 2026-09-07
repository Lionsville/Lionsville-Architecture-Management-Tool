/**
 * The light or dark theme — or the system's.
 *
 * Down here rather than in `projects/preferences.ts`, where it was, because
 * the theme is now a fact two processes share: the renderer keeps it as a
 * preference, and the desktop's View menu has three radio items that must show
 * which one is on. A `HostCommand` carries the mode one way and the report of
 * it the other, and both are typed against this.
 *
 * Three settings and not two: "follow the system" is what most people want,
 * and it is the only setting that moves along by itself in the evening.
 */
export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system']

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value)
}
