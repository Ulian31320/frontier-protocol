// 纯逻辑测试：跨角色装备、旧版迁移、满仓不丢失保护道具、自动分解、词条增益。
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const base=path.join(__dirname,'..');const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{id,style:{},classList:{add(){},remove(){},toggle(){}},dataset:{},innerHTML:'',textContent:'',value:'',disabled:false,checked:false,querySelector(){return {onclick:null}},select(){}});return elements.get(id)}
for(const x of html.matchAll(/\bid="([^"]+)"/g))el(x[1]);
const tabs=['overview','factory','battle','operators','inventory','research','missions','protocol'];
const ctx={console,Date,Math,JSON,Number,String,Object,Array,Set,Map,Boolean,Infinity,parseInt,parseFloat,setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},confirm(){return true},navigator:{clipboard:{writeText:async()=>{}}},window:{scrollTo(){},addEventListener(){}},document:{hidden:false,documentElement:{classList:{add(){}}},getElementById:el,querySelectorAll:sel=>sel==='.page'?tabs.map(el):sel==='.navbtn'?tabs.map(k=>({...el('nav-'+k),dataset:{tab:k}})):[],addEventListener(){}},localStorage:{state:{},getItem(k){return this.state[k]||null},setItem(k,v){this.state[k]=v}},handlers:{}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(base,'js/art.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(path.join(base,'js/game.js'),'utf8'),ctx);const run=s=>vm.runInContext(s,ctx);
run('s=fresh();s.recruited=["lin","yor","shi"];s.squad=["lin","yor","shi"];s.credits=1e10;s.alloy=1e10;s.parts=1e10;s.data=1e10;s.stage=10;s.maxStage=10;changed()');
// 手动创建已知属性以测试确定性的角色装备效果。
run("s.inventory=[{id:1,slot:'weapon',rarity:2,zone:1,name:'测评主武器',atk:40,hp:0,loot:0,crit:4,guard:0,xp:0,locked:false},{id:2,slot:'weapon',rarity:1,zone:1,name:'备用主武器',atk:20,hp:0,loot:0,crit:0,guard:0,xp:0,locked:false},{id:3,slot:'armor',rarity:1,zone:1,name:'战术防具',atk:0,hp:55,loot:0,crit:0,guard:10,xp:0,locked:false},{id:4,slot:'module',rarity:2,zone:1,name:'研究芯片',atk:0,hp:0,loot:9,crit:0,guard:0,xp:6,locked:false}];s.uid=5;changed()");
assert.equal(run('maxSquadHp()'),155);const dmgBefore=run('dps()'),dropBefore=run('chanceLoot()');
run("equip(1,'lin');equip(2,'yor');equip(3,'shi');equip(4,'lin')");
assert.equal(run('equippedIds().size'),4);assert(run('dps()')>dmgBefore);assert(run('maxSquadHp()')>155);assert(run('chanceLoot()')>dropBefore);
assert.equal(run('storageUsed()'),0);run("equip(1,'shi')");assert.equal(run('s.loadouts.lin.weapon'),null);assert.equal(run('s.loadouts.shi.weapon'),1);
// 分解不能触碰已穿戴或锁定的装备。
run('salvage(1)');assert(run('s.inventory.some(x=>x.id===1)'));
run('unequip("weapon","shi")');run('toggleLock(1)');run('salvage(1)');assert(run('s.inventory.some(x=>x.id===1)'));
run("setAutoSalvage('rare')");assert(run('s.inventory.some(x=>x.id===1)'));
assert(run('s.inventory.every(i=>i.locked||assignedTo(i.id)||i.rarity===2)'));
// 满仓时如果未配置自动分解，拾取失败但不销毁原有物品。
run("s.autoSalvage='none';s.autoEquip=false;s.inventory=[];s.loadouts=Object.fromEntries(Object.keys(opDefs).map(k=>[k,emptyLoadout()]));s.uid=1");
run("for(let n=0;n<storageCapacity();n++)s.inventory.push({id:s.uid++,slot:'weapon',rarity:2,zone:1,name:'受保护库存'+n,atk:1,hp:0,loot:0,locked:true})");
const before=run('s.inventory.map(i=>i.id).join(",")');run('makeItem(2)');assert.equal(run('s.inventory.map(i=>i.id).join(",")'),before);assert.equal(run('storageUsed()'),60);
run('upgradeStorage()');assert.equal(run('storageCapacity()'),80);run('makeItem(2)');assert.equal(run('storageUsed()'),61);
// v2 共享装备转交第一名已招募角色。
ctx.old={version:2,credits:1,buildings:{},ops:{},recruited:['lin','yor'],inventory:[{id:31,name:'迁移版',slot:'armor',rarity:1,zone:1,atk:0,hp:20,loot:0}],equipped:{armor:31}};
run('s=hydrate(old)');assert.equal(run('s.loadouts.lin.armor'),31);assert.equal(run('s.loadouts.yor.armor'),null);assert.equal(run('s.version'),4);
// v3 导入导出保留新增规则与角色配装。
run("s.autoSalvage='common';s.storageLevel=4;s.inventory[0].locked=true");
const saved=run('JSON.stringify(s)');ctx.saved=saved;run('s=hydrate(JSON.parse(saved))');assert.equal(run('s.autoSalvage'),'common');assert.equal(run('s.storageLevel'),4);assert(run('s.inventory[0].locked'));
console.log('PASS: 3 operators / 9 equipment slots; anti-duplication; rarity/lock safeguards; storage expansion; auto salvage; migration; v4 persistence');
