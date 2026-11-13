'use strict';
const { W, H, R, POCKETS, targetText } = require('./engine.js');
const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';
const rect = (x,y,w,h) => ({x,y,w,h});
function createLayout(v={}) {
  const width=Math.max(240,v.width||375),height=Math.max(240,v.height||750);
  const top=Math.max(v.safeTop||0,v.capsuleRect ? v.capsuleRect.bottom||0 : 0)+8;
  const bottom=height-(v.safeBottom||0)-42, landscape=width>height*1.1;
  const available=Math.max(130,bottom-top-118);
  const rail=landscape?Math.min(220,width*.32):width-32;
  const bw=landscape?Math.min(width-rail-44,available*2):Math.min(width-48,Math.max(80,available-220)*2);
  const table=rect(landscape?20:(width-bw)/2,top+116,bw,bw/2);
  const controls=landscape?rect(width-rail-12,top+116,rail,available):rect(16,table.y+table.h+24,width-32,190);
  return {width,height,top,bottom,table,controls,landscape,
    power:rect(controls.x+12,controls.y+47,controls.w-24,34),
    spin:rect(controls.x+10,controls.y+88,82,82)};
}
function text(c,s,x,y,size=13,color='#e8eee8',align='left') { c.font=`${size}px ${FONT}`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(String(s),x,y); }
function circle(c,x,y,r,color){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
function renderGame(c,l,s){
 const {round:r,paused,angle,power,spin,guides}=s, targets=[];
 c.fillStyle='#102c2b';c.fillRect(0,0,l.width,l.height);
 function button(a,label,action,payload,on=false){c.fillStyle=on?'#cba85c':'#244744';c.fillRect(a.x,a.y,a.w,a.h);text(c,label,a.x+a.w/2,a.y+a.h/2,12,on?'#132e2b':'#eef1e9','center');targets.push({...a,label,action,payload});}
 button(rect(12,l.top,48,32),'大厅','home');text(c,'台球俱乐部',74,l.top+16,19);
 button(rect(l.width-62,l.top,50,32),'玩法','billiards:help');
 const tabs=(l.width-32)/3;
 button(rect(16,l.top+40,tabs-5,30),'中式 8 球','billiards:mode','eight',r.mode==='eight');
 button(rect(16+tabs,l.top+40,tabs-5,30),'斯诺克','billiards:mode','snooker',r.mode==='snooker');
 button(rect(16+tabs*2,l.top+40,tabs-5,30),'重新开局','billiards:new');
 const t=l.table,k=t.w/W;
 c.fillStyle='#89613f';c.fillRect(t.x-10,t.y-10,t.w+20,t.h+20);c.fillStyle='#176c58';c.fillRect(t.x,t.y,t.w,t.h);
 c.strokeStyle='#93b6a1';c.lineWidth=1;c.beginPath();c.moveTo(t.x+t.w*.2,t.y);c.lineTo(t.x+t.w*.2,t.y+t.h);c.stroke();
 for(const p of POCKETS)circle(c,t.x+p.x*k,t.y+p.y*k,Math.max(5,23*k),'#071514');
 if(r.mode==='snooker') {
  c.strokeStyle=r.ballInHand?'#f4dfaa':'#93b6a1';c.lineWidth=r.ballInHand?2:1;
  c.beginPath();c.moveTo(t.x+210*k,t.y);c.lineTo(t.x+210*k,t.y+t.h);c.stroke();
  c.beginPath();c.arc(t.x+210*k,t.y+250*k,90*k,Math.PI/2,Math.PI*1.5);c.stroke();
  if(r.ballInHand)text(c,'D区摆球',t.x+25*k,t.y+250*k,10,'#f4dfaa');
 }
 const cue=r.balls.find(b=>b.id===0);
 // A short cue is an aiming control indicator, not an auxiliary trajectory.
 // Keep it visible with guides disabled so a player can still aim deliberately.
 if(cue&&cue.active&&!r.moving&&!paused&&r.status==='playing'){
  const dx=Math.cos(angle),dy=Math.sin(angle),cx=t.x+cue.x*k,cy=t.y+cue.y*k;
  c.save();c.beginPath();c.rect(t.x-8,t.y-8,t.w+16,t.h+16);c.clip();
  c.strokeStyle='#e8c69a';c.lineWidth=3;c.beginPath();
  c.moveTo(cx-dx*(R*k+6),cy-dy*(R*k+6));c.lineTo(cx-dx*(R*k+40),cy-dy*(R*k+40));c.stroke();c.restore();
 }

 if(guides&&cue&&cue.active&&!r.moving&&!paused&&r.status==='playing'){
  const dx=Math.cos(angle),dy=Math.sin(angle);let distance=1500;
  for(const b of r.balls){if(!b.active||b.id===0)continue;const x=b.x-cue.x,y=b.y-cue.y,d=x*dx+y*dy,perp=x*x+y*y-d*d;if(d>0&&perp<4*R*R)distance=Math.min(distance,d-Math.sqrt(4*R*R-perp));}
  for(const [coord,dir,max] of [[cue.x,dx,W],[cue.y,dy,H]])if(Math.abs(dir)>1e-8)distance=Math.min(distance,((dir>0?max-R:R)-coord)/dir);
  c.save();c.setLineDash([6,5]);c.strokeStyle='#f8ecb2';c.lineWidth=1.5;c.beginPath();c.moveTo(t.x+cue.x*k,t.y+cue.y*k);c.lineTo(t.x+(cue.x+dx*distance)*k,t.y+(cue.y+dy*distance)*k);c.stroke();c.restore();
  circle(c,t.x+(cue.x+dx*distance)*k,t.y+(cue.y+dy*distance)*k,Math.max(2,R*k),'#b6ccb6');
 }
 const colors=['#fff8df','#edce36','#397fbd','#c84f4a','#8e5ca3','#e38c42','#368d72','#873b40','#192022'];
 for(const b of r.balls){if(!b.active)continue;const x=t.x+b.x*k,y=t.y+b.y*k,rad=Math.max(3,R*k);let color=b.id===0?'#fff9e9':r.mode==='eight'?colors[b.id>8?b.id-8:b.id]:({1:'#cf4344',2:'#f0cc3b',3:'#51a776',4:'#9d6950',5:'#428cc0',6:'#e49dba',7:'#171b23'}[b.value]);
 circle(c,x+1,y+1,rad,'#0a4035');circle(c,x,y,rad,color);
 if(r.mode==='eight'&&b.id>8){c.fillStyle='#fff8df';c.fillRect(x-rad*.86,y-rad*.25,rad*1.72,rad*.5);}
 if(r.mode==='eight'&&b.id!==0)text(c,b.id,x,y,Math.max(5,rad*1.1),b.id>8?'#1f3030':'#fff','center');}
 const a=l.controls;
 const state=r.status==='won'?`玩家 ${r.winner+1} 获胜`:paused?'已暂停':r.moving?'球正在运动…':`玩家 ${r.turn+1} · ${targetText(r)}`;
 text(c,state,a.x,a.y+4,14,'#f4dfaa');
 text(c,r.mode==='snooker'?`得分 ${r.scores[0]} : ${r.scores[1]}`:`同机双人 · ${r.groups.map(g=>g==='solid'?'全色':g==='stripe'?'花色':'未分组').join(' / ')}`,a.x,a.y+25,12);
 const p=l.power;c.fillStyle='#244744';c.fillRect(p.x,p.y,p.w,p.h);c.fillStyle='#cba85c';c.fillRect(p.x,p.y,p.w*power,p.h);text(c,`力度 ${Math.round(power*100)}% · 拖动调整`,p.x+p.w/2,p.y+p.h/2,12,'#fff','center');
 const sp=l.spin;circle(c,sp.x+41,sp.y+41,36,'#f3efe1');c.strokeStyle='#a5afa3';c.beginPath();c.moveTo(sp.x+8,sp.y+41);c.lineTo(sp.x+74,sp.y+41);c.moveTo(sp.x+41,sp.y+8);c.lineTo(sp.x+41,sp.y+74);c.stroke();circle(c,sp.x+41+spin.x*29,sp.y+41-spin.y*29,5,'#c25447');
 text(c,'上跟 / 下拉 · 左右塞',sp.x+41,sp.y+90,10,'#c6d7cb','center');
 const bx=a.x+102,bw=a.w-102;
 button(rect(bx,a.y+88,bw,32),guides?'辅助线：开':'辅助线：关','billiards:guides');
 button(rect(bx,a.y+126,bw,36),paused?'继续':r.ballInHand?'先摆放母球':r.moving?'请稍候':'击球',paused?'billiards:resume':'billiards:shoot',undefined,!paused&&!r.moving);
 const fy=Math.min(l.bottom-12,a.y+198);
 text(c,r.message||'拖动球台瞄准，调整力度与击点后击球',16,fy,11,'#bdd1c5');
 if(!s.storageOK)text(c,'本机存档失败，请勿退出',16,fy+17,11,'#ffb6a3');
 if(!(r.mode==='snooker'&&r.phase==='color'&&!r.moving&&!paused))text(c,r.ballInHand?'请先在合法区域摆放母球':'拖动球台瞄准 · 点击母球盘加塞',16,l.top+90,11,'#bdd1c5');
 if(r.mode==='snooker'&&r.phase==='color'&&!r.moving&&!paused){const y=l.top+76,w=(l.width-32)/6;for(let n=2;n<=7;n++)button(rect(16+(n-2)*w,y,w-3,28),`${n} 分`,'billiards:nominate',n,r.nomination===n);}
 return targets;
}
module.exports={createLayout,renderGame};
