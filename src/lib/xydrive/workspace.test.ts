import { describe, expect, it } from 'vitest';

import { getOrganization } from './organization';
import {
  buildFolderTree, flattenFolderTree, getXydriveLocationState, getXydrivePreferences, storeXydriveLocationState,
} from './workspace';

describe('Xydrive workspace state', () => {
  it('defaults to the card-only workspace', () => {
    expect(getXydrivePreferences().view).toBe('grid');
  });

  it('walks only open tree branches and keeps full logical depth', () => {
    const folders = Array.from({ length: 8 }, (_, i) => ({ id: String(i), title: String(i), accessHash: '1' }));
    const org = getOrganization(undefined, 'owner');
    for (let i = 1; i < folders.length; i++) org.parents[i] = String(i - 1);
    const tree = buildFolderTree(folders, org.parents);
    expect(flattenFolderTree(tree, new Set()).map(({ folder }) => folder.id)).toEqual(['0']);
    expect(flattenFolderTree(tree, new Set(folders.map(({ id }) => id))).at(-1)?.depth).toBe(7);
  });

  it('restores an exact folder view within its account only', () => {
    const state = { scrollTop: 240, query: 'pdf', page: 2 };
    storeXydriveLocationState('first', 'folder', state);
    expect(getXydriveLocationState('first', 'folder')).toEqual(state);
    expect(getXydriveLocationState('second', 'folder')).toBeUndefined();
    expect(getXydriveLocationState('first', 'other-folder')).toBeUndefined();
  });
});
