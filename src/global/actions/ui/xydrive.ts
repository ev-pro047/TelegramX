import type { ActionReturnType } from '../../types';
import { MediaViewerOrigin } from '../../../types';

import { getOrganization, setFolderParent, updateFileLabel } from '../../../lib/xydrive/organization';
import { getXydriveMounts } from '../../../lib/xydrive/folders';
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

  return updateTabState(global, {
    xydriveOwnerId: global.currentUserId,
    xydriveSourceId: undefined,
    xydrive: undefined,
    xydriveMountRequest: undefined,
    xydriveMountError: undefined,
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
    xydriveIndex: undefined,
    xydriveSourceId: undefined,
    xydrive: undefined,
    xydriveMountRequest: undefined,
    xydriveMountError: undefined,
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
    xydriveSourceId: channelId, xydrive: undefined, xydriveMediaRequest: undefined, xydriveMediaError: undefined,
  }, tabId);
});

addActionHandler('unmountXydriveChannel', (global, actions, payload): ActionReturnType => {
  const { channelId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  if (!ownerId || global.byTabId[tabId]?.xydriveOwnerId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled) return undefined;

  const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  if (!folders.some(({ id }) => id === channelId)) return undefined;
  global = replaceSettings(global, { xydriveMounts: { ownerId, folders: folders.filter(({ id }) => id !== channelId) } });
  for (const tab of Object.values(global.byTabId)) {
    if (tab.xydriveSourceId === channelId && tab.xydriveOwnerId === ownerId) {
      global = updateTabState(global, {
        xydriveSourceId: undefined, xydrive: undefined, xydriveMediaRequest: undefined, xydriveMediaError: undefined,
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

addActionHandler('labelXydriveFile', (global, actions, payload): ActionReturnType => {
  const { fileId, alias, favorite, pinned, opened, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  const tab = global.byTabId[tabId];
  if (!ownerId || tab?.xydriveOwnerId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled) return undefined;
  const file = tab.xydrive?.ownerId === ownerId && tab.xydrive.files.find(({ id }) => id === fileId);
  if (!file) return undefined;
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
