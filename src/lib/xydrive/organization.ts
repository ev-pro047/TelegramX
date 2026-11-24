import type { XydriveFile, XydriveFileLabel, XydriveMount, XydriveOrganization } from './types';

export function getOrganization(value: XydriveOrganization | undefined, ownerId: string): XydriveOrganization {
  return value?.ownerId === ownerId ? value : { ownerId, parents: {}, labels: {} };
}

export function getFileLabel(org: XydriveOrganization, file: XydriveFile): XydriveFileLabel | undefined {
  const label = org.labels[file.id];
  return label && label.mediaId === file.mediaId ? label : undefined;
}

export function updateFileLabel(org: XydriveOrganization, file: XydriveFile, patch: Partial<XydriveFileLabel>) {
  const labels = { ...org.labels, [file.id]: { ...getFileLabel(org, file), ...patch, mediaId: file.mediaId } };
  return { ...org, labels };
}

export function getFolderChain(org: XydriveOrganization, folders: readonly XydriveMount[], id?: string): XydriveMount[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const chain: XydriveMount[] = [];
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    const folder = byId.get(id);
    if (!folder) break;
    seen.add(id);
    chain.unshift(folder);
    id = org.parents[id];
  }
  return chain;
}

export function setFolderParent(org: XydriveOrganization, folders: readonly XydriveMount[], id: string, parentId?: string) {
  if (!folders.some((folder) => folder.id === id) || (parentId && (!folders.some((folder) => folder.id === parentId)
    || getFolderChain(org, folders, parentId).some((folder) => folder.id === id)))) return org;
  const parents = { ...org.parents };
  if (parentId) parents[id] = parentId;
  else delete parents[id];
  return { ...org, parents };
}

export function getFolderChildren(org: XydriveOrganization, folders: readonly XydriveMount[], parentId?: string) {
  const ids = new Set(folders.map(({ id }) => id));
  return folders.filter(({ id }) => {
    const parent = org.parents[id];
    return (parent && ids.has(parent) ? parent : undefined) === parentId;
  });
}
