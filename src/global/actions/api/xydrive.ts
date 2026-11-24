import type { GlobalState } from '../../types';

import { callApi } from '../../../api/gramjs';
import { getXydriveFile, mergeXydriveFiles } from '../../../lib/xydrive/fileMetadata';
import {
  buildXydriveChannel, getXydriveMounts, isXydriveChannelEligible, upsertXydriveMount,
} from '../../../lib/xydrive/folders';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { replaceSettings } from '../../reducers/settings';
import { updateTabState } from '../../reducers/tabs';
import { selectSharedSettings } from '../../selectors/sharedState';

let nextRequestId = 0;

function isXydriveOpen(global: GlobalState, tabId: number, ownerId: string) {
  return global.currentUserId === ownerId && !global.passcode.isScreenLocked
    && selectSharedSettings(global).isXydriveEnabled
    && global.byTabId[tabId]?.xydriveOwnerId === ownerId;
}

addActionHandler('mountXydriveChannel', async (global, actions, payload): Promise<void> => {
  const { channelId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId)) return;
  if (global.byTabId[tabId].xydriveMountRequest) return;

  const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  if (folders.some(({ id }) => id === channelId)) return;

  const channel = global.chats.byId[channelId];
  if (!channel || !isXydriveChannelEligible(channel)) return;

  const id = ++nextRequestId;
  setGlobal(updateTabState(global, {
    xydriveMountRequest: { id, channelId },
    xydriveMountError: undefined,
  }, tabId));

  let result;
  try {
    result = await callApi('verifyXydriveChannel', { channel });
  } catch {
    result = undefined;
  }

  global = getGlobal();
  if (!isXydriveOpen(global, tabId, ownerId) || global.byTabId[tabId].xydriveMountRequest?.id !== id) return;

  global = updateTabState(global, {
    xydriveMountRequest: undefined,
    xydriveMountError: result?.type === 'channel' ? undefined
      : result?.type === 'wait' ? 'wait' : result?.type === 'unavailable' ? 'unavailable' : 'generic',
  }, tabId);
  if (result?.type === 'channel' && result.folder.id === channelId) {
    const current = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
    global = replaceSettings(global, { xydriveMounts: { ownerId, folders: upsertXydriveMount(current, result.folder) } });
  }
  setGlobal(global);
});

addActionHandler('loadXydrivePage', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const ownerId = global.currentUserId;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId)) return;

  const tab = global.byTabId[tabId];
  const sourceId = tab.xydriveSourceId || ownerId;
  const folder = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId).find(({ id }) => id === sourceId);
  if (sourceId !== ownerId && !folder) return;

  const previous = tab.xydrive;
  if (previous?.status === 'loading' || (previous?.status === 'ready' && previous.nextOffsetId === undefined)) return;

  const requestId = ++nextRequestId;
  const offsetId = previous?.nextOffsetId;
  setGlobal(updateTabState(global, {
    xydrive: {
      ownerId,
      sourceId,
      files: previous?.files || [],
      scannedCount: previous?.scannedCount || 0,
      nextOffsetId: offsetId,
      status: 'loading',
      requestId,
    },
  }, tabId));

  let result;
  try {
    result = await callApi('fetchXydriveHistory', { offsetId, channel: folder && buildXydriveChannel(folder) });
  } catch {
    result = undefined;
  }

  global = getGlobal();
  if (!isXydriveOpen(global, tabId, ownerId)) return;
  const currentTab = global.byTabId[tabId];
  const current = currentTab.xydrive;
  const currentFolders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  if (current?.ownerId !== ownerId || current.requestId !== requestId || current.sourceId !== sourceId
    || (currentTab.xydriveSourceId || ownerId) !== sourceId
    || (sourceId !== ownerId && !currentFolders.some(({ id }) => id === sourceId))) return;

  if (!result || result.type !== 'page') {
    const isUnavailable = result?.type === 'unavailable';
    const shouldClear = isUnavailable || (Boolean(folder) && !result);
    setGlobal(updateTabState(global, {
      xydrive: {
        ...current,
        files: shouldClear ? [] : current.files,
        scannedCount: shouldClear ? 0 : current.scannedCount,
        nextOffsetId: shouldClear ? undefined : current.nextOffsetId,
        requestId: undefined,
        status: 'error',
        error: result?.type === 'wait' ? 'wait' : isUnavailable ? 'unavailable' : 'generic',
      },
    }, tabId));
    return;
  }

  if (result.folder && result.folder.id === sourceId) {
    const updatedFolders = upsertXydriveMount(currentFolders, result.folder);
    if (updatedFolders !== currentFolders) {
      global = replaceSettings(global, { xydriveMounts: { ownerId, folders: updatedFolders } });
    }
  }
  const files = result.messages.map((message) => getXydriveFile(message, sourceId)).filter(Boolean);
  setGlobal(updateTabState(global, {
    xydrive: {
      ownerId,
      sourceId,
      files: mergeXydriveFiles(current.files, files),
      scannedCount: current.scannedCount + result.scannedCount,
      nextOffsetId: result.nextOffsetId,
      status: 'ready',
    },
  }, tabId));
});
