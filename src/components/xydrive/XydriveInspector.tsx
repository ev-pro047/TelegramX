import { memo, useRef } from '../../lib/teact/teact';

import type { XydriveItem } from '../../lib/xydrive/collection';
import type { XydriveFile } from '../../lib/xydrive/types';

import { CATEGORY_LABELS, getFileFormat, getFileIcon, summarizeXydriveItems } from '../../lib/xydrive/collection';
import { enqueueXydriveDownload } from '../../lib/xydrive/transfers';
import { formatFileSize } from '../../util/text/textFormat';

import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import XydriveThumbnail from './XydriveThumbnail';

import workspaceStyles from './Xydrive.module.scss';
import styles from './XydriveExplorer.module.scss';

type OwnProps = {
  items: XydriveItem[];
  isSheet: boolean;
  getPath: (sourceId?: string) => string;
  onGoTo: (sourceId?: string) => void;
  onOpen: (item: XydriveItem) => void;
  onNativeMessage: (file: XydriveFile) => void;
  onActions: (item: XydriveItem, anchor: HTMLElement) => void;
  onClose: NoneToVoidFunction;
};

const XydriveInspector = ({
  items, isSheet, getPath, onGoTo, onOpen, onNativeMessage, onActions, onClose,
}: OwnProps) => {
  const lang = useLang();
  const contentRef = useRef<HTMLDivElement>();
  const { observe } = useIntersectionObserver({ rootRef: contentRef });
  const actionRef = useRef<HTMLButtonElement | HTMLAnchorElement>();
  const item = items.length === 1 ? items[0] : undefined;
  const file = item?.kind === 'file' ? item.file : undefined;
  const folder = item?.kind === 'folder' ? item.folder : undefined;
  const stats = summarizeXydriveItems(items);
  const location = item?.sourceId;
  const format = file && getFileFormat(file);
  const type = file ? lang(CATEGORY_LABELS[file.category])
    : lang(folder?.isManaged ? 'XydriveManagedFolder' : 'XydriveMountedChannel');

  const content = (
    <div ref={contentRef} className={styles.inspectorBody}>
      {item ? (
        <>
          {file ? <XydriveThumbnail file={file} icon={getFileIcon(file.category)} observe={observe} />
            : (
              <span className={styles.folderGlyph} data-tone={item.kind === 'folder' ? item.tone : undefined}>
                <Icon name={folder?.isManaged ? 'folder-filled' : 'folder'} />
              </span>
            )}
          <div className={styles.inspectorIdentity}>
            <h2 className={styles.inspectorName} dir="auto">{item.name}</h2>
            <span className={styles.itemMeta}>{format || type}</span>
          </div>
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
            <dd>{type}</dd>
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
          {file && !file.previewKind && (
            <p className={styles.inspectorHint}>{lang('XydriveUnsupportedPreview')}</p>
          )}
          <div className={styles.inspectorActions}>
            {file && !file.previewKind ? (
              <Button size="smaller" noFastClick onClick={() => onNativeMessage(file)}>
                {lang('XydriveOpenMessage')}
              </Button>
            ) : (
              <Button size="smaller" noFastClick onClick={() => onOpen(item)}>
                {lang(file ? 'XydrivePreview' : 'Open')}
              </Button>
            )}
            {file && (
              <Button
                size="smaller"
                round
                color="translucent"
                iconName="download"
                noFastClick
                ariaLabel={lang('XydriveTransferDownload')}
                onClick={() => enqueueXydriveDownload(file)}
              />
            )}
            <Button
              ref={actionRef}
              size="smaller"
              round
              color="translucent"
              iconName="more"
              noFastClick
              ariaLabel={lang('XydriveActionsNamed', { name: item.name })}
              onClick={() => { if (actionRef.current) onActions(item, actionRef.current); }}
            />
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
      ) : (
        <div className={styles.inspectorEmpty}>
          <Icon name="info" />
          <p>{lang('XydriveSelectForDetails')}</p>
        </div>
      )}
    </div>
  );

  return isSheet ? (
    <Modal
      isOpen
      hasCloseButton
      title={lang('XydriveDetails')}
      onClose={onClose}
      dialogClassName={workspaceStyles.sheetFrame}
    >
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
