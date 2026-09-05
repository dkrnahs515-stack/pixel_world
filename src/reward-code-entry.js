import { redeemRewardCodes, redeemAndSaveCodes, rewardCodeEffects } from './reward-codes.js';

const messages={empty:'보상 코드를 입력해 주세요.',unknown:'알 수 없는 코드입니다.',already_redeemed:'이 닉네임에서 이미 받은 코드입니다.',storage_failed:'저장하지 못해 보상을 지급하지 않았습니다. 저장 공간을 확인하고 다시 시도해 주세요.',inventory_full:'물약 보유 한도를 초과합니다.',overflow:'보유 수치 한도를 초과합니다.'};
export function bindRewardCodeEntry({input,preview,redeem,status,getSelection,load,save,selectionInputs=[]}) {
  if(!input||!preview||!redeem||!status) return;
  let previewKey=null;
  const codes=()=>input.value.split(/[\s,;]+/u).filter(Boolean);
  const key=selection=>JSON.stringify([selection.nickname,selection.classId,selection.playMode,codes()]);
  const invalidate=()=>{previewKey=null;redeem.disabled=true;};
  invalidate();input.addEventListener('input',invalidate);
  for (const element of selectionInputs) {
    for (const event of ['input','change','click','keydown']) element?.addEventListener(event,()=>{
      if(previewKey!==null) status.textContent='변경한 닉네임과 코드의 보상을 다시 확인해 주세요.';
      invalidate();
    });
  }
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();preview.click();}});
  preview.addEventListener('click',()=>{
    invalidate();const selection=getSelection();
    if(!selection.ok){status.textContent=selection.error;return;}
    const result=redeemRewardCodes(load(selection.nickname),codes());
    if(!result.ok){status.textContent=messages[result.reason]||'코드를 적용하지 못했습니다.';return;}
    const soloWarning=selection.playMode==='online' && result.progress.redeemedCodeIds.some(id=>['TEACHER','BOSSKILLBOSS'].includes(id));
    status.textContent=`${selection.nickname}님에게 지급: ${result.rewards.map(r=>r.description).join(' / ')}${soloWarning?' · 불사신·연필·보스 3마리는 솔로에서만 적용됩니다.':''}`;
    previewKey=key(selection);redeem.disabled=false;
  });
  redeem.addEventListener('click',()=>{
    const selection=getSelection();
    if(!selection.ok||previewKey!==key(selection)){invalidate();status.textContent='변경한 닉네임과 코드의 보상을 다시 확인해 주세요.';return;}
    const result=redeemAndSaveCodes(load(selection.nickname),codes(),progress=>save(selection.nickname,progress));
    if(!result.ok){status.textContent=messages[result.reason]||'코드를 적용하지 못했습니다.';return;}
    invalidate();input.value='';
    const effects=rewardCodeEffects(result.progress,selection.playMode);
    status.textContent=`지급 완료! ${selection.nickname} · Lv.${result.progress.level} · ${result.progress.gold.toLocaleString('ko-KR')} G · HP/MP 물약 ${result.progress.inventory.hpPotion}/${result.progress.inventory.mpPotion}개${effects.immortal?' · 솔로 불사신':''}${effects.bossCount===3?' · 솔로 보스 3마리':''} · 무기는 입장 후 인벤토리에서 장착하세요.`;
  });
}
