import type { XydriveFolderLabel, XydriveFileLabel, XydriveMount, XydriveOrganization } from './types';

export const XYDRIVE_REGISTRY_TITLE = 'Xydrive Registry';
export const XYDRIVE_REGISTRY_ABOUT = 'Xydrive private metadata registry v1. Do not share or delete.';
const PREFIX = 'XYDRIVE_REGISTRY_V1 ';
const MAX_PARTS = 128;
const PART_SIZE = 2600;
const MAX_OPERATIONS = 10000;
const KEYS = ['folders', 'parents', 'labels', 'folderLabels'] as const;
type Key = (typeof KEYS)[number];
export type CloudSnapshot = {
  folders: Record<string, XydriveMount>;
  parents: Record<string, string>;
  labels: Record<string, XydriveFileLabel>;
  folderLabels: Record<string, XydriveFolderLabel>;
};
type Value = XydriveMount | string | XydriveFileLabel | XydriveFolderLabel | null;
export type CloudChange = { key: Key; id: string; before: Value; after: Value };
export type CloudBase = { ownerId: string; registryId: string; snapshot: CloudSnapshot };
export type CloudSyncStatus = 'checking' | 'setup' | 'syncing' | 'synced' | 'error' | 'conflict';
type Part = { owner: string; tx: string; part: number; total: number; data: string };
type Commit = { owner: string; tx: string; commit: true; total: number };

export function emptyCloudSnapshot(): CloudSnapshot {
  return { folders: {}, parents: {}, labels: {}, folderLabels: {} };
}

export function makeCloudSnapshot(folders: readonly XydriveMount[], organization?: XydriveOrganization): CloudSnapshot {
  return {
    folders: Object.fromEntries(folders.map((folder) => [folder.id, folder])),
    parents: organization?.parents || {},
    labels: organization?.labels || {},
    folderLabels: organization?.folderLabels || {},
  };
}

function stable(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  return JSON.stringify(Object.fromEntries(Object.entries(value)
    .filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b))));
}

export function sameCloudSnapshot(a: CloudSnapshot, b: CloudSnapshot) {
  return !diffCloud(a, b).length;
}

export function diffCloud(before: CloudSnapshot, after: CloudSnapshot): CloudChange[] {
  const result: CloudChange[] = [];
  for (const key of KEYS) {
    for (const id of new Set([...Object.keys(before[key]), ...Object.keys(after[key])])) {
      const oldValue = before[key][id] ?? null;
      const newValue = after[key][id] ?? null;
      if (stable(oldValue) !== stable(newValue)) result.push({ key, id, before: oldValue, after: newValue });
    }
  }
  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && /^-?\\d{1,24}$/.test(value);
}

function validValue(key: Key, id: string, value: unknown): boolean {
  if (value === null) return true;
  if (key === 'parents') return isId(value) && value !== id;
  if (!isObject(value)) return false;
  if (key === 'folders') {
    return Object.keys(value).every((k) => ['id', 'title', 'accessHash', 'isManaged'].includes(k))
      && value.id === id && typeof value.title === 'string' && value.title.length > 0 && value.title.length <= 128
      && value.title !== XYDRIVE_REGISTRY_TITLE && isId(value.accessHash)
      && (value.isManaged === undefined || value.isManaged === true);
  }
  if (value.favorite !== undefined && typeof value.favorite !== 'boolean') return false;
  if (value.pinned !== undefined && typeof value.pinned !== 'boolean') return false;
  if (key === 'folderLabels') {
    return Object.keys(value).every((k) => ['favorite', 'pinned', 'tone'].includes(k))
      && (value.tone === undefined || ['default', 'teal', 'amber', 'violet'].includes(String(value.tone)));
  }
  return Object.keys(value).every((k) => ['mediaId', 'alias', 'favorite', 'pinned', 'lastOpened'].includes(k))
    && (value.mediaId === undefined || isId(value.mediaId))
    && (value.alias === undefined || (typeof value.alias === 'string' && value.alias.length <= 255))
    && (value.lastOpened === undefined || (typeof value.lastOpened === 'number'
      && Number.isSafeInteger(value.lastOpened) && value.lastOpened >= 0));
}

function validChange(value: unknown): value is CloudChange {
  if (!isObject(value) || !KEYS.includes(value.key as Key) || typeof value.id !== 'string') return false;
  const key = value.key as Key;
  const id = value.id;
  if (key === 'labels' ? !/^-?\\d{1,24}:\\d{1,16}:(photo|video|audio|voice|document|sticker)$/.test(id)
    : !isId(id)) return false;
  return validValue(key, id, value.before) && validValue(key, id, value.after);
}

// Apply a complete transaction atomically. Disjoint concurrent edits merge; conflicting edits stop.
export function applyCloudChanges(snapshot: CloudSnapshot, changes: CloudChange[]): CloudSnapshot | undefined {
  if (changes.length > MAX_OPERATIONS || !changes.every(validChange)) return undefined;
  const next: CloudSnapshot = {
    folders: { ...snapshot.folders }, parents: { ...snapshot.parents },
    labels: { ...snapshot.labels }, folderLabels: { ...snapshot.folderLabels },
  };
  for (const { key, id, before, after } of changes) {
    const values = next[key] as Record<string, Value>;
    const current = values[id] ?? null;
    if (stable(current) !== stable(before) && stable(current) !== stable(after)) return undefined;
    if (after === null) delete values[id];
    else values[id] = after;
  }
  for (const [id, parent] of Object.entries(next.parents)) {
    if (!next.folders[id] || !next.folders[parent]) return undefined;
    const seen = new Set([id]);
    let current: string | undefined = parent;
    while (current) {
      if (seen.has(current)) return undefined;
      seen.add(current);
      current = next.parents[current];
    }
  }
  if (Object.keys(next.folderLabels).some((id) => !next.folders[id])) return undefined;
  return next;
}

export function encodeCloudTransaction(owner: string, tx: string, changes: CloudChange[]): string[] {
  if (!changes.length || changes.length > MAX_OPERATIONS || !changes.every(validChange)) throw Error('Invalid metadata');
  const json = JSON.stringify(changes);
  // Split by UTF-16 units, while ensuring no unpaired surrogate is sent to Telegram.
  const parts: string[] = [];
  let offset = 0;
  while (offset < json.length) {
    let end = Math.min(offset + PART_SIZE, json.length);
    if (end < json.length && /[\\uD800-\\uDBFF]/.test(json[end - 1])) end--;
    parts.push(json.slice(offset, end));
    offset = end;
  }
  if (parts.length > MAX_PARTS) throw Error('Metadata transaction too large');
  const records = parts.map((data, part) => PREFIX + JSON.stringify({ owner, tx, part, total: parts.length, data }));
  records.push(PREFIX + JSON.stringify({ owner, tx, commit: true, total: parts.length }));
  if (records.some((record) => record.length > 4096)) throw Error('Metadata record too large');
  return records;
}

export function replayCloudJournal(owner: string, records: { id: number; text: string }[]):
{ status: 'ready'; snapshot: CloudSnapshot } | { status: 'conflict' } {
  let snapshot = emptyCloudSnapshot();
  const pending = new Map<string, Map<number, Part>>();
  const finished = new Set<string>();
  for (const { text } of records.slice().sort((a, b) => a.id - b.id)) {
    if (!text.startsWith(PREFIX)) continue;
    try {
      const raw: unknown = JSON.parse(text.slice(PREFIX.length));
      if (!isObject(raw) || raw.owner !== owner || typeof raw.tx !== 'string'
        || !/^[a-zA-Z0-9-]{1,80}$/.test(raw.tx) || typeof raw.total !== 'number'
        || !Number.isInteger(raw.total) || raw.total < 1 || raw.total > MAX_PARTS) return { status: 'conflict' };
      const record = raw as unknown as Part | Commit;
      if (finished.has(record.tx)) continue;
      const parts = pending.get(record.tx) || new Map<number, Part>();
      if ('commit' in record) {
        if (record.commit !== true || parts.size !== record.total) return { status: 'conflict' };
        const ordered = Array.from({ length: record.total }, (_, i) => parts.get(i));
        if (ordered.some((part) => !part || part.total !== record.total)) return { status: 'conflict' };
        const changes: unknown = JSON.parse(ordered.map((part) => part!.data).join(''));
        if (!Array.isArray(changes)) return { status: 'conflict' };
        const next = applyCloudChanges(snapshot, changes);
        if (!next) return { status: 'conflict' };
        snapshot = next;
        pending.delete(record.tx);
        finished.add(record.tx);
      } else {
        if (!Number.isInteger(record.part) || record.part < 0 || record.part >= record.total
          || typeof record.data !== 'string' || record.data.length > PART_SIZE) return { status: 'conflict' };
        const old = parts.get(record.part);
        if (old && (old.data !== record.data || old.total !== record.total)) return { status: 'conflict' };
        parts.set(record.part, record);
        pending.set(record.tx, parts);
      }
    } catch {
      return { status: 'conflict' };
    }
  }
  return { status: 'ready', snapshot };
}
