import { describe, expect, it } from 'vitest';

import { applyCloudChanges, diffCloud, emptyCloudSnapshot, encodeCloudTransaction, replayCloudJournal, verifyCloudCheckpoint } from './cloud';

const owner = '1';
const initial = emptyCloudSnapshot();
const folder = { id: '-1001', title: 'Physics', accessHash: '123', isManaged: true as const };
const next = { ...initial, folders: { [folder.id]: folder } };
const records = (messages: string[]) => messages.map((text, i) => ({ id: i + 1, text }));

describe('Xydrive cloud metadata', () => {
  it('recovers committed metadata and ignores an interrupted transaction', () => {
    const messages = encodeCloudTransaction(owner, 'first', diffCloud(initial, next));
    expect(replayCloudJournal(owner, records(messages.slice(0, -1)))).toEqual({ status: 'ready', snapshot: initial, journalId: 0 });
    expect(replayCloudJournal(owner, records(messages))).toEqual({ status: 'ready', snapshot: next, journalId: messages.length });
  });

  it('merges disjoint changes and refuses competing edits', () => {
    const a = { ...next, folderLabels: { [folder.id]: { favorite: true } } };
    const b = { ...next, folders: { [folder.id]: { ...folder, title: 'Chemistry' } } };
    expect(applyCloudChanges(a, diffCloud(next, b))?.folders[folder.id].title).toBe('Chemistry');
    const c = { ...next, folders: { [folder.id]: { ...folder, title: 'Biology' } } };
    expect(applyCloudChanges(b, diffCloud(next, c))).toBeUndefined();
  });

  it('rejects a truncated or altered journal before replacing the local checkpoint', () => {
    const messages = encodeCloudTransaction(owner, 'first', diffCloud(initial, next));
    const base = { ownerId: owner, registryId: '-1000', snapshot: next, journalId: messages.length };
    expect(verifyCloudCheckpoint(owner, records(messages), base)).toBe(true);
    expect(verifyCloudCheckpoint(owner, [], base)).toBe(false);
  });

  it('preserves nested folders and unicode names across chunked transactions', () => {
    const child = { ...folder, id: '-1002', title: 'Physics 📚' };
    const snapshot = { ...next, folders: { ...next.folders, [child.id]: child }, parents: { [child.id]: folder.id } };
    const messages = encodeCloudTransaction(owner, 'nested', diffCloud(initial, snapshot));
    expect(replayCloudJournal(owner, records(messages))).toEqual({
      status: 'ready', snapshot, journalId: messages.length,
    });
  });

  it('rejects foreign account and invalid parent relationships', () => {
    const messages = encodeCloudTransaction(owner, 'first', diffCloud(initial, next));
    expect(replayCloudJournal('2', records(messages))).toEqual({ status: 'conflict' });
    expect(applyCloudChanges(next, [{ key: 'parents', id: folder.id, before: null, after: '-1002' }])).toBeUndefined();
  });
});
