import { memo, useEffect, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat } from '../../api/types';
import type { XydriveFile, XydriveMount, XydriveState } from '../../lib/xydrive/types';
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
  drive?: XydriveState;
  previewingId?: string;
  mediaError?: 'wait' | 'unavailable';
  isViewerOpen?: boolean;
  isSynced?: boolean;
};

const XydriveAsync = ({
  isEnabled, currentUserId, xydriveOwnerId, isScreenLocked, sourceId, folders, chats, mountingId, mountError, drive,
  previewingId, mediaError, isViewerOpen, isSynced,
}: StateProps) => {
  const {
    openXydrive, closeXydrive, openChat, focusMessage, loadXydrivePage, selectXydriveSource,
    mountXydriveChannel, unmountXydriveChannel,
    openXydriveMedia,
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
    if (!isOpen || !drive || drive.ownerId !== currentUserId || drive.sourceId !== (sourceId || currentUserId)
      || !drive.files.some(({ id, chatId, messageId }) => id === file.id && chatId === file.chatId
        && messageId === file.messageId)) return;
    closeXydrive();
    focusMessage({ chatId: file.chatId, messageId: file.messageId, shouldReplaceHistory: true });
  });

  const handlePreview = useLastCallback((file: XydriveFile) => {
    if (isOpen) openXydriveMedia({ fileId: file.id });
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
      drive: isOpen ? tab.xydrive : undefined,
      previewingId: isOpen ? tab.xydriveMediaRequest?.fileId : undefined,
      mediaError: isOpen ? tab.xydriveMediaError : undefined,
      isViewerOpen: isOpen && tab.mediaViewer.origin === MediaViewerOrigin.Xydrive
        && Boolean(tab.mediaViewer.messageId) && !tab.mediaViewer.isHidden,
    };
  },
)(XydriveAsync));
