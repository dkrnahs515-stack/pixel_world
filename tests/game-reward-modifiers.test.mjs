import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelRPG} from '../src/game-20260903-volcano-20260905-upgrade.js';
import {TripleBossController} from '../src/triple-boss-controller-20260905-upgrade.js';
import {LocalBossController} from '../src/local-boss-controller-20260903-volcano-20260905-upgrade.js';
import {serializePlayerState,filterPlayersForMap} from '../src/network-state-20260903-volcano-20260905-upgrade.js';

test('runtime chooses triple bosses only for a solo profile with the code',()=>{
  const game=Object.create(PixelRPG.prototype);game.progress={redeemedCodeIds:['BOSSKILLBOSS']};game.sessionMode='solo';
  assert.ok(game.createLocalBossController() instanceof TripleBossController);
  game.sessionMode='online';assert.ok(game.createLocalBossController() instanceof LocalBossController);
});
test('teacher prevents actual game damage only while solo',()=>{
  const game=Object.create(PixelRPG.prototype);game.progress={redeemedCodeIds:['TEACHER']};game.sessionMode='solo';game.mapId='village';
  game.player={x:1440,y:1110,hp:100,invulnerable:0,respawnTimer:0};game.isInventoryOpen=()=>false;
  assert.deepEqual(game.damagePlayer(40,{x:1440,y:1110}),{applied:false,died:false});assert.equal(game.player.hp,100);
  game.sessionMode='online';assert.equal(game.damagePlayer(40,{x:1440,y:1110}).applied,true);assert.equal(game.player.hp,60);
});
test('presence sends only the supported slime cosmetic and never solo privileges',()=>{
  const source={x:1440,y:1110,dir:'down',name:'슬라임',classId:'mage',skinId:'slime',immortal:true,pencilWeapon:true};
  const payload=serializePlayerState(source,'village');assert.equal(payload.skinId,'slime');assert.equal(Object.hasOwn(payload,'immortal'),false);assert.equal(Object.hasOwn(payload,'pencilWeapon'),false);
  const filtered=filterPlayersForMap({other:{...payload,pencilWeapon:true,immortal:true}},'self','village').get('other');
  assert.equal(filtered.skinId,'slime');assert.equal(filtered.pencilWeapon,false);assert.equal(filtered.immortal,false);
  assert.equal(serializePlayerState({...source,skinId:'evil'},'village').skinId,'default');
});
