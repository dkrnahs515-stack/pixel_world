const skill = (name, delivery, mpCost, cooldown, multiplier, hitCount, extra={}) => Object.freeze({name,delivery,mpCost,cooldown,multiplier,hitCount,windup:0.12,interval:0.18,duration:0.35,range:120,arcDegrees:120,knockback:70,hitStun:0.1,hitStop:0.02,...extra});
export const SKILLS = Object.freeze({
 warrior: Object.freeze({ 'skill-e':skill('돌진 베기','dash',18,5,1.8,1,{dashDistance:90,range:100}), 'skill-r':skill('연속 검격','sequence',32,9,1.1,4,{duration:0.8,range:120}) }),
 archer: Object.freeze({ 'skill-e':skill('세 갈래 화살','spread',20,5,1,3,{range:440,speed:700,projectileKind:'spread-arrow',windup:0,interval:0}), 'skill-r':skill('화살비','area',36,10,0.9,5,{range:330,targetDistance:220,radius:110,windup:0.4,interval:0.25,duration:1.5}) }),
 mage: Object.freeze({ 'skill-e':skill('빙결탄','slow',22,6,1.6,1,{range:380,speed:540,projectileKind:'ice-bolt',slowDuration:2,slowMultiplier:0.5}), 'skill-r':skill('운석 낙하','meteor',42,12,4,1,{range:340,targetDistance:210,radius:130,windup:0.8,duration:1.1}) }),
});
export function skillDefinition(kind,classId,damage){const value=SKILLS[classId]?.[kind];return value?{...value,requiredLevel:kind==='skill-e'?5:10,damage:Number((damage*value.multiplier).toFixed(4))}:null;}
