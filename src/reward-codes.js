import { nextLevelExp } from './player-progression.js';

export const REWARD_POTION_LIMIT = 9999;
export const CODE_WEAPON_ID = 'heaven-sovereign-sword';
export const REWARD_CODES = Object.freeze(Object.fromEntries([
  ['JAEHOON','천상천하 유아독존 · 검사 무기 공격력 100 · 사거리 76px'],
  ['MINAH','최소 Lv.100으로 시작'],
  ['KANGIN','HP·MP 물약 각각 100개'],
  ['JOOHYEONG','최소 Lv.30 · 5,000,000 Gold'],
  ['NOISE','HP·MP 물약 각각 5개'],
  ['SLIME','슬라임 외형 · 직업과 스킬 유지'],
  ['BOSSKILLBOSS','솔로 전용 · 지역 보스 3마리 동시 등장'],
  ['TEACHER','솔로 전용 · 불사신과 연필 무기 외형'],
].map(([id,description])=>[id,Object.freeze({id,description})])));

export function normalizeRewardCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}
export function normalizeRedeemedCodeIds(value) {
  return Array.isArray(value) ? [...new Set(value.map(normalizeRewardCode).filter(id=>Object.hasOwn(REWARD_CODES,id)))] : [];
}
export function previewRewardCode(value) {
  const id=normalizeRewardCode(value);
  return Object.hasOwn(REWARD_CODES,id) ? REWARD_CODES[id] : null;
}
export function rewardCodeEffects(progress, mode='solo') {
  const ids=new Set(normalizeRedeemedCodeIds(progress?.redeemedCodeIds));
  const teacher=mode==='solo' && ids.has('TEACHER');
  return {skinId:ids.has('SLIME')?'slime':'default',immortal:teacher,pencilWeapon:teacher,bossCount:mode==='solo' && ids.has('BOSSKILLBOSS')?3:1};
}
export function redeemRewardCodes(progress, values) {
  const codes=[...new Set((Array.isArray(values)?values:[values]).map(normalizeRewardCode).filter(Boolean))];
  const fail=(reason,code=null)=>({ok:false,reason,code,progress});
  if(!codes.length) return fail('empty');
  const claimed=normalizeRedeemedCodeIds(progress.redeemedCodeIds);
  for(const code of codes) {
    if(!previewRewardCode(code)) return fail('unknown',code);
    if(claimed.includes(code)) return fail('already_redeemed',code);
  }
  const next=structuredClone(progress);
  for(const code of codes) {
    if(code==='MINAH'||code==='JOOHYEONG') {
      next.level=Math.max(next.level,code==='MINAH'?100:30);
      next.nextLevelExp=nextLevelExp(next.level);
    }
    if(code==='JOOHYEONG') next.gold+=5000000;
    if(code==='KANGIN'||code==='NOISE') {
      const quantity=code==='KANGIN'?100:5;
      next.inventory.hpPotion+=quantity;next.inventory.mpPotion+=quantity;
    }
    if(code==='JAEHOON') {
      const owned=next.equipmentByClass.warrior.ownedWeaponIds;
      if(!owned.includes(CODE_WEAPON_ID)) owned.push(CODE_WEAPON_ID);
    }
  }
  if(!Number.isSafeInteger(next.gold)||!Number.isSafeInteger(next.nextLevelExp)) return fail('overflow');
  if(Object.values(next.inventory).some(n=>!Number.isSafeInteger(n)||n<0||n>REWARD_POTION_LIMIT)) return fail('inventory_full');
  next.redeemedCodeIds=[...claimed,...codes];
  return {ok:true,progress:next,appliedCodes:codes,rewards:codes.map(code=>REWARD_CODES[code])};
}
export function redeemAndSaveCodes(progress, codes, save) {
  const result=redeemRewardCodes(progress,codes);
  if(!result.ok) return result;
  try {
    if(save(result.progress)?.ok) return result;
  } catch { /* Storage failure must not change the caller's live progress. */ }
  return {ok:false,reason:'storage_failed',progress};
}
