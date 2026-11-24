import { memo, useEffect, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat } from '../../api/types';
import type { XydriveFile, XydriveIndex, XydriveMount, XydriveMutationStatus, XydriveOrganization, XydriveState } from '../../lib/xydrive/types';
import { MediaViewerOrigin } from '../../types';

import { selectTabState } from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import { getXydriveMounts } from '../../lib/xydrive/folders';
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
  xydriveOwnerId?: string;
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
  isViewerOpen?: boolean;
  isSynced?: boolean;
  organization?: XydriveOrganization;
  index?: XydriveIndex;
  mutationStatus?: XydriveMutationStatus;
};

const XydriveAsync = ({
  isEnabled, currentUserId, xydriveOwnerId, isScreenLocked, sourceId, folders, chats, mountingId, mountError, drive,
  previewingId, mediaError, isViewerOpen, isSynced, createStatus, organization, index, mutationStatus,
}: StateProps) => {
  const {
    openXydrive, closeXydrive, openChat, focusMessage, loadXydrivePage, selectXydriveSource,
    mountXydriveChannel, unmountXydriveChannel, createXydriveFolder,
    openXydriveMedia, labelXydriveFile, setXydriveFolderParent, mutateXydriveFile, syncXydriveIndex, cancelXydriveSync,
  } = getActions();
  const isOpen = Boolean(isEnabled && !isScreenLocked && currentUserId && xydriveOwnerId === currentUserId);
  const Xydrive = useModuleLoader(Bundles.Xydrive, 'Xydrive', !isOpen);
  const initialRouteHandled = useRef(false);

  useEffect(() => {
    if (initialRouteHandled.current || !isSynced || !currentUserId || isScreenLocked) return;
    initialRouteHandled.current = true;
    if (isEnabled && getInitialLocationHash() === '#xydrive' && !isOpen) openXydrive();
  }, [isSynced, currentUserId, isScreenLocked, isEnabled, isOpen, openXydrive]);

  useEffect(() => {
    if (xydriveOwnerId && !isOpen) closeXydrive();
  }, [xydriveOwnerId, isOpen, closeXydrive]);

  useEffect(() => {
    if (isOpen) loadXydrivePage();
  }, [isOpen, sourceId, loadXydrivePage]);

  const handleLoadMore = useLastCallback(() => {
    if (isOpen) loadXydrivePage();
  });

  const handleRefresh = useLastCallback(() => {
    if (isOpen) loadXydrivePage({ shouldRefresh: true });
  });

  const handleCreate = useLastCallback((title: string, parentId?: string) => {
    if (isOpen) createXydriveFolder({ title, parentId });
  });
  const handleLabel = useLastCallback((fileId: string, patch: { alias?: string; favorite?: boolean; pinned?: boolean; opened?: boolean }) => {
    if (isOpen) labelXydriveFile({ fileId, ...patch });
  });
  const handleMutate = useLastCallback((fileId: string, operation: 'delete' | 'move', destinationId?: string) => {
    if (isOpen) mutateXydriveFile({ fileId, operation, destinationId });
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
    const known = [...(drive?.files || []), ...(index?.sources[file.chatId]?.files || [])].some(({ id, mediaId }) => id === file.id && mediaId === file.mediaId);
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
      isOpen={isOpen}
      ownerId={isOpen ? currentUserId : undefined}
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
      mutationStatus={mutationStatus}
      onLabel={handleLabel}
      onMutate={handleMutate}
      onReparent={handleReparent}
      onSync={() => syncXydriveIndex()}
      onCancelSync={() => cancelXydriveSync()}
      onOpenMessage={handleOpenMessage}
      onPreview={handlePreview}
      previewingId={isOpen ? previewingId : undefined}
      mediaError={isOpen ? mediaError : undefined}
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
      xydriveOwnerId: tab.xydriveOwnerId,
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
      mutationStatus: isOpen ? tab.xydriveMutation?.status : undefined,
      previewingId: isOpen ? tab.xydriveMediaRequest?.fileId : undefined,
      mediaError: isOpen ? tab.xydriveMediaError : undefined,
      isViewerOpen: isOpen && tab.mediaViewer.origin === MediaViewerOrigin.Xydrive
        && Boolean(tab.mediaViewer.messageId) && !tab.mediaViewer.isHidden,
    };
  },
)(XydriveAsync));
