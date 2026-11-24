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
