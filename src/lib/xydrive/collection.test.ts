import { describe, expect, it } from 'vitest';

import type { XydriveFile } from './types';

import { buildXydriveItems, getXydrivePage, queryXydriveItems, summarizeXydriveItems } from './collection';
import { getOrganization } from './organization';

const FILE: XydriveFile = {
  id: 'self:1:document', chatId: 'self', name: 'Budget.xlsx', category: 'documents', mediaType: 'document',
  messageId: 1, date: 10,
};

describe('Xydrive collection', () => {
  it('finds the alias and original name and applies extension filter to the original', () => {
    const organization = getOrganization(undefined, 'self');
    organization.labels[FILE.id] = { alias: 'Quarterly accounts' };
    const items = buildXydriveItems([FILE], [], organization);
    expect(queryXydriveItems(items, 'budget', 'all', 'name', 'asc', '.xlsx')).toEqual(items);
    expect(queryXydriveItems(items, 'quarterly', 'all', 'name', 'asc', '.xlsx')).toEqual(items);
    expect(queryXydriveItems(items, 'quarterly', 'all', 'name', 'asc', '.pdf')).toEqual([]);
  });

  it('bounds the DOM page even with 20,000 file results and clamps removed pages', () => {
    const entries = Array.from({ length: 20000 }, (_, i) => i);
    expect(getXydrivePage(entries, 300, 48).visible).toHaveLength(48);
    expect(getXydrivePage(entries.slice(0, 2), 300, 48).activePage).toBe(0);
  });

  it('counts unknown sizes independently of zero and separates folders', () => {
    const items = buildXydriveItems([FILE, { ...FILE, id: 'other', size: 0 }],
      [{ id: 'channel', title: 'Folder', accessHash: '1' }], getOrganization(undefined, 'self'));
    expect(summarizeXydriveItems(items)).toEqual({ files: 2, folders: 1, bytes: 0, unknown: 1 });
  });
});

describe('Xydrive inline text preview', () => {
  it('rejects oversized and non-text files while accepting ordinary UTF-8 documents', async () => {
    const { canPreviewXydriveText, decodeXydrivePreviewText, MAX_XYDRIVE_TEXT_PREVIEW_BYTES }
      = await import('./fileMetadata');
    expect(canPreviewXydriveText({ ...FILE, name: 'notes.txt', mimeType: 'text/plain', size: 42 })).toBe(true);
    expect(canPreviewXydriveText({ ...FILE, name: 'notes.txt', mimeType: 'text/html', size: 42 })).toBe(false);
    expect(canPreviewXydriveText({ ...FILE, name: 'notes.txt', size: MAX_XYDRIVE_TEXT_PREVIEW_BYTES + 1 })).toBe(false);
    expect(decodeXydrivePreviewText(new TextEncoder().encode('<b>plain text</b>').buffer)).toBe('<b>plain text</b>');
    expect(decodeXydrivePreviewText(new Uint8Array([0xff, 0xfe]).buffer)).toBeUndefined();
  });
});
