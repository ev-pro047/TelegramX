import { memo, useMemo, useState } from '../../lib/teact/teact';

import type {
  XydriveCategory, XydriveFile, XydriveIndex, XydriveMount, XydriveOrganization,
} from '../../lib/xydrive/types';

import { CATEGORY_LABELS, getFileIcon, XYDRIVE_CATEGORIES } from '../../lib/xydrive/collection';
import { getFileLabel } from '../../lib/xydrive/organization';
import buildClassName from '../../util/buildClassName';
import { formatFileSize } from '../../util/text/textFormat';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';

import styles from './XydriveOverview.module.scss';

type OwnProps = {
  files: XydriveFile[];
  folders: XydriveMount[];
  organization: XydriveOrganization;
  index?: XydriveIndex;
  ownerId?: string;
  onOpenCategory: (category: XydriveCategory) => void;
  onOpenFolder: (id?: string) => void;
  onOpenFile: (file: XydriveFile) => void;
};

type Totals = { count: number; size: number; unknown: number };
const ROWS = 40;
const MOST_RECENT = 5;
const LARGEST = 5;

const XydriveOverview = ({
  files, folders, organization, index, ownerId, onOpenCategory, onOpenFolder, onOpenFile,
}: OwnProps) => {
  const lang = useLang();
  const [folderPage, setFolderPage] = useState(0);
  const { bytes, unknown, categories, sources, largest, recent } = useMemo(() => {
    const byCategory = new Map<XydriveCategory, Totals>();
    const bySource = new Map<string, Totals>();
    let totalBytes = 0;
    let unknownSizes = 0;

    for (const { category, chatId, size } of files) {
      if (size === undefined) unknownSizes++;
      else totalBytes += size;
      addToTotals(byCategory, category, size);
      addToTotals(bySource, chatId, size);
    }

    const biggest = files.filter(({ size }) => size !== undefined).sort((a, b) => b.size! - a.size!).slice(0, LARGEST);
    const last = files.map((file) => ({ file, opened: getFileLabel(organization, file)?.lastOpened }))
      .filter(({ opened }) => opened !== undefined).sort((a, b) => b.opened! - a.opened!).slice(0, MOST_RECENT);
    return {
      bytes: totalBytes, unknown: unknownSizes, categories: byCategory, sources: bySource,
      largest: biggest, recent: last,
    };
  }, [files, organization]);

  const locations = folders.map(({ id, title }) => ({ id, title }));
  if (ownerId) locations.unshift({ id: ownerId, title: lang('XydriveRoot') });
  const complete = locations.filter(({ id }) => index?.sources[id]?.complete).length;
  const sortedLocations = locations.sort((a, b) => (sources.get(b.id)?.size || 0) - (sources.get(a.id)?.size || 0)
    || a.title.localeCompare(b.title));
  const status = index?.status === 'syncing' ? 'XydriveIndexSyncing'
    : complete === locations.length && complete > 0 ? 'XydriveIndexReady'
      : index?.status === 'limited' ? 'XydriveIndexLimit' : 'XydriveIndexPartial';
  const activeSource = index?.scan?.sourceId;
  const activeTitle = activeSource === ownerId ? lang('XydriveRoot')
    : folders.find(({ id }) => id === activeSource)?.title;

  return (
    <section className={styles.overview} aria-label={lang('XydriveOverview')}>
      <dl className={styles.metrics}>
        <div className={styles.metric}>
          <dt className={styles.caption}>{lang('XydriveIndexedStorage')}</dt>
          <dd className={styles.value}>{formatFileSize(lang, bytes)}</dd>
        </div>
        <div className={styles.metric}>
          <dt className={styles.caption}>{lang('XydriveLoadedFiles')}</dt>
          <dd className={styles.value}>{lang.number(files.length)}</dd>
        </div>
        <div className={styles.metric}>
          <dt className={styles.caption}>{lang('XydriveScannedSources')}</dt>
          <dd className={styles.value}>
            {lang.number(complete)}
            {' '}
            /
            {' '}
            {lang.number(locations.length)}
          </dd>
        </div>
      </dl>
      <div className={styles.coverage} role="status">
        <strong>{lang(status)}</strong>
        <span>
          {lang('XydriveStorageScope')}
          {' '}
          {lang.number(unknown)}
          {' '}
          {lang('XydriveUnknownSizes')}
        </span>
        {index?.status === 'syncing' && index.scan && (
          <span dir="auto">
            {lang('XydriveScanProgress', { folder: activeTitle || lang('XydriveRoot'),
              count: lang.number(index.scan.pages) })}
          </span>
        )}
      </div>
      <div className={styles.panels}>
        <section className={styles.panel}>
          <h2 className={styles.heading}>{lang('XydriveStorageTypes')}</h2>
          {bytes > 0 && (
            <div className={styles.chart} aria-label={lang('XydriveStorageTypes')}>
              {XYDRIVE_CATEGORIES.map((category) => {
                const fraction = (categories.get(category)?.size || 0) / bytes;
                if (!fraction) return undefined;
                return (
                  <button
                    type="button"
                    key={category}
                    className={buildClassName(styles.segment, styles[category])}
                    style={`flex-grow: ${fraction}`}
                    aria-label={`${lang(CATEGORY_LABELS[category])} · ${lang.number(Math.round(fraction * 100))}%`}
                    onClick={() => onOpenCategory(category)}
                  />
                );
              })}
            </div>
          )}
          {XYDRIVE_CATEGORIES.map((category) => {
            const total = categories.get(category);
            return (
              <button
                type="button"
                key={category}
                className={styles.metricRow}
                onClick={() => onOpenCategory(category)}
              >
                <span className={buildClassName(styles.swatch, styles[category])}>
                  <Icon name={getFileIcon(category)} />
                </span>
                <span>
                  {lang(CATEGORY_LABELS[category])}
                  {' '}
                  ·
                  {' '}
                  {lang.number(total?.count || 0)}
                </span>
                <strong>{formatFileSize(lang, total?.size || 0)}</strong>
              </button>
            );
          })}
        </section>
        <section className={styles.panel}>
          <h2 className={styles.heading}>{lang('XydriveUsageByFolder')}</h2>
          {sortedLocations.slice(folderPage * ROWS, (folderPage + 1) * ROWS).map(({ id, title }) => {
            const total = sources.get(id);
            const coverage = index?.sources[id]?.complete ? 'XydriveSourceIndexed'
              : total || index?.sources[id] ? 'XydriveSourcePartial' : 'XydriveSourceUnscanned';
            return (
              <button
                type="button"
                key={id}
                className={styles.metricRow}
                onClick={() => onOpenFolder(id === ownerId ? undefined : id)}
              >
                <Icon name="folder" />
                <span className={styles.source} dir="auto" title={title}>{title}</span>
                <span className={styles.caption}>{lang(coverage)}</span>
                <strong>{total ? formatFileSize(lang, total.size) : '—'}</strong>
              </button>
            );
          })}
          {locations.length > ROWS && (
            <div className={styles.pager}>
              <button type="button" disabled={!folderPage} onClick={() => setFolderPage(folderPage - 1)}>
                {lang('Back')}
              </button>
              <button
                type="button"
                disabled={(folderPage + 1) * ROWS >= locations.length}
                onClick={() => setFolderPage(folderPage + 1)}
              >
                {lang('Next')}
              </button>
            </div>
          )}
        </section>
        <section className={styles.panel}>
          <h2 className={styles.heading}>{lang('XydriveLargestFiles')}</h2>
          {!largest.length && <p className={styles.caption}>{lang('XydriveNoSizes')}</p>}
          {largest.map((file) => (
            <button type="button" className={styles.metricRow} key={file.id} onClick={() => onOpenFile(file)}>
              <Icon name={getFileIcon(file.category)} />
              <span dir="auto" className={styles.source}>{file.name}</span>
              <strong>{formatFileSize(lang, file.size!)}</strong>
            </button>
          ))}
        </section>
        <section className={styles.panel}>
          <h2 className={styles.heading}>{lang('XydriveRecentActivity')}</h2>
          {!recent.length && <p className={styles.caption}>{lang('XydriveEmptyCollection')}</p>}
          {recent.map(({ file, opened }) => (
            <button type="button" className={styles.metricRow} key={file.id} onClick={() => onOpenFile(file)}>
              <Icon name={getFileIcon(file.category)} />
              <span dir="auto" className={styles.source}>{file.name}</span>
              <span className={styles.caption}>{new Date(opened!).toLocaleDateString()}</span>
            </button>
          ))}
        </section>
      </div>
    </section>
  );
};

function addToTotals<Key>(totals: Map<Key, Totals>, key: Key, size?: number) {
  const current = totals.get(key);
  if (current) {
    current.count++;
    current.size += size || 0;
    if (size === undefined) current.unknown++;
  } else {
    totals.set(key, { count: 1, size: size || 0, unknown: size === undefined ? 1 : 0 });
  }
}

export default memo(XydriveOverview);
