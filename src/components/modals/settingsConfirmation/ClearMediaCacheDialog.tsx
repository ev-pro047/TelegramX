import { memo } from '../../../lib/teact/teact';

import { clearMediaCache } from '../../../util/settingsActions';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

const ClearMediaCacheDialog = ({ isOpen, onClose }: OwnProps) => {
  const lang = useLang();

  const handleConfirm = useLastCallback(() => {
    onClose();
    void clearMediaCache();
  });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      title={lang('SettingsDataClearMediaCache')}
      text={lang('SettingsDataClearCacheConfirmation')}
      confirmLabel={lang('Clear')}
      confirmHandler={handleConfirm}
      confirmIsDestructive
    />
  );
};

export default memo(ClearMediaCacheDialog);
