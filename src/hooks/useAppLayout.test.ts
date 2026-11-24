import { describe, expect, it, vi } from 'vitest';

import {
  MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN,
  MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT,
  MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH,
  MOBILE_SCREEN_MAX_WIDTH,
} from '../config';

vi.mock('../util/windowSize', () => ({ updateSizes: vi.fn() }));

describe('Telegram pane layout', () => {
  it('uses separate media conditions for short windows and follows breakpoint changes', async () => {
    const mobileQuery = [
      `(max-width: ${MOBILE_SCREEN_MAX_WIDTH}px)`,
      `(max-width: ${MOBILE_SCREEN_LANDSCAPE_MAX_WIDTH}px) and (max-height: ${MOBILE_SCREEN_LANDSCAPE_MAX_HEIGHT}px)`,
    ].join(', ');
    const tabletQuery = `(max-width: ${MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN}px)`;
    const queries = new Map<string, { matches: boolean; onChange: () => void }>();
    vi.stubGlobal('matchMedia', (media: string) => {
      const state = { matches: false, onChange: () => {} };
      queries.set(media.replace(/\s+/g, ' '), state);

      return {
        media,
        get matches() {
          return state.matches;
        },
        addEventListener(_type: string, onChange: () => void) {
          state.onChange = onChange;
        },
      };
    });

    const { getIsMobile, getIsTablet } = await import('./useAppLayout');
    const mobile = queries.get(mobileQuery);
    const tablet = queries.get(tabletQuery);
    expect(mobile).toBeDefined();
    expect(tablet).toBeDefined();
    expect(getIsMobile()).toBe(false);
    expect(getIsTablet()).toBe(false);

    tablet!.matches = true;
    tablet!.onChange();
    expect(getIsMobile()).toBe(false);
    expect(getIsTablet()).toBe(true);

    mobile!.matches = true;
    mobile!.onChange();
    expect(getIsMobile()).toBe(true);
    expect(getIsTablet()).toBe(false);

    tablet!.matches = false;
    tablet!.onChange();
    expect(getIsMobile()).toBe(true);
    expect(getIsTablet()).toBe(false);

    mobile!.matches = false;
    mobile!.onChange();
    expect(getIsMobile()).toBe(false);
    expect(getIsTablet()).toBe(false);
  });
});
