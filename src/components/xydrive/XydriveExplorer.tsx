import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';

import type { XydriveDirection, XydriveFilter, XydriveSort } from '../../lib/xydrive/explorer';
import type { XydriveCategory, XydriveFile } from '../../lib/xydrive/types';
import type { IconName } from '../../types/icons';
import type { RegularLangKey } from '../../types/language';

import {
  EMPTY_XYDRIVE_SELECTION, queryXydriveFiles, restrictXydriveSelection, selectXydriveFile,
} from '../../lib/xydrive/explorer';
import { enqueueXydriveDownload } from '../../lib/xydrive/transfers';
import buildClassName from '../../util/buildClassName';
import { formatFileSize } from '../../util/text/textFormat';

import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import XydriveThumbnail from './XydriveThumbnail';

import styles from './XydriveExplorer.module.scss';

type OwnProps = {
  files: readonly XydriveFile[];
  isComplete: boolean;
  isLoading: boolean;
  onOpenMessage: (file: XydriveFile) => void;
  onPreview: (file: XydriveFile) => void;
  previewingId?: string;
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

const CATEGORIES: XydriveCategory[] = ['images', 'videos', 'audio', 'documents', 'archives', 'other'];
const SORT_OPTIONS: { key: XydriveSort; label: RegularLangKey }[] = [
  { key: 'date', label: 'XydriveSortDate' },
  { key: 'name', label: 'XydriveSortName' },
  { key: 'size', label: 'XydriveSortSize' },
  { key: 'type', label: 'XydriveSortType' },
];

const XydriveExplorer = ({
  files, isComplete, isLoading, onOpenMessage, onPreview, previewingId,
}: OwnProps) => {
  const lang = useLang();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<XydriveFilter>('all');
  const [sort, setSort] = useState<XydriveSort>('date');
  const [direction, setDirection] = useState<XydriveDirection>('desc');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selection, setSelection] = useState(EMPTY_XYDRIVE_SELECTION);
  const [detailsId, setDetailsId] = useState<string | undefined>(undefined);
  const [menuId, setMenuId] = useState<string | undefined>(undefined);
  const listRef = useRef<HTMLUListElement>();
  // Undefined observer root uses the viewport; ancestor scroll clipping is respected.
  const viewportRef = useRef<HTMLDivElement>();
  const { observe } = useIntersectionObserver({ rootRef: viewportRef });

  const visibleFiles = useMemo(
    () => queryXydriveFiles(files, query, category, sort, direction),
    [files, query, category, sort, direction],
  );
  const visibleIds = useMemo(() => visibleFiles.map(({ id }) => id), [visibleFiles]);
  const visibleSelection = useMemo(
    () => restrictXydriveSelection(selection, visibleIds), [selection, visibleIds],
  );
  const details = visibleFiles.find(({ id }) => id === detailsId);
  const hasFilter = Boolean(query.trim()) || category !== 'all';
  const navigateWithKeyboard = useKeyboardListNavigation(listRef, true, undefined, '[data-xydrive-file]', true);

  useEffect(() => {
    setSelection((current) => restrictXydriveSelection(current, visibleIds));
    if (detailsId && !visibleIds.includes(detailsId)) setDetailsId(undefined);
    if (menuId && !visibleIds.includes(menuId)) setMenuId(undefined);
  }, [visibleIds, detailsId, menuId]);

  function selectAll() {
    setSelection({ ids: new Set(visibleIds), anchor: visibleIds[0] });
  }

  function handleListKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    if (menuId) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selectAll();
      return;
    }
    navigateWithKeyboard(event);
  }

  function handleFileClick(event: React.MouseEvent<HTMLButtonElement>, file: XydriveFile) {
    const mode = event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'replace';
    setSelection((current) => selectXydriveFile(current, visibleIds, file.id, mode));
    if (mode === 'replace') setDetailsId(file.id);
  }

  function toggleFile(id: string) {
    setSelection((current) => selectXydriveFile(current, visibleIds, id, 'toggle'));
  }

  function clearFilters() {
    setQuery('');
    setCategory('all');
  }

  return (
    <section className={styles.explorer} aria-label={lang('XydriveExplorer')}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Icon name="search" />
          <input
            type="search"
            aria-label={lang('XydriveSearch')}
            placeholder={lang('XydriveSearch')}
            value={query}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
        <div className={styles.controls}>
          <select
            aria-label={lang('XydriveFilter')}
            value={category}
            onChange={(event) => setCategory(event.currentTarget.value as XydriveFilter)}
          >
            <option value="all">{lang('XydriveAllTypes')}</option>
            {CATEGORIES.map((item) => <option key={item} value={item}>{lang(CATEGORY_LABELS[item])}</option>)}
          </select>
          <select
            aria-label={lang('XydriveSort')}
            value={sort}
            onChange={(event) => setSort(event.currentTarget.value as XydriveSort)}
          >
            {SORT_OPTIONS.map(({ key, label }) => <option key={key} value={key}>{lang(label)}</option>)}
          </select>
          <button
            type="button"
            className={styles.controlButton}
            aria-label={lang(direction === 'asc' ? 'XydriveAscending' : 'XydriveDescending')}
            title={lang(direction === 'asc' ? 'XydriveAscending' : 'XydriveDescending')}
            onClick={() => setDirection(direction === 'asc' ? 'desc' : 'asc')}
          >
            <span aria-hidden="true">{direction === 'asc' ? '↑' : '↓'}</span>
          </button>
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={buildClassName(styles.controlButton, view === 'grid' && styles.activeControl)}
              aria-pressed={view === 'grid'}
              aria-label={lang('XydriveGrid')}
              title={lang('XydriveGrid')}
              onClick={() => setView('grid')}
            >
              <span className={styles.gridIcon} aria-hidden="true"><i /><i /><i /><i /></span>
            </button>
            <button
              type="button"
              className={buildClassName(styles.controlButton, view === 'list' && styles.activeControl)}
              aria-pressed={view === 'list'}
              aria-label={lang('XydriveList')}
              title={lang('XydriveList')}
              onClick={() => setView('list')}
            >
              <Icon name="list" />
            </button>
          </div>
        </div>
      </div>
      <p className={styles.scope} aria-live="polite">
        {lang(isComplete ? 'XydriveCompleteScope' : 'XydrivePartialScope')}
      </p>
      <div className={styles.statusBar}>
        <span>{lang('XydriveShowing')}: {lang.number(visibleFiles.length)} / {lang.number(files.length)}</span>
        {visibleSelection.ids.size > 0 && (
          <span>{lang('XydriveSelected')}: {lang.number(visibleSelection.ids.size)}</span>
        )}
        <div className={styles.selectionActions}>
          {visibleIds.length > 0 && (
            <Button size="tiny" color="translucent" onClick={selectAll}>{lang('XydriveSelectVisible')}</Button>
          )}
          {visibleSelection.ids.size > 0 && (
            <Button size="tiny" color="translucent" onClick={() => {
              visibleFiles.filter(({ id }) => visibleSelection.ids.has(id)).forEach(enqueueXydriveDownload);
            }}
            >
              {lang('XydriveTransferDownloadSelected')}
            </Button>
          )}
          {visibleSelection.ids.size > 0 && (
            <Button size="tiny" color="translucent" onClick={() => setSelection(EMPTY_XYDRIVE_SELECTION)}>
              {lang('XydriveClearSelection')}
            </Button>
          )}
        </div>
      </div>
      <div className={buildClassName(styles.body, details && styles.withDetails)}>
        <div className={styles.collection}>
          {!visibleFiles.length && hasFilter && (
            <div className={styles.empty}>
              <Icon name="search" />
              <p>{lang(isComplete ? 'XydriveNoMatches' : 'XydriveNoLoadedMatches')}</p>
              <Button size="smaller" color="translucent" onClick={clearFilters}>{lang('XydriveClearFilters')}</Button>
            </div>
          )}
          {visibleFiles.length > 0 && (
            <ul
              ref={listRef}
              className={buildClassName(styles.files, view === 'grid' ? styles.grid : styles.list)}
              onKeyDown={handleListKeyDown}
            >
              {visibleFiles.map((file) => {
                const isSelected = visibleSelection.ids.has(file.id);
                return (
                  <li
                    key={file.id}
                    className={buildClassName(styles.file, isSelected && styles.selected)}
                  >
                    <button
                      type="button"
                      data-xydrive-file="true"
                      className={styles.fileMain}
                      aria-pressed={isSelected}
                      title={file.name}
                      onClick={(event) => handleFileClick(event, file)}
                      onDoubleClick={() => {
                        if (file.previewKind && !previewingId) onPreview(file);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setMenuId(file.id);
                      }}
                    >
                      <XydriveThumbnail file={file} icon={CATEGORY_ICONS[file.category]} observe={observe} />
                      <span className={styles.fileText}>
                        <span className={styles.name} dir="auto">{file.name}</span>
                        <span className={styles.meta}>
                          {lang(CATEGORY_LABELS[file.category])} · {file.size === undefined
                            ? lang('XydriveUnknownSize') : formatFileSize(lang, file.size)}
                        </span>
                      </span>
                    </button>
                    <div className={styles.fileActions}>
                      {file.previewKind && (
                        <button
                          type="button"
                          className={styles.controlButton}
                          aria-label={lang('XydrivePreview')}
                          title={lang('XydrivePreview')}
                          disabled={Boolean(previewingId)}
                          onClick={() => onPreview(file)}
                        >
                          <Icon name={previewingId === file.id ? 'reload-arrows'
                            : file.previewKind === 'audio' ? 'play' : 'eye'} />
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.controlButton}
                        aria-label={lang(isSelected ? 'XydriveDeselectFile' : 'XydriveSelectFile')}
                        aria-pressed={isSelected}
                        onClick={() => toggleFile(file.id)}
                      >
                        <span className={buildClassName(styles.selectionMark, isSelected && styles.checkedMark)}>
                          {isSelected && <Icon name="check" />}
                        </span>
                      </button>
                      <div className={styles.menuAnchor}>
                        <button
                          type="button"
                          className={styles.controlButton}
                          aria-label={lang('XydriveFileActions')}
                          aria-haspopup="menu"
                          aria-expanded={menuId === file.id}
                          onClick={() => setMenuId(menuId === file.id ? undefined : file.id)}
                        >
                          <Icon name="more" />
                        </button>
                        {menuId === file.id && (
                          <Menu
                            isOpen
                            autoClose
                            ariaLabel={lang('XydriveFileActions')}
                            positionX={lang.isRtl ? 'left' : 'right'}
                            positionY="bottom"
                            onClose={() => setMenuId(undefined)}
                          >
                            {file.previewKind && (
                              <MenuItem icon="eye" disabled={Boolean(previewingId)} onClick={() => onPreview(file)}>
                                {lang('XydrivePreview')}
                              </MenuItem>
                            )}
                            <MenuItem icon="download" onClick={() => enqueueXydriveDownload(file)}>
                              {lang('XydriveTransferDownload')}
                            </MenuItem>
                            <MenuItem icon="info" onClick={() => setDetailsId(file.id)}>{lang('XydriveDetails')}</MenuItem>
                            <MenuItem icon="check" onClick={() => toggleFile(file.id)}>
                              {lang(isSelected ? 'XydriveDeselectFile' : 'XydriveSelectFile')}
                            </MenuItem>
                            <MenuItem icon="arrow-right" onClick={() => onOpenMessage(file)}>
                              {lang('XydriveOpenMessage')}
                            </MenuItem>
                          </Menu>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {details && (
          <aside className={styles.details} aria-label={lang('XydriveDetails')}>
            <div className={styles.detailsHeader}>
              <strong>{lang('XydriveDetails')}</strong>
              <Button
                round
                size="tiny"
                color="translucent"
                iconName="close"
                ariaLabel={lang('Close')}
                onClick={() => setDetailsId(undefined)}
              />
            </div>
            <Icon name={CATEGORY_ICONS[details.category]} className={styles.detailIcon} />
            <strong className={styles.detailName} dir="auto">{details.name}</strong>
            <dl>
              <dt>{lang('XydriveSortType')}</dt>
              <dd>{lang(CATEGORY_LABELS[details.category])}</dd>
              <dt>{lang('XydriveSortSize')}</dt>
              <dd>{details.size === undefined ? lang('XydriveUnknownSize') : formatFileSize(lang, details.size)}</dd>
              <dt>{lang('XydriveSortDate')}</dt>
              <dd>{new Date(details.date * 1000).toLocaleDateString()}</dd>
              <dt>{lang('XydriveMimeType')}</dt>
              <dd>{details.mimeType || lang('XydriveUnknownValue')}</dd>
            </dl>
            {details.previewKind && (
              <Button
                size="smaller"
                isLoading={previewingId === details.id}
                disabled={Boolean(previewingId)}
                onClick={() => onPreview(details)}
              >
                {lang('XydrivePreview')}
              </Button>
            )}
            <Button size="smaller" onClick={() => enqueueXydriveDownload(details)}>
              {lang('XydriveTransferDownload')}
            </Button>
            <Button size="smaller" color="translucent" onClick={() => onOpenMessage(details)}>
              {lang('XydriveOpenMessage')}
            </Button>
          </aside>
        )}
      </div>
      {isLoading && files.length > 0 && <p className={styles.scope}>{lang('XydriveLoadingOlder')}</p>}
    </section>
  );
};

export default memo(XydriveExplorer);
