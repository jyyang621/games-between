'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGame,SAVE_KEY}=require('../src/games/billiards/index.js');
const {createCanvas}=(()=>{try{return require('@napi-rs/canvas');}catch{return {};}})();
const ctx=new Proxy({measureText:t=>({width:String(t).length*7})},{get:(o,k)=>k in o?o[k]:()=>{}});
function fixture(){const stored=new Map(),modals=[];const game=createGame({read:k=>stored.get(k),write:(k,v)=>{stored.set(k,JSON.parse(JSON.stringify(v)));return true;},services:{modal:(c,ok)=>{modals.push(ok);return true;}}});game.resize({width:390,height:844,safeTop:24,safeBottom:12});return {game,stored,modals};}
test('touch coordinates, power, spin, guides and gesture cancel',()=>{const {game}=fixture();let l=game.layout;game.pointer('start',[{clientX:l.power.x+l.power.w*.8,clientY:l.power.y+10,identifier:2}]);assert.ok(Math.abs(game.model.power-.8)<1e-8);game.pointer('cancel',[]);game.pointer('move',[{clientX:0,clientY:0}]);assert.ok(game.model.power>.7);game.pointer('start',[{clientX:l.spin.x+65,clientY:l.spin.y+20}]);assert.ok(game.model.spin.x>0&&game.model.spin.y>0);game.pointer('end',[]);game.activate('billiards:guides');assert.equal(game.model.guides,false);game.pause();let p=game.model.power;game.pointer('start',[{clientX:l.power.x,clientY:l.power.y}]);assert.equal(game.model.power,p);});
test('new game confirmation, stale callbacks, only billiards storage touched',()=>{const {game,stored,modals}=fixture();game.activate('billiards:mode','snooker');assert.equal(game.model.round.mode,'eight');modals[0]();assert.equal(game.model.round.mode,'snooker');game.activate('billiards:new');game.dispose();modals[1]();assert.deepEqual([...stored.keys()],[SAVE_KEY]);});
test('render both modes and portrait/landscape with valid targets',()=>{for(const [width,height] of [[390,844],[844,390]]){const {game,modals}=fixture();game.resize({width,height,safeTop:24,safeBottom:12});for(const mode of ['eight','snooker']){if(mode==='snooker'){game.activate('billiards:mode',mode);modals.pop()();}const targets=game.render(ctx);assert.ok(targets.length>=7);for(const t of targets){assert.ok(t.w>0&&t.h>0);assert.ok(t.x>=0&&t.y>=0&&t.x+t.w<=width&&t.y+t.h<=height);}}}});
test('save and restore safe snapshot instead of half a shot',()=>{const {game,stored}=fixture();const before=JSON.stringify(game.model.round.balls);assert.equal(game.activate('billiards:shoot'),true);game.tick(30);game.pause();game.save();const restored=createGame({read:k=>stored.get(k)});assert.equal(restored.model.paused,true);assert.equal(restored.model.round.moving,false);assert.equal(JSON.stringify(restored.model.round.balls),before);});

test('actual host touch routing, modal switching, repeated shoots, background and guides',t=>{
 const {createMiniGame}=require('../src/app/host.js');const handlers={},storage=new Map();let modal,clock=0;
 const platform={createCanvas:()=>({getContext:()=>ctx}),getWindowInfo:()=>({windowWidth:390,windowHeight:844,pixelRatio:1,safeArea:{top:24,bottom:832}}),getLaunchOptionsSync:()=>({}),getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,JSON.parse(JSON.stringify(v))),showModal:c=>{modal=c;}};
 for(const name of ['onTouchStart','onTouchMove','onTouchEnd','onTouchCancel','onHide','onShow','onWindowResize','onShareAppMessage'])platform[name]=f=>{handlers[name]=f;};
 const host=createMiniGame(platform,{autoTick:false,now:()=>clock});t.after(()=>host.dispose());host.activate('openGame','billiards');
 function touch(type,x,y){handlers[type]({changedTouches:[{identifier:1,clientX:x,clientY:y}]});}
 let l=host.activeGame.layout;touch('onTouchStart',l.power.x+l.power.w*.9,l.power.y+15);touch('onTouchEnd',l.power.x+l.power.w*.9,l.power.y+15);assert.ok(host.activeGame.model.power>.89);
 touch('onTouchStart',l.spin.x+60,l.spin.y+20);touch('onTouchEnd',l.spin.x+60,l.spin.y+20);assert.ok(host.activeGame.model.spin.x>0);
 const guide=host.targets.find(t=>t.action==='billiards:guides');touch('onTouchStart',guide.x+5,guide.y+5);assert.equal(host.activeGame.model.guides,false);
 assert.equal(host.activate('billiards:shoot'),true);assert.equal(host.activate('billiards:shoot'),false);clock+=40;host.tick();const state=JSON.stringify(host.activeGame.model.round);handlers.onHide();clock+=1000;host.tick();assert.equal(JSON.stringify(host.activeGame.model.round),state);handlers.onShow({});assert.equal(host.activeGame.model.paused,true);
 host.activate('billiards:resume');host.activate('billiards:mode','snooker');modal.success({confirm:false});assert.equal(host.activeGame.model.round.mode,'eight');host.activate('billiards:mode','snooker');modal.success({confirm:true});assert.equal(host.activeGame.model.round.mode,'snooker');assert.equal(host.activeGame.model.paused,false);
});


test('snooker color nomination controls never cover the table',()=>{
 for(const [width,height] of [[390,844],[844,390]]){
 const {game,modals}=fixture();game.resize({width,height,safeTop:24,safeBottom:12});game.activate('billiards:mode','snooker');modals.pop()();game.model.round.phase='color';
 const table=game.layout.table,buttons=game.render(ctx).filter(t=>t.action==='billiards:nominate');assert.equal(buttons.length,6);
 for(const b of buttons)assert.ok(b.y+b.h<table.y-5);
 }
});
