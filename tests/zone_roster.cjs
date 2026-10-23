// v0.4 回归测试：章节地图、动态地图、四人小队、专精、v3 向后兼容。
const {readFileSync}=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const html=readFileSync(path.join(root,'index.html'),'utf8');
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{id,style:{},classList:{add(){},remove(){},toggle(){}},dataset:{},innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,checked:false,select(){},querySelector(){return {onclick:null}}});return elements.get(id)}
for(const m of html.matchAll(/\bid="([^"]+)"/g))element(m[1]);
const tabs=['overview','factory','battle','operators','inventory','research','missions','protocol'];
const ctx={console,Date,Math,JSON,Number,String,Object,Array,Set,Map,Boolean,Infinity,parseInt,parseFloat,
 setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},confirm(){return true},navigator:{clipboard:{writeText:async()=>{}}},
 window:{scrollTo(){},addEventListener(){}},document:{hidden:false,documentElement:{classList:{add(){}}},getElementById:element,querySelectorAll:sel=>sel==='.page'?tabs.map(element):sel==='.navbtn'?tabs.map(t=>({dataset:{tab:t},classList:{toggle(){}}})):[],addEventListener(){}},
 localStorage:{data:{},getItem(k){return this.data[k]||null},setItem(k,v){this.data[k]=v}},handlers:{}};
vm.createContext(ctx);vm.runInContext(readFileSync(path.join(root,'js/art.js'),'utf8'),ctx);vm.runInContext(readFileSync(path.join(root,'js/game.js'),'utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);
assert.equal(run('s.version'),4);assert.equal(run('Object.keys(opDefs).length'),12);assert.equal(run('zoneDefs.length'),30);assert.equal(run('chapterDefs.length'),6);
assert.equal(run('zoneAt(1)[0]'),'灰岭外围');assert.equal(run('zoneAt(30)[0]'),'零号观测环');assert.notEqual(run('zoneAt(31)[0]'),run('zoneAt(32)[0]'));
assert.equal(run('regionGoal(1)'),6);assert.equal(run('regionGoal(6)'),8);assert.equal(run('regionGoal(26)'),16);
assert(run('enemyMaxHp()')>0);
run('s.credits=1e12;s.alloy=1e12;s.energy=1e12;s.data=1e12;s.parts=1e12;s.maxStage=30;s.stage=30;s.killsStage=0;s.mapChapter=5;render(true)');
assert(element('regionCards').innerHTML.includes('零号观测环'));
run('chooseMapChapter(0)');assert(element('regionCards').innerHTML.includes('灰岭外围'));
run('chooseMapChapter(5)');assert(element('regionCards').innerHTML.includes('零号观测环'));
// 第 30 区完成 16 个目标，进入 31 区以后动态区域仍能正确显示。
run('s.killsStage=regionGoal(30);advance()');assert.equal(run('s.stage'),31);assert.equal(run('s.mapChapter'),6);assert(element('regionCards').innerHTML.includes('深层协议'));
// 新增干员都能招募，且最多四人出战；待命不提供 DPS 加成。
run("s=fresh();s.credits=1e12;s.alloy=1e12;s.energy=1e12;s.data=1e12;s.parts=1e12;");
for(const op of ['sai','qi','yor','shi','nuo','su','en','li','mo','yun','ge'])run(`recruit('${op}')`);
assert.equal(run('s.recruited.length'),12);assert.equal(run('s.squad.length'),4);
const originalSquad=run('s.squad.slice()');
run("toggleSquad('li')");assert.equal(run('s.squad.length'),4); // 队伍满员不能增加第五人
const dpsBefore=run('dps()');
run("toggleSquad('sai')");assert.equal(run('s.squad.length'),3);
run("toggleSquad('li')");assert.equal(run('s.squad.length'),4);assert(run('dps()')>dpsBefore);
run('s.ops.li.level=12');const activeDps=run('dps()');run("toggleSquad('li')");assert(run('dps()')<activeDps);
run('s.squad=["lin"];s.squadHp=30;');assert.equal(run("squadBuff('heal')"),0);run("toggleSquad('yun')");assert.equal(run("squadBuff('heal')"),7);
const sample=run('portraitSvg("yun")');assert(sample.includes('svg')&&sample.includes('path'));
assert.notEqual(run('portraitSvg("yun")'),run('portraitSvg("mo")'));
// 升级 v3 不丢失已招募角色、装备、战斗线路等。
const p={version:3,credits:2000,alloy:300,energy:120,data:90,parts:35,buildings:{mine:4,solar:2},ops:{lin:{level:7,xp:35},yor:{level:8,xp:49}},recruited:['lin','yor'],loadouts:{lin:{weapon:2,armor:null,module:null}},inventory:[{id:2,name:'旧式脉冲武器',slot:'weapon',rarity:2,zone:5,atk:45,hp:0,loot:0}],stage:8,maxStage:12,storageLevel:2,uid:3};ctx.legacy=p;
run('s=hydrate(legacy)');assert.equal(run('s.version'),4);assert.equal(run('s.stage'),8);assert.equal(run('s.maxStage'),12);assert.equal(run('s.squad.length'),2);assert.equal(run('s.loadouts.lin.weapon'),2);assert.equal(run('s.storageLevel'),2);
run('save();s=fresh();load()');assert.equal(run('s.version'),4);assert.equal(run('s.squad.length'),2);
const css=readFileSync(path.join(root,'css/styles.css'),'utf8');
assert(css.includes('.loot-grid{grid-template-columns:repeat(5,minmax(0,1fr));'));
assert(css.includes('.loot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}'));
console.log('PASS: 30 named zones, procedural sector 31+, 12 operators, 4 deployment slots, traits, paging, v3 compatibility, five-column CSS');
