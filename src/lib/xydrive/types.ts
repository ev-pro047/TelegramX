export type XydriveCategory = 'images' | 'videos' | 'audio' | 'documents' | 'archives' | 'other';

export type XydriveFile = {
  id: string;
  chatId: string;
  messageId: number;
  mediaId?: string;
  thumbnailHash?: string;
  previewKind?: 'viewer' | 'audio';
  name: string;
  mimeType?: string;
  size?: number;
  date: number;
  category: XydriveCategory;
  mediaType: 'photo' | 'video' | 'audio' | 'voice' | 'document' | 'sticker';
};

export type XydriveMount = {
  id: string;
  title: string;
  accessHash: string;
  isManaged?: true;
};

export type XydriveMountRegistry = {
  ownerId: string;
  folders: XydriveMount[];
};

export type XydriveState = {
  sourceId: string;
  ownerId: string;
  files: XydriveFile[];
  scannedCount: number;
  nextOffsetId?: number;
  status: 'loading' | 'ready' | 'error';
  requestId?: number;
  error?: 'wait' | 'generic' | 'unavailable';
};

export type XydriveFileLabel = {
  mediaId?: string;
  alias?: string;
  favorite?: boolean;
  pinned?: boolean;
  lastOpened?: number;
};

export type XydriveFolderLabel = { favorite?: boolean; pinned?: boolean };

export type XydriveOrganization = {
  ownerId: string;
  parents: Record<string, string>;
  labels: Record<string, XydriveFileLabel>;
  folderLabels?: Record<string, XydriveFolderLabel>;
};

export type XydriveIndexSource = {
  files: XydriveFile[];
  complete: boolean;
  checkedAt: number;
  nextOffsetId?: number;
};

export type XydriveIndex = {
  ownerId: string;
  sources: Record<string, XydriveIndexSource>;
  status: 'idle' | 'syncing' | 'partial' | 'ready' | 'error' | 'limited';
  requestId?: number;
};

export type XydriveMutationStatus = 'working' | 'complete' | 'wait' | 'unavailable' | 'error'
  | 'copied' | 'copyUnknown' | 'deleteUnknown';
