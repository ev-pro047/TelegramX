import {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import { pick } from '../../util/iteratees';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import TrackingMonkey from '../common/TrackingMonkey';
import Button from '../ui/Button';
import InputText from '../ui/InputText';
import Loading from '../ui/Loading';

type StateProps = {
  auth: GlobalState['auth'];
};

const CODE_LENGTH = 5;

const AuthCode = ({
  auth,
}: StateProps) => {
  const {
    setAuthCode,
    returnToAuthPhoneNumber,
    clearAuthErrorKey,
  } = getActions();

  const { phoneNumber, isCodeViaApp, isLoading, errorKey } = auth;

  const lang = useLang();
  const inputRef = useRef<HTMLInputElement>();

  const [code, setCode] = useState<string>('');
  const [isTracking, setIsTracking] = useState(false);
  const [trackingDirection, setTrackingDirection] = useState(1);

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      inputRef.current!.focus();
    }
  }, []);

  useHistoryBack({
    isActive: true,
    onBack: returnToAuthPhoneNumber,
  });

  const onCodeChange = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    if (errorKey) {
      clearAuthErrorKey();
    }

    const { currentTarget: target } = e;
    target.value = target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);

    if (target.value === code) {
      return;
    }

    setCode(target.value);

    if (!isTracking) {
      setIsTracking(true);
    } else if (!target.value.length) {
      setIsTracking(false);
    }

    if (code && code.length > target.value.length) {
      setTrackingDirection(-1);
    } else {
      setTrackingDirection(1);
    }

    if (target.value.length === CODE_LENGTH) {
      setAuthCode({ code: target.value });
    }
  }, [errorKey, code, isTracking]);

  function handleReturnToAuthPhoneNumber() {
    returnToAuthPhoneNumber();
  }

  return (
    <div id="auth-code-form" className="custom-scroll">
      <div className="auth-form">
        <TrackingMonkey
          code={code}
          codeLength={CODE_LENGTH}
          isTracking={isTracking}
          trackingDirection={trackingDirection}
        />
        <h1>
          {phoneNumber}
          <Button
            round
            color="translucent"
            size="smaller"
            className="auth-number-edit"
            onClick={handleReturnToAuthPhoneNumber}
            ariaLabel={lang('WrongNumber')}
            iconName="edit"
          />
        </h1>
        <p className="note">
          {lang(isCodeViaApp ? 'SentAppCode' : 'LoginJustSentSms', undefined, {
            withNodes: true,
            withMarkdown: true,
          })}
        </p>
        <InputText
          ref={inputRef}
          id="sign-in-code"
          label={lang('Code')}
          onInput={onCodeChange}
          value={code}
          error={errorKey && lang.withRegular(errorKey)}
          autoComplete="one-time-code"
          inputMode="numeric"
        />
        {isLoading && <Loading />}
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => (
    pick(global, ['auth'])
  ),
)(AuthCode));
