import { getVolcanoChapterObjective } from './world-20260903-volcano.js';
import { getWorldDefinition } from './world-data-20260903-volcano.js';

const COAST_LOCATIONS = {
 'defeat-forest-boss':'forest', 'repair-beach-transceiver':'coast-beach', 'collect-distress-signal':'coast-beach',
 'repair-wreck-relays':'coast-wreck-bay', 'collect-wreck-records':'coast-wreck-bay',
 'repair-flooded-station':'coast-flooded-station', 'collect-deleted-record':'coast-flooded-station', 'choose-support':'coast-flooded-station',
 'defeat-tide-core-boss':'coast-tide-core-cave', 'rescue-sera':'coast-tide-core-cave', 'collect-coast-core':'coast-tide-core-cave',
};
export function mainQuestObjective(progress) {
 const status = progress?.quests?.adventureStart?.status ?? 'available';
 if (status !== 'completed') {
  const body = {available:'현자 아렌에게 첫 모험을 의뢰받으세요.',active:'슬라임 3마리를 처치하세요.',ready_to_report:'중앙 마을의 현자 아렌에게 보고하세요.'}[status];
  return {id:`adventure-${status}`,title:'첫 모험',body,location:status==='active'?'태고의 숲 · 마을 북서쪽 초록 포털':'중앙 마을 북쪽 · 현자 아렌',controls:'방향키 이동 · 가까이에서 F 대화 · Ctrl 공격',reward:'EXP 15 · Gold 30 (아렌에게 보고 후)'};
 }
 const objective = getVolcanoChapterObjective(progress?.worldProgress);
 const mapId = objective.mapId ?? COAST_LOCATIONS[objective.id] ?? 'volcano';
 const reward = objective.id === 'resolve-captain-outcome' && progress.worldProgress?.chapters?.volcano?.routeDecision === 'rescue'
  ? '세 직업 히든 무기' : objective.id === 'defeat-forest-boss' ? '푸른 해안 개방' : objective.id === 'collect-coast-core' ? '해안 코어 조각 · 활화산 개방' : objective.id === 'collect-volcano-core' ? '세 번째 코어 조각 · 성역 개방' : '스토리 진행 · 다음 목표';
 return {id:objective.id,title:'메인 퀘스트',body:objective.label,location:getWorldDefinition(mapId).name,controls:'방향키 이동 · 표식 근처에서 F 조사 · Ctrl 공격',reward};
}
export function questNotifications(previous, next, {saved = false} = {}) {
 const ids = [...new Set((next?.questNotificationIds ?? []).filter(id => typeof id === 'string'))];
 if (!saved) return {ids,notifications:[]};
 let current = mainQuestObjective(next); let before = previous ? mainQuestObjective(previous) : null;
 // Chapter progression can advance even when the optional starter quest was skipped.
 if (previous && getVolcanoChapterObjective(previous.worldProgress).id !== getVolcanoChapterObjective(next.worldProgress).id && before.id === current.id) {
  const asChapter = progress => mainQuestObjective({...progress, quests:{adventureStart:{status:'completed'}}});
  before = asChapter(previous); current = asChapter(next);
 }
 const notifications = [];
 if (before && before.id !== current.id && !ids.includes(`complete:${before.id}`)) {
  ids.push(`complete:${before.id}`);
  notifications.push({...before,kind:'completion',title:before.id === 'adventure-ready_to_report' ? '퀘스트 완료!' : '목표 달성!',body:before.id === 'adventure-ready_to_report' ? '아렌에게 보고를 마쳤습니다.' : `완료 · ${before.body}`,reward:before.id === 'adventure-ready_to_report' ? 'EXP 15 · Gold 30 획득' : before.reward,next:current.body});
 }
 if (!ids.includes(`objective:${current.id}`)) {
  ids.push(`objective:${current.id}`); notifications.push({...current,kind:'objective',next:''});
 }
 return {ids,notifications};
}
