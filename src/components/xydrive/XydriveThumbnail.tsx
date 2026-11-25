import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';

import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { XydriveFile } from '../../lib/xydrive/types';
import type { IconName } from '../../types/icons';

import { getFileFormat } from '../../lib/xydrive/collection';
import buildClassName from '../../util/buildClassName';

import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';

import Icon from '../common/icons/Icon';

import styles from './XydriveExplorer.module.scss';

const THUMBNAIL_WAIT_MS = 8000;

type OwnProps = {
  file: XydriveFile;
  icon: IconName;
  observe: ObserveFn;
};

const XydriveThumbnail = ({ file, icon, observe }: OwnProps) => {
  const ref = useRef<HTMLDivElement>();
  const [failedUrl, setFailedUrl] = useState<string>();
  const [timedOutHash, setTimedOutHash] = useState<string>();
  const isIntersecting = useIsIntersecting(ref, observe);
  const url = useMedia(file.thumbnailHash, !isIntersecting);
  const format = getFileFormat(file);
  // Source-code extensions can be mislabeled by generic MIME/category detection.
  const displayIcon = /^(PDF|DOCX?|RTF|TXT|XLSX?|CSV|PPTX?|CSS|SCSS|JSX?|TSX?|JSON|HTML|XML|SVG|PY|MD)$/.test(format)
    ? 'document' : /^(ZIP|RAR|7Z|TAR|GZ|BZ2|XZ)$/.test(format) ? 'archive' : icon;
  const hash = file.thumbnailHash;
  useEffect(() => {
    if (!hash || url || !isIntersecting) return undefined;
    const timer = window.setTimeout(() => setTimedOutHash(hash), THUMBNAIL_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [hash, url, isIntersecting]);

  const hasImage = Boolean(url && failedUrl !== url);

  return (
    <div
      ref={ref}
      className={buildClassName(styles.thumbnail, styles[file.category])}
      data-format={format || undefined}
      data-has-image={hasImage ? 'true' : undefined}
      data-loading={hash && isIntersecting && !url && timedOutHash !== hash ? 'true' : undefined}
      aria-hidden="true"
    >
      {hasImage ? (
        <img
          className={styles.thumbnailImage}
          src={url}
          alt=""
          draggable={false}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <span className={styles.fileIconTile}>
          <Icon name={displayIcon} className={styles.fileIcon} />
          {format && <small>{format}</small>}
        </span>
      )}
    </div>
  );
};

export default memo(XydriveThumbnail);
