import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialProgress } from '../src/quest-state-20260903-volcano-20260905-upgrade.js';
let api = {};
try { api = await import('../src/reward-codes-20260905-upgrade.js'); } catch (error) { if(error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }

test('entry codes normalize and stack eight specified rewards without changing the source', () => {
  assert.equal(typeof api.redeemRewardCodes, 'function');
  const source=createInitialProgress();
  const result=api.redeemRewardCodes(source,[' jaehoon ','MINAH','kangin','JOOHYEONG','NOISE','SLIME','BOSSKILLBOSS','TEACHER','noise']);
  assert.equal(result.ok,true);
  assert.equal(result.progress.level,100);
  assert.equal(result.progress.nextLevelExp,10000);
  assert.equal(result.progress.gold,5000000);
  assert.deepEqual(result.progress.inventory,{hpPotion:105,mpPotion:105});
  assert.equal(result.progress.equipmentByClass.warrior.ownedWeaponIds.includes('heaven-sovereign-sword'),true);
  assert.equal(result.progress.equipmentByClass.warrior.equippedWeaponId,'starter-sword');
  assert.equal(result.progress.redeemedCodeIds.length,8);
  assert.deepEqual(source,createInitialProgress());
});
test('codes never lower an existing level or erase experience',()=>{
  assert.equal(typeof api.redeemRewardCodes,'function');
  const source={...createInitialProgress(),level:120,exp:57,nextLevelExp:12000};
  const result=api.redeemRewardCodes(source,['MINAH','JOOHYEONG']);
  assert.equal(result.progress.level,120);assert.equal(result.progress.exp,57);
});
test('unknown or previously claimed codes reject the full transaction',()=>{
  assert.equal(typeof api.redeemRewardCodes,'function');
  const p=api.redeemRewardCodes(createInitialProgress(),['NOISE']).progress;
  for(const codes of [['KANGIN','NOISE'],['KANGIN','UNKNOWN']]) {
    const r=api.redeemRewardCodes(p,codes);assert.equal(r.ok,false);assert.equal(r.progress,p);
  }
});
test('online retains slime skin but disables teacher and triple boss modifiers',()=>{
  assert.equal(typeof api.rewardCodeEffects,'function');
  const p={redeemedCodeIds:['SLIME','TEACHER','BOSSKILLBOSS']};
  assert.deepEqual(api.rewardCodeEffects(p,'solo'),{skinId:'slime',immortal:true,pencilWeapon:true,bossCount:3});
  assert.deepEqual(api.rewardCodeEffects(p,'online'),{skinId:'slime',immortal:false,pencilWeapon:false,bossCount:1});
});
test('failed save neither claims codes nor grants inventory in the live progress',()=>{
  assert.equal(typeof api.redeemAndSaveCodes,'function');
  const p=createInitialProgress();let attempted;
  const r=api.redeemAndSaveCodes(p,['KANGIN'],next=>{attempted=next;return {ok:false};});
  assert.equal(r.ok,false);assert.equal(r.progress,p);assert.equal(p.inventory.hpPotion,0);
  assert.equal(attempted.inventory.hpPotion,100);
  const retry=api.redeemAndSaveCodes(p,['KANGIN'],()=>({ok:true}));
  assert.equal(retry.progress.inventory.hpPotion,100);
});

test('eight code rewards roundtrip through the real v7 save including the 100-damage sword',async()=>{
  const {saveProgress,loadProgress}=await import('../src/progress-storage-20260903-volcano-20260905-upgrade.js');
  const {getWeaponDefinition}=await import('../src/weapon-data-20260903-volcano-20260905-upgrade.js');
  const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const r=api.redeemRewardCodes(createInitialProgress(),Object.keys(api.REWARD_CODES));
  assert.deepEqual(saveProgress(storage,'보상검증',r.progress),{ok:true});
  const loaded=loadProgress(storage,'보상검증');assert.deepEqual(loaded,r.progress);
  const sword=getWeaponDefinition('heaven-sovereign-sword');
  assert.equal(sword.damage,100);assert.equal(sword.range,76);assert.equal(sword.name,'천상천하 유아독존');
});

test('entry preview must precede redeem and failed storage leaves an actionable error',async()=>{
  let entry={};try {entry=await import('../src/reward-code-entry-20260905-upgrade.js');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
  assert.equal(typeof entry.bindRewardCodeEntry,'function');
  const element=()=>({value:'',textContent:'',disabled:false,events:{},addEventListener(k,fn){this.events[k]=fn;}});
  const input=element(),preview=element(),redeem=element(),status=element();let saved=0;
  input.value='KANGIN';
  entry.bindRewardCodeEntry({input,preview,redeem,status,getSelection:()=>({ok:true,nickname:'코드',classId:'warrior',playMode:'solo'}),load:()=>createInitialProgress(),save:()=>{saved++;return {ok:false};}});
  assert.equal(redeem.disabled,true);preview.events.click();assert.equal(redeem.disabled,false);
  assert.match(status.textContent,/100/);redeem.events.click();assert.equal(saved,1);assert.match(status.textContent,/저장/);
  input.value='unknown';input.events.input();assert.equal(redeem.disabled,true);
});


test('changing entry identity, class or mode invalidates the reward preview immediately',async()=>{
  const {bindRewardCodeEntry}=await import('../src/reward-code-entry-20260905-upgrade.js');
  const element=()=>({value:'',textContent:'',disabled:false,events:{},addEventListener(k,fn){this.events[k]=fn;}});
  const input=element(),preview=element(),redeem=element(),status=element();
  const nickname=element(),classCard=element(),modeCard=element();
  input.value='NOISE';
  bindRewardCodeEntry({input,preview,redeem,status,selectionInputs:[nickname,classCard,modeCard],getSelection:()=>({ok:true,nickname:'코드',classId:'warrior',playMode:'solo'}),load:()=>createInitialProgress(),save:()=>({ok:true})});
  for(const [element,event] of [[nickname,'input'],[classCard,'click'],[modeCard,'keydown']]) {
    preview.events.click();assert.equal(redeem.disabled,false);
    element.events[event]?.();assert.equal(redeem.disabled,true);
    assert.match(status.textContent,/다시 확인/);
  }
});
