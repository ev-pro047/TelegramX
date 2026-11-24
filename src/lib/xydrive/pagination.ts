// Use raw message IDs, including unsupported and empty messages, to advance history.
export function getXydriveNextOffset(ids: readonly number[], offsetId?: number): number | undefined {
  let nextOffsetId: number | undefined;

  for (const id of ids) {
    if (!Number.isSafeInteger(id) || id <= 0 || (offsetId !== undefined && id >= offsetId)) continue;
    if (nextOffsetId === undefined || id < nextOffsetId) nextOffsetId = id;
  }

  return nextOffsetId;
}
