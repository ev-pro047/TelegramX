import type { ApiChat } from '../../api/types';
import type { XydriveMount, XydriveMountRegistry } from './types';

const EMPTY_FOLDERS: XydriveMount[] = [];

export function isXydriveChannelEligible(chat: ApiChat): boolean {
  return Boolean(chat.type === 'chatTypeChannel' && chat.isOwner && !chat.isMin
    && chat.accessHash && /^-?\d+$/.test(chat.accessHash) && !chat.hasUsername
    && !chat.usernames?.some((username) => username.isActive)
    && !chat.isNotJoined && !chat.isForbidden && !chat.isRestricted && !chat.isProtected
    && !chat.restrictionReasons?.length && !chat.isMonoforum);
}

export function getXydriveMounts(registry?: XydriveMountRegistry, ownerId?: string): XydriveMount[] {
  return ownerId && registry?.ownerId === ownerId ? registry.folders : EMPTY_FOLDERS;
}

export function buildXydriveChannel(folder: XydriveMount): ApiChat {
  return { id: folder.id, title: folder.title, accessHash: folder.accessHash, type: 'chatTypeChannel' };
}

export function upsertXydriveMount(folders: XydriveMount[], folder: XydriveMount): XydriveMount[] {
  return [...folders.filter(({ id }) => id !== folder.id), folder];
}
