import type { GlobalState } from '../../types';
import type { XydriveFile, XydriveIndexSource } from '../../../lib/xydrive/types';
import { getOrganization, setFolderParent, getFileLabel } from '../../../lib/xydrive/organization';
import { MAIN_THREAD_ID } from '../../../api/types';
import { MediaViewerOrigin } from '../../../types';

import { callApi } from '../../../api/gramjs';
import { mergeXydriveFiles } from '../../../lib/xydrive/fileMetadata';
import { getXydriveMediaFile, matchesXydriveMedia } from '../../../lib/xydrive/media';
import {
  buildXydriveChannel, getXydriveMounts, isXydriveChannelEligible, upsertXydriveMount,
} from '../../../lib/xydrive/folders';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateChat } from '../../reducers/chats';
import { replaceMessages } from '../../reducers/messages';
import { replaceSettings } from '../../reducers/settings';
import { updateTabState } from '../../reducers/tabs';
import { selectChat } from '../../selectors';
import { selectSharedSettings } from '../../selectors/sharedState';

let nextRequestId = 0;
const creatingForAccounts = new Set<string>();

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

addActionHandler('createXydriveFolder', async (global, actions, payload): Promise<void> => {
  const { title, parentId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  const name = title.trim();
  if (parentId && !getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId).some(({ id }) => id === parentId)) return;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId) || !name || name.length > 128
    || creatingForAccounts.has(ownerId)) return;

  const requestId = ++nextRequestId;
  const sourceAtStart = global.byTabId[tabId].xydriveSourceId;
  creatingForAccounts.add(ownerId);
  setGlobal(updateTabState(global, { xydriveCreateState: { ownerId, requestId, status: 'creating' } }, tabId));

  let channel;
  let verified;
  let status: 'created' | 'error' | 'limit' | 'unverified' = 'error';
  try {
    const result = await callApi('createXydriveChannel', { ownerId, title: name });
    channel = result?.channel;
    if (channel) {
      status = 'unverified';
      const current = getGlobal();
      if (current.currentUserId === ownerId && !current.passcode.isScreenLocked
        && isXydriveChannelEligible(channel)) {
        const result = await callApi('verifyXydriveChannel', { channel });
        if (result?.type === 'channel' && result.folder.id === channel.id) {
          verified = result.folder;
          status = 'created';
        }
      }
    }
  } catch (error) {
    if (!channel && (error as { message?: string }).message === 'CHANNELS_TOO_MUCH') status = 'limit';
  } finally {
    creatingForAccounts.delete(ownerId);
  }

  global = getGlobal();
  const tab = global.byTabId[tabId];
  if (global.currentUserId !== ownerId || !tab || tab.xydriveCreateState?.requestId !== requestId) return;
  if (channel) global = updateChat(global, channel.id, channel);
  if (verified) {
    const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
    const nextFolders = upsertXydriveMount(folders, verified);
    const organization = getOrganization(global.settings.byKey.xydriveOrganization, ownerId);
    global = replaceSettings(global, { xydriveMounts: { ownerId, folders: nextFolders },
      xydriveOrganization: setFolderParent(organization, nextFolders, verified.id, parentId) });
    if (isXydriveOpen(global, tabId, ownerId) && tab.xydriveSourceId === sourceAtStart) {
      global = updateTabState(global, {
        xydriveSourceId: verified.id, xydrive: undefined,
        xydriveMediaRequest: undefined, xydriveMediaError: undefined,
      }, tabId);
    }
  }
  setGlobal(updateTabState(global, { xydriveCreateState: { ownerId, requestId, status } }, tabId));
  if (status === 'limit' && isXydriveOpen(global, tabId, ownerId)) {
    actions.openLimitReachedModal({ limit: 'channels', tabId });
  }
});

addActionHandler('loadXydrivePage', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId(), shouldRefresh } = payload || {};
  const ownerId = global.currentUserId;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId)) return;

  const tab = global.byTabId[tabId];
  const sourceId = tab.xydriveSourceId || ownerId;
  const folder = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId).find(({ id }) => id === sourceId);
  if (sourceId !== ownerId && !folder) return;

  if (tab.xydrive?.status === 'loading') return;
  const previous = shouldRefresh ? undefined : tab.xydrive;
  if (previous?.status === 'ready' && previous.nextOffsetId === undefined) return;

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
  const files = result.messages.map((message) => getXydriveMediaFile(message, sourceId)).filter(Boolean);
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

addActionHandler('openXydriveMedia', async (global, actions, payload): Promise<void> => {
  const { fileId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId)) return;
  const tab = global.byTabId[tabId];
  if (tab.xydriveMediaRequest) return;
  const file = findDriveFile(global, tabId, ownerId, fileId);
  if (!file?.previewKind) return;
  const sourceId = file.chatId;

  const folder = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId).find(({ id }) => id === sourceId);
  if (sourceId !== ownerId && !folder) return;

  const id = ++nextRequestId;
  setGlobal(updateTabState(global, {
    xydriveMediaRequest: { id, fileId },
    xydriveMediaError: undefined,
  }, tabId));

  let result;
  try {
    result = await callApi('fetchXydriveMediaMessage', {
      messageId: file.messageId,
      channel: folder && buildXydriveChannel(folder),
    });
  } catch {
    result = undefined;
  }

  global = getGlobal();
  if (!isXydriveOpen(global, tabId, ownerId)) return;
  const currentTab = global.byTabId[tabId];
  if (currentTab.xydriveMediaRequest?.id !== id) return;
  const currentFile = findDriveFile(global, tabId, ownerId, fileId);
  const isMounted = sourceId === ownerId || getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId)
    .some((item) => item.id === sourceId);
  const refreshedFile = result?.type === 'message' ? getXydriveMediaFile(result.message, sourceId) : undefined;
  const isValid = currentFile && isMounted && refreshedFile && matchesXydriveMedia(file, refreshedFile)
    && matchesXydriveMedia(currentFile, refreshedFile);

  global = updateTabState(global, {
    xydriveMediaRequest: undefined,
    xydriveMediaError: isValid ? undefined : result?.type === 'wait' ? 'wait' : 'unavailable',
  }, tabId);

  if (!isValid || result?.type !== 'message') {
    // The original file may have been removed or changed since this page loaded.
    // Drop stale metadata/thumbnail for a definite mismatch, not a transient network error.
    if (currentTab.xydrive?.sourceId === sourceId && result?.type === 'channelUnavailable') {
      global = updateTabState(global, {
        xydrive: {
          ...currentTab.xydrive, files: [], scannedCount: 0, nextOffsetId: undefined,
          requestId: undefined, status: 'error', error: 'unavailable',
        },
      }, tabId);
    } else if (currentTab.xydrive?.sourceId === sourceId && (result?.type === 'unavailable' || result?.type === 'message')) {
      global = updateTabState(global, {
        xydrive: { ...currentTab.xydrive, files: currentTab.xydrive.files.filter((item) => item.id !== fileId) },
      }, tabId);
    }
    setGlobal(updateTabState(global, { xydriveIndex: undefined }, tabId));
    return;
  }

  if (result.chat) global = updateChat(global, result.chat.id, result.chat);
  if (!selectChat(global, sourceId)) {
    setGlobal(updateTabState(global, { xydriveMediaError: 'unavailable' }, tabId));
    return;
  }
  // Insert only the explicitly opened message into the native message store, not the entire drive history.
  global = replaceMessages(global, [result.message]);
  setGlobal(global);
  if (refreshedFile?.previewKind === 'viewer') {
    actions.openMediaViewer({
      chatId: sourceId, messageId: file.messageId, origin: MediaViewerOrigin.Xydrive, tabId,
    });
  } else if (refreshedFile?.previewKind === 'audio') {
    actions.openAudioPlayer({
      item: { type: 'message', chatId: sourceId, threadId: MAIN_THREAD_ID, messageId: file.messageId },
      source: { type: 'single' },
      tabId,
    });
  }
});


const SYNC_PAGE_BUDGET = 100;
const SYNC_FILE_LIMIT = 5000;

function findDriveFile(global: GlobalState, tabId: number, ownerId: string, id: string): XydriveFile | undefined {
  const tab = global.byTabId[tabId];
  const current = tab.xydrive?.ownerId === ownerId ? tab.xydrive.files.find((file) => file.id === id) : undefined;
  if (current) return current;
  if (tab.xydriveIndex?.ownerId !== ownerId) return undefined;
  const file = Object.values(tab.xydriveIndex.sources).flatMap((source) => source.files).find((item) => item.id === id);
  if (!file) return undefined;
  return file.chatId === ownerId || getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId)
    .some((folder) => folder.id === file.chatId) ? file : undefined;
}

addActionHandler('mutateXydriveFile', async (global, actions, payload): Promise<void> => {
  const { fileId, operation, destinationId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId) || global.byTabId[tabId].xydriveMutation?.status === 'working') return;
  const file = findDriveFile(global, tabId, ownerId, fileId);
  if (!file) return;
  const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  const source = folders.find(({ id }) => id === file.chatId);
  const destination = folders.find(({ id }) => id === destinationId);
  if ((file.chatId !== ownerId && !source) || (destinationId && !destination)
    || (operation === 'move' && file.chatId === (destinationId || ownerId))) return;
  const id = ++nextRequestId;
  setGlobal(updateTabState(global, { xydriveMutation: { id, fileId, status: 'working' } }, tabId));
  const result = await callApi('mutateXydriveFile', {
    ownerId, file, operation, source: source && buildXydriveChannel(source),
    destination: destination && buildXydriveChannel(destination),
  }).catch(() => undefined);
  global = getGlobal();
  if (global.currentUserId !== ownerId || global.byTabId[tabId]?.xydriveMutation?.id !== id) return;
  const tab = global.byTabId[tabId];
  const status = result?.status || 'error';
  if (status === 'complete') {
    const org = getOrganization(global.settings.byKey.xydriveOrganization, ownerId);
    const label = getFileLabel(org, file);
    const labels = { ...org.labels };
    delete labels[file.id];
    if (label && result?.copiedFile) labels[result.copiedFile.id] = { ...label, mediaId: result.copiedFile.mediaId };
    global = replaceSettings(global, { xydriveOrganization: { ...org, labels } });
    if (tab.xydrive?.sourceId === file.chatId) {
      global = updateTabState(global, { xydrive: { ...tab.xydrive,
        files: tab.xydrive.files.filter((item) => item.id !== fileId) } }, tabId);
    }
  }
  // Any mutation can change history; invalidate the scan rather than claiming its totals remain exact.
  setGlobal(updateTabState(global, { xydriveMutation: { id, fileId, status }, xydriveIndex: undefined }, tabId));
  if (isXydriveOpen(global, tabId, ownerId)) actions.loadXydrivePage({ shouldRefresh: true, tabId });
});

addActionHandler('syncXydriveIndex', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const ownerId = global.currentUserId;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId) || global.byTabId[tabId].xydriveIndex?.status === 'syncing') return;
  const requestId = ++nextRequestId;
  const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  const sources: Record<string, XydriveIndexSource> = {};
  let remaining = SYNC_PAGE_BUDGET;
  let count = 0;
  let failed = false;
  const stillActive = () => {
    const latest = getGlobal();
    return isXydriveOpen(latest, tabId, ownerId) && latest.byTabId[tabId].xydriveIndex?.requestId === requestId;
  };
  const publish = (status: 'syncing' | 'partial' | 'ready' | 'error') => {
    if (!stillActive()) return;
    setGlobal(updateTabState(getGlobal(), { xydriveIndex: { ownerId, sources: { ...sources }, status, requestId } }, tabId));
  };
  setGlobal(updateTabState(global, { xydriveIndex: { ownerId, sources: {}, status: 'syncing', requestId } }, tabId));
  for (const folder of [undefined, ...folders]) {
    if (!stillActive() || remaining <= 0 || count >= SYNC_FILE_LIMIT || failed) break;
    const sourceId = folder?.id || ownerId;
    let offsetId: number | undefined;
    let files: XydriveFile[] = [];
    let complete = false;
    do {
      if (!stillActive()) return;
      remaining--;
      const result = await callApi('fetchXydriveHistory', { offsetId, channel: folder && buildXydriveChannel(folder) })
        .catch(() => undefined);
      if (!stillActive()) return;
      if (result?.type !== 'page') { failed = true; break; }
      const next = result.messages.map((message) => getXydriveMediaFile(message, sourceId)).filter(Boolean);
      const merged = mergeXydriveFiles(files, next);
      count += merged.length - files.length;
      files = merged;
      complete = result.nextOffsetId === undefined;
      if (!complete && result.nextOffsetId === offsetId) { failed = true; break; }
      offsetId = result.nextOffsetId;
      sources[sourceId] = { files, complete, checkedAt: Date.now() };
      publish('syncing');
    } while (!complete && remaining > 0 && count < SYNC_FILE_LIMIT);
  }
  if (!stillActive()) return;
  const complete = [ownerId, ...folders.map(({ id }) => id)].every((id) => sources[id]?.complete);
  publish(complete ? 'ready' : failed && !Object.keys(sources).length ? 'error' : 'partial');
});
