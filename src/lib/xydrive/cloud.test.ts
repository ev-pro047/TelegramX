import { applyCloudChanges, diffCloud, emptyCloudSnapshot, encodeCloudTransaction, replayCloudJournal } from './cloud';

const owner = '1';
const initial = emptyCloudSnapshot();
const folder = { id: '-1001', title: 'Physics', accessHash: '123', isManaged: true as const };
const next = { ...initial, folders: { [folder.id]: folder } };
const records = (messages: string[]) => messages.map((text, i) => ({ id: i + 1, text }));

describe('Xydrive cloud metadata', () => {
  it('recovers committed metadata and ignores an interrupted transaction', () => {
    const messages = encodeCloudTransaction(owner, 'first', diffCloud(initial, next));
    expect(replayCloudJournal(owner, records(messages.slice(0, -1)))).toEqual({ status: 'ready', snapshot: initial });
    expect(replayCloudJournal(owner, records(messages))).toEqual({ status: 'ready', snapshot: next });
  });

  it('merges disjoint changes and refuses competing edits', () => {
    const a = { ...next, folderLabels: { [folder.id]: { favorite: true } } };
    const b = { ...next, folders: { [folder.id]: { ...folder, title: 'Chemistry' } } };
    expect(applyCloudChanges(a, diffCloud(next, b))?.folders[folder.id].title).toBe('Chemistry');
    const c = { ...next, folders: { [folder.id]: { ...folder, title: 'Biology' } } };
    expect(applyCloudChanges(b, diffCloud(next, c))).toBeUndefined();
  });

  it('rejects foreign account and invalid parent relationships', () => {
    const messages = encodeCloudTransaction(owner, 'first', diffCloud(initial, next));
    expect(replayCloudJournal('2', records(messages))).toEqual({ status: 'conflict' });
    expect(applyCloudChanges(next, [{ key: 'parents', id: folder.id, before: null, after: '-1002' }])).toBeUndefined();
  });
});
