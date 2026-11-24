import type { XydriveCategory, XydriveFile } from './types';

export type XydriveSort = 'name' | 'date' | 'size' | 'type';
export type XydriveFilter = XydriveCategory | 'all';
export type XydriveDirection = 'asc' | 'desc';

export type XydriveSelection = {
  ids: ReadonlySet<string>;
  anchor?: string;
};

export const EMPTY_XYDRIVE_SELECTION: XydriveSelection = { ids: new Set() };

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function queryXydriveFiles(
  files: readonly XydriveFile[],
  query: string,
  category: XydriveFilter,
  sort: XydriveSort,
  direction: XydriveDirection,
): XydriveFile[] {
  const term = query.trim().normalize('NFC').toLowerCase();
  const sign = direction === 'asc' ? 1 : -1;
  return files.filter((file) => (category === 'all' || category === file.category)
    && file.name.normalize('NFC').toLowerCase().includes(term))
    .sort((left, right) => {
      let result = 0;
      switch (sort) {
        case 'name':
          result = collator.compare(left.name, right.name);
          break;
        case 'date':
          result = left.date - right.date;
          break;
        case 'size':
          // Unknown sizes remain last, independent of sort direction.
          if (left.size === undefined && right.size !== undefined) return 1;
          if (right.size === undefined && left.size !== undefined) return -1;
          result = (left.size ?? 0) - (right.size ?? 0);
          break;
        case 'type':
          result = collator.compare(left.category, right.category);
          break;
      }
      return result * sign || collator.compare(left.name, right.name) || left.id.localeCompare(right.id);
    });
}

export function selectXydriveFile(
  selection: XydriveSelection,
  visibleIds: readonly string[],
  id: string,
  mode: 'replace' | 'toggle' | 'range',
): XydriveSelection {
  if (!visibleIds.includes(id)) return selection;

  if (mode === 'toggle') {
    const ids = new Set(selection.ids);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    return { ids, anchor: id };
  }

  if (mode === 'range' && selection.anchor) {
    const start = visibleIds.indexOf(selection.anchor);
    const end = visibleIds.indexOf(id);
    if (start >= 0 && end >= 0) {
      return {
        ids: new Set(visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1)),
        anchor: selection.anchor,
      };
    }
  }

  return { ids: new Set([id]), anchor: id };
}

export function restrictXydriveSelection(
  selection: XydriveSelection, visibleIds: readonly string[],
): XydriveSelection {
  const visible = new Set(visibleIds);
  const ids = new Set(Array.from(selection.ids).filter((id) => visible.has(id)));
  const anchor = selection.anchor && visible.has(selection.anchor) ? selection.anchor : undefined;
  return ids.size === selection.ids.size && anchor === selection.anchor ? selection : { ids, anchor };
}
