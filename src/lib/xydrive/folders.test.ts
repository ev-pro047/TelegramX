import { describe, expect, it } from 'vitest';

import type { ApiChat } from '../../api/types';

import { getXydriveFile } from './fileMetadata';
import { buildXydriveChannel, getXydriveMounts, isXydriveChannelEligible, upsertXydriveMount } from './folders';

const CHANNEL: ApiChat = {
  id: '-100123', type: 'chatTypeChannel', title: 'Projects', isOwner: true, accessHash: '123',
};
const FOLDER = { id: CHANNEL.id, title: CHANNEL.title, accessHash: '123' };

describe('Xydrive private folders', () => {
  it('only accepts eligible owned private broadcast channels', () => {
    expect(isXydriveChannelEligible(CHANNEL)).toBe(true);
    for (const patch of [
      { isOwner: false }, { hasUsername: true }, { usernames: [{ username: 'public', isActive: true }] },
      { type: 'chatTypeSuperGroup' as const }, { isProtected: true }, { isNotJoined: true },
      { isRestricted: true }, { isForbidden: true }, { isMin: true }, { accessHash: 'undefined' },
    ]) {
      expect(isXydriveChannelEligible({ ...CHANNEL, ...patch })).toBe(false);
    }
  });

  it('isolates persisted folder registries by account', () => {
    const registry = { ownerId: '100', folders: [FOLDER] };
    expect(getXydriveMounts(registry, '100')).toEqual([FOLDER]);
    expect(getXydriveMounts(registry, '101')).toEqual([]);
    expect(getXydriveMounts(registry)).toEqual([]);
  });

  it('deduplicates folders by channel ID and keeps native peer information', () => {
    const updated = { ...FOLDER, title: 'Updated' };
    expect(upsertXydriveMount([FOLDER], updated)).toEqual([updated]);
    expect(buildXydriveChannel(FOLDER)).toMatchObject({ id: CHANNEL.id, type: 'chatTypeChannel', accessHash: '123' });
  });

  it('separates identical message IDs in different sources', () => {
    const message = {
      id: 9, chatId: '100', date: 1000, isOutgoing: true,
      content: { document: { mediaType: 'document' as const, id: '7', fileName: 'notes.pdf', size: 10, mimeType: 'application/pdf' } },
    };
    const root = getXydriveFile(message, '100');
    const folder = getXydriveFile({ ...message, chatId: CHANNEL.id }, CHANNEL.id);
    expect(root?.id).not.toBe(folder?.id);
    expect(folder?.chatId).toBe(CHANNEL.id);
    expect(getXydriveFile(message, CHANNEL.id)).toBeUndefined();
  });
});
