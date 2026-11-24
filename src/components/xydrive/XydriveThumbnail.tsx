import { memo, useRef } from '../../lib/teact/teact';

import type { XydriveFile } from '../../lib/xydrive/types';
import type { IconName } from '../../types/icons';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';

import Icon from '../common/icons/Icon';

import styles from './XydriveExplorer.module.scss';

type OwnProps = {
  file: XydriveFile;
  icon: IconName;
  observe: ObserveFn;
};

const XydriveThumbnail = ({ file, icon, observe }: OwnProps) => {
  const ref = useRef<HTMLDivElement>();
  const isIntersecting = useIsIntersecting(ref, observe);
  const url = useMedia(file.thumbnailHash, !isIntersecting);

  return (
    <div ref={ref} className={styles.thumbnail} aria-hidden="true">
      {url ? <img src={url} alt="" draggable={false} /> : <Icon name={icon} className={styles.fileIcon} />}
    </div>
  );
};

export default memo(XydriveThumbnail);
