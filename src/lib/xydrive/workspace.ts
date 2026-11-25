import type { XydriveDirection, XydriveFilter, XydriveSort } from './explorer';
import type { XydriveMount, XydriveOrganization } from './types';

export type XydriveSection = 'drive' | 'favorites' | 'pinned' | 'recent' | 'overview';
export type XydriveView = 'grid' | 'list';
type XydriveWorkspacePreferences = {
  view: XydriveView;
  density: 'compact' | 'comfortable';
  isSidebarCollapsed: boolean;
  expanded: string[];
  sort: XydriveSort;
  direction: XydriveDirection;
  filter: XydriveFilter;
};

type Location = { section: XydriveSection; sourceId?: string };
export type XydriveLocationState = { scrollTop: number; query: string; page: number; extension?: string };
type Session = { location: Location; byLocation: Map<string, XydriveLocationState> };

const STORAGE_PREFIX = 'xydrive:preferences:';
const SESSIONS = new Map<string, Session>();
const MAX_LOCATIONS = 64;
const MAX_EXPANDED = 1000;

export function getXydrivePreferences(ownerId?: string): XydriveWorkspacePreferences {
  let saved: Partial<XydriveWorkspacePreferences> = {};
  try {
    const stored = ownerId && localStorage.getItem(STORAGE_PREFIX + ownerId);
    if (stored) saved = JSON.parse(stored) || {};
  } catch {
    // The workspace also runs with browser storage disabled
  }

  return {
    // Ignore the legacy list preference: the workspace now uses cards only.
    view: 'grid',
    density: saved.density === 'compact' ? 'compact' : 'comfortable',
    isSidebarCollapsed: saved.isSidebarCollapsed === true,
    expanded: Array.isArray(saved.expanded)
      ? saved.expanded.filter((id) => typeof id === 'string').slice(-MAX_EXPANDED) : [],
    sort: saved.sort && ['name', 'date', 'size', 'type'].includes(saved.sort) ? saved.sort : 'date',
    direction: saved.direction === 'asc' ? 'asc' : 'desc',
    filter: saved.filter && ['images', 'videos', 'audio', 'documents', 'archives', 'other'].includes(saved.filter)
      ? saved.filter : 'all',
  };
}

export function storeXydrivePreferences(ownerId: string | undefined, preferences: XydriveWorkspacePreferences) {
  if (!ownerId) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + ownerId, JSON.stringify(preferences));
  } catch {
    // In-memory preferences remain active
  }
}

export function getXydriveLocation(ownerId?: string): Location {
  return (ownerId && SESSIONS.get(ownerId)?.location) || { section: 'drive' };
}

export function storeXydriveLocation(ownerId: string | undefined, location: Location) {
  if (!ownerId) return;
  const current = SESSIONS.get(ownerId);
  SESSIONS.set(ownerId, { location, byLocation: current?.byLocation || new Map() });
}

export function getXydriveLocationState(ownerId: string | undefined, key: string): XydriveLocationState | undefined {
  return ownerId ? SESSIONS.get(ownerId)?.byLocation.get(key) : undefined;
}

export function storeXydriveLocationState(ownerId: string | undefined, key: string, state: XydriveLocationState) {
  if (!ownerId) return;
  const session = SESSIONS.get(ownerId) || { location: getXydriveLocation(ownerId), byLocation: new Map() };
  session.byLocation.delete(key);
  session.byLocation.set(key, state);
  if (session.byLocation.size > MAX_LOCATIONS) session.byLocation.delete(session.byLocation.keys().next().value);
  SESSIONS.set(ownerId, session);
}

export function buildFolderTree(folders: readonly XydriveMount[], parents: XydriveOrganization['parents']) {
  const known = new Map(folders.map((folder) => [folder.id, folder]));
  const children = new Map<string | undefined, XydriveMount[]>();
  for (const folder of folders) {
    const parent = parents[folder.id];
    const parentId = parent !== folder.id && known.has(parent) ? parent : undefined;
    const list = children.get(parentId) || [];
    list.push(folder);
    children.set(parentId, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.title.localeCompare(b.title));
  return children;
}

export function flattenFolderTree(
  tree: ReturnType<typeof buildFolderTree>, expanded: ReadonlySet<string>, rootId?: string,
) {
  const rows: { folder: XydriveMount; depth: number; hasChildren: boolean }[] = [];
  const visited = new Set<string>();
  const pending = (tree.get(rootId) || []).map((folder) => ({ folder, depth: 0 })).reverse();
  while (pending.length) {
    const { folder, depth } = pending.pop()!;
    if (visited.has(folder.id)) continue;
    visited.add(folder.id);
    const children = tree.get(folder.id) || [];
    rows.push({ folder, depth, hasChildren: children.length > 0 });
    if (expanded.has(folder.id)) {
      for (let i = children.length - 1; i >= 0; i--) pending.push({ folder: children[i], depth: depth + 1 });
    }
  }
  return rows;
}
