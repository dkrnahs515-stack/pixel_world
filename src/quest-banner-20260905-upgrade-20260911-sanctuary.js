// A transient status surface: no backdrop, focus grab, key handler, or simulation pause.
export class QuestBanner {
 constructor(parent) {
  this.queue = []; this.timer = null;
  this.element = parent.ownerDocument.createElement('section');
  this.element.className = 'quest-banner hidden';
  this.element.setAttribute('role','status'); this.element.setAttribute('aria-live','polite');
  this.element.innerHTML = '<span class="quest-banner-kicker"></span><h2></h2><p class="quest-banner-goal"></p><p class="quest-banner-location"></p><p class="quest-banner-reward"></p><p class="quest-banner-next"></p><p class="quest-banner-controls"></p><button type="button" aria-label="퀘스트 알림 닫기">확인 · 닫기 ×</button>';
  this.element.querySelector('button').addEventListener('click',()=>this.advance());
  parent.append(this.element);
 }
 enqueue(notifications) { this.queue.push(...notifications); if(this.element.classList.contains('hidden')) this.advance(); }
 advance() {
  clearTimeout(this.timer); const notification=this.queue.shift();
  this.element.classList.toggle('hidden',!notification); if(!notification) return;
  const set=(selector,text)=>{this.element.querySelector(selector).textContent=text;};
  set('.quest-banner-kicker',notification.kind==='completion'?'QUEST COMPLETE':'MAIN QUEST');
  set('h2',notification.title);set('.quest-banner-goal',notification.body);
  set('.quest-banner-location',`위치 · ${notification.location}`);
  set('.quest-banner-reward',`${notification.kind==='completion'?'보상 / 진행':'목표 보상'} · ${notification.reward}`);
  set('.quest-banner-next',notification.next?`다음 · ${notification.next}`:'');
  set('.quest-banner-controls',notification.controls);
  this.timer=setTimeout(()=>this.advance(),notification.kind==='completion'?6500:10000);
 }
 reset(){this.queue=[];this.advance();}
}

export function drawQuestGuidance(ctx, guidance, cameraX, cameraY, width, height) {
 ctx.save();ctx.font='700 12px Pretendard, Arial, sans-serif';ctx.textAlign='center';
 for(const marker of guidance.markers) {
  const x=Math.round(marker.x-cameraX),y=Math.round(marker.y-cameraY);
  if(x < -100 || y < -40 || x > width+100 || y > height+40) continue;
  const label=`${marker.completed?'✓':'◆'} ${marker.label}${marker.completed?' · 수집 완료':''}`;
  const w=ctx.measureText(label).width+16;
  ctx.fillStyle='rgba(8,20,25,.9)';ctx.fillRect(x-w/2,y-48,w,22);
  ctx.fillStyle=marker.completed?'#92a9a0':'#ffe090';ctx.fillText(label,x,y-33);
  ctx.fillStyle=marker.completed?'#647a72':'#f0c66c';ctx.fillRect(x-7,y-22,14,14);
  ctx.fillStyle='#122c30';ctx.fillRect(x-3,y-19,6,2);ctx.fillRect(x-3,y-15,6,2);
 }
 const arrow=guidance.direction;
 if(arrow){
  ctx.save();ctx.translate(arrow.x,arrow.y);ctx.rotate(arrow.angle);ctx.fillStyle='#ffe090';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-7,-7);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.restore();
  const label=`${arrow.label} · ${arrow.distance}px`;const w=ctx.measureText(label).width+14;
  const x=Math.max(w/2+4,Math.min(width-w/2-4,arrow.x));const y=Math.max(50,Math.min(height-35,arrow.y));
  ctx.fillStyle='rgba(8,20,25,.94)';ctx.fillRect(x-w/2,y+12,w,22);ctx.fillStyle='#ffe090';ctx.fillText(label,x,y+27);
 }
 ctx.restore();
}
