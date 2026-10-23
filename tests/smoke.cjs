// 在 Node VM 内测试游戏逻辑与交互入口，不依赖真实浏览器。
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'), root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
const elements=new Map();
function element(id){if(!elements.has(id)){const e={id,dataset:{},style:{},textContent:'',innerHTML:'',value:'',hidden:false,disabled:false,checked:false,offsetWidth:10,classList:{add(){},remove(){},toggle(){}},select(){}};elements.set(id,e)}return elements.get(id)}
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
assert.equal(run('s.version'),2);
assert.equal(run('s.recruited.length'),1);
assert(element('operatorCards').innerHTML.includes('临川'));
assert(element('facilityCards').innerHTML.includes('远程采矿机'));
assert(element('inventoryCards').innerHTML.includes('装备库目前为空'));
run("go('inventory')");assert.equal(run('tab'),'inventory');
run("build('mine')");assert.equal(run('s.buildings.mine'),2);
run("setPolicy('combat')");assert.equal(run('s.policy'),'combat');
run('for(let k=0;k<150;k++)tick(.5)');assert(run('s.totalKills')>0);
run('s.credits=100000;s.alloy=100000;s.energy=100000;s.data=100000;s.parts=100000;s.maxStage=5;s.stage=2;s.killsStage=6;changed()');
run("research('tactics')");assert.equal(run('s.tech.tactics'),1);
run("recruit('yor')");assert(run("s.recruited.includes('yor')"));
run("setFocus('yor')");assert.equal(run('s.focus'),'yor');
run('forge()');assert(run('s.inventory.length')>0);
run('equip(s.inventory[0].id)');assert(run('Object.values(s.equipped).some(v=>v!==null)'));
run("go('research')");assert(element('researchCards').innerHTML.includes('战术协同'));
run('selectZone(1)');assert.equal(run('s.stage'),1);
run('selectZone(2)');assert.equal(run('s.stage'),2);
run('const snap=JSON.stringify(s);s=fresh();s=hydrate(JSON.parse(snap));render(true)');assert(run('s.inventory.length')>0);
const old={version:1,credits:1000,alloy:230,energy:50,data:42,buildings:{mine:4,solar:2,trade:1,lab:0},ops:{lin:{level:15,xp:3},yor:{level:4,xp:0},shi:{level:1,xp:0}},recruited:['lin','yor'],gear:3,cores:2,stage:4,killsStage:2,totalKills:71,totalEarned:1500,enemyHp:200,logs:[],created:Date.now(),lastSave:Date.now()};
ctx.old=old;run('s=hydrate(old);render(true)');
assert.equal(run('s.version'),2);assert.equal(run('s.cores'),2);assert.equal(run('s.buildings.mine'),4);assert.equal(run('s.ops.lin.level'),15);assert.equal(run('s.stage'),4);
assert.equal(run('typeof s.tech'),'object');
// 中文状态文案以及跨页面按钮输出验证
for(const label of ['技术研发','装备仓库','任务终端'])assert(html.includes(label));
console.log('PASS: init, render, navigation, production, combat, research, recruiting, inventory, zone selection, legacy migration');