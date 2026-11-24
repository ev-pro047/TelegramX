import { memo } from '../../lib/teact/teact';

import type { XydriveCategory, XydriveFile, XydriveState } from '../../lib/xydrive/types';
import type { IconName } from '../../types/icons';
import type { RegularLangKey } from '../../types/language';

import { formatFileSize } from '../../util/text/textFormat';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import Modal from '../ui/Modal';

import styles from './Xydrive.module.scss';

type OwnProps = {
  isOpen: boolean;
  drive?: XydriveState;
  onClose: NoneToVoidFunction;
  onOpenSaved: NoneToVoidFunction;
  onLoadMore: NoneToVoidFunction;
};

const CATEGORY_LABELS: Record<XydriveCategory, RegularLangKey> = {
  images: 'XydriveImages',
  videos: 'XydriveVideos',
  audio: 'XydriveAudio',
  documents: 'XydriveDocuments',
  archives: 'XydriveArchives',
  other: 'XydriveOther',
};

const CATEGORY_ICONS: Record<XydriveCategory, IconName> = {
  images: 'sd-photo',
  videos: 'video',
  audio: 'music',
  documents: 'document',
  archives: 'archive',
  other: 'file-badge',
};

const XydriveFileRow = memo(({ file }: { file: XydriveFile }) => {
  const lang = useLang();
  const size = file.size === undefined ? lang('XydriveUnknownSize') : formatFileSize(lang, file.size);

  return (
    <li className={styles.fileRow}>
      <Icon name={CATEGORY_ICONS[file.category]} className={styles.fileIcon} />
      <div className={styles.fileInfo}>
        <span className={styles.fileName} dir="auto">{file.name}</span>
        <span className={styles.fileMeta}>{lang(CATEGORY_LABELS[file.category])} · {size}</span>
      </div>
    </li>
  );
});

const Xydrive = ({
  isOpen, drive, onClose, onOpenSaved, onLoadMore,
}: OwnProps) => {
  const lang = useLang();
  const files = drive?.files;
  const isLoading = !drive || drive.status === 'loading';
  const hasError = drive?.status === 'error';
  const hasMore = drive?.nextOffsetId !== undefined;

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
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.badge}>{lang('XydriveBeta')}</span>
            <h2 className={styles.heading}>{lang('XydriveSavedFiles')}</h2>
            <p className={styles.description}>{lang('XydriveHistoryDesc')}</p>
          </div>
          <Button size="smaller" color="translucent" onClick={onOpenSaved}>
            {lang('XydriveOpenSaved')}
          </Button>
        </div>
        {Boolean(files?.length) && (
          <ul className={styles.fileList}>
            {files!.map((file) => <XydriveFileRow key={file.id} file={file} />)}
          </ul>
        )}
        <div className={styles.status} aria-live="polite">
          {isLoading && <Loading />}
          {hasError && (
            <p className={styles.description}>
              {lang(drive?.error === 'wait' ? 'XydriveWait' : 'XydriveLoadError')}
            </p>
          )}
          {!isLoading && !hasError && !files?.length && (
            <p className={styles.description}>
              {lang(hasMore ? 'XydriveNoFilesYet' : 'XydriveEmpty')}
            </p>
          )}
          {!isLoading && !hasError && Boolean(files?.length) && !hasMore && (
            <p className={styles.description}>{lang('XydriveEnd')}</p>
          )}
          {!isLoading && (hasError || hasMore) && (
            <Button color="translucent" onClick={onLoadMore}>
              {lang(hasError ? 'XydriveRetry' : 'XydriveLoadMore')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default memo(Xydrive);
