import { memo, useEffect, useRef } from '../../lib/teact/teact';

import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { XydriveItem } from '../../lib/xydrive/collection';

import { CATEGORY_LABELS, getFileExtension, getFileFormat, getFileIcon } from '../../lib/xydrive/collection';
import buildClassName from '../../util/buildClassName';
import { formatMediaDuration } from '../../util/dates/duration';
import { formatFileSize } from '../../util/text/textFormat';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import XydriveThumbnail from './XydriveThumbnail';

import styles from './XydriveExplorer.module.scss';

const PRESS_MS = 480;
const PRESS_TOLERANCE = 10;
const DRAG_TYPE = 'application/x-telegramx-drive';

type OwnProps = {
  items: XydriveItem[];
  selected: ReadonlySet<string>;
  query: string;
  previewingId?: string;
  observe: ObserveFn;
  canDrag: (item: XydriveItem) => boolean;
  canDrop: (source: XydriveItem, destination: XydriveItem) => boolean;
  onDrop: (item: XydriveItem, folder: XydriveItem) => void;
  onOpen: (item: XydriveItem) => void;
  onSelect: (item: XydriveItem, mode: 'replace' | 'toggle' | 'range') => void;
  onMenu: (item: XydriveItem, anchor: HTMLElement) => void;
};

const XydriveCollection = ({
  items, selected, query, previewingId, observe,
  canDrag, canDrop, onDrop, onOpen, onSelect, onMenu,
}: OwnProps) => {
  const lang = useLang();
  const pressRef = useRef<{ id: string; x: number; y: number; timer: number }>();
  const gestureRef = useRef<{ id: string; isTouch: boolean; didHold?: boolean }>();
  const draggedRef = useRef<XydriveItem>();

  useEffect(() => () => window.clearTimeout(pressRef.current?.timer), []);

  function cancelPress() {
    window.clearTimeout(pressRef.current?.timer);
    pressRef.current = undefined;
  }

  function startPress(event: React.PointerEvent<HTMLElement>, item: XydriveItem) {
    cancelPress();
    const isTouch = event.pointerType === 'touch' || event.pointerType === 'pen';
    gestureRef.current = { id: item.id, isTouch };
    if (!isTouch) return;
    const timer = window.setTimeout(() => {
      gestureRef.current = { id: item.id, isTouch, didHold: true };
      pressRef.current = undefined;
      onSelect(item, 'toggle');
    }, PRESS_MS);
    pressRef.current = { id: item.id, x: event.clientX, y: event.clientY, timer };
  }

  function movePress(event: React.PointerEvent<HTMLElement>) {
    const press = pressRef.current;
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > PRESS_TOLERANCE) cancelPress();
  }

  function clickItem(event: React.MouseEvent<HTMLButtonElement>, item: XydriveItem) {
    const gesture = gestureRef.current?.id === item.id ? gestureRef.current : undefined;
    gestureRef.current = undefined;
    if (gesture?.didHold) return;
    if (event.detail === 0 || (gesture?.isTouch && !selected.size)) onOpen(item);
    else if (event.shiftKey) onSelect(item, 'range');
    else onSelect(item, event.ctrlKey || event.metaKey || gesture?.isTouch ? 'toggle' : 'replace');
  }

  function renderItem(item: XydriveItem) {
    const file = item.kind === 'file' ? item.file : undefined;
    const folder = item.kind === 'folder' ? item.folder : undefined;
    const isSelected = selected.has(item.id);
    const format = file && getFileFormat(file);
    const category = file?.category;
    const type = category ? lang(CATEGORY_LABELS[category])
      : lang(folder?.isManaged ? 'XydriveManagedFolder' : 'XydriveMountedChannel');
    const size = file?.size === undefined ? undefined : formatFileSize(lang, file.size);
    const date = file ? new Date(file.date * 1000).toLocaleDateString() : undefined;
    const duration = file?.duration !== undefined ? formatMediaDuration(file.duration) : undefined;
    const count = item.kind === 'folder' && item.snapshot
      ? lang('XydriveIndexedCount', { count: lang.number(item.snapshot.files.length) }) : undefined;
    const marks = [item.isFavorite && lang('XydriveFavorites'), item.isPinned && lang('XydrivePinned')]
      .filter(Boolean).join(', ');

    return (
      <li
        key={item.id}
        data-drive-item={item.id}
        className={buildClassName(styles.item, isSelected && styles.selected, folder && styles.folderItem,
          (category === 'images' || category === 'videos') && styles.mediaItem)}
        onContextMenu={(event: React.MouseEvent<HTMLLIElement>) => {
          if (gestureRef.current?.didHold) return;
          event.preventDefault();
          onMenu(item, event.currentTarget);
        }}
        onDragOver={(event: React.DragEvent<HTMLLIElement>) => {
          if (!draggedRef.current || !folder || !canDrop(draggedRef.current, item)
            || !event.dataTransfer.types.includes(DRAG_TYPE)) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(event: React.DragEvent<HTMLLIElement>) => {
          if (!draggedRef.current || !folder || !canDrop(draggedRef.current, item)
            || !event.dataTransfer.types.includes(DRAG_TYPE)) {
            return;
          }
          event.preventDefault();
          onDrop(draggedRef.current, item);
          draggedRef.current = undefined;
        }}
      >
        <button
          type="button"
          className={styles.select}
          aria-label={lang(isSelected ? 'XydriveDeselectNamed' : 'XydriveSelectNamed', { name: item.name })}
          aria-pressed={isSelected}
          onClick={() => onSelect(item, 'toggle')}
        >
          <span className={styles.checkbox}>{isSelected && <Icon name="check" />}</span>
        </button>
        <button
          type="button"
          className={styles.itemMain}
          aria-label={marks ? `${item.name} · ${marks}` : item.name}
          title={item.name}
          draggable={canDrag(item)}
          onPointerDown={(event: React.PointerEvent<HTMLButtonElement>) => startPress(event, item)}
          onPointerMove={movePress}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onPointerLeave={cancelPress}
          onClick={(event) => clickItem(event, item)}
          onDoubleClick={(event) => { if (event.detail > 1) onOpen(item); }}
          onKeyDown={(event) => {
            if (event.key !== ' ') return;
            event.preventDefault();
            onSelect(item, 'toggle');
          }}
          onDragStart={(event) => {
            if (!canDrag(item)) {
              event.preventDefault();
              return;
            }
            draggedRef.current = item;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData(DRAG_TYPE, item.id);
          }}
          onDragEnd={() => { draggedRef.current = undefined; }}
        >
          {file && category ? <XydriveThumbnail file={file} icon={getFileIcon(category)} observe={observe} />
            : (
              <span className={styles.folderGlyph} data-tone={item.kind === 'folder' ? item.tone : undefined}>
                <Icon name={folder?.isManaged ? 'folder-filled' : 'folder'} />
              </span>
            )}
          <span className={styles.itemCopy}>
            <span className={styles.itemName} dir="auto">
              {renderName(item.name, query)}
              {folder && (item.isFavorite || item.isPinned) && (
                <span className={styles.folderMarks} aria-hidden="true">
                  {item.isFavorite && <Icon name="star-outline" />}
                  {item.isPinned && <Icon name="pin" />}
                </span>
              )}
            </span>
            <span className={styles.itemMeta} dir="auto">
              {format || type}
              {count && ` · ${count}`}
              {size && ` · ${size}`}
              {date && ` · ${date}`}
              {duration && ` · ${duration}`}
            </span>
          </span>
        </button>
        <span className={styles.flags}>
          {item.isFavorite && <Icon name="star-outline" />}
          {item.isPinned && <Icon name="pin" />}
        </span>
        {file?.previewKind && (
          <button
            type="button"
            className={styles.preview}
            disabled={previewingId === item.id}
            aria-busy={previewingId === item.id}
            aria-label={lang('XydrivePreviewNamed', { name: item.name })}
            onClick={() => onOpen(item)}
          >
            <Icon name={previewingId === item.id ? 'reload-arrows'
              : category === 'audio' || category === 'videos' ? 'play' : 'eye'}
            />
          </button>
        )}
        <button
          type="button"
          className={styles.more}
          aria-haspopup="menu"
          aria-label={lang('XydriveActionsNamed', { name: item.name })}
          onClick={(event) => onMenu(item, event.currentTarget)}
        >
          <Icon name="more" />
        </button>
      </li>
    );
  }

  const folders = items.filter((item) => item.kind === 'folder');
  const files = items.filter((item) => item.kind === 'file');
  return (
    <div className={styles.gridGroups}>
      {folders.length > 0 && (
        <section aria-labelledby="xydrive-folder-group">
          <h2 id="xydrive-folder-group" className={styles.groupTitle}>{lang('XydriveFolders')}</h2>
          <ul className={buildClassName(styles.collectionItems, styles.folderGrid)}>{folders.map(renderItem)}</ul>
        </section>
      )}
      {files.length > 0 && (
        <section aria-labelledby="xydrive-file-group">
          <h2 id="xydrive-file-group" className={styles.groupTitle}>{lang('XydriveFolderFiles')}</h2>
          <ul className={buildClassName(styles.collectionItems, styles.grid)}>{files.map(renderItem)}</ul>
        </section>
      )}
    </div>
  );
};

function renderName(name: string, query: string) {
  const extension = getFileExtension(name);
  const hasSuffix = extension && extension.length <= 8;
  const base = hasSuffix ? name.slice(0, -extension.length - 1) : name;
  const term = query.trim();
  const match = term ? base.toLocaleLowerCase().indexOf(term.toLocaleLowerCase()) : -1;
  return (
    <>
      <span className={styles.nameBase}>
        {match < 0 ? base : (
          <>
            {base.slice(0, match)}
            <mark>{base.slice(match, match + term.length)}</mark>
            {base.slice(match + term.length)}
          </>
        )}
      </span>
      {hasSuffix && (
        <span className={styles.extension}>
          .
          {extension}
        </span>
      )}
    </>
  );
}

export default memo(XydriveCollection);
