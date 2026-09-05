import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialProgress } from '../src/quest-state-20260903-volcano-20260905-upgrade.js';
import { completeRegion } from '../src/chapter-progress-20260903-volcano-20260905-upgrade.js';
import { questNotifications } from '../src/quest-notifications-20260905-upgrade.js';
import { storyGuidance } from '../src/quest-guidance-20260905-upgrade.js';
import { ALL_STORY_INTERACTIONS } from '../src/story-interactions-20260903-volcano-20260905-upgrade.js';

test('first quest has location controls reward and appears once across reload', () => {
 const progress = createInitialProgress();
 const result = questNotifications(null, progress, { saved: true });
 assert.equal(result.notifications.length, 1);
 const goal = result.notifications[0];
 assert.match(goal.body, /아렌/); assert.match(goal.location, /마을/); assert.match(goal.controls, /F/); assert.match(goal.reward, /15.*30/);
 assert.equal(questNotifications(null, {...progress, questNotificationIds: result.ids}, {saved:true}).notifications.length, 0);
});
test('completion requires save and queues before next goal without frame/reconnect spam', () => {
 const before = createInitialProgress(); before.quests.adventureStart.status = 'ready_to_report';
 const after = structuredClone(before); after.quests.adventureStart.status = 'completed';
 assert.deepEqual(questNotifications(before, after, {saved:false}).notifications, []);
 const result = questNotifications(before, after, {saved:true});
 assert.deepEqual(result.notifications.map(n=>n.kind), ['completion','objective']);
 assert.match(result.notifications[0].next, /숲/);
 assert.match(result.notifications[0].body, /마쳤습니다/);
 assert.equal(result.notifications[0].reward, 'EXP 15 · Gold 30 획득');
 assert.deepEqual(questNotifications(after, {...after, questNotificationIds:result.ids}, {saved:true}).notifications, []);
});
test('eligible records receive labels/minimap points; collected distinct and never targeted', () => {
 const world = completeRegion(createInitialProgress().worldProgress, 'forest').progress;
 const args = {interactions:ALL_STORY_INTERACTIONS, worldProgress:world, mapId:'coast-beach', player:{x:0,y:0}, camera:{x:0,y:0,width:300,height:200}, world:{width:2000,height:1600}, minimap:{width:200,height:160}};
 const result = storyGuidance(args);
 assert.ok(result.markers.some(m=>m.id==='sera-distress-current' && /세라/.test(m.label)));
 assert.ok(result.direction); assert.ok(result.direction.x <= 276 && result.direction.y <= 176);
 world.chapters.coast.collectedRecordIds.push('sera-distress-current'); world.chapters.coast.repairedDeviceIds.push('coast-beach-transceiver');
 const done = storyGuidance(args); assert.equal(done.direction,null); assert.ok(done.markers.every(m=>m.completed));
 assert.deepEqual(storyGuidance({...args,mapId:'coast-wreck-bay'}).markers, []);
});
test('onscreen nearest target suppresses offscreen arrow and minimap mapping is exact', () => {
 const worldProgress = completeRegion(createInitialProgress().worldProgress, 'forest').progress;
 const result = storyGuidance({interactions:ALL_STORY_INTERACTIONS,worldProgress,mapId:'coast-beach',player:{x:1100,y:700},camera:{x:1000,y:600,width:500,height:500},world:{width:2000,height:1600},minimap:{width:200,height:160}});
 assert.equal(result.direction,null); const marker=result.markers.find(m=>m.id==='coast-beach-transceiver'); assert.equal(marker.minimapX,112);assert.equal(marker.minimapY,72);
});

test('quest completion save failure restores reward and does not announce success', async () => {
 const {PixelRPG} = await import('../src/game-20260903-volcano-20260905-upgrade.js');
 const game=Object.create(PixelRPG.prototype); game.progress=createInitialProgress(); game.progress.quests.adventureStart={status:'ready_to_report',progress:3};
 const before=structuredClone(game.progress), notices=[];
 game.persistProgress=()=>false;game.notify=text=>notices.push(text);
 for(const method of ['applyProgressionStats','updateQuestHud','updateProgressHud','updateHud','updateBiome','closeNpcDialogue']) game[method]=()=>{};
 game.handleDialogueAction('complete');
 assert.deepEqual(game.progress,before);assert.equal(notices.some(text=>text.includes('완료!')),false);
});

test('notification receipts roundtrip in v7 with old saves unchanged', async () => {
 const {saveProgress,loadProgress}=await import('../src/progress-storage-20260903-volcano-20260905-upgrade.js');
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const progress=createInitialProgress();progress.questNotificationIds=['objective:adventure-available'];
 assert.equal(saveProgress(storage,'guide',progress).ok,true);
 assert.deepEqual(loadProgress(storage,'guide').questNotificationIds,progress.questNotificationIds);
 assert.deepEqual(questNotifications(null,loadProgress(storage,'guide'),{saved:true}).notifications,[]);
});
test('runtime queues completion only after real successful storage write and deduplicates retry', async () => {
 const {PixelRPG}=await import('../src/game-20260903-volcano-20260905-upgrade.js');
 const game=Object.create(PixelRPG.prototype);game.player={name:'quest-save'}; game.progress=createInitialProgress();game.progress.quests.adventureStart={status:'ready_to_report',progress:3};
 game.savedQuestProgress=structuredClone(game.progress);game.progress.quests.adventureStart.status='completed';game.progress.completedQuests=['adventureStart'];
 const queued=[];game.questBanner={enqueue:events=>queued.push(...events)};game.notify=()=>{};
 const previous=globalThis.localStorage;
 try {
  globalThis.localStorage={getItem:()=>null,setItem:()=>{throw new Error('quota');}};
  assert.equal(game.persistProgress(),false);assert.equal(queued.length,0);assert.equal(game.progress.questNotificationIds,undefined);
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  assert.equal(game.persistProgress(),true);assert.deepEqual(queued.map(n=>n.kind),['completion','objective']);
  game.persistProgress(); assert.equal(queued.length,2);
 } finally { if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous; }
});
test('chapter milestones announce even if player skipped the starter quest', () => {
 const previous=createInitialProgress();const next=structuredClone(previous);next.worldProgress=completeRegion(next.worldProgress,'forest').progress;
 const result=questNotifications(previous,next,{saved:true});assert.deepEqual(result.notifications.map(n=>n.kind),['completion','objective']);assert.match(result.notifications[1].body,/송수신기/);
});
