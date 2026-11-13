'use strict';
const E=require('./engine.js');
const {createLayout,renderGame}=require('./renderer.js');
const {saveKey}=require('../../platform/storage.js');
const SAVE_KEY=saveKey('billiards');
const HELP='同机双人，亦可一人练习。轻触或拖动球台瞄准；拖动力度条；点母球盘调整击点：左右为侧塞、上为跟杆、下为拉杆。点击击球出杆。辅助线可关闭，仅示首段中心轨迹，不预测旋转或进球。自由球时点球台合法位置放白球，再瞄准。\n\n中式8球休闲规则：开球不分组，之后合法进球分全色/花色；清完自己的球再打黑8。犯规换手并给自由球。\n\n斯诺克：15红球；红1分，彩2–7分。红彩交替，打彩球前点击分值指定；最后红球之后仍打一颗彩球，再按2到7清彩。犯规罚4–7分，白球入袋在D区摆放。\n\n简化二维物理：侧塞改变碰库角度，高低杆改变碰球后的跟进/回拉。未模拟跳球、弧线、偏移和完整摩擦旋转。休闲规则省略专业裁判的自由球、无意识救球重摆等。\n\n仅本机存档。球运动中关闭进程，重启恢复存档时会回到本杆之前，防止半杆局面损坏。';
function createGame({read=()=>null,write=()=>false,services={}}={}){
 let saved;try{saved=read(SAVE_KEY);}catch{}
 let restored=saved&&saved.version===1&&E.validateRound(saved.round);
 let round=restored||E.createRound(),paused=!!restored,disposed=false,storageOK=true;
 let layout=createLayout(),angle=0,power=.55,spin={x:0,y:0},guides=saved?saved.guides!==false:true,gesture=null,generation=0;
 let stable=JSON.parse(JSON.stringify(round));
 const invalidate=()=>{if(services.invalidate)services.invalidate();};
 const toast=m=>{if(services.toast)services.toast(m);};
 function save(){try{storageOK=write(SAVE_KEY,{version:1,round:round.moving?stable:round,guides})!==false;}catch{storageOK=false;}return storageOK;}
 function pause(){paused=true;gesture=null;generation++;}
 function start(mode){round=E.createRound(mode);stable=JSON.parse(JSON.stringify(round));paused=false;gesture=null;spin={x:0,y:0};angle=0;generation++;save();invalidate();}
 function requestNew(mode){pause();const token=generation;save();if(!services.modal){toast('无法打开确认框，已保留当前球局');return false;}return services.modal({title:'开始新的台球局？',content:'将替换当前台球局，其他游戏存档不受影响。取消后点击继续。',confirmText:'新开一局',cancelText:'保留'},()=>{if(!disposed&&generation===token)start(mode);})!==false;}
 function activate(action,payload){
 if(disposed)return false;
 if(action==='billiards:resume'){paused=false;gesture=null;return true;}
 if(action==='billiards:guides'){guides=!guides;save();return true;}
 if(action==='billiards:help'){pause();save();if(services.modal)services.modal({title:'台球 · 休闲规则',content:HELP,showCancel:false});return true;}
 if(action==='billiards:mode'&&['eight','snooker'].includes(payload)&&payload!==round.mode)return requestNew(payload);
 if(action==='billiards:new')return requestNew(round.mode);
 if(paused||round.moving||round.status!=='playing')return false;
 if(action==='billiards:nominate'){const ok=E.nominate(round,payload);if(ok)save();return ok;}
 if(action==='billiards:shoot'){
   stable=JSON.parse(JSON.stringify(round));const ok=E.shoot(round,angle,power,spin);if(ok){gesture=null;save();}else if(round.ballInHand)toast('先在球台合法区域放置母球');return ok;
 }
 return false;
 }
 const inside=(p,a)=>p.x>=a.x&&p.x<=a.x+a.w&&p.y>=a.y&&p.y<=a.y+a.h;
 function adjust(p){if(!gesture)return;const k=layout.table.w/E.W;
 if(gesture.kind==='power')power=Math.max(.05,Math.min(1,(p.x-layout.power.x)/layout.power.w));
 if(gesture.kind==='spin'){let x=(p.x-layout.spin.x-41)/29,y=-(p.y-layout.spin.y-41)/29;const d=Math.max(1,Math.hypot(x,y));spin={x:x/d,y:y/d};}
 if(gesture.kind==='aim'){const cue=round.balls.find(b=>b.id===0);const x=(p.x-layout.table.x)/k,y=(p.y-layout.table.y)/k;if(Math.hypot(x-cue.x,y-cue.y)>2)angle=Math.atan2(y-cue.y,x-cue.x);}
 }
 return {id:'billiards',frameInterval:16,enter(){},resize(v){layout=createLayout(v);gesture=null;},
 render(c){return renderGame(c,layout,{round,paused,angle,power,spin,guides,storageOK});},activate,
 pointer(type,points){if(type==='cancel'||points.length>1){gesture=null;return false;}if(paused||round.moving||round.status!=='playing')return false;
 const raw=points[0];const p=raw?{x:raw.clientX===undefined?raw.x:raw.clientX,y:raw.clientY===undefined?raw.y:raw.clientY,id:raw.identifier===undefined?raw.id:raw.identifier}:null;if(type==='end'){gesture=null;return false;}if(!p)return false;
 if(type==='start'){
  if(gesture){gesture=null;return false;}
  if(inside(p,layout.power))gesture={kind:'power',id:p.id};
  else if(inside(p,layout.spin))gesture={kind:'spin',id:p.id};
  else if(inside(p,layout.table)){
   if(round.ballInHand){const k=layout.table.w/E.W;if(E.placeCue(round,(p.x-layout.table.x)/k,(p.y-layout.table.y)/k)){stable=JSON.parse(JSON.stringify(round));save();}else toast('此处不可摆球，请避开其他球及袋口');return true;}
   gesture={kind:'aim',id:p.id};
  }
 }
 if(gesture&&gesture.id!==undefined&&p.id!==undefined&&gesture.id!==p.id){gesture=null;return false;}adjust(p);return !!gesture;},
 tick(ms){if(!disposed&&!paused&&Number.isFinite(ms)&&ms>0&&round.moving){if(E.step(round,Math.min(ms,100)/1000)){stable=JSON.parse(JSON.stringify(round));save();}}},pause,save,
 sharePayload(){return {title:'来打一局台球 · 游戏之间',query:'g=billiards'};},
 getResumeInfo(){return {available:true,text:(round.mode==='eight'?'中式8球':'斯诺克')+' · 同机双人'};},
 get model(){return {round,paused,angle,power,spin,guides,status:round.status};},get layout(){return layout;},get musicActive(){return !paused&&!disposed;},
 get statusText(){return '台球 · '+(round.mode==='eight'?'中式8球':'斯诺克')+' · 玩家'+(round.turn+1);},dispose(){pause();disposed=true;}
 };
}
module.exports={createGame,SAVE_KEY,HELP};
