const test=require('node:test');
const {readFileSync}=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {set,ref,get}=require('firebase/database');
test('sanctuary rules validate real anchor attack requests and frozen warning geometry',async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-pixel-world-rules',database:{rules:readFileSync('database.rules.json','utf8')}});
 try {
  await env.clearDatabase();
  const {getCoopBossForMap}=await import('../src/coop-boss-data-20260910-sanctuary.js');
  const {createOriginEncounter}=await import('../src/origin-boss-state-20260910-sanctuary.js');
  const map='sanctuary-core-heart',base=`rooms/public/bosses/${map}`,now=Date.now();
  const state=createOriginEncounter(getCoopBossForMap(map),{encounterId:'origin-rules',authorityUid:'host',now});
  const host=env.authenticatedContext('host').database();
  const guest=env.authenticatedContext('guest').database();
  await assertSucceeds(set(ref(host,base+'/state'),state));
  const warning={phase:'warning',elapsed:.1,sequence:1,attack:{kind:'energy',sourceX:1080,sourceY:760,targetX:1000,targetY:900,radius:130}};
  await assertSucceeds(set(ref(host,base+'/state/rewriteCycle'),warning));
  await assertFails(set(ref(host,base+'/state/rewriteCycle'),{...warning,attack:{...warning.attack,targetX:3000}}));
  await assertFails(set(ref(guest,base+'/state/rewriteCycle'),warning));
  await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'rooms/public/players/guest'),{mapId:map,level:30});});
  function request(seq,targetId){return {attackId:`guest:origin-rules:${seq}`,sequence:seq,uid:'guest',encounterId:'origin-rules',bossId:'origin-zero',mapId:map,classId:'warrior',weaponId:'starter-sword',attackKind:'basic',playerX:520,playerY:660,direction:'up',createdAt:Date.now(),targetId};}
  await assertSucceeds(set(ref(guest,base+'/attacks/guest/1'),request(1,'origin-anchor-life')));
  await assertFails(set(ref(guest,base+'/attacks/guest/2'),request(2,'forged-anchor')));
  await assertFails(set(ref(guest,base+'/attacks/guest/3'),{...request(3,'origin-anchor-memory'),damage:999}));
  await assertFails(set(ref(guest,base+'/state/hp'),0));
  await env.clearDatabase();
 }finally{await env.cleanup();}
});
