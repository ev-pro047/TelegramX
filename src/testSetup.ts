import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

import { vi } from 'vitest';

vi.stubGlobal('matchMedia', (query: string) => ({
  media: query,
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
