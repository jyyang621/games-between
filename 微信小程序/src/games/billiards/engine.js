'use strict';
// Deliberately bounded 2D leisure simulation, not a tournament referee.
const W = 1000, H = 500, R = 11, DT = 1 / 240;
const POCKETS = [{x:0,y:0},{x:W/2,y:0},{x:W,y:0},{x:0,y:H},{x:W/2,y:H},{x:W,y:H}];
const spots = {2:[210,340],3:[210,160],4:[210,250],5:[500,250],6:[710,250],7:[900,250]};
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
function ball(id,value,x,y,group) { return {id,value,x,y,vx:0,vy:0,active:true,group,side:0,follow:0}; }
function createRound(mode='eight') {
  mode = mode === 'snooker' ? mode : 'eight';
  const balls = [ball(0,0,250,250,'cue')];
  if (mode === 'eight') {
    const order=[1,9,2,10,8,3,4,11,5,12,13,6,14,7,15]; let n=0;
    for(let row=0;row<5;row++) for(let col=0;col<=row;col++) {
      const id=order[n++]; balls.push(ball(id,id,700+row*(Math.sqrt(3)*R+0.3),250+(col-row/2)*(2*R+0.3),id===8?'black':id<8?'solid':'stripe'));
    }
  } else {
    balls[0].x=180; balls[0].y=275;
    for(const value of [2,3,4,5,6,7]) balls.push(ball(value,value,...spots[value],'color'));
    let id=10;
    for(let row=0;row<5;row++) for(let col=0;col<=row;col++) balls.push(ball(id++,1,739+row*(Math.sqrt(3)*R+0.3),250+(col-row/2)*(2*R+0.3),'red'));
  }
  return {version:1,mode,balls,turn:0,scores:[0,0],groups:[null,null],moving:false,status:'playing',winner:null,message:'玩家 1 开球',ballInHand:false,phase:'red',nomination:7,clearValue:2,breakShot:true,shots:0,shot:null,accumulator:0};
}
function cue(round) {return round.balls.find(b=>b.id===0);}
function onIds(r) {
  if(r.mode==='snooker') return r.balls.filter(b=>b.active && (r.phase==='red'?b.group==='red':b.value===(r.phase==='color'?r.nomination:r.clearValue))).map(b=>b.id);
  const group=r.groups[r.turn];
  if(!group) return r.balls.filter(b=>b.active && ['solid','stripe'].includes(b.group)).map(b=>b.id);
  const own=r.balls.filter(b=>b.active && b.group===group);
  return own.length?own.map(b=>b.id):[8];
}
function targetText(r) {
  if(r.status==='won') return '本局结束';
  if(r.mode==='eight') return r.groups[r.turn] ? (onIds(r).includes(8)?'黑 8':r.groups[r.turn]==='solid'?'全色球':'花色球') : '开放球台';
  if(r.phase==='red') return '红球';
  const names={2:'黄球',3:'绿球',4:'棕球',5:'蓝球',6:'粉球',7:'黑球'};
  return names[r.phase==='color'?r.nomination:r.clearValue];
}
function nominate(r,value) {
  if(r.moving || r.status!=='playing' || r.mode!=='snooker' || r.phase!=='color' || ![2,3,4,5,6,7].includes(value)) return false;
  r.nomination=value; return true;
}
function legalPlacement(r,x,y) {
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<R||x>W-R||y<R||y>H-R) return false;
  if(POCKETS.some(p=>Math.hypot(p.x-x,p.y-y)<25)) return false;
  if(r.mode==='snooker' && (x>210 || Math.hypot(x-210,y-250)>90)) return false;
  return !r.balls.some(b=>b.active && b.id!==0 && Math.hypot(b.x-x,b.y-y)<2*R+0.2);
}
function placeCue(r,x,y) {
  if(!r.ballInHand || r.moving || r.status!=='playing' || !legalPlacement(r,x,y)) return false;
  Object.assign(cue(r),{x,y,active:true,vx:0,vy:0,side:0,follow:0}); r.ballInHand=false; return true;
}
function shoot(r,angle,power,spin={x:0,y:0}) {
  if(r.moving||r.ballInHand||r.status!=='playing'||!Number.isFinite(angle)||!Number.isFinite(power)||power<=0||!cue(r).active) return false;
  power=clamp(power,0,1); const c=cue(r), speed=80+power*1150;
  c.vx=Math.cos(angle)*speed; c.vy=Math.sin(angle)*speed;
  c.side=clamp(Number.isFinite(spin.x)?spin.x:0,-1,1); c.follow=clamp(Number.isFinite(spin.y)?spin.y:0,-1,1);
  r.shot={first:null,pots:[],rail:false,targets:onIds(r),phase:r.phase,nomination:r.nomination,clearValue:r.clearValue,elapsed:0};
  r.moving=true; r.accumulator=0; r.message='球在运动中'; return true;
}
function respot(r,b) {
  const spot=b.id===8?[700,250]:spots[b.value]||[250,250];
  let found=null;
  // Bounded search, first along the length then whole table; never overlap.
  const free=(x,y)=> x>=R && x<=W-R && y>=R && y<=H-R && !r.balls.some(o=>o!==b&&o.active&&Math.hypot(o.x-x,o.y-y)<2*R+0.2);
  for(let d=0;d<W&&!found;d+=2*R+1) for(const sign of [1,-1]) if(free(spot[0]+d*sign,spot[1])) {found=[spot[0]+d*sign,spot[1]];break;}
  for(let y=R;y<H-R&&!found;y+=2*R+1) for(let x=R;x<W-R;x+=2*R+1) if(free(x,y)){found=[x,y];break;}
  if(!found) throw new Error('No legal respot');
  Object.assign(b,{x:found[0],y:found[1],vx:0,vy:0,active:true,side:0,follow:0});
}
function finish(r) {
  const s=r.shot, p=r.turn, other=1-p;
  let foul=s.first===null||!s.targets.includes(s.first)||s.pots.includes(0);
  const pots=s.pots.map(id=>r.balls.find(b=>b.id===id));
  if(r.mode==='eight') {
    if(!s.rail && !pots.some(b=>b.id!==0)) foul=true;
    const black=pots.some(b=>b.id===8);
    if(black && !r.breakShot) {r.status='won'; r.winner=!foul&&s.targets.length===1&&s.targets[0]===8?p:other;}
    if(black && r.breakShot) respot(r,r.balls.find(b=>b.id===8));
    const ordinary=pots.filter(b=>['solid','stripe'].includes(b.group));
    if(!foul && !r.breakShot && !r.groups[p] && ordinary.length) {r.groups[p]=ordinary[0].group;r.groups[other]=ordinary[0].group==='solid'?'stripe':'solid';}
    const ownPot=ordinary.some(b=>!r.groups[p]||b.group===r.groups[p]) || (r.breakShot && black);
    if(foul||!ownPot) r.turn=other;
    if(foul){r.ballInHand=true;const c=cue(r);c.active=false;}
    r.message=foul?'犯规，对手全台自由球':ownPot?'合法进球，继续击球':'换手';
  } else {
    const objectPots=pots.filter(b=>b.id!==0);
    if(objectPots.some(b=>!s.targets.includes(b.id))) foul=true;
    if(s.phase!=='red' && objectPots.length>1) foul=true;
    if(foul) {
      const involved=[4,s.phase==='red'?1:s.phase==='color'?s.nomination:s.clearValue,...objectPots.map(b=>b.value)];
      const first=r.balls.find(b=>b.id===s.first); if(first) involved.push(first.value);
      const penalty=Math.max(...involved);r.scores[other]+=penalty;r.turn=other;
      r.message=`犯规，对手 +${penalty} 分`;
    } else if(objectPots.length) {const points=objectPots.reduce((sum,b)=>sum+b.value,0);r.scores[p]+=points;r.message=`+${points} 分，继续击球`;} else {r.turn=other;r.message='换手';}
    const reds=r.balls.some(b=>b.active&&b.group==='red');
    for(const b of objectPots) if(b.group==='color' && (s.phase!=='clear'||foul)) respot(r,b);
    if(s.phase==='clear') {if(!foul&&objectPots.length) r.clearValue++;}
    else if(!foul && s.phase==='red' && objectPots.length) r.phase='color';
    else r.phase=reds?'red':'clear';
    if(s.pots.includes(0)) {r.ballInHand=true;cue(r).active=false;}
    // Final black ends frame on a legal pot OR foul (no unnecessary second black).
    if(s.phase==='clear'&&s.clearValue===7&&(foul||objectPots.length)) {
      if(r.scores[0]===r.scores[1]) {respot(r,r.balls.find(b=>b.value===7));r.phase='clear';r.clearValue=7;r.ballInHand=true;cue(r).active=false;r.message='平分：重置黑球决胜';}
      else {r.status='won';r.winner=r.scores[0]>r.scores[1]?0:1;}
    }
  }
  r.breakShot=false;r.shots++;r.moving=false;r.shot=null;r.accumulator=0;
  for(const b of r.balls) {b.vx=0;b.vy=0;b.side=0;b.follow=0;}
  if(r.status==='won') r.message=`玩家 ${r.winner+1} 获胜`;
}
function substep(r) {
  const s=r.shot; s.elapsed+=DT;
  for(const b of r.balls) if(b.active) {
    b.x+=b.vx*DT;b.y+=b.vy*DT;
    if(POCKETS.some(p=>Math.hypot(b.x-p.x,b.y-p.y)<23)) {b.active=false;b.vx=0;b.vy=0;s.pots.push(b.id);continue;}
    const hitX=b.x<R||b.x>W-R,hitY=b.y<R||b.y>H-R;
    if(hitX) {b.x=clamp(b.x,R,W-R);b.vx=-b.vx*0.82;b.vy+=b.side*Math.abs(b.vx)*0.18*(b.x<W/2?1:-1);b.side*=0.7;}
    if(hitY) {b.y=clamp(b.y,R,H-R);b.vy=-b.vy*0.82;b.vx+=b.side*Math.abs(b.vy)*0.18*(b.y<H/2?-1:1);b.side*=0.7;}
    if((hitX||hitY)&&s.first!==null) s.rail=true;
  }
  const live=r.balls.filter(b=>b.active);
  for(let i=0;i<live.length;i++) for(let j=i+1;j<live.length;j++) {
    const a=live[i],b=live[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d>=2*R) continue;
    const nx=d>1e-7?dx/d:1,ny=d>1e-7?dy/d:0,overlap=2*R-d;
    a.x-=nx*overlap/2;a.y-=ny*overlap/2;b.x+=nx*overlap/2;b.y+=ny*overlap/2;
    const approach=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
    if(approach<=0) continue;
    const cueBall=a.id===0?a:b.id===0?b:null;
    const prior=cueBall?{vx:cueBall.vx,vy:cueBall.vy}:null;
    const impulse=approach*0.98;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;
    if(cueBall) {
      if(s.first===null) s.first=cueBall===a?b.id:a.id;
      // Follow/draw is an intentionally simplified post-impact longitudinal impulse.
      cueBall.vx+=prior.vx*cueBall.follow*0.32;cueBall.vy+=prior.vy*cueBall.follow*0.32;cueBall.follow*=0.2;
    }
  }
  for(const b of live) {
    const speed=Math.hypot(b.vx,b.vy),next=Math.max(0,speed-125*DT);
    const scale=speed?Math.min(next,1600)/speed:0;b.vx*=scale;b.vy*=scale;
    b.side*=Math.exp(-0.45*DT);b.follow*=Math.exp(-0.2*DT);
  }
  if(s.elapsed>30||r.balls.every(b=>!b.active||Math.hypot(b.vx,b.vy)<2)) finish(r);
}
function step(r,seconds) {
  if(!r.moving||!Number.isFinite(seconds)||seconds<=0) return false;
  r.accumulator+=Math.min(seconds,0.1);
  while(r.moving&&r.accumulator>=DT){r.accumulator-=DT;substep(r);}
  return !r.moving;
}
function validateRound(value) {
  try {
    if(!value||value.version!==1||!['eight','snooker'].includes(value.mode)) return null;
    const r=JSON.parse(JSON.stringify(value)),template=createRound(r.mode);
    if(!Array.isArray(r.balls)||r.balls.length!==template.balls.length||!['playing','won'].includes(r.status)||![0,1].includes(r.turn)||typeof r.moving!=='boolean'||typeof r.ballInHand!=='boolean'||typeof r.breakShot!=='boolean') return null;
    for(const b of r.balls) {
      const expected=template.balls.find(t=>t.id===b.id);
      if(!expected||r.balls.filter(t=>t.id===b.id).length!==1||b.value!==expected.value||b.group!==expected.group||typeof b.active!=='boolean') return null;
      for(const key of ['x','y','vx','vy','side','follow']) if(!Number.isFinite(b[key])) return null;
      if(b.x< -R||b.x>W+R||b.y< -R||b.y>H+R||Math.hypot(b.vx,b.vy)>1700||Math.abs(b.side)>1||Math.abs(b.follow)>1) return null;
    }
    if(!Array.isArray(r.scores)||r.scores.length!==2||r.scores.some(n=>!Number.isInteger(n)||n<0||n>1e7)||!Array.isArray(r.groups)||r.groups.length!==2||r.groups.some(g=>![null,'solid','stripe'].includes(g))) return null;
    if(!['red','color','clear'].includes(r.phase)||![2,3,4,5,6,7].includes(r.nomination)||!Number.isInteger(r.clearValue)||r.clearValue<2||r.clearValue>8||!Number.isInteger(r.shots)||r.shots<0||!Number.isFinite(r.accumulator)||r.accumulator<0||r.accumulator>0.2) return null;
    if(r.status==='won'&&![0,1].includes(r.winner)) return null;
    if(typeof r.message!=='string'||r.message.length>150) return null;
    if(r.moving) {
      const s=r.shot,ids=r.balls.map(b=>b.id);
      if(!s||!Array.isArray(s.targets)||!Array.isArray(s.pots)||s.targets.some(id=>!ids.includes(id))||s.pots.some(id=>!ids.includes(id))||new Set(s.pots).size!==s.pots.length||!(s.first===null||ids.includes(s.first))||typeof s.rail!=='boolean'||!Number.isFinite(s.elapsed)||s.elapsed<0||s.elapsed>31||!['red','color','clear'].includes(s.phase)||![2,3,4,5,6,7].includes(s.nomination)||![2,3,4,5,6,7].includes(s.clearValue)) return null;
    } else if(r.shot!==null) return null;
    return r;
  } catch {return null;}
}
module.exports={W,H,R,POCKETS,createRound,shoot,step,placeCue,nominate,validateRound,targetText};
