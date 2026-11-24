import { memo, useRef } from '../../lib/teact/teact';

import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { XydriveItem } from '../../lib/xydrive/collection';
import type { XydriveFile } from '../../lib/xydrive/types';

import { CATEGORY_LABELS, getFileIcon, summarizeXydriveItems } from '../../lib/xydrive/collection';
import { formatFileSize } from '../../util/text/textFormat';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import XydriveThumbnail from './XydriveThumbnail';

import styles from './XydriveExplorer.module.scss';

type OwnProps = {
  items: XydriveItem[];
  isSheet: boolean;
  observe: ObserveFn;
  getPath: (sourceId?: string) => string;
  onGoTo: (sourceId?: string) => void;
  onOpen: (item: XydriveItem) => void;
  onNativeMessage: (file: XydriveFile) => void;
  onActions: (item: XydriveItem, anchor: HTMLElement) => void;
  onClose: NoneToVoidFunction;
};

const XydriveInspector = ({
  items, isSheet, observe, getPath, onGoTo, onOpen, onNativeMessage, onActions, onClose,
}: OwnProps) => {
  const lang = useLang();
  const actionRef = useRef<HTMLButtonElement | HTMLAnchorElement>();
  const item = items.length === 1 ? items[0] : undefined;
  const file = item?.kind === 'file' ? item.file : undefined;
  const folder = item?.kind === 'folder' ? item.folder : undefined;
  const stats = summarizeXydriveItems(items);
  const location = item?.sourceId;

  const content = (
    <div className={styles.inspectorBody}>
      {item ? (
        <>
          {file ? <XydriveThumbnail file={file} icon={getFileIcon(file.category)} observe={observe} />
            : (
              <span className={styles.folderGlyph} data-tone={item.kind === 'folder' ? item.tone : undefined}>
                <Icon name={folder?.isManaged ? 'folder-filled' : 'folder'} />
              </span>
            )}
          <strong className={styles.inspectorName} dir="auto">{item.name}</strong>
          <dl className={styles.metadata}>
            {file && item.name !== file.name && (
              <>
                <dt>{lang('XydriveOriginalName')}</dt>
                <dd dir="auto">{file.name}</dd>
              </>
            )}
            <dt>{lang('XydriveLocation')}</dt>
            <dd>
              <button type="button" className={styles.textButton} dir="auto" onClick={() => onGoTo(location)}>
                {getPath(location)}
              </button>
            </dd>
            <dt>{lang('XydriveSortType')}</dt>
            <dd>
              {file ? lang(CATEGORY_LABELS[file.category])
                : lang(folder?.isManaged ? 'XydriveManagedFolder' : 'XydriveMountedChannel')}
            </dd>
            {file ? (
              <>
                <dt>{lang('XydriveSortDate')}</dt>
                <dd>{new Date(file.date * 1000).toLocaleString()}</dd>
                <dt>{lang('XydriveSortSize')}</dt>
                <dd>{file.size === undefined ? lang('XydriveUnknownSize') : formatFileSize(lang, file.size)}</dd>
              </>
            ) : (
              <>
                <dt>{lang('XydriveIndexCoverage')}</dt>
                <dd>
                  {item.kind === 'folder' && item.snapshot ? lang('XydriveIndexedCount', {
                    count: lang.number(item.snapshot.files.length),
                  }) : lang('XydriveIndexPartial')}
                </dd>
              </>
            )}
          </dl>
          <div className={styles.inspectorActions}>
            {file && !file.previewKind ? (
              <>
                <p className={styles.itemMeta}>{lang('XydriveUnsupportedPreview')}</p>
                <Button size="smaller" noFastClick onClick={() => onNativeMessage(file)}>
                  {lang('XydriveOpenMessage')}
                </Button>
              </>
            ) : <Button size="smaller" noFastClick onClick={() => onOpen(item)}>{lang('Open')}</Button>}
            <Button
              ref={actionRef}
              size="smaller"
              color="translucent-bordered"
              noFastClick
              onClick={() => { if (actionRef.current) onActions(item, actionRef.current); }}
            >
              {lang('XydriveActionsNamed', { name: item.name })}
            </Button>
          </div>
        </>
      ) : items.length ? (
        <>
          <strong>{lang('XydriveItemCount', { count: lang.number(items.length) })}</strong>
          <dl className={styles.metadata}>
            <dt>{lang('XydriveFolderFiles')}</dt>
            <dd>{lang.number(stats.files)}</dd>
            <dt>{lang('XydriveFolders')}</dt>
            <dd>{lang.number(stats.folders)}</dd>
            <dt>{lang('XydriveKnownSize')}</dt>
            <dd>{formatFileSize(lang, stats.bytes)}</dd>
            {stats.unknown > 0 && (
              <>
                <dt>{lang('XydriveUnknownSize')}</dt>
                <dd>{lang.number(stats.unknown)}</dd>
              </>
            )}
          </dl>
        </>
      ) : <p>{lang('XydriveSelectForDetails')}</p>}
    </div>
  );

  return isSheet ? (
    <Modal isOpen hasCloseButton title={lang('XydriveDetails')} onClose={onClose} dialogClassName={styles.sheet}>
      {content}
    </Modal>
  ) : (
    <aside className={styles.inspector} aria-label={lang('XydriveDetails')}>
      <div className={styles.inspectorHeader}>
        <strong>{lang('XydriveDetails')}</strong>
        <button type="button" className={styles.control} aria-label={lang('Close')} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {content}
    </aside>
  );
};

export default memo(XydriveInspector);
