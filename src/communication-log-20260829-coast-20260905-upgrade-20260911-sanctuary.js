import { orderedArchiveRecords, renderRecordArchive } from "./record-archive-20260911-sanctuary.js";

export const orderedCommunicationRecords = orderedArchiveRecords;

export function renderCommunicationLog(list, records) {
  renderRecordArchive(list, records);
}
