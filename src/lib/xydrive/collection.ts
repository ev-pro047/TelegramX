import type { IconName } from '../../types/icons';
import type { XydriveDirection, XydriveFilter, XydriveSort } from './explorer';
import type {
  XydriveCategory, XydriveFile, XydriveFolderTone, XydriveIndexSource, XydriveMount, XydriveOrganization,
} from './types';

import { getFileLabel } from './organization';

export const XYDRIVE_CATEGORIES = ['images', 'videos', 'audio', 'documents', 'archives', 'other'] as const;
export const CATEGORY_LABELS = {
  images: 'XydriveImages',
  videos: 'XydriveVideos',
  audio: 'XydriveAudio',
  documents: 'XydriveDocuments',
  archives: 'XydriveArchives',
  other: 'XydriveOther',
} as const;
const CATEGORY_ICONS: Record<XydriveCategory, IconName> = {
  images: 'sd-photo', videos: 'video', audio: 'music', documents: 'document', archives: 'archive', other: 'file-badge',
};

export type XydriveItem = {
  id: string;
  name: string;
  sourceId?: string;
  isPinned?: boolean;
  isFavorite?: boolean;
} & ({
  kind: 'file';
  file: XydriveFile;
  lastOpened?: number;
} | {
  kind: 'folder';
  folder: XydriveMount;
  snapshot?: XydriveIndexSource;
  tone?: XydriveFolderTone;
});

const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function buildXydriveItems(
  files: readonly XydriveFile[],
  folders: readonly XydriveMount[],
  organization: XydriveOrganization,
  sources?: Record<string, XydriveIndexSource>,
): XydriveItem[] {
  return [
    ...folders.map((folder): XydriveItem => {
      const label = organization.folderLabels?.[folder.id];
      return {
        kind: 'folder', id: folder.id, name: folder.title, folder, sourceId: organization.parents[folder.id],
        isPinned: label?.pinned, isFavorite: label?.favorite, tone: label?.tone, snapshot: sources?.[folder.id],
      };
    }),
    ...files.map((file): XydriveItem => {
      const label = getFileLabel(organization, file);
      return {
        kind: 'file', id: file.id, name: label?.alias || file.name, file, sourceId: file.chatId,
        isPinned: label?.pinned, isFavorite: label?.favorite, lastOpened: label?.lastOpened,
      };
    }),
  ];
}

export function queryXydriveItems(
  items: readonly XydriveItem[],
  query: string,
  filter: XydriveFilter,
  sort: XydriveSort | 'opened',
  direction: XydriveDirection,
  extension: string,
): XydriveItem[] {
  const term = normalizeXydriveSearch(query);
  const ext = normalizeXydriveSearch(extension).replace(/^\./, '');
  const order = direction === 'asc' ? 1 : -1;
  return items.filter((item) => {
    if (item.kind === 'folder') return filter === 'all' && !ext && normalizeXydriveSearch(item.name).includes(term);
    return (filter === 'all' || item.file.category === filter)
      && (!ext || normalizeXydriveSearch(getFileExtension(item.file.name)) === ext)
      && [item.name, item.file.name].some((name) => normalizeXydriveSearch(name).includes(term));
  }).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    if (sort !== 'opened' && Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
    let result = COLLATOR.compare(a.name, b.name);
    if (a.kind === 'file' && b.kind === 'file') {
      if (sort === 'date') result = a.file.date - b.file.date;
      if (sort === 'opened') result = (a.lastOpened || 0) - (b.lastOpened || 0);
      if (sort === 'type') result = COLLATOR.compare(getFileFormat(a.file), getFileFormat(b.file));
      if (sort === 'size') {
        if (a.file.size === undefined && b.file.size !== undefined) return 1;
        if (b.file.size === undefined && a.file.size !== undefined) return -1;
        result = (a.file.size || 0) - (b.file.size || 0);
      }
    }
    return result * order || COLLATOR.compare(a.name, b.name) || a.id.localeCompare(b.id);
  });
}

export function normalizeXydriveSearch(value: string) {
  return value.trim().normalize('NFC').toLocaleLowerCase();
}

export function getFileExtension(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1) : '';
}

export function getFileFormat(file: Pick<XydriveFile, 'name' | 'category' | 'mimeType'>) {
  const extension = getFileExtension(file.name).toLowerCase();
  if (extension.length <= 8 && /^[a-z0-9]+$/.test(extension)) return extension.toUpperCase();
  if (file.mimeType === 'application/pdf') return 'PDF';
  return '';
}

export function getFileIcon(category: XydriveCategory) {
  return CATEGORY_ICONS[category];
}

export function summarizeXydriveItems(items: readonly XydriveItem[]) {
  let files = 0;
  let bytes = 0;
  let unknown = 0;
  for (const item of items) {
    if (item.kind !== 'file') continue;
    files++;
    if (item.file.size === undefined) unknown++;
    else bytes += item.file.size;
  }
  return { files, folders: items.length - files, bytes, unknown };
}

export function getXydrivePage<T>(items: readonly T[], page: number, size: number) {
  const lastPage = Math.max(0, Math.ceil(items.length / size) - 1);
  const activePage = Math.min(Math.max(0, page), lastPage);
  return { activePage, lastPage, visible: items.slice(activePage * size, (activePage + 1) * size) };
}

export const MAX_XYDRIVE_MOVE_OR_DELETE = 100;

export function canManageXydriveSource(
  sourceId: string, ownerId: string, folders: readonly XydriveMount[],
) {
  return sourceId === ownerId || folders.some(({ id, isManaged }) => id === sourceId && isManaged);
}
