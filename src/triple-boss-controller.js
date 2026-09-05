import {createLocalBossController} from './local-boss-controller-20260903-volcano.js';
import {getCoopBossForMap} from './coop-boss-data-20260903-volcano.js';
import {getWorldDefinition} from './world-data-20260903-volcano.js';
import {isWorldPositionBlocked} from './world-20260903-volcano.js';

// Solo-only composition. Child encounters validate hits independently; the
// chapter sees one aggregate encounter and one reward after all three die.
export class TripleBossController {
  constructor(options={}) {this.options=options;this.children=[];this.pendingEvents=[];this.generation=0;this.rewardEmitted=false;}
  async setMap(mapId) {
    this.clear();const generation=this.generation;const definition=getCoopBossForMap(mapId);
    if(!definition)return false;
    const children=Array.from({length:3},()=>createLocalBossController(this.options));
    for(const child of children)await child.setMap(mapId);
    if(generation!==this.generation)return false;
    const world=getWorldDefinition(mapId),placed=[];
    for(let i=0;i<children.length;i++) {
      const child=children[i];let spawn=null;
      for(const distance of [0,160,240,320,400]) {
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
          const x=definition.x+dx*distance,y=definition.y+dy*distance,r=child.view.radius;
          if(isWorldPositionBlocked(mapId,x,y,r)||placed.some(v=>Math.hypot(v.x-x,v.y-y)<v.radius+r+32))continue;
          if(world.portals.some(p=>x>=p.x-r-24&&x<=p.x+p.w+r+24&&y>=p.y-r-24&&y<=p.y+p.h+r+24))continue;
          spawn={x,y};break;
        }
        if(spawn)break;
      }
      if(!spawn)throw new Error(`보스 세 마리를 배치할 공간이 없습니다: ${mapId}`);
      child.snapshot={...child.snapshot,...spawn};
      Object.assign(child.view,spawn,{prevX:spawn.x,prevY:spawn.y,id:`${definition.id}:solo-${i+1}`,name:`${definition.name} ${i+1}`});
      placed.push(child.view);
    }
    this.children=children;this.mapId=mapId;return true;
  }
  get snapshot() {
    if(!this.children.length)return null;
    const base=this.children.find(c=>c.snapshot.status==='alive')?.snapshot||this.children[0].snapshot;
    const hp=this.children.reduce((n,c)=>n+c.snapshot.hp,0),maxHp=this.children.reduce((n,c)=>n+c.snapshot.maxHp,0);
    return {...base,encounterId:`${this.children[0].snapshot.encounterId}:triple`,hp,maxHp,status:hp>0?'alive':'defeated'};
  }
  renderableBosses(){return this.children.map(c=>c.renderableBoss()).filter(Boolean);}
  targetableBosses(){return this.children.map(c=>c.targetableBoss()).filter(Boolean);}
  renderableBoss(){return this.targetableBosses()[0]||this.renderableBosses()[0]||null;}
  targetableBoss(){return this.targetableBosses()[0]||null;}
  async requestHit(request={}) {
    const child=this.children.find(c=>c.view?.id===request.targetId)
      || (!request.targetId?this.children.find(c=>c.targetableBoss()):null);
    if(!child)return {ok:false,reason:'boss_unavailable'};
    const generation=this.generation;const result=await child.requestHit(request);
    if(generation===this.generation)this.collectEvents();
    return result;
  }
  collectEvents() {
    for(const child of this.children) {
      for(const event of child.consumeEvents())if(event.type!=='boss-defeated')this.pendingEvents.push(event);
    }
    if(this.snapshot?.status==='defeated'&&!this.rewardEmitted) {
      this.rewardEmitted=true;const definition=getCoopBossForMap(this.mapId);
      this.pendingEvents.push({type:'boss-defeated',encounterId:this.snapshot.encounterId,bossId:definition.id,mapId:this.mapId,rewardExp:definition.rewardExp,rewardGold:definition.rewardGold});
    }
  }
  update(dt,context={},timestamp) {
    for(const child of this.children)child.update(dt,context,timestamp);
    this.collectEvents();return this.pendingEvents;
  }
  consumeEvents(){const result=this.pendingEvents;this.pendingEvents=[];return result;}
  clear(){this.generation++;for(const child of this.children)child.clear();this.children=[];this.pendingEvents=[];this.rewardEmitted=false;this.mapId='village';}
}
export function createTripleBossController(options){return new TripleBossController(options);}
