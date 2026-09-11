export function orderedCommunicationRecords(records) {
  return (Array.isArray(records) ? records : [])
    .filter(record => record && Number.isFinite(record.timelineOrder))
    .sort((left, right) => left.timelineOrder - right.timelineOrder);
}

export function renderCommunicationLog(list, records) {
  if (!list) return;
  const ordered = orderedCommunicationRecords(records);
  const documentRef = list.ownerDocument || document;
  if (ordered.length === 0) {
    const empty = documentRef.createElement("li");
    empty.className = "communication-log-empty";
    empty.textContent = "아직 수집한 통신 기록이 없습니다.";
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...ordered.map(record => {
    const entry = documentRef.createElement("li");
    const speaker = documentRef.createElement("small");
    entry.className = "communication-log-entry";
    speaker.textContent = record.speaker || "알 수 없는 발신자";
    entry.append(speaker, documentRef.createTextNode(record.pages?.join(" ") || "기록을 복원할 수 없습니다."));
    return entry;
  }));
}
