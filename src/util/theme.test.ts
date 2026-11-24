import { describe, expect, it } from 'vitest';

import type { ApiThemeSettings } from '../api/types';
import type { ThemeKey } from '../types';

import { getLuminance } from '../lib/color';
import { buildColorFromHex } from './colors';
import { buildThemePalette } from './theme';

describe('Selected chat theme contrast', () => {
  const examples: [ThemeKey, ApiThemeSettings?][] = [
    ['light'],
    ['dark'],
    ['light', { baseTheme: 'day', accentColor: '#f9d35c' }],
    ['dark', { baseTheme: 'tinted', accentColor: '#dfbffd' }],
    ['dark', { baseTheme: 'night', accentColor: '#294a6f' }],
  ];

  it.each(examples)('keeps white selected-chat text readable in the %s palette', (theme, settings) => {
    const { variables } = buildThemePalette(theme, settings);
    const selected = getLuminance(buildColorFromHex(variables['--color-chat-active-contrast']));
    const accent = getLuminance(buildColorFromHex(variables['--color-primary']));

    expect(1.05 / (selected + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(selected).toBeLessThanOrEqual(accent + 0.001);
    expect(variables['--color-chat-active']).toBe(variables['--color-primary']);
  });
});
