import { describe, expect, it } from 'vitest';

import type { XydriveFile } from './types';

import {
  EMPTY_XYDRIVE_SELECTION, queryXydriveFiles, restrictXydriveSelection, selectXydriveFile,
} from './explorer';

function makeFile(id: string, name: string, size?: number, date = 1000): XydriveFile {
  return { id, name, size, date, chatId: '1', messageId: Number(id), category: 'documents', mediaType: 'document' };
}

const FILES = [
  makeFile('1', 'File 10.pdf', 10, 100),
  makeFile('2', 'file 2.pdf', 0, 200),
  { ...makeFile('3', 'image.jpg', undefined, 300), category: 'images' as const },
];

describe('Xydrive explorer', () => {
  it('combines case-insensitive filename search and category filtering', () => {
    expect(queryXydriveFiles(FILES, ' FILE ', 'documents', 'name', 'asc').map(({ id }) => id))
      .toEqual(['2', '1']);
    expect(queryXydriveFiles(FILES, 'file', 'images', 'name', 'asc')).toEqual([]);
  });

  it('sorts by date without mutating source', () => {
    expect(queryXydriveFiles(FILES, '', 'all', 'date', 'desc').map(({ id }) => id)).toEqual(['3', '2', '1']);
    expect(FILES.map(({ id }) => id)).toEqual(['1', '2', '3']);
  });

  it('keeps unknown sizes last in either direction and preserves zero', () => {
    expect(queryXydriveFiles(FILES, '', 'all', 'size', 'asc').map(({ id }) => id)).toEqual(['2', '1', '3']);
    expect(queryXydriveFiles(FILES, '', 'all', 'size', 'desc').map(({ id }) => id)).toEqual(['1', '2', '3']);
  });

  it('supports single, toggle and range selection in visible order', () => {
    const order = ['3', '2', '1'];
    const first = selectXydriveFile(EMPTY_XYDRIVE_SELECTION, order, '3', 'replace');
    const range = selectXydriveFile(first, order, '1', 'range');
    expect([...range.ids]).toEqual(order);
    const toggled = selectXydriveFile(range, order, '2', 'toggle');
    expect([...toggled.ids]).toEqual(['3', '1']);
    expect(selectXydriveFile(toggled, order, 'missing', 'toggle')).toBe(toggled);
  });

  it('removes hidden selections and invalid range anchors', () => {
    const selection = { ids: new Set(['1', '2']), anchor: '2' };
    expect(restrictXydriveSelection(selection, ['1'])).toEqual({ ids: new Set(['1']), anchor: undefined });
  });
});
