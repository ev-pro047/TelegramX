import { memo } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

import styles from './Xydrive.module.scss';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
  onOpenSaved: NoneToVoidFunction;
};

const Xydrive = ({ isOpen, onClose, onOpenSaved }: OwnProps) => {
  const lang = useLang();

  return (
    <Modal
      isOpen={isOpen}
      title={lang('XydriveTitle')}
      dialogClassName={styles.dialog}
      hasCloseButton
      isBackButton
      onClose={onClose}
    >
      <div className={styles.workspace} dir={lang.isRtl ? 'rtl' : 'ltr'}>
        <div className={styles.intro}>
          <div className={styles.iconBackdrop}>
            <Icon name="folder" className={styles.icon} />
          </div>
          <span className={styles.badge}>{lang('XydriveBeta')}</span>
          <h2 className={styles.heading}>{lang('XydriveWelcome')}</h2>
          <p className={styles.description}>{lang('XydriveFoundationDesc')}</p>
          <Button className={styles.action} onClick={onOpenSaved}>
            {lang('XydriveOpenSaved')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(Xydrive);
