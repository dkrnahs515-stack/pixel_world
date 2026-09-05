import { isStoryInteractionEligible } from './story-interactions-20260903-volcano.js';

export function storyGuidance({interactions, worldProgress, mapId, player, camera, world, minimap}) {
 const chapters = worldProgress?.chapters ?? {};
 const completedIds = new Set(Object.values(chapters).flatMap(chapter => [
  ...(chapter.collectedRecordIds ?? []), ...(chapter.collectedClueIds ?? []), ...(chapter.repairedDeviceIds ?? []), ...(chapter.coolantAnchorIds ?? []),
 ]));
 const markers = interactions.filter(item => item.mapId === mapId && (
  completedIds.has(item.id) || isStoryInteractionEligible(item, worldProgress)
 )).map(item => ({...item, completed:completedIds.has(item.id),
  label:item.name ?? (item.speaker ? `${item.speaker}의 ${item.signalKind === 'current' ? '구조 신호' : '기록'}` : item.prompt?.replace(/^F\s*·\s*/, '') ?? '조사'),
  minimapX:item.x * minimap.width / world.width, minimapY:item.y * minimap.height / world.height,
 }));
 const nearest = markers.filter(item => !item.completed).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];
 let direction = null;
 if (nearest) {
  const x=nearest.x-camera.x, y=nearest.y-camera.y;
  if(x<0 || y<0 || x>camera.width || y>camera.height) {
   const dx=x-camera.width/2,dy=y-camera.height/2;
   const scale=Math.min((camera.width/2-24)/Math.max(Math.abs(dx),1),(camera.height/2-24)/Math.max(Math.abs(dy),1));
   direction={id:nearest.id,label:nearest.label,x:camera.width/2+dx*scale,y:camera.height/2+dy*scale,angle:Math.atan2(dy,dx),distance:Math.round(Math.hypot(nearest.x-player.x,nearest.y-player.y))};
  }
 }
 return {markers,direction};
}
