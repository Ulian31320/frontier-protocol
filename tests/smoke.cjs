// 在 Node VM 内测试游戏逻辑与交互入口，不依赖真实浏览器。
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'), root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
const elements=new Map();
function element(id){if(!elements.has(id)){const e={id,dataset:{},style:{},textContent:'',innerHTML:'',value:'',hidden:false,disabled:false,checked:false,offsetWidth:10,classList:{add(){},remove(){},toggle(){}},select(){},querySelector(){return {onclick:null}}};elements.set(id,e)}return elements.get(id)}
for(const id of ids)element(id);
const tabs=['overview','factory','battle','operators','inventory','research','missions','protocol'];
const nav=tabs.map(k=>({...element('nav-'+k),dataset:{tab:k},classList:{add(){},remove(){},toggle(){}}}));
const ctx={console,Date,Math,JSON,Number,String,Object,Array,Set,Map,Boolean,Infinity,parseInt,parseFloat,
 setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},confirm(){return true},
 navigator:{clipboard:{writeText:async()=>{}}},
 window:{scrollTo(){},addEventListener(){}},
 document:{hidden:false,documentElement:{classList:{add(){}}},getElementById:id=>element(id),querySelectorAll:sel=>sel==='.page'?tabs.map(element):sel==='.navbtn'?nav:[],addEventListener(type,cb){ctx.handlers[type]=cb}},
 localStorage:{state:{},getItem(k){return this.state[k]??null},setItem(k,v){this.state[k]=v},removeItem(k){delete this.state[k]}},handlers:{},
};ctx.window.document=ctx.document;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'js/art.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'js/game.js'),'utf8'),ctx);
function run(s){return vm.runInContext(s,ctx)}
assert.equal(run('s.version'),4);
assert.equal(run('s.recruited.length'),1);
assert(element('operatorCards').innerHTML.includes('临川'));
assert(element('facilityCards').innerHTML.includes('远程采矿机'));
assert(element('inventoryCards').innerHTML.includes('暂无符合条件的装备'));
run("go('inventory')");assert.equal(run('tab'),'inventory');
run("build('mine')");assert.equal(run('s.buildings.mine'),2);
run("setPolicy('combat')");assert.equal(run('s.policy'),'combat');
run('for(let k=0;k<150;k++)tick(.5)');assert(run('s.totalKills')>0);
run('s.credits=100000;s.alloy=100000;s.energy=100000;s.data=100000;s.parts=100000;s.maxStage=5;s.stage=2;s.killsStage=6;changed()');
run("research('tactics')");assert.equal(run('s.tech.tactics'),1);
run("recruit('yor')");assert(run("s.recruited.includes('yor')"));
run("setFocus('yor')");assert.equal(run('s.focus'),'yor');
run('forge()');assert(run('s.inventory.length')>0);
run("equip(s.inventory[0].id,'lin')");assert(run("Object.values(s.loadouts.lin).some(v=>v!==null)"));
run("go('research')");assert(element('researchCards').innerHTML.includes('战术协同'));
run('selectZone(1)');assert.equal(run('s.stage'),1);
run('selectZone(2)');assert.equal(run('s.stage'),2);
run('const snap=JSON.stringify(s);s=fresh();s=hydrate(JSON.parse(snap));render(true)');assert(run('s.inventory.length')>0);
const old={version:1,credits:1000,alloy:230,energy:50,data:42,buildings:{mine:4,solar:2,trade:1,lab:0},ops:{lin:{level:15,xp:3},yor:{level:4,xp:0},shi:{level:1,xp:0}},recruited:['lin','yor'],gear:3,cores:2,stage:4,killsStage:2,totalKills:71,totalEarned:1500,enemyHp:200,logs:[],created:Date.now(),lastSave:Date.now()};
ctx.old=old;run('s=hydrate(old);render(true)');
assert.equal(run('s.version'),4);assert.equal(run('s.cores'),2);assert.equal(run('s.buildings.mine'),4);assert.equal(run('s.ops.lin.level'),15);assert.equal(run('s.stage'),4);
assert.equal(run('typeof s.tech'),'object');
// 中文状态文案以及跨页面按钮输出验证
for(const label of ['技术研发','装备仓库','任务终端'])assert(html.includes(label));
// 装备系统回归测试：逐人穿戴、互斥、词条加成、锁定保护、分解规则、扩容与旧存档迁移
run('s=fresh();s.credits=1e7;s.alloy=1e7;s.energy=1e7;s.data=1e7;s.parts=1e7;s.recruited=["lin","yor","shi"];s.stage=4;s.maxStage=4;changed()');
run("makeItem(2);makeItem(1);makeItem(0)");
assert.equal(run('storageCapacity()'),60);
assert.equal(run('s.inventory.length'),3);
assert(run('affixes(s.inventory[0]).length>=1'));
run('s.inventory.push({id:s.uid++,slot:"weapon",rarity:2,zone:4,atk:32,hp:0,loot:0,crit:8,guard:0,xp:0,locked:false,name:"配装校验武器"})');
run("equip(s.inventory[s.inventory.length-1].id,'yor')");
assert(run("s.loadouts.yor.weapon===s.inventory[s.inventory.length-1].id"));
run("equip(s.inventory[s.inventory.length-1].id,'shi')");
assert(run('s.loadouts.yor.weapon===null'));
assert(run('s.loadouts.shi.weapon!==null'));
assert(run('equippedIds().size===1'));
const hp=run('maxSquadHp()'),dps=run('dps()');
assert(hp>=100&&dps>0);
run('toggleLock(s.inventory[0].id)');
assert(run('s.inventory[0].locked'));
run("setAutoSalvage('common')");
assert(run('s.inventory.every(i=>i.rarity!==0 || i.locked || assignedTo(i.id))'));
const noLoss=run('s.inventory.filter(i=>i.locked).length');assert(noLoss>0);
run('s.autoEquip=true;autoEquipBest()');
assert.equal(run('equippedIds().size'),run('new Set([...equippedIds()]).size'));
const oldStorage=run('storageCapacity()');run('upgradeStorage()');assert.equal(run('storageCapacity()'),oldStorage+20);
// 一个旧 v2 战队共用主武器，迁移后归属于第一位已招募干员。
const v2={version:2,credits:100,alloy:30,energy:5,data:0,parts:0,buildings:{mine:1,solar:1},ops:{lin:{level:2,xp:0}},recruited:['lin'],inventory:[{id:6,slot:'weapon',rarity:1,zone:2,atk:13,hp:0,loot:0,name:'旧武器'}],equipped:{weapon:6,armor:null,module:null},uid:7};
ctx.v2=v2;run('s=hydrate(v2);render(true)');
assert.equal(run('s.loadouts.lin.weapon'),6);assert.equal(run('s.inventory[0].crit'),0);
run("go('inventory')");assert(element('inventoryCards').innerHTML.includes('旧武器'));
assert(element('equipmentOperators').innerHTML.includes('临川'));
console.log('PASS: init, render, navigation, production, combat, research, recruiting, inventory, zone selection, legacy migration');
