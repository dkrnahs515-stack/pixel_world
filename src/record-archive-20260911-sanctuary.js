function normalizeArchiveRecord(record, fallbackChapterId) {
  return {
    ...record,
    chapterId: record.chapterId || fallbackChapterId,
    pages: Array.isArray(record.pages) ? [...record.pages] : [],
    evidenceRecordIds: Array.isArray(record.evidenceRecordIds) ? [...record.evidenceRecordIds] : [],
  };
}

export function orderedArchiveRecords(records) {
  return (Array.isArray(records) ? [...records] : [])
    .filter(record => record && Number.isFinite(record.timelineOrder))
    .sort((left, right) => left.timelineOrder - right.timelineOrder);
}

export function collectRecordArchiveEntries({ coastRecords = [], sanctuaryRecords = [] } = {}) {
  return orderedArchiveRecords([
    ...coastRecords.map(record => normalizeArchiveRecord(record, "coast")),
    ...sanctuaryRecords.map(record => normalizeArchiveRecord(record, "sanctuary")),
  ]);
}

export function renderRecordArchive(list, records) {
  if (!list) return;
  const entries = orderedArchiveRecords(records);
  const documentRef = list.ownerDocument || document;
  const nodes = entries.map(record => {
    const item = documentRef.createElement("li");
    const heading = documentRef.createElement("strong");
    const source = documentRef.createElement("small");
    const body = documentRef.createElement("p");
    item.className = "record-archive-entry";
    item.dataset.recordId = record.id;
    heading.textContent = record.title || record.speaker || "이름 없는 기록";
    source.textContent = record.chapterId === "coast" ? "푸른 해안" : "픽셀 코어 성역";
    body.textContent = record.pages.join(" ") || "기록을 복원할 수 없습니다.";
    item.append(heading, source, body);
    if (record.correctsRecordId) {
      const link = documentRef.createElement("small");
      link.className = "record-correction-link";
      link.textContent = "보존된 원본 연결: " + record.correctsRecordId;
      item.append(link);
    }
    return item;
  });
  if (nodes.length === 0) {
    const empty = documentRef.createElement("li");
    empty.className = "communication-log-empty";
    empty.textContent = "아직 수집한 기록이 없습니다.";
    nodes.push(empty);
  }
  list.replaceChildren(...nodes);
}
