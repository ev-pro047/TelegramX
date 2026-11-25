import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { DEBUG_LOG_FILENAME } from '../../../config';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { getDebugLogs } from '../../../util/debugConsole';
import download from '../../../util/download';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Island from '../../gili/layout/Island';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  shouldForceHttpTransport?: boolean;
  shouldAllowHttpTransport?: boolean;
  shouldCollectDebugLogs?: boolean;
  isXydriveEnabled?: boolean;
  shouldDebugExportedSenders?: boolean;
};

const SettingsExperimental = ({
  isActive,
  shouldForceHttpTransport,
  shouldAllowHttpTransport,
  shouldCollectDebugLogs,
  shouldDebugExportedSenders,
  isXydriveEnabled,
  onReset,
}: OwnProps & StateProps) => {
  const { setSharedSettingOption } = getActions();

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleDownloadLog = useLastCallback(() => {
    const file = new File([getDebugLogs()], DEBUG_LOG_FILENAME, { type: 'text/plain' });
    const url = URL.createObjectURL(file);
    download(url, DEBUG_LOG_FILENAME);
  });

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Experimental}
          size={200}
          className="experimental-duck"
          nonInteractive
          noLoop={false}
        />
      </div>
      <Island>
        <Checkbox
          label={lang('XydriveEnable')}
          subLabel={lang('XydriveExperimentalDesc')}
          checked={Boolean(isXydriveEnabled)}
          onCheck={(isChecked) => setSharedSettingOption({ isXydriveEnabled: isChecked })}
        />
      </Island>
      <Island>
        <Checkbox
          label={lang('SettingsAllowHttp')}
          checked={Boolean(shouldAllowHttpTransport)}
          onCheck={() => setSharedSettingOption({ shouldAllowHttpTransport: !shouldAllowHttpTransport })}
        />
        <Checkbox
          label={lang('SettingsForceHttp')}
          disabled={!shouldAllowHttpTransport}
          checked={Boolean(shouldForceHttpTransport)}
          onCheck={() => setSharedSettingOption({ shouldForceHttpTransport: !shouldForceHttpTransport })}
        />
      </Island>
      <Island>
        <Checkbox
          label={lang('DebugMenuEnableLogs')}
          checked={Boolean(shouldCollectDebugLogs)}
          onCheck={() => setSharedSettingOption({ shouldCollectDebugLogs: !shouldCollectDebugLogs })}
        />
        <Checkbox
          label={lang('DebugExportedSenders')}
          checked={Boolean(shouldDebugExportedSenders)}
          onCheck={() => setSharedSettingOption({ shouldDebugExportedSenders: !shouldDebugExportedSenders })}
        />
        <ListItem
          onClick={handleDownloadLog}
          icon="bug"
        >
          <div className="title">{lang('DebugDownloadLog')}</div>
        </ListItem>
      </Island>
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const {
      shouldForceHttpTransport,
      shouldAllowHttpTransport,
      shouldCollectDebugLogs,
      shouldDebugExportedSenders,
      isXydriveEnabled,
    } = selectSharedSettings(global);

    return {
      shouldForceHttpTransport,
      shouldAllowHttpTransport,
      shouldCollectDebugLogs,
      shouldDebugExportedSenders,
      isXydriveEnabled,
    };
  },
)(SettingsExperimental));
