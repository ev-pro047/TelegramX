import { describe, expect, it } from 'vitest';
import { getOrganization, getFolderChain, setFolderParent, getFolderChildren, updateFileLabel, getFileLabel } from './organization';
import type { XydriveFile } from './types';

const folders = [{ id: 'a', title: 'A', accessHash: '1' }, { id: 'b', title: 'B', accessHash: '2' }];
const file: XydriveFile = { id: 'a:1:document', chatId: 'a', messageId: 1, mediaId: '10', name: 'test.pdf', date: 1,
  category: 'documents', mediaType: 'document' };

describe('drive organization', () => {
  it('supports nested channels and prevents cycles', () => {
    const org = setFolderParent(getOrganization(undefined, 'owner'), folders, 'b', 'a');
    expect(getFolderChain(org, folders, 'b').map(({ id }) => id)).toEqual(['a', 'b']);
    expect(getFolderChildren(org, folders, 'a')).toEqual([folders[1]]);
    expect(setFolderParent(org, folders, 'a', 'b')).toBe(org);
    expect(getFolderChildren(org, [folders[1]])).toEqual([folders[1]]);
  });
  it('isolates accounts and media replacements', () => {
    const org = updateFileLabel(getOrganization(undefined, 'owner'), file, { favorite: true });
    expect(getFileLabel(org, file)?.favorite).toBe(true);
    expect(getFileLabel(org, { ...file, mediaId: '11' })).toBeUndefined();
    expect(getOrganization(org, 'other').labels).toEqual({});
  });
});
