import { memo, useEffect, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat } from '../../api/types';
import type { CloudSyncStatus } from '../../lib/xydrive/cloud';
import type {
  XydriveFile, XydriveFolderLabel, XydriveIndex, XydriveMount, XydriveMutation, XydriveOrganization, XydriveState,
} from '../../lib/xydrive/types';
import { MediaViewerOrigin } from '../../types';

import { getXydriveMounts } from '../../lib/xydrive/folders';
import { selectTabState } from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { Bundles } from '../../util/moduleLoader';
import { getInitialLocationHash } from '../../util/routing';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLastCallback from '../../hooks/useLastCallback';
import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

type StateProps = {
  isEnabled?: boolean;
  currentUserId?: string;
  accountName?: string;
  xydriveOwnerId?: string;
  cloudStatus?: CloudSyncStatus;
  isScreenLocked?: boolean;
  sourceId?: string;
  folders?: XydriveMount[];
  chats?: Record<string, ApiChat>;
  mountingId?: string;
  mountError?: 'wait' | 'generic' | 'unavailable';
  createStatus?: 'creating' | 'created' | 'error' | 'limit' | 'unverified';
  drive?: XydriveState;
  previewingId?: string;
  mediaError?: 'wait' | 'unavailable';
  textPreview?: { fileId: string; name: string; text: string };
  isViewerOpen?: boolean;
  isSynced?: boolean;
  organization?: XydriveOrganization;
  index?: XydriveIndex;
  mutation?: XydriveMutation;
  renameStatus?: { folderId: string; status: 'working' | 'complete' | 'error' | 'wait' };
};

const XydriveAsync = ({
  isEnabled, currentUserId, accountName, xydriveOwnerId, isScreenLocked, sourceId, folders, chats,
  mountingId, mountError, drive,
  previewingId, mediaError, textPreview, isViewerOpen, isSynced, createStatus,
  organization, index, mutation, renameStatus, cloudStatus,
}: StateProps) => {
  const {
    openXydrive, closeXydrive, openChat, focusMessage, loadXydrivePage, selectXydriveSource,
    mountXydriveChannel, unmountXydriveChannel, createXydriveFolder,
    openXydriveMedia, closeXydriveTextPreview, labelXydriveFile, labelXydriveFolder, setXydriveFolderParent,
    mutateXydriveFile, labelXydriveItems, renameXydriveFolder, syncXydriveIndex, cancelXydriveSync, syncXydriveCloud,
  } = getActions();
  const isOpen = Boolean(isEnabled && !isScreenLocked && currentUserId && xydriveOwnerId === currentUserId);
  const Xydrive = useModuleLoader(Bundles.Xydrive, 'Xydrive', !isOpen);
  const initialRouteHandledRef = useRef(false);

  useEffect(() => {
    if (initialRouteHandledRef.current || !isSynced || !currentUserId || isScreenLocked) return;
    initialRouteHandledRef.current = true;
    if (isEnabled && getInitialLocationHash() === '#xydrive' && !isOpen) openXydrive();
  }, [isSynced, currentUserId, isScreenLocked, isEnabled, isOpen, openXydrive]);

  useEffect(() => {
    if (xydriveOwnerId && !isOpen) closeXydrive();
  }, [xydriveOwnerId, isOpen, closeXydrive]);

  useEffect(() => {
    if (isOpen) loadXydrivePage();
  }, [isOpen, sourceId, loadXydrivePage]);

  useEffect(() => {
    if (!isOpen || !isSynced) return undefined;
    syncXydriveCloud();
    const timer = window.setInterval(() => syncXydriveCloud(), 60_000);
    return () => window.clearInterval(timer);
  }, [isOpen, isSynced, currentUserId, syncXydriveCloud]);

  useEffect(() => {
    if (!isOpen || cloudStatus !== 'synced') return undefined;
    const timer = window.setTimeout(() => syncXydriveCloud(), 1500);
    return () => window.clearTimeout(timer);
  }, [isOpen, folders, organization]);

  const handleLoadMore = useLastCallback(() => {
    if (isOpen) loadXydrivePage();
  });

  const handleRefresh = useLastCallback(() => {
    if (isOpen) loadXydrivePage({ shouldRefresh: true });
  });

  const handleCreate = useLastCallback((title: string, parentId?: string) => {
    if (isOpen) createXydriveFolder({ title, parentId });
  });
  const handleLabel = useLastCallback(
    (fileId: string, patch: { alias?: string; favorite?: boolean; pinned?: boolean }) => {
      if (isOpen) labelXydriveFile({ fileId, ...patch });
    },
  );
  const handleLabelFolder = useLastCallback((channelId: string, patch: XydriveFolderLabel) => {
    if (isOpen) labelXydriveFolder({ channelId, ...patch });
  });

  const handleBulkLabel = useLastCallback(
    (fileIds: string[], folderIds: string[], patch: { favorite?: boolean; pinned?: boolean }) => {
      if (isOpen) labelXydriveItems({ fileIds, folderIds, ...patch });
    },
  );
  const handleRenameFolder = useLastCallback((folderId: string, title: string) => {
    if (isOpen) renameXydriveFolder({ folderId, title });
  });
  const handleForward = useLastCallback((file: XydriveFile) => {
    if (isOpen) openXydriveMedia({ fileId: file.id, shouldForward: true });
  });

  const handleMutate = useLastCallback((fileIds: string[], operation: 'delete' | 'move', destinationId?: string) => {
    if (isOpen) mutateXydriveFile({ fileIds, operation, destinationId });
  });
  const handleReparent = useLastCallback((channelId: string, parentId?: string) => {
    if (isOpen) setXydriveFolderParent({ channelId, parentId });
  });

  const handleClose = useLastCallback(() => {
    closeXydrive();
  });

  useHistoryBack({ isActive: isOpen, hash: 'xydrive', onBack: handleClose });

  useEffect(() => (isOpen && !isViewerOpen
    ? captureKeyboardListeners({ onEsc: handleClose }) : undefined), [isOpen, isViewerOpen, handleClose]);

  const handleOpenSaved = useLastCallback(() => {
    if (!isOpen || !currentUserId) return;
    closeXydrive();
    openChat({ id: currentUserId, shouldReplaceHistory: true });
  });

  const handleOpenMessage = useLastCallback((file: XydriveFile) => {
    if (!isOpen || (file.chatId !== currentUserId && !folders?.some(({ id }) => id === file.chatId))) return;
    const matches = ({ id, mediaId }: XydriveFile) => id === file.id && mediaId === file.mediaId;
    const known = drive?.files.some(matches) || index?.sources[file.chatId]?.files.some(matches);
    if (!known) return;
    labelXydriveFile({ fileId: file.id, opened: true });
    closeXydrive();
    focusMessage({ chatId: file.chatId, messageId: file.messageId, shouldReplaceHistory: true });
  });

  const handlePreview = useLastCallback((file: XydriveFile) => {
    if (isOpen) {
      labelXydriveFile({ fileId: file.id, opened: true });
      openXydriveMedia({ fileId: file.id });
    }
  });

  const handleSelectSource = useLastCallback((channelId?: string) => {
    if (isOpen) selectXydriveSource({ channelId });
  });

  const handleMount = useLastCallback((channelId: string) => {
    if (isOpen) mountXydriveChannel({ channelId });
  });

  const handleUnmount = useLastCallback((channelId: string) => {
    if (isOpen) unmountXydriveChannel({ channelId });
  });

  if (!isOpen) return undefined;
  if (!Xydrive) return <section id="XydrivePage" className="xydrive-loading"><Loading /></section>;

  return (
    <Xydrive
      ownerId={isOpen ? currentUserId : undefined}
      accountName={accountName}
      drive={isOpen ? drive : undefined}
      sourceId={isOpen ? sourceId : undefined}
      folders={isOpen ? folders : undefined}
      chats={isOpen ? chats : undefined}
      mountingId={isOpen ? mountingId : undefined}
      mountError={isOpen ? mountError : undefined}
      onClose={handleClose}
      onOpenSaved={handleOpenSaved}
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
      onCreate={handleCreate}
      createStatus={createStatus}
      organization={organization}
      index={index}
      mutation={mutation}
      renameStatus={renameStatus}
      isNativeViewerOpen={isViewerOpen}
      onForward={handleForward}
      onBulkLabel={handleBulkLabel}
      onRenameFolder={handleRenameFolder}
      onLabel={handleLabel}
      onLabelFolder={handleLabelFolder}
      onMutate={handleMutate}
      onReparent={handleReparent}
      cloudStatus={cloudStatus}
      onCloudSync={(shouldCreate) => syncXydriveCloud({ shouldCreate })}
      onSync={() => syncXydriveIndex()}
      onCancelSync={() => cancelXydriveSync()}
      onOpenMessage={handleOpenMessage}
      onPreview={handlePreview}
      previewingId={isOpen ? previewingId : undefined}
      mediaError={isOpen ? mediaError : undefined}
      textPreview={textPreview}
      onCloseTextPreview={() => closeXydriveTextPreview()}
      onSelectSource={handleSelectSource}
      onMount={handleMount}
      onUnmount={handleUnmount}
    />
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const tab = selectTabState(global);
    const isEnabled = selectSharedSettings(global).isXydriveEnabled;
    const isOpen = Boolean(isEnabled && !global.passcode.isScreenLocked && global.currentUserId
      && tab.xydriveOwnerId === global.currentUserId);
    return {
      isEnabled,
      isSynced: global.isSynced,
      currentUserId: global.currentUserId,
      accountName: isOpen && global.currentUserId ? global.users.byId[global.currentUserId]?.firstName : undefined,
      xydriveOwnerId: tab.xydriveOwnerId,
      cloudStatus: isOpen ? tab.xydriveCloudStatus : undefined,
      isScreenLocked: global.passcode.isScreenLocked,
      sourceId: isOpen ? tab.xydriveSourceId : undefined,
      folders: isOpen ? getXydriveMounts(global.settings.byKey.xydriveMounts, global.currentUserId) : undefined,
      chats: isOpen ? global.chats.byId : undefined,
      mountingId: isOpen ? tab.xydriveMountRequest?.channelId : undefined,
      mountError: isOpen ? tab.xydriveMountError : undefined,
      createStatus: isOpen && tab.xydriveCreateState?.ownerId === global.currentUserId
        ? tab.xydriveCreateState?.status : undefined,
      drive: isOpen ? tab.xydrive : undefined,
      organization: isOpen && global.settings.byKey.xydriveOrganization?.ownerId === global.currentUserId
        ? global.settings.byKey.xydriveOrganization : undefined,
      index: isOpen && tab.xydriveIndex?.ownerId === global.currentUserId ? tab.xydriveIndex : undefined,
      mutation: isOpen && tab.xydriveMutation?.ownerId === global.currentUserId ? tab.xydriveMutation : undefined,
      renameStatus: isOpen ? tab.xydriveRename : undefined,
      previewingId: isOpen ? tab.xydriveMediaRequest?.fileId : undefined,
      mediaError: isOpen ? tab.xydriveMediaError : undefined,
      textPreview: isOpen ? tab.xydriveTextPreview : undefined,
      isViewerOpen: isOpen && tab.mediaViewer.origin === MediaViewerOrigin.Xydrive
        && Boolean(tab.mediaViewer.messageId) && !tab.mediaViewer.isHidden,
    };
  },
)(XydriveAsync));
