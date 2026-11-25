import { describe, expect, it } from 'vitest';

import { applyCloudChanges, diffCloud, emptyCloudSnapshot, encodeCloudTransaction, replayCloudJournal, runCloudSyncWithRetries, verifyCloudCheckpoint } from './cloud';

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

describe('silent cloud retries', () => {
  it('makes three retries after the first failure, with increasing delays', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const result = await runCloudSyncWithRetries(async () => {
      attempts++;
      return 'registry-error';
    }, () => true, async (ms) => { delays.push(ms); }, async () => 0);
    expect(result).toBe('registry-error');
    expect(attempts).toBe(4);
    expect(delays).toEqual([1500, 3500, 8000]);
  });

  it('stops after a successful retry and never retries a conflict', async () => {
    let attempts = 0;
    const result = await runCloudSyncWithRetries(async () => {
      attempts++;
      return attempts === 1 ? 'write-error' : 'synced';
    }, () => true, async () => {}, async () => 0);
    expect(result).toBe('synced');
    expect(attempts).toBe(2);
    expect(await runCloudSyncWithRetries(async () => 'conflict', () => true, async () => {
      throw Error('Conflict must not be retried');
    }, async () => 0)).toBe('conflict');
  });

  it('honors Telegram cooldowns and stops after the account becomes inactive', async () => {
    const delays: number[] = [];
    let active = true;
    const result = await runCloudSyncWithRetries(async () => 'discovery-error', () => active, async (ms) => {
      delays.push(ms);
      active = false;
    }, async () => 10);
    expect(result).toBeUndefined();
    expect(delays).toEqual([10000]);
    expect(await runCloudSyncWithRetries(async () => 'registry-error', () => true, async () => {
      throw Error('Long flood wait must not retry');
    }, async () => 120)).toBe('wait-error');
  });
});
