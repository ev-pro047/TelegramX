import { describe, expect, it } from 'vitest';

import type { ApiMessage, MediaContent } from '../../api/types';

import { classifyXydriveFile, getXydriveFile, mergeXydriveFiles } from './fileMetadata';
import { getXydriveNextOffset } from './pagination';

const OWNER = '100';

function makeMessage(id: number, content: MediaContent, chatId = OWNER): ApiMessage {
  return { id, chatId, content, date: 1000, isOutgoing: true };
}

const DOCUMENT: MediaContent = {
  document: { mediaType: 'document', id: '123', fileName: ' notes.PDF ', size: 2048, mimeType: 'APPLICATION/PDF' },
};

describe('Xydrive file metadata', () => {
  it('normalizes filenames, MIME types and sizes', () => {
    expect(getXydriveFile(makeMessage(9, DOCUMENT), OWNER)).toMatchObject({
      id: '100:9:document', chatId: OWNER, messageId: 9, name: 'notes.PDF',
      mimeType: 'application/pdf', size: 2048, category: 'documents',
    });
  });

  it('does not invent sizes for photos', () => {
    const file = getXydriveFile(makeMessage(8, {
      photo: { mediaType: 'photo', id: 'photo', date: 1000, sizes: [] },
    }), OWNER);
    expect(file).toMatchObject({ name: 'photo-8.jpg', category: 'images' });
    expect(file?.size).toBeUndefined();
  });

  it('rejects foreign, protected, expiring and text-only messages', () => {
    expect(getXydriveFile(makeMessage(9, DOCUMENT, '101'), OWNER)).toBeUndefined();
    expect(getXydriveFile({ ...makeMessage(9, DOCUMENT), isProtected: true }, OWNER)).toBeUndefined();
    expect(getXydriveFile(makeMessage(9, { ...DOCUMENT, ttlSeconds: 5 }), OWNER)).toBeUndefined();
    expect(getXydriveFile(makeMessage(9, {}), OWNER)).toBeUndefined();
  });

  it('classifies archives and unknown binaries', () => {
    expect(classifyXydriveFile('archive.ZIP', 'application/octet-stream')).toBe('archives');
    expect(classifyXydriveFile('binary.bin', 'application/octet-stream')).toBe('other');
    expect(classifyXydriveFile('track', 'audio/mpeg')).toBe('audio');
    expect(classifyXydriveFile('untitled', 'application/pdf')).toBe('documents');
    expect(classifyXydriveFile('sheet', 'application/vnd.ms-excel')).toBe('documents');
  });

  it('deduplicates repeated pages without collapsing distinct messages', () => {
    const first = getXydriveFile(makeMessage(9, DOCUMENT), OWNER)!;
    const second = getXydriveFile(makeMessage(8, DOCUMENT), OWNER)!;
    expect(mergeXydriveFiles([first], [first, second])).toEqual([first, second]);
  });
});

describe('Xydrive history cursor', () => {
  it('advances using raw IDs even when files are absent', () => {
    expect(getXydriveNextOffset([10, 9, 8])).toBe(8);
    expect(getXydriveNextOffset([8, 7, 6], 8)).toBe(6);
  });

  it('stops on empty or nonadvancing pages', () => {
    expect(getXydriveNextOffset([], 8)).toBeUndefined();
    expect(getXydriveNextOffset([8, 9, 0], 8)).toBeUndefined();
  });
});
