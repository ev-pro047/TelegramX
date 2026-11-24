import { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { XydriveState } from '../../lib/xydrive/types';

import { selectTabState } from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import { Bundles } from '../../util/moduleLoader';

import useLastCallback from '../../hooks/useLastCallback';
import useModuleLoader from '../../hooks/useModuleLoader';

type StateProps = {
  isEnabled?: boolean;
  currentUserId?: string;
  xydriveOwnerId?: string;
  isScreenLocked?: boolean;
  drive?: XydriveState;
};

const XydriveAsync = ({
  isEnabled, currentUserId, xydriveOwnerId, isScreenLocked, drive,
}: StateProps) => {
  const { closeXydrive, openChat, loadXydrivePage } = getActions();
  const isOpen = Boolean(isEnabled && !isScreenLocked && currentUserId && xydriveOwnerId === currentUserId);
  const Xydrive = useModuleLoader(Bundles.Xydrive, 'Xydrive', !isOpen);

  useEffect(() => {
    if (xydriveOwnerId && !isOpen) {
      closeXydrive();
    }
  }, [xydriveOwnerId, isOpen, closeXydrive]);

  useEffect(() => {
    if (isOpen) loadXydrivePage();
  }, [isOpen, loadXydrivePage]);

  const handleLoadMore = useLastCallback(() => {
    if (isOpen) loadXydrivePage();
  });

  const handleClose = useLastCallback(() => {
    closeXydrive();
  });

  const handleOpenSaved = useLastCallback(() => {
    if (!isOpen || !currentUserId) return;
    closeXydrive();
    openChat({ id: currentUserId, shouldReplaceHistory: true });
  });

  return Xydrive ? (
    <Xydrive
      isOpen={isOpen}
      drive={isOpen ? drive : undefined}
      onClose={handleClose}
      onOpenSaved={handleOpenSaved}
      onLoadMore={handleLoadMore}
    />
  ) : undefined;
};

export default memo(withGlobal(
  (global): Complete<StateProps> => ({
    isEnabled: selectSharedSettings(global).isXydriveEnabled,
    currentUserId: global.currentUserId,
    xydriveOwnerId: selectTabState(global).xydriveOwnerId,
    isScreenLocked: global.passcode.isScreenLocked,
    drive: selectTabState(global).xydrive,
  }),
)(XydriveAsync));
