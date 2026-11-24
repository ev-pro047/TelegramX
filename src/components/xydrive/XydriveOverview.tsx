import { memo, useMemo } from '../../lib/teact/teact';

import type { XydriveCategory, XydriveFile, XydriveIndex, XydriveMount } from '../../lib/xydrive/types';

import { formatFileSize } from '../../util/text/textFormat';

import useLang from '../../hooks/useLang';

import styles from './XydriveOverview.module.scss';

type OwnProps = {
  files: XydriveFile[];
  folders: XydriveMount[];
  index?: XydriveIndex;
  ownerId?: string;
};

const CATEGORIES = [
  ['images', 'XydriveImages'],
  ['videos', 'XydriveVideos'],
  ['audio', 'XydriveAudio'],
  ['documents', 'XydriveDocuments'],
  ['archives', 'XydriveArchives'],
  ['other', 'XydriveOther'],
] as const;

type Totals = { count: number; size: number };

const XydriveOverview = ({ files, folders, index, ownerId }: OwnProps) => {
  const lang = useLang();
  const { bytes, unknown, categories, sources } = useMemo(() => {
    const byCategory = new Map<XydriveCategory, Totals>();
    const bySource = new Map<string, Totals>();
    let totalBytes = 0;
    let unknownSizes = 0;

    for (const { category, chatId, size } of files) {
      if (size === undefined) unknownSizes += 1;
      totalBytes += size || 0;
      addToTotals(byCategory, category, size || 0);
      addToTotals(bySource, chatId, size || 0);
    }
    return { bytes: totalBytes, unknown: unknownSizes, categories: byCategory, sources: bySource };
  }, [files]);
  const locations = folders.map(({ id, title }) => ({ id, title }));
  if (ownerId) locations.unshift({ id: ownerId, title: lang('XydriveRoot') });

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
            {lang.number(locations.filter(({ id }) => index?.sources[id]?.complete).length)}
            {' / '}
            {lang.number(locations.length)}
          </dd>
        </div>
      </dl>
      <p className={styles.caption}>
        {lang('XydriveStorageScope')}
        {' '}
        {lang.number(unknown)}
        {' '}
        {lang('XydriveUnknownSizes')}
      </p>
      <h2 className={styles.heading}>{lang('XydriveStorageTypes')}</h2>
      {CATEGORIES.map(([category, label]) => (
        <div key={category} className={styles.metricRow}>
          <span>
            {lang(label)}
            {' '}
            ·
            {' '}
            {lang.number(categories.get(category)?.count || 0)}
          </span>
          <progress
            className={styles.progress}
            aria-label={lang(label)}
            value={categories.get(category)?.size || 0}
            max={bytes || 1}
          />
          <strong>{formatFileSize(lang, categories.get(category)?.size || 0)}</strong>
        </div>
      ))}
      <h2 className={styles.heading}>{lang('XydriveFolderPath')}</h2>
      {locations.map(({ id, title }) => (
        <div key={id} className={styles.metricRow}>
          <span className={styles.source} dir="auto" title={title}>{title}</span>
          <span className={styles.caption}>
            {lang.number(sources.get(id)?.count || 0)}
            {' '}
            {lang('XydriveLoadedFiles')}
          </span>
          <strong>{formatFileSize(lang, sources.get(id)?.size || 0)}</strong>
        </div>
      ))}
    </section>
  );
};

function addToTotals<Key>(totals: Map<Key, Totals>, key: Key, size: number) {
  const current = totals.get(key);
  if (current) {
    current.count += 1;
    current.size += size;
  } else {
    totals.set(key, { count: 1, size });
  }
}

export default memo(XydriveOverview);
