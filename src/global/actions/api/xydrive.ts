import type { GlobalState } from '../../types';
import type { XydriveFile, XydriveIndexSource } from '../../../lib/xydrive/types';
import { getOrganization, setFolderParent, getFileLabel } from '../../../lib/xydrive/organization';
import type { ApiChat } from '../../../api/types';
import type { CloudSyncStatus } from '../../../lib/xydrive/cloud';
import {
  applyCloudChanges, diffCloud, emptyCloudSnapshot, encodeCloudTransaction, makeCloudSnapshot,
  replayCloudJournal, sameCloudSnapshot, XYDRIVE_REGISTRY_TITLE,
} from '../../../lib/xydrive/cloud';
import { ApiMediaFormat, MAIN_THREAD_ID } from '../../../api/types';
import { MediaViewerOrigin } from '../../../types';

import { callApi } from '../../../api/gramjs';
import { canManageXydriveSource, MAX_XYDRIVE_MOVE_OR_DELETE } from '../../../lib/xydrive/collection';
import { decodeXydrivePreviewText, MAX_XYDRIVE_TEXT_PREVIEW_BYTES, mergeXydriveFiles } from '../../../lib/xydrive/fileMetadata';
import { getXydriveMediaFile, matchesXydriveMedia } from '../../../lib/xydrive/media';
import {
  buildXydriveChannel, getXydriveMounts, isXydriveChannelEligible, upsertXydriveMount,
} from '../../../lib/xydrive/folders';
import { getMediaHash } from '../../helpers/messageMedia';
import * as mediaLoader from '../../../util/mediaLoader';
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
  if (!channel || channel.title === XYDRIVE_REGISTRY_TITLE || !isXydriveChannelEligible(channel)) return;

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
    const index = global.byTabId[tabId].xydriveIndex;
    if (index?.ownerId === ownerId) {
      global = updateTabState(global, { xydriveIndex: { ownerId, sources: index.sources, status: 'partial' } }, tabId);
    }
  }
  setGlobal(global);
});

addActionHandler('createXydriveFolder', async (global, actions, payload): Promise<void> => {
  const { title, parentId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  const name = title.trim();
  if (parentId && !getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId).some(({ id }) => id === parentId)) return;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId) || !name || name.length > 128 || name === XYDRIVE_REGISTRY_TITLE
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
    const nextFolders = upsertXydriveMount(folders, { ...verified, isManaged: true });
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
  const { fileId, shouldForward, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId)) return;
  const tab = global.byTabId[tabId];
  if (tab.xydriveMediaRequest) return;
  const file = findDriveFile(global, tabId, ownerId, fileId);
  if (!file || (!file.previewKind && !shouldForward)) return;
  const sourceId = file.chatId;

  const folder = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId).find(({ id }) => id === sourceId);
  if (sourceId !== ownerId && !folder) return;

  const id = ++nextRequestId;
  setGlobal(updateTabState(global, {
    xydriveTextPreview: undefined,
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
    const index = currentTab.xydriveIndex;
    if (index?.ownerId === ownerId && (result?.type === 'channelUnavailable'
      || result?.type === 'unavailable' || result?.type === 'message')) {
      const sources = { ...index.sources };
      delete sources[sourceId];
      global = updateTabState(global, { xydriveIndex: { ownerId, sources, status: 'partial' } }, tabId);
    }
    setGlobal(global);
    return;
  }

  if (result.chat) global = updateChat(global, result.chat.id, result.chat);
  if (!selectChat(global, sourceId)) {
    setGlobal(updateTabState(global, { xydriveMediaError: 'unavailable' }, tabId));
    return;
  }
  if (!shouldForward && refreshedFile?.previewKind === 'text') {
    const document = result.message.content.document;
    const hash = document && getMediaHash(document, 'download');
    setGlobal(updateTabState(global, { xydriveMediaRequest: { id, fileId } }, tabId));
    const text = hash ? await fetchXydriveText(hash) : undefined;
    global = getGlobal();
    if (!isXydriveOpen(global, tabId, ownerId) || global.byTabId[tabId].xydriveMediaRequest?.id !== id) return;
    setGlobal(updateTabState(global, {
      xydriveMediaRequest: undefined,
      xydriveMediaError: text === undefined ? 'unavailable' : undefined,
      xydriveTextPreview: text === undefined ? undefined : { fileId, name: file.name, text },
    }, tabId));
    return;
  }
  // Insert only the explicitly opened message into the native message store, not the entire drive history.
  global = replaceMessages(global, [result.message]);
  setGlobal(global);
  if (shouldForward) {
    actions.closeXydrive({ tabId });
    actions.openForwardMenu({ fromChatId: sourceId, messageIds: [file.messageId], tabId });
  } else if (refreshedFile?.previewKind === 'viewer') {
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


async function fetchXydriveText(hash: string): Promise<string | undefined> {
  try {
    const url = await mediaLoader.fetch(hash, ApiMediaFormat.BlobUrl);
    if (typeof url !== 'string' || !url.startsWith('blob:')) return undefined;
    const blob = await (await fetch(url)).blob();
    if (blob.size > MAX_XYDRIVE_TEXT_PREVIEW_BYTES) return undefined;
    return decodeXydrivePreviewText(await blob.arrayBuffer());
  } catch {
    return undefined;
  }
}

const SYNC_PAGE_BUDGET = 100;
const SYNC_FILE_LIMIT = 20000;

function findDriveFile(global: GlobalState, tabId: number, ownerId: string, id: string): XydriveFile | undefined {
  const tab = global.byTabId[tabId];
  const current = tab.xydrive?.ownerId === ownerId ? tab.xydrive.files.find((file) => file.id === id) : undefined;
  if (current) return current;
  if (tab.xydriveIndex?.ownerId !== ownerId) return undefined;
  const sourceId = id.split(':', 1)[0];
  const file = tab.xydriveIndex.sources[sourceId]?.files.find((item) => item.id === id);
  if (!file) return undefined;
  return file.chatId === ownerId || getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId)
    .some((folder) => folder.id === file.chatId) ? file : undefined;
}

addActionHandler('renameXydriveFolder', async (global, actions, payload): Promise<void> => {
  const { folderId, title, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  const name = title.trim();
  if (!ownerId || !name || name.length > 128 || !isXydriveOpen(global, tabId, ownerId)
    || global.byTabId[tabId].xydriveRename?.status === 'working') return;
  const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  const folder = folders.find(({ id, isManaged }) => id === folderId && isManaged);
  if (!folder) return;
  setGlobal(updateTabState(global, { xydriveRename: { folderId, status: 'working' } }, tabId));
  const result = await callApi('renameXydriveChannel', {
    ownerId, channel: buildXydriveChannel(folder), title: name,
  }).catch(() => undefined);
  global = getGlobal();
  if (!isXydriveOpen(global, tabId, ownerId) || global.byTabId[tabId].xydriveRename?.folderId !== folderId) return;
  const current = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  const status = result?.type === 'channel' ? 'complete' : result?.type === 'wait' ? 'wait' : 'error';
  if (result?.type === 'channel' && current.some(({ id, isManaged }) => id === folderId && isManaged)) {
    global = replaceSettings(global, { xydriveMounts: { ownerId, folders: upsertXydriveMount(current, result.folder) } });
  }
  setGlobal(updateTabState(global, { xydriveRename: { folderId, status } }, tabId));
});

addActionHandler('mutateXydriveFile', async (global, actions, payload): Promise<void> => {
  const { fileIds, operation, destinationId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId)
    || (global.byTabId[tabId].xydriveMutation?.ownerId === ownerId
      && global.byTabId[tabId].xydriveMutation?.status === 'working')) return;
  const ids = [...new Set(fileIds)];
  const id = ++nextRequestId;
  let mutation: NonNullable<GlobalState['byTabId'][number]['xydriveMutation']> = {
    id, ownerId, total: ids.length, completed: 0, status: 'working',
  };
  const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  const targetId = destinationId || ownerId;
  const queue = ids.map((fileId) => findDriveFile(global, tabId, ownerId, fileId));
  if (!ids.length || ids.length > MAX_XYDRIVE_MOVE_OR_DELETE
    || queue.some((file) => !file || !canManageXydriveSource(file.chatId, ownerId, folders)
      || (operation === 'move' && file.chatId === targetId))
    || (operation === 'move' && !canManageXydriveSource(targetId, ownerId, folders))) {
    setGlobal(updateTabState(global, { xydriveMutation: { ...mutation, status: 'unavailable' } }, tabId));
    return;
  }
  setGlobal(updateTabState(global, { xydriveMutation: mutation }, tabId));

  for (const preflight of queue) {
    global = getGlobal();
    const tab = global.byTabId[tabId];
    if (!tab || global.currentUserId !== ownerId || tab.xydriveMutation?.id !== id) return;
    const currentFolders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
    const file = preflight!;
    const source = currentFolders.find(({ id: channelId }) => channelId === file.chatId && file.chatId !== ownerId);
    const destination = destinationId && currentFolders.find(({ id: channelId }) => channelId === destinationId);
    if (!isXydriveOpen(global, tabId, ownerId) || (file.chatId !== ownerId && !source?.isManaged)
      || (destinationId && (!destination || !destination.isManaged))) {
      mutation = { ...mutation, status: 'unavailable' };
      break;
    }

    const result = await callApi('mutateXydriveFile', {
      ownerId, file, operation, source: source && buildXydriveChannel(source),
      destination: destination ? buildXydriveChannel(destination) : undefined,
    }).catch(() => undefined);
    global = getGlobal();
    if (global.currentUserId !== ownerId || global.byTabId[tabId]?.xydriveMutation?.id !== id) return;
    const latestTab = global.byTabId[tabId];
    const status = result?.status || 'error';
    if (status === 'complete') {
      const org = getOrganization(global.settings.byKey.xydriveOrganization, ownerId);
      const label = getFileLabel(org, file);
      const labels = { ...org.labels };
      delete labels[file.id];
      if (label && result?.copiedFile) labels[result.copiedFile.id] = { ...label, mediaId: result.copiedFile.mediaId };
      global = replaceSettings(global, { xydriveOrganization: { ...org, labels } });
      if (latestTab.xydrive?.sourceId === file.chatId) {
        global = updateTabState(global, {
          xydrive: { ...latestTab.xydrive, files: latestTab.xydrive.files.filter(({ id: fileId }) => fileId !== file.id) },
        }, tabId);
      }
    }
    const index = latestTab.xydriveIndex;
    const snapshots = index?.ownerId === ownerId ? { ...index.sources } : undefined;
    if (snapshots) {
      delete snapshots[file.chatId];
      if (operation === 'move') delete snapshots[targetId];
    }
    mutation = status === 'complete' ? { ...mutation, completed: mutation.completed + 1 } : { ...mutation, status };
    setGlobal(updateTabState(global, {
      xydriveMutation: mutation,
      xydriveIndex: snapshots ? { ownerId, sources: snapshots, status: 'partial' } : undefined,
    }, tabId));
    if (status !== 'complete') break;
  }

  setGlobal(updateTabState(getGlobal(), {
    xydriveMutation: mutation.completed === mutation.total ? { ...mutation, status: 'complete' } : mutation,
  }, tabId));
  if (isXydriveOpen(getGlobal(), tabId, ownerId)) actions.loadXydrivePage({ shouldRefresh: true, tabId });
});

addActionHandler('syncXydriveIndex', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const ownerId = global.currentUserId;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId) || global.byTabId[tabId].xydriveIndex?.status === 'syncing') return;
  const requestId = ++nextRequestId;
  const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  const previous = global.byTabId[tabId].xydriveIndex;
  const sources: Record<string, XydriveIndexSource> = previous?.ownerId === ownerId && previous.status === 'partial'
    ? Object.fromEntries(Object.entries(previous.sources).filter(([id]) => id === ownerId || folders.some((folder) => folder.id === id))) : {};
  let remaining = SYNC_PAGE_BUDGET;
  let activeSourceId: string | undefined;
  let count = Object.values(sources).reduce((sum, source) => sum + source.files.length, 0);
  let failed = false;
  const stillActive = () => {
    const latest = getGlobal();
    return isXydriveOpen(latest, tabId, ownerId) && latest.byTabId[tabId].xydriveIndex?.requestId === requestId;
  };
  const publish = (status: 'syncing' | 'partial' | 'ready' | 'error' | 'limited') => {
    if (!stillActive()) return;
    setGlobal(updateTabState(getGlobal(), { xydriveIndex: {
      ownerId, sources: { ...sources }, status, requestId,
      scan: { sourceId: activeSourceId, pages: SYNC_PAGE_BUDGET - remaining },
    } }, tabId));
  };
  setGlobal(updateTabState(global, { xydriveIndex: { ownerId, sources: { ...sources }, status: 'syncing', requestId } }, tabId));
  for (const folder of [undefined, ...folders]) {
    if (!stillActive() || remaining <= 0 || count >= SYNC_FILE_LIMIT || failed) break;
    const sourceId = folder?.id || ownerId;
    activeSourceId = sourceId;
    if (sources[sourceId]?.complete) continue;
    let offsetId = sources[sourceId]?.nextOffsetId;
    let files = sources[sourceId]?.files || [];
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
      sources[sourceId] = { files, complete, checkedAt: Date.now(), nextOffsetId: offsetId };
      publish('syncing');
    } while (!complete && remaining > 0 && count < SYNC_FILE_LIMIT);
  }
  if (!stillActive()) return;
  const complete = [ownerId, ...folders.map(({ id }) => id)].every((id) => sources[id]?.complete);
  if (complete) publish('ready');
  else if (count >= SYNC_FILE_LIMIT) publish('limited');
  else if (failed && !Object.keys(sources).length) publish('error');
  else publish('partial');
});

const cloudBusy = new Set<string>();
const registryByAccount = new Map<string, ApiChat>();

function getLocalCloudSnapshot(global: GlobalState, ownerId: string) {
  return makeCloudSnapshot(getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId),
    getOrganization(global.settings.byKey.xydriveOrganization, ownerId));
}

addActionHandler('syncXydriveCloud', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId(), shouldCreate } = payload || {};
  const ownerId = global.currentUserId;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId) || cloudBusy.has(ownerId)) return;
  if (shouldCreate && global.byTabId[tabId].xydriveCloudStatus !== 'setup') return;
  cloudBusy.add(ownerId);
  const active = () => isXydriveOpen(getGlobal(), tabId, ownerId);
  const status = (value: CloudSyncStatus) => {
    if (active()) setGlobal(updateTabState(getGlobal(), { xydriveCloudStatus: value }, tabId));
  };
  status('checking');
  try {
    let channel = registryByAccount.get(ownerId);
    if (!channel || shouldCreate) {
      const discovered = await callApi('discoverXydriveRegistry', { ownerId });
      if (!active()) return;
      if (discovered?.status === 'conflict') { status('conflict'); return; }
      if (discovered?.status === 'error' || !discovered) { status('error'); return; }
      if (discovered.status === 'found') channel = discovered.channel;
      else if (shouldCreate) {
        const created = await callApi('createXydriveRegistry', { ownerId });
        if (!active()) return;
        channel = created?.channel;
        if (!channel) { status('error'); return; }
        setGlobal(updateChat(getGlobal(), channel.id, channel));
      } else {
        status(getGlobal().settings.byKey.xydriveCloudBase?.ownerId === ownerId ? 'error' : 'setup');
        return;
      }
      registryByAccount.set(ownerId, channel);
    }
    status('syncing');
    const records = await callApi('readXydriveRegistry', { ownerId, channel });
    if (!active()) return;
    if (!records) { registryByAccount.delete(ownerId); status('error'); return; }
    const remote = replayCloudJournal(ownerId, records);
    if (remote.status !== 'ready') { status('conflict'); return; }
    global = getGlobal();
    const local = getLocalCloudSnapshot(global, ownerId);
    const cached = global.settings.byKey.xydriveCloudBase;
    if (cached?.ownerId === ownerId && cached.registryId !== channel.id) { status('conflict'); return; }
    const baseline = cached?.ownerId === ownerId ? cached.snapshot : emptyCloudSnapshot();
    const changes = diffCloud(baseline, local);
    // A fresh login has an empty local snapshot; never treat it as a deletion of remote metadata.
    const merged = applyCloudChanges(remote.snapshot, changes);
    if (!merged) { status('conflict'); return; }
    const pending = diffCloud(remote.snapshot, merged);
    let confirmed = remote.snapshot;
    if (pending.length) {
      const tx = crypto.randomUUID();
      const encoded = encodeCloudTransaction(ownerId, tx, pending);
      if (!active() || !sameCloudSnapshot(local, getLocalCloudSnapshot(getGlobal(), ownerId))) {
        status('error'); return;
      }
      const sent = await callApi('appendXydriveRegistry', { ownerId, channel, records: encoded });
      if (!active()) return;
      // Even ambiguous sends are reconciled only from a confirmed server read; never overwrite a snapshot.
      const refreshed = await callApi('readXydriveRegistry', { ownerId, channel });
      if (!active()) return;
      if (!refreshed) { status('error'); return; }
      const replayed = replayCloudJournal(ownerId, refreshed);
      if (replayed.status !== 'ready') { status('conflict'); return; }
      confirmed = replayed.snapshot;
      if (!sent || diffCloud(remote.snapshot, merged).some((change) =>
        !applyCloudChanges(confirmed, [{ ...change, before: change.after }]))) { status('error'); return; }
    }
    global = getGlobal();
    const newer = getLocalCloudSnapshot(global, ownerId);
    const final = applyCloudChanges(confirmed, diffCloud(local, newer));
    if (!final) { status('conflict'); return; }
    if (final.folders[channel.id]) { status('conflict'); return; }
    global = replaceSettings(global, {
      xydriveMounts: { ownerId, folders: Object.values(final.folders) },
      xydriveOrganization: { ownerId, parents: final.parents, labels: final.labels, folderLabels: final.folderLabels },
      xydriveCloudBase: { ownerId, registryId: channel.id, snapshot: confirmed },
    });
    for (const tab of Object.values(global.byTabId)) {
      if (tab.xydriveOwnerId !== ownerId) continue;
      if (tab.xydriveSourceId && !final.folders[tab.xydriveSourceId]) {
        global = updateTabState(global, { xydriveSourceId: undefined, xydrive: undefined }, tab.id);
      }
      if (!sameCloudSnapshot(local, final)) {
        global = updateTabState(global, { xydriveIndex: undefined }, tab.id);
      }
    }
    setGlobal(updateTabState(global, { xydriveCloudStatus: sameCloudSnapshot(final, confirmed) ? 'synced' : 'error' }, tabId));
  } catch {
    status('error');
  } finally {
    cloudBusy.delete(ownerId);
  }
});
