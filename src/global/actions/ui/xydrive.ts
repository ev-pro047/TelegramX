import type { ActionReturnType } from '../../types';
import type { XydriveFile, XydriveIndex } from '../../../lib/xydrive/types';
import { MediaViewerOrigin } from '../../../types';

import { getFileLabel, getOrganization, setFolderParent, updateFileLabel } from '../../../lib/xydrive/organization';
import { getXydriveMounts } from '../../../lib/xydrive/folders';
import { getXydriveLocation } from '../../../lib/xydrive/workspace';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../../index';
import { replaceSettings } from '../../reducers/settings';
import { updateTabState } from '../../reducers/tabs';
import { selectSharedSettings } from '../../selectors/sharedState';

addActionHandler('openXydrive', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  if (!selectSharedSettings(global).isXydriveEnabled || !global.currentUserId || global.passcode.isScreenLocked) {
    return undefined;
  }

  const { sourceId } = getXydriveLocation(global.currentUserId);
  const validSourceId = getXydriveMounts(global.settings.byKey.xydriveMounts, global.currentUserId)
    .some(({ id }) => id === sourceId) ? sourceId : undefined;
  return updateTabState(global, {
    xydriveOwnerId: global.currentUserId,
    xydriveSourceId: validSourceId,
    xydrive: undefined,
    xydriveMountRequest: undefined,
    xydriveMountError: undefined,
    xydriveTextPreview: undefined,
    xydriveMediaRequest: undefined,
    xydriveMediaError: undefined,
  }, tabId);
});

addActionHandler('closeXydrive', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  if (global.byTabId[tabId]?.mediaViewer.origin === MediaViewerOrigin.Xydrive) {
    const { volume, isMuted, playbackRate } = global.byTabId[tabId].mediaViewer;
    global = updateTabState(global, { mediaViewer: { volume, isMuted, playbackRate } }, tabId);
  }
  return updateTabState(global, {
    xydriveOwnerId: undefined,
    xydriveRename: undefined,
    xydriveIndex: global.byTabId[tabId]?.xydriveIndex?.ownerId === global.currentUserId
      && !global.passcode.isScreenLocked && selectSharedSettings(global).isXydriveEnabled
      ? getPausedXydriveIndex(global.byTabId[tabId].xydriveIndex) : undefined,
    xydriveSourceId: undefined,
    xydrive: undefined,
    xydriveMountRequest: undefined,
    xydriveMountError: undefined,
    xydriveTextPreview: undefined,
    xydriveMediaRequest: undefined,
    xydriveMediaError: undefined,
  }, tabId);
});

addActionHandler('selectXydriveSource', (global, actions, payload): ActionReturnType => {
  const { channelId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  const tab = global.byTabId[tabId];
  if (!ownerId || tab?.xydriveOwnerId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled || tab.xydriveSourceId === channelId) return undefined;
  if (channelId && !getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId)
    .some(({ id }) => id === channelId)) return undefined;

  return updateTabState(global, {
    xydriveSourceId: channelId, xydrive: undefined, xydriveTextPreview: undefined, xydriveMediaRequest: undefined, xydriveMediaError: undefined,
  }, tabId);
});

addActionHandler('unmountXydriveChannel', (global, actions, payload): ActionReturnType => {
  const { channelId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  if (!ownerId || global.byTabId[tabId]?.xydriveOwnerId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled) return undefined;

  const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  if (!folders.some(({ id }) => id === channelId)) return undefined;
  const org = getOrganization(global.settings.byKey.xydriveOrganization, ownerId);
  const parents = { ...org.parents };
  const folderLabels = { ...org.folderLabels };
  delete folderLabels[channelId];
  delete parents[channelId];
  for (const id of Object.keys(parents)) if (parents[id] === channelId) delete parents[id];
  global = replaceSettings(global, { xydriveMounts: { ownerId, folders: folders.filter(({ id }) => id !== channelId) },
    xydriveOrganization: { ...org, parents, folderLabels } });
  for (const tab of Object.values(global.byTabId)) {
    if (tab.xydriveIndex?.ownerId === ownerId) {
      const sources = { ...tab.xydriveIndex.sources };
      delete sources[channelId];
      global = updateTabState(global, { xydriveIndex: { ownerId, sources, status: 'partial' } }, tab.id);
    }
    if (tab.xydriveSourceId === channelId && tab.xydriveOwnerId === ownerId) {
      global = updateTabState(global, {
        xydriveSourceId: undefined, xydrive: undefined, xydriveTextPreview: undefined, xydriveMediaRequest: undefined, xydriveMediaError: undefined,
      }, tab.id);
    }
  }
  return global;
});


addActionHandler('setXydriveFolderParent', (global, actions, payload): ActionReturnType => {
  const { channelId, parentId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  if (!ownerId || global.byTabId[tabId]?.xydriveOwnerId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled) return undefined;
  const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  const org = getOrganization(global.settings.byKey.xydriveOrganization, ownerId);
  return replaceSettings(global, { xydriveOrganization: setFolderParent(org, folders, channelId, parentId) });
});

addActionHandler('labelXydriveFolder', (global, actions, payload): ActionReturnType => {
  const { channelId, favorite, pinned, tone, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  if (!ownerId || global.byTabId[tabId]?.xydriveOwnerId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled) return undefined;
  const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  if (!folders.some(({ id }) => id === channelId)) return undefined;

  const org = getOrganization(global.settings.byKey.xydriveOrganization, ownerId);
  const previous = org.folderLabels?.[channelId];
  const label = {
    favorite: favorite ?? previous?.favorite, pinned: pinned ?? previous?.pinned, tone: tone ?? previous?.tone,
  };
  const folderLabels = { ...org.folderLabels };
  if (label.favorite || label.pinned || (label.tone && label.tone !== 'default')) folderLabels[channelId] = label;
  else delete folderLabels[channelId];
  return replaceSettings(global, { xydriveOrganization: { ...org, folderLabels } });
});

addActionHandler('labelXydriveFile', (global, actions, payload): ActionReturnType => {
  const { fileId, alias, favorite, pinned, opened, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  const tab = global.byTabId[tabId];
  if (!ownerId || tab?.xydriveOwnerId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled) return undefined;
  const file = (tab.xydrive?.ownerId === ownerId ? tab.xydrive.files.find(({ id }) => id === fileId) : undefined)
    || (tab.xydriveIndex?.ownerId === ownerId ? Object.values(tab.xydriveIndex.sources).flatMap((source) => source.files).find(({ id }) => id === fileId) : undefined);
  if (!file || (file.chatId !== ownerId && !getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId).some(({ id }) => id === file.chatId))) return undefined;
  const org = getOrganization(global.settings.byKey.xydriveOrganization, ownerId);
  return replaceSettings(global, { xydriveOrganization: updateFileLabel(org, file, {
    ...(alias !== undefined && { alias: alias.trim().slice(0, 255) || undefined }),
    ...(favorite !== undefined && { favorite }),
    ...(pinned !== undefined && { pinned }),
    ...(opened && { lastOpened: Date.now() }),
  }) });
});

addActionHandler('cancelXydriveSync', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const index = global.byTabId[tabId]?.xydriveIndex;
  if (index?.status !== 'syncing' || index.ownerId !== global.currentUserId) return undefined;
  return updateTabState(global, { xydriveIndex: { ...index, status: 'partial', requestId: undefined } }, tabId);
});

function getPausedXydriveIndex(index: XydriveIndex | undefined) {
  return index?.status === 'syncing' ? { ...index, status: 'partial' as const, requestId: undefined } : index;
}

addActionHandler('labelXydriveItems', (global, actions, payload): ActionReturnType => {
  const { fileIds, folderIds, favorite, pinned, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  const tab = global.byTabId[tabId];
  if (!ownerId || tab?.xydriveOwnerId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled) return undefined;
  const folderSet = new Set(getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId).map(({ id }) => id));
  const org = getOrganization(global.settings.byKey.xydriveOrganization, ownerId);
  const labels = { ...org.labels };
  const folderLabels = { ...org.folderLabels };
  const files = new Map<string, XydriveFile>();
  if (tab.xydriveIndex?.ownerId === ownerId) {
    Object.values(tab.xydriveIndex.sources).forEach((source) => source.files.forEach((file) => files.set(file.id, file)));
  }
  if (tab.xydrive?.ownerId === ownerId) tab.xydrive.files.forEach((file) => files.set(file.id, file));
  const patch = { ...(favorite !== undefined && { favorite }), ...(pinned !== undefined && { pinned }) };
  for (const id of fileIds) {
    const file = files.get(id);
    if (file && (file.chatId === ownerId || folderSet.has(file.chatId))) {
      labels[id] = { ...getFileLabel(org, file), mediaId: file.mediaId, ...patch };
    }
  }
  for (const id of folderIds) {
    if (folderSet.has(id)) folderLabels[id] = { ...folderLabels[id], ...patch };
  }
  return replaceSettings(global, { xydriveOrganization: { ...org, labels, folderLabels } });
});

addActionHandler('closeXydriveTextPreview', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, { xydriveTextPreview: undefined }, tabId);
});
