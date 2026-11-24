import { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { selectTabState } from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import { Bundles } from '../../util/moduleLoader';

import useLastCallback from '../../hooks/useLastCallback';
import useModuleLoader from '../../hooks/useModuleLoader';

type StateProps = {
  isEnabled?: boolean;
  currentUserId?: string;
  xydriveOwnerId?: string;
};

const XydriveAsync = ({ isEnabled, currentUserId, xydriveOwnerId }: StateProps) => {
  const { closeXydrive, openChat } = getActions();
  const isOpen = Boolean(isEnabled && currentUserId && xydriveOwnerId === currentUserId);
  const Xydrive = useModuleLoader(Bundles.Xydrive, 'Xydrive', !isOpen);

  useEffect(() => {
    if (xydriveOwnerId && !isOpen) {
      closeXydrive();
    }
  }, [xydriveOwnerId, isOpen, closeXydrive]);

  const handleClose = useLastCallback(() => {
    closeXydrive();
  });

  const handleOpenSaved = useLastCallback(() => {
    if (!isOpen || !currentUserId) return;
    closeXydrive();
    openChat({ id: currentUserId, shouldReplaceHistory: true });
  });

  return Xydrive ? (
    <Xydrive isOpen={isOpen} onClose={handleClose} onOpenSaved={handleOpenSaved} />
  ) : undefined;
};

export default memo(withGlobal(
  (global): Complete<StateProps> => ({
    isEnabled: selectSharedSettings(global).isXydriveEnabled,
    currentUserId: global.currentUserId,
    xydriveOwnerId: selectTabState(global).xydriveOwnerId,
  }),
)(XydriveAsync));
