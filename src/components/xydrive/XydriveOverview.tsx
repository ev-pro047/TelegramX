import { memo } from '../../lib/teact/teact';
import type { XydriveFile, XydriveIndex, XydriveMount } from '../../lib/xydrive/types';
import { formatFileSize } from '../../util/text/textFormat';
import useLang from '../../hooks/useLang';
import styles from './XydriveOverview.module.scss';

type OwnProps = { files: XydriveFile[]; folders: XydriveMount[]; index?: XydriveIndex; ownerId?: string };
const CATEGORIES = [
  ['images', 'XydriveImages'], ['videos', 'XydriveVideos'], ['audio', 'XydriveAudio'],
  ['documents', 'XydriveDocuments'], ['archives', 'XydriveArchives'], ['other', 'XydriveOther'],
] as const;

const XydriveOverview = ({ files, folders, index, ownerId }: OwnProps) => {
  const lang = useLang();
  const bytes = files.reduce((total, file) => total + (file.size || 0), 0);
  const unknown = files.filter((file) => file.size === undefined).length;
  const sources = [ownerId, ...folders.map(({ id }) => id)].filter(Boolean);
  return (
    <section className={styles.overview}>
      <h1>{lang('XydriveOverview')}</h1>
      <div className={styles.metrics}>
        <div><small>{lang('XydriveIndexedStorage')}</small><strong>{formatFileSize(lang, bytes)}</strong></div>
        <div><small>{lang('XydriveLoadedFiles')}</small><strong>{lang.number(files.length)}</strong></div>
        <div><small>{lang('XydriveFolders')}</small><strong>{lang.number(folders.length)}</strong></div>
        <div><small>{lang('XydriveScannedSources')}</small><strong>{lang.number(sources.filter((id) => index?.sources[id]?.complete).length)} / {lang.number(sources.length)}</strong></div>
      </div>
      <p>{lang('XydriveStorageScope')} {lang.number(unknown)} {lang('XydriveUnknownSizes')}</p>
      <h2>{lang('XydriveStorageTypes')}</h2>
      {CATEGORIES.map(([category, label]) => {
        const items = files.filter((file) => file.category === category);
        const size = items.reduce((total, file) => total + (file.size || 0), 0);
        return <div key={category} className={styles.metricRow}><span>{lang(label)} · {lang.number(items.length)}</span>
          <progress value={size} max={bytes || 1} /><strong>{formatFileSize(lang, size)}</strong></div>;
      })}
      <h2>{lang('XydriveFolders')}</h2>
      {sources.map((id) => {
        const items = files.filter((file) => file.chatId === id);
        return <div key={id} className={styles.metricRow}><span>{folders.find((folder) => folder.id === id)?.title || lang('XydriveRoot')}</span>
          <span>{lang.number(items.length)} {lang('XydriveLoadedFiles')}</span><strong>{formatFileSize(lang, items.reduce((sum, file) => sum + (file.size || 0), 0))}</strong></div>;
      })}
    </section>
  );
};
export default memo(XydriveOverview);
