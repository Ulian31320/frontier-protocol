'use strict';
/*
 * 《边境协议》v0.2.0 游戏主引擎
 * 放置成长参考 Progress Knight 的长期经验曲线、Trimps 的区域推进与地图奖励。
 * 该项目的素材、文案和程序为原创实现；不包含上述游戏的源代码。
 *
 * 开发约定：经济和战斗先由状态驱动，再由 render() 绘制。
 * 直接修改状态后调用 changed()，并优先保证旧版 localStorage 可迁移。
 */
const $ = id => document.getElementById(id);
const fmt = n => {n=Number.isFinite(n)?Math.max(0,n):0; return n>=1e12?(n/1e12).toFixed(2)+'T':n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e4?(n/1e3).toFixed(1)+'K':Math.floor(n).toLocaleString('zh-CN')};
const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SAVEKEY='frontier_protocol_original_v1'; // 延续 v0.1 存档键，不能随意更换
const MAX_OFFLINE=8*3600;
const resourceNames={credits:'信用点',alloy:'合金',energy:'能源',data:'研究数据',parts:'机械零件'};
const costText=c=>Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>`${fmt(v)} ${resourceNames[k]}`).join(' · ');
const opDefs={
 lin:{name:'临川',role:'侦察 / VANGUARD',tag:'SR-01',desc:'善于弱点识别，能够快速处理低威胁目标。',base:5.8,bonus:.28,price:{credits:0,data:0},colors:['#8ea7a1','#334953','#d9c58d']},
 yor:{name:'尧灯',role:'技术 / CASTER',tag:'SR-02',desc:'能源调制工程师，拥有额外的装置穿透能力。',base:9.5,bonus:.32,price:{credits:310,data:18},colors:['#b7a6a7','#424e69','#dac4be']},
 shi:{name:'初砾',role:'护卫 / GUARD',tag:'SR-03',desc:'重装防护专员，能够提升行动小队的耐久上限。',base:13.2,bonus:.35,price:{credits:680,data:65},colors:['#9aadae','#53595c','#e7c47e']}
};
const bld={
 mine:{name:'远程采矿机',sub:'自动收集野外工业原料',product:'alloy',rate:.48,cost:{credits:70},mult:1.43,unlock:1,icon:'mine'},
 solar:{name:'流动供能塔',sub:'维持设备和护盾运转',product:'energy',rate:1.1,cost:{credits:85,alloy:12},mult:1.46,unlock:1,icon:'solar'},
 trade:{name:'物流交换站',sub:'承接货运，持续获得信用点',product:'credits',rate:2.0,cost:{credits:170,alloy:28,energy:10},mult:1.49,unlock:1,icon:'trade'},
 lab:{name:'边境观测所',sub:'分析异常信号，生成研究数据',product:'data',rate:.17,cost:{credits:315,alloy:65,energy:35},mult:1.57,unlock:1,icon:'lab'},
 foundry:{name:'自动精炼厂',sub:'消耗少量能源，高效精炼合金',product:'alloy',rate:1.9,consume:{energy:.34},cost:{credits:950,alloy:140,energy:60},mult:1.55,unlock:3,icon:'foundry'},
 workshop:{name:'装配零件厂',sub:'消耗合金与能源，制造机械零件',product:'parts',rate:.105,consume:{alloy:.32,energy:.28},cost:{credits:650,alloy:110,energy:45},mult:1.57,unlock:2,icon:'workshop'}
};
const zoneDefs=[
 ['灰岭外围','重返前线 · 边缘集结地','巡游构装体','废弃公路仍保留着可用的补给线路。'],
 ['沉积平原','探查矿带 · 物资回收','异常勘探机','丰富的地表矿脉吸引着失控的作业设备。'],
 ['风蚀回廊','穿越风区 · 样本回收','警戒无人机','环境监测记录了反复出现的干扰脉冲。'],
 ['北部联运区','清理交通线 · 护送运输','铁壳守卫','大型运输站的仓储设施仍处于自动封锁状态。'],
 ['废墟中继站','修复节点 · 重建通信','失联哨卫','这里保存着旧联络网的最后一段日志。'],
 ['边境禁入带','深层调查 · 信号追踪','腐化构装体','未知信号在地表之下持续汇聚。'],
 ['黑色冲积地','防线部署 · 压制群体','裂岩冲锋者','群聚型机械生命占据了原有工程通路。'],
 ['灯塔孤岛','重新接入 · 激活设施','浮空哨戒机','远方的导航灯已经熄灭了很多年。'],
 ['静海工业群','工厂清理 · 回收档案','工业监工','无人生产线上仍有复杂的机械协同。'],
 ['零号观测环','终端调查 · 取得样本','协议守望者','这里或许保留着前线失联的真正原因。']
];
// 技术采用前置区域与多级价格，供玩家在经济、战斗和收益之间权衡。
const techDefs={
 mining:{name:'复合开采',category:'产业',desc:'所有合金生产 +25% / 级',unlock:1,max:8,cost:{data:18,credits:90},rate:1.7},
 logistics:{name:'高速物流',category:'产业',desc:'信用点生产 +25% / 级',unlock:1,max:8,cost:{data:20,credits:120},rate:1.68},
 generators:{name:'储能结构',category:'产业',desc:'能源生产 +30% / 级',unlock:2,max:6,cost:{data:38,alloy:60},rate:1.8},
 analysis:{name:'样本解算',category:'产业',desc:'数据生产 +30% / 级',unlock:2,max:6,cost:{data:42,credits:220},rate:1.9},
 tactics:{name:'战术协同',category:'作战',desc:'全队造成伤害 +20% / 级',unlock:1,max:10,cost:{data:30,alloy:35},rate:1.85},
 plating:{name:'自愈装甲',category:'作战',desc:'小队耐久 +25；修复效率 +15% / 级',unlock:2,max:8,cost:{data:30,parts:4},rate:1.65},
 salvage:{name:'精细拆解',category:'探索',desc:'装备掉落概率 +4%；拆解获得更多零件',unlock:2,max:8,cost:{data:45,parts:3},rate:1.85},
 training:{name:'神经训练',category:'探索',desc:'战斗经验获取 +25% / 级',unlock:3,max:8,cost:{data:65,parts:5},rate:1.75},
 mapping:{name:'区域测绘',category:'探索',desc:'敌人奖励 +20% / 级',unlock:4,max:6,cost:{data:110,parts:10},rate:1.9},
 autonomy:{name:'自动导航',category:'探索',desc:'解锁自动推进至下一地区',unlock:3,max:1,cost:{data:90,parts:8,credits:480},rate:1}
};
const rarityDefs=[{name:'标准',class:'common',weight:70,mult:1,salvage:1},{name:'精良',class:'rare',weight:24,mult:1.85,salvage:3},{name:'卓越',class:'epic',weight:6,mult:3.1,salvage:8}];
const slotDefs={weapon:{name:'主武器',prefix:['制式','贯穿','脉冲','碳纤']},armor:{name:'防护装具',prefix:['机动','叠层','抗压','复合']},module:{name:'战术芯片',prefix:['回收','增幅','探测','协调']}};
const itemSuffix=['试验型','改良型','战地型','远征型','强化型'];
const missions=[
 {id:'first',name:'边境第一讯号',desc:'清除 3 个威胁目标',key:'kills',need:3,reward:{credits:130,alloy:35}},
 {id:'industry',name:'复工计划',desc:'拥有合计 5 级工业设施',key:'buildings',need:5,reward:{credits:250,energy:70}},
 {id:'explore2',name:'通路复原',desc:'解锁区域 02',key:'zone',need:2,reward:{data:28,parts:5}},
 {id:'study',name:'实验室日志',desc:'完成 2 级研究',key:'tech',need:2,reward:{data:58,alloy:80}},
 {id:'gear',name:'资产回收',desc:'累计收集 2 件装备',key:'loot',need:2,reward:{credits:430,parts:14}},
 {id:'zone4',name:'中继信标',desc:'抵达区域 04',key:'zone',need:4,reward:{credits:850,data:100}},
 {id:'squad',name:'三人编组',desc:'招募 3 名队员',key:'squad',need:3,reward:{alloy:230,parts:20}},
 {id:'manufacture',name:'工业化试验',desc:'生产或获得 80 个机械零件',key:'parts',need:80,reward:{credits:1400,data:160}},
 {id:'zone7',name:'远方的灯塔',desc:'抵达区域 07',key:'zone',need:7,reward:{data:300,parts:65}}
];
const dispatchDefs={
 recon:{name:'信号标绘',detail:'轻型无人机探查山脊',sec:40,cost:{energy:12},reward:{credits:100,data:12},unlock:1},
 convoy:{name:'货物护送',detail:'自动车队运送可回收物资',sec:90,cost:{energy:35,credits:70},reward:{credits:310,alloy:85},unlock:2},
 core:{name:'废墟搜寻',detail:'进行深层维修及物资回收',sec:160,cost:{energy:65,alloy:35},reward:{parts:16,data:75},unlock:3}
};
const tabMeta={overview:['总控概览','当前目标、工业产能与远征动态'],factory:['基地建设','产业链 · 能源调度 · 自动生产'],battle:['前线探索','区域推进 · 首领遭遇 · 自动战斗'],operators:['行动小队','队员成长 · 培训分工 · 装备装配'],inventory:['战利品库','随机词条 · 手动装备 · 拆解制造'],research:['技术研发','规划前置研究 · 定向强化基地'],missions:['任务终端','里程碑 · 可重复后勤派遣'],protocol:['协议档案','永久成长 · 数据与存档']};

// 新档案结构。不改旧字段语义，额外字段在 hydrate 中补全。
function fresh(cores=0){return {version:2,credits:340,alloy:50,energy:34,data:0,parts:0,
 buildings:Object.fromEntries(Object.keys(bld).map(k=>[k,k==='mine'||k==='solar'?1:0])),
 ops:Object.fromEntries(Object.keys(opDefs).map(k=>[k,{level:1,xp:0}])),recruited:['lin'],
 gear:0,cores,stage:1,maxStage:1,killsStage:0,totalKills:0,totalEarned:0,totalAlloy:50,totalParts:0,
 lootCount:0,enemyHp:0,squadHp:100,retreat:0,tech:{},claimed:{},inventory:[],equipped:{weapon:null,armor:null,module:null},uid:1,
 focus:'lin',policy:'normal',autoAdvance:false,autoEquip:false,dispatch:null,logs:[],created:Date.now(),lastSave:Date.now()};}
let s=fresh();let tab='overview';let lastTick=Date.now(),lastSave=Date.now(),lastFull=0,toastTimer=0,completedDispatches=0;
const zone=()=>zoneDefs[Math.min(s.stage-1,zoneDefs.length-1)];
const high=()=>s.maxStage||s.stage;
const researchLv=k=>s.tech[k]||0;
const mult=()=>1+s.cores*.15;
const resourceBoost=key=>key==='alloy'?1+researchLv('mining')*.25:key==='credits'?1+researchLv('logistics')*.25:key==='energy'?1+researchLv('generators')*.3:key==='data'?1+researchLv('analysis')*.3:1;
const powerBoost=()=>s.policy==='industry'&&s.energy>1?1.45:1;
const prod=k=>{const x=bld[k],lv=s.buildings[k];return lv*x.rate*mult()*resourceBoost(x.product)*(x.product!=='energy'?powerBoost():1)};
const totalProd=()=>Object.keys(bld).reduce((v,k)=>v+prod(k),0);
const enemyBoss=()=>s.killsStage%6===5;
const enemyMaxHp=()=>Math.round(24*Math.pow(1.52,s.stage-1)*(enemyBoss()?3.2:1));
const enemyDmg=()=>.65*Math.pow(1.27,s.stage-1)*(enemyBoss()?1.7:1);
const maxSquadHp=()=>100+researchLv('plating')*25+(s.recruited.includes('shi')?55:0)+(s.equipped.armor?Number(equippedItem('armor')?.hp||0):0);
const dps=()=>{let base=s.recruited.reduce((sum,k)=>sum+opDefs[k].base*(1+(s.ops[k].level-1)*opDefs[k].bonus)*(s.focus===k?1.08:1),0);return (base+Number(equippedItem('weapon')?.atk||0))*(1+s.gear*.22)*(1+researchLv('tactics')*.2)*mult()*(s.policy==='combat'&&s.energy>1?1.35:1)};
const itemLootBonus=()=>Number(equippedItem('module')?.loot||0);
const reward=()=>Math.ceil((14+s.stage*10)*(1+researchLv('mapping')*.2)*mult()*(enemyBoss()?3:1));
function addLog(msg){s.logs.unshift({ts:Date.now(),msg});s.logs=s.logs.slice(0,25)}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2300)}
function levelCap(level){return Math.round(45*(level+1)*Math.pow(1.025,level))}
function equippedItem(slot){return s.inventory.find(i=>i.id===s.equipped[slot])||null}
function afford(c){return Object.entries(c).every(([k,v])=>s[k]+1e-6>=v)}
function pay(c){if(!afford(c))return false;for(const [k,v] of Object.entries(c))s[k]=Math.max(0,s[k]-v);return true}
function credit(k,v){if(!v||v<=0)return;s[k]+=v;if(k==='credits')s.totalEarned+=v;if(k==='alloy')s.totalAlloy+=v;if(k==='parts')s.totalParts+=v}
function gainRewards(r){Object.entries(r).forEach(([k,v])=>credit(k,v))}
function costFor(d,level){return Object.fromEntries(Object.entries(d.cost).map(([k,v])=>[k,Math.ceil(v*Math.pow(d.mult||d.rate||1.6,level))]))}
function buildCost(k){return costFor(bld[k],s.buildings[k])}
function researchCost(k){let x=techDefs[k],lv=researchLv(k);return Object.fromEntries(Object.entries(x.cost).map(([a,b])=>[a,Math.ceil(b*Math.pow(x.rate,lv))]))}
function gearCost(){return {credits:Math.ceil(90*Math.pow(1.46,s.gear)),alloy:Math.ceil(24*Math.pow(1.47,s.gear)),energy:Math.ceil(11*Math.pow(1.38,s.gear))}}
function trainCost(k){return {credits:Math.ceil(50*Math.pow(1.25,s.ops[k].level)),data:Math.ceil(8*Math.pow(1.2,s.ops[k].level))}}
function salvageReward(i){return Math.ceil(rarityDefs[i.rarity].salvage*(1+researchLv('salvage')*.25))}
function itemScore(i){return i.atk*3+i.hp*.24+i.loot*8}
function chanceLoot(){return Math.min(.72,.20+researchLv('salvage')*.04+itemLootBonus()*.005)}
// 道具模型：每件装备生成一个唯一 ID，稀有度和区域决定具体属性。
function makeItem(forceRarity){let roll=Math.random()*100,rarity=forceRarity??(roll<6?2:roll<30?1:0);let slots=Object.keys(slotDefs),slot=slots[Math.floor(Math.random()*slots.length)];let d=rarityDefs[rarity];let scale=(1+s.stage*.3)*d.mult;let i={id:s.uid++,slot,rarity,zone:s.stage,atk:0,hp:0,loot:0,name:`${slotDefs[slot].prefix[Math.floor(Math.random()*4)]}${slotDefs[slot].name} · ${itemSuffix[Math.floor(Math.random()*5)]}`};
 if(slot==='weapon')i.atk=Math.ceil((3+Math.random()*4)*scale);if(slot==='armor')i.hp=Math.ceil((12+Math.random()*18)*scale);if(slot==='module')i.loot=Number(((3+Math.random()*5)*d.mult).toFixed(1));
 if(s.inventory.length>=60){const victim=s.inventory.find(x=>!Object.values(s.equipped).includes(x.id));if(victim){s.inventory=s.inventory.filter(x=>x.id!==victim.id);credit('parts',salvageReward(victim))}else{return null}}
 s.inventory.unshift(i);s.lootCount++;
 if(s.autoEquip){const old=equippedItem(slot);if(!old||itemScore(i)>itemScore(old))s.equipped[slot]=i.id}
 addLog(`回收装备：${d.name} · ${i.name}`);return i;
}
// 区域内每六只怪出现一次首领；首领保证掉落装备。击杀获得研究点和经验。
function victory(){const boss=enemyBoss(),name=boss?'区域首领':zone()[2],creds=reward();s.totalKills++;s.killsStage++;credit('credits',creds);credit('data',2+Math.ceil(s.stage*.85)*(boss?3:1));if(Math.random()<.26)credit('parts',boss?3:1+Math.floor(s.stage/3));
 if(Math.random()<.28)credit('alloy',Math.max(2,s.stage*2));
 for(const k of s.recruited){const o=s.ops[k];o.xp+=(13+s.stage*6)*(1+researchLv('training')*.25)*(s.focus===k?2:1)*(boss?2.2:1);let n=0;while(o.xp>=levelCap(o.level)&&n++<50){o.xp-=levelCap(o.level);o.level++;if(o.level%4===0)addLog(`${opDefs[k].name}训练晋升至 Lv.${o.level}`)}}
 const drop=boss||Math.random()<chanceLoot();if(drop)makeItem(boss?Math.min(2,1+(s.stage>=5&&Math.random()<.22?1:0)):undefined);
 if(boss||s.totalKills%8===0)addLog(`${name} 清除 · +${creds} 信用点${boss?' · 首领物资已回收':''}`);
 if(s.killsStage>=6 && s.autoAdvance && researchLv('autonomy')>0){advance(true)}
 s.enemyHp=enemyMaxHp();
}
// 原型设计：生产设施需消耗原料时，会在当前可负担范围内部分运行。
function simulateProduction(dt,offline=false){
 const bonus=offline?.7:1;let policy=s.policy==='industry'&&s.energy>1? .35: s.policy==='combat'&&s.energy>1?.35:0;
 if(policy){s.energy=Math.max(0,s.energy-policy*dt*bonus)}
 const buildings=Object.keys(bld).sort((a,b)=>(bld[a].consume?1:0)-(bld[b].consume?1:0));
 for(const k of buildings){const d=bld[k],lvl=s.buildings[k];if(!lvl)continue;const wanted=prod(k)*dt*bonus;let factor=1;
 for(const [rk,v] of Object.entries(d.consume||{})){if(v>0)factor=Math.min(factor,s[rk]/(v*lvl*dt*bonus||1))}
 factor=Math.max(0,Math.min(1,factor));for(const [rk,v] of Object.entries(d.consume||{}))s[rk]=Math.max(0,s[rk]-v*lvl*dt*bonus*factor);
 credit(d.product,wanted*factor);
 }
}
// 战斗状态：单位会承受伤害，护盾耗尽后撤退并恢复。任何区域都不会永久卡死。
function simulateCombat(dt,offline=false){if(s.retreat>0){s.retreat=Math.max(0,s.retreat-dt);if(s.retreat===0){s.squadHp=maxSquadHp()*.65;addLog('小队完成修复，恢复战斗部署')}return}
 const hpMax=maxSquadHp();if(s.squadHp>hpMax)s.squadHp=hpMax;
 if(s.energy>.06){let heal=Math.min(hpMax-s.squadHp,dt*(1.15+researchLv('plating')*.18));s.squadHp+=heal;s.energy=Math.max(0,s.energy-heal*.07)}
 const incoming=enemyDmg()*dt*(offline?.7:1);s.squadHp=Math.max(0,s.squadHp-incoming);
 if(s.squadHp<=0){s.retreat=10;addLog('小队护盾耗尽 · 正在自动修复（10 秒）');return}
 let damage=dps()*dt*(offline?.7:1);if(!Number.isFinite(s.enemyHp)||s.enemyHp<=0)s.enemyHp=enemyMaxHp();
 let n=0;while(damage>=s.enemyHp&&n++<150){damage-=s.enemyHp;victory();if(s.retreat>0)break}
 s.enemyHp=Math.max(0,s.enemyHp-damage);
}
function finishDispatch(now=Date.now()){if(!s.dispatch||now<s.dispatch.end)return false;const def=dispatchDefs[s.dispatch.id];s.dispatch=null;gainRewards(def.reward);completedDispatches++;addLog(`${def.name}完成：${costText(def.reward)}`);return true}
function tick(dt){simulateProduction(dt);simulateCombat(dt);if(finishDispatch())changed();}
// 计算离线收益：生产最多累计 8 小时，自动战斗最多累积 1 小时，防止离线掉落失控。
function calculateOffline(seconds){const prodSeconds=Math.min(MAX_OFFLINE,seconds),battleSeconds=Math.min(3600,seconds);
 if(prodSeconds>5){simulateProduction(prodSeconds,true)}
 // 用连续 2 秒分片重演战斗，允许中途修复与掉落，避免虚构不存在的胜利。
 if(battleSeconds>5){for(let remaining=battleSeconds;remaining>0;remaining-=2)simulateCombat(Math.min(2,remaining),true)}
 if(finishDispatch())addLog('离线期间，后勤派遣已完成');
 if(seconds>5)addLog(`离线 ${Math.floor(seconds/60)} 分钟：资源最多计 8 小时，战斗最多计 1 小时`);
}
function hydrate(p){const base=fresh(Number.isFinite(p?.cores)?p.cores:0);
 if(!p||typeof p!=='object'||(p.version!==1&&p.version!==2))return base;
 for(const k of ['credits','alloy','energy','data','parts','gear','cores','stage','maxStage','killsStage','totalKills','totalEarned','totalAlloy','totalParts','lootCount','enemyHp','squadHp','retreat','uid','created','lastSave'])if(Number.isFinite(p[k])&&p[k]>=0)base[k]=p[k];
 base.maxStage=Math.max(base.stage,base.maxStage);base.stage=Math.max(1,Math.min(999,Math.floor(base.stage)));base.maxStage=Math.max(1,Math.min(999,Math.floor(base.maxStage)));
 for(const k of Object.keys(bld))if(Number.isInteger(p.buildings?.[k])&&p.buildings[k]>=0)base.buildings[k]=Math.min(10000,p.buildings[k]);
 for(const k of Object.keys(opDefs)){let o=p.ops?.[k];if(o&&Number.isInteger(o.level)&&o.level>=1&&Number.isFinite(o.xp)&&o.xp>=0)base.ops[k]={level:Math.min(10000,o.level),xp:o.xp}}
 if(Array.isArray(p.recruited))base.recruited=[...new Set(p.recruited.filter(k=>opDefs[k]))];if(!base.recruited.length)base.recruited=['lin'];
 for(const k of Object.keys(techDefs))if(Number.isInteger(p.tech?.[k])&&p.tech[k]>=0)base.tech[k]=Math.min(techDefs[k].max,p.tech[k]);
 if(p.claimed&&typeof p.claimed==='object')for(const m of missions)if(p.claimed[m.id])base.claimed[m.id]=true;
 if(Array.isArray(p.inventory))base.inventory=p.inventory.filter(x=>x&&Number.isInteger(x.id)&&x.id>0&&slotDefs[x.slot]&&rarityDefs[x.rarity]&&typeof x.name==='string'&&x.name.length<=80&&['atk','hp','loot'].every(k=>Number.isFinite(x[k])&&x[k]>=0)).slice(0,60);
 base.uid=Math.max(base.uid,1,...base.inventory.map(i=>i.id+1));
 for(const k of Object.keys(slotDefs)){const id=p.equipped?.[k];if(base.inventory.some(i=>i.id===id&&i.slot===k))base.equipped[k]=id}
 if(opDefs[p.focus]&&base.recruited.includes(p.focus))base.focus=p.focus;
 if(['normal','industry','combat'].includes(p.policy))base.policy=p.policy;
 base.autoAdvance=!!p.autoAdvance;base.autoEquip=!!p.autoEquip;
 if(p.dispatch&&dispatchDefs[p.dispatch.id]&&Number.isFinite(p.dispatch.end))base.dispatch={id:p.dispatch.id,end:p.dispatch.end};
 if(Array.isArray(p.logs))base.logs=p.logs.filter(x=>x&&typeof x.msg==='string'&&Number.isFinite(x.ts)).slice(0,20);
 // v1 迁移：确保真实的旧武器强化、永久核心和建筑等级保留。
 if(p.version===1){base.totalAlloy=Math.max(base.totalAlloy,base.alloy);base.squadHp=maxHpFrom(base);addLogMigration(base)}
 base.version=2;return base;
}
function maxHpFrom(v){return 100+(v.recruited.includes('shi')?55:0)}
function addLogMigration(v){v.logs.unshift({ts:Date.now(),msg:'存档已从 v0.1 自动升级为 v0.2，原有资源、建筑和角色等级已保留'})}
function load(){try{const raw=localStorage.getItem(SAVEKEY);if(raw){s=hydrate(JSON.parse(raw));const off=Math.min(MAX_OFFLINE,Math.max(0,(Date.now()-(s.lastSave||Date.now()))/1000));calculateOffline(off);}else{s=fresh();addLog('前线指挥系统启动 · 采矿与能源生产自动运行')}}catch(e){console.warn('无法读取旧存档，已创建新档案',e);s=fresh();addLog('存档数据读取失败，已新建临时档案')}s.squadHp=Math.min(maxSquadHp(),s.squadHp);s.enemyHp=s.enemyHp||enemyMaxHp();}
function save(){try{s.lastSave=Date.now();localStorage.setItem(SAVEKEY,JSON.stringify(s));$('saveStatus').textContent='已保存';return true}catch(e){$('saveStatus').textContent='存档不可用';return false}}
function changed(){save();render(true)}

// 玩家主动操作。禁止交易负库存，资源不足时按钮不生效也会给予原因。
function build(k){if(!bld[k]||high()<bld[k].unlock)return;const c=buildCost(k);if(!pay(c)){toast('资源不足，请继续生产或调整优先级');return} s.buildings[k]++;addLog(`建造：${bld[k].name} Lv.${s.buildings[k]}`);toast('设施升级完成');changed()}
function recruit(k){if(s.recruited.includes(k))return;const d=opDefs[k];if(!d||!pay(d.price)){toast('招募所需资源不足');return}s.recruited.push(k);addLog(`队员 ${d.name} 已加入行动小队`);toast('新成员已加入');changed()}
function strengthen(){if(!pay(gearCost())){toast('强化材料不足');return}s.gear++;addLog(`战术装备等级 Mk.${s.gear}`);changed()}
function train(k){if(!s.recruited.includes(k)||!pay(trainCost(k))){toast('训练资源不足');return}s.ops[k].xp+=levelCap(s.ops[k].level)*.65;while(s.ops[k].xp>=levelCap(s.ops[k].level)){s.ops[k].xp-=levelCap(s.ops[k].level);s.ops[k].level++}addLog(`${opDefs[k].name} 完成集中训练`);changed()}
function equip(id){let i=s.inventory.find(x=>x.id===id);if(!i)return;s.equipped[i.slot]=id;addLog(`已装备 ${i.name}`);toast('装备已启用');changed()}
function unequip(slot){s.equipped[slot]=null;changed()}
function salvage(id){let i=s.inventory.find(x=>x.id===id);if(!i||Object.values(s.equipped).includes(id))return;let gained=salvageReward(i);s.inventory=s.inventory.filter(x=>x.id!==id);credit('parts',gained);addLog(`拆解 ${i.name} · +${gained} 零件`);changed()}
function forge(){const c={credits:180,alloy:45,parts:8};if(!pay(c)){toast('制造装备需要更多信用点、合金和零件');return}const item=makeItem(Math.random()<.2?1:0);toast(item?`制造完成：${item.name}`:'装备库已满');changed()}
function research(k){const d=techDefs[k];if(!d||high()<d.unlock||researchLv(k)>=d.max)return;const c=researchCost(k);if(!pay(c)){toast('研发资源不足');return}s.tech[k]=(s.tech[k]||0)+1;addLog(`研究完成：${d.name} Lv.${s.tech[k]}`);toast('技术研究完成');changed()}
function advance(auto=false){if(s.killsStage<6){if(!auto)toast('请先完成当前区域的 6 次目标清除');return}if(s.stage>=999)return;s.stage++;s.maxStage=Math.max(s.maxStage,s.stage);s.killsStage=0;s.enemyHp=enemyMaxHp();addLog(`已接入区域 ${s.stage}：${zone()[0]}`);if(!auto)toast(`新地区：${zone()[0]}`);changed()}
function selectZone(n){if(!Number.isInteger(n)||n<1||n>high())return;if(n===s.stage)return;s.stage=n;s.killsStage=0;s.enemyHp=enemyMaxHp();addLog(`行动线路切换至区域 ${String(n).padStart(2,'0')}`);changed()}
function questProgress(m){switch(m.key){case 'kills':return s.totalKills;case 'buildings':return Object.values(s.buildings).reduce((a,b)=>a+b,0);case 'zone':return high();case 'tech':return Object.values(s.tech).reduce((a,b)=>a+b,0);case 'loot':return s.lootCount;case 'squad':return s.recruited.length;case 'parts':return s.totalParts;default:return 0}}
function claimQuest(k){const m=missions.find(x=>x.id===k);if(!m||s.claimed[k]||questProgress(m)<m.need)return;s.claimed[k]=true;gainRewards(m.reward);addLog(`任务「${m.name}」已领取奖励`);toast('里程碑奖励已领取');changed()}
function dispatch(k){const d=dispatchDefs[k];if(!d||s.dispatch||high()<d.unlock)return;if(!pay(d.cost)){toast('派遣物资不足');return}s.dispatch={id:k,end:Date.now()+d.sec*1000};addLog(`后勤派遣已出发：${d.name}`);changed()}
function setPolicy(k){if(!['normal','industry','combat'].includes(k))return;s.policy=k;toast(`已切换至${{normal:'均衡运行',industry:'工业超频',combat:'战斗超频'}[k]}`);changed()}
function setFocus(k){if(!s.recruited.includes(k))return;s.focus=k;addLog(`集训重点调整为 ${opDefs[k].name}`);changed()}
function reset(){if(!confirm('确认永久删除本地存档及全部永久核心？此操作无法撤销。'))return;s=fresh();toast('新档案建立');changed()}
function reboot(){if(high()<5){toast('需解锁区域 05 才能进行协议重启');return}const gain=1+Math.floor((high()-5)/2);if(!confirm(`重启将重置当前轮次的设施、角色、背包装备和科技，保留已获得的永久核心。获得 ${gain} 枚核心，是否执行？`))return;s=fresh(s.cores+gain);addLog(`协议重启完成：获得 ${gain} 枚永久核心`);toast(`永久核心 +${gain}`);changed()}

function opPower(k){const o=s.ops[k],d=opDefs[k];return d.base*(1+(o.level-1)*d.bonus)}
function progressHtml(a,b){const p=Math.min(100,Math.max(0,a/Math.max(1,b)*100));return `<div class="progress"><div style="width:${p.toFixed(2)}%"></div></div>`}
function logHtml(n=5){return s.logs.slice(0,n).map(x=>`<div class="logitem"><span class="logtime">${new Date(x.ts).toLocaleTimeString('zh-CN',{hour12:false,hour:'2-digit',minute:'2-digit'})}</span><span>${esc(x.msg)}</span></div>`).join('')||'<div class="logitem">等待新的前线信息。</div>'}
function renderResource(){for(const k of ['Credits','Alloy','Energy','Data','Parts']){const e=$('res'+k);if(e)e.textContent=fmt(s[k.toLowerCase()])} $('statStage').textContent=String(s.stage).padStart(2,'0');$('statDps').textContent=dps().toFixed(1);$('statProd').textContent=totalProd().toFixed(1);$('statKills').textContent=fmt(s.totalKills);$('areanum').textContent=String(s.stage).padStart(2,'0');$('statusText').textContent=`核心加成 ×${mult().toFixed(2)} · 战斗 ${s.retreat?'修复中':'自动进行'}`;
 $('enemyName').textContent=enemyBoss()?`首领 · ${zone()[2]}`:zone()[2];$('enemyHealthText').textContent=`${fmt(Math.ceil(s.enemyHp))} / ${fmt(enemyMaxHp())} HP`;$('enemyBar').style.width=`${Math.max(0,Math.min(100,s.enemyHp/enemyMaxHp()*100))}%`;
 $('battleZone').textContent=`AREA ${String(s.stage).padStart(2,'0')} · ${zone()[0]}`;$('zoneName').textContent=zone()[0];$('zoneDesc').textContent=zone()[3];$('sectorProgress').textContent=`${Math.min(6,s.killsStage)} / 6`;$('sectorBar').style.width=`${Math.min(100,s.killsStage/6*100)}%`;$('killReward').textContent=`+${reward()} 信用点 / 自动战利品`;$('battleDps').textContent=dps().toFixed(1);
 $('advanceBtn').disabled=s.killsStage<6;$('advanceBtn').textContent=s.killsStage>=6?'开启下一调查区域 →':`等待清除 ${6-s.killsStage} 个目标`;
 $('goalTitle').textContent=s.killsStage>=6?'区域调查完成，等待推进':'清除区域威胁，回收作战物资';$('goalDesc').textContent=`${zone()[0]} · 本地区清除 ${Math.min(s.killsStage,6)}/6。${enemyBoss()?'遭遇区域首领，必定掉落装备。':'保持自动战斗，同时升级设施和技能。'}`;
 $('goalBar').style.width=`${Math.min(100,s.killsStage/6*100)}%`;$('goalPct').textContent=`${Math.round(Math.min(100,s.killsStage/6*100))}%`;$('goalAction').textContent=s.killsStage>=6?'前往解锁下一个区域 →':'查看实时战斗 →';
 const hpPct=Math.max(0,Math.min(100,s.squadHp/maxSquadHp()*100));$('squadHealth').textContent=`${fmt(Math.ceil(s.squadHp))} / ${fmt(maxSquadHp())}`;$('squadBar').style.width=hpPct+'%';$('battleStatus').textContent=s.retreat>0?`战损修复：${Math.ceil(s.retreat)}秒`:'小队防护正常';
 $('clock').textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false});if(s.dispatch)$('dispatchEta').textContent=`${dispatchDefs[s.dispatch.id].name} · ${Math.ceil(Math.max(0,s.dispatch.end-Date.now())/1000)} 秒`;else $('dispatchEta').textContent='当前没有派遣任务';}
function render(full=false){renderResource();if(!full)return;
 $('overviewLog').innerHTML=logHtml(6);$('battleLog').innerHTML=logHtml(7);
 const available=missions.filter(m=>!s.claimed[m.id]&&questProgress(m)>=m.need);const next=missions.find(m=>!s.claimed[m.id]);$('overviewTasks').innerHTML=`<div class="smallhead">// OPERATIONS / 可领取任务 ${available.length}</div>${next?`<div class="missionline"><b>${esc(next.name)}</b><span>${fmt(Math.min(next.need,questProgress(next)))} / ${next.need}</span></div>${progressHtml(questProgress(next),next.need)}<p>${esc(next.desc)} · 奖励 ${costText(next.reward)}</p>`:'<p>当前所有里程碑均已完成，可继续探索更深区域。</p>'}<button class="btn primary" data-goto="missions">任务与派遣 →</button>`;
 $('overviewLoot').innerHTML=`<div class="smallhead">// EQUIPMENT / 战利品</div><div class="summary-value">${s.inventory.length} <small>/ 60 件库存</small></div><p>累计获得 ${s.lootCount} 件装备 · 武器、防护装具与芯片提供不同属性。首领必定掉落装备。</p><button class="btn outline" data-goto="inventory">打开装备库 →</button>`;
 $('facilityCards').innerHTML=Object.entries(bld).map(([k,x])=>{const unlocked=high()>=x.unlock,c=buildCost(k),ok=afford(c);return `<article class="panel facility ${unlocked?'':'softlock'}"><div class="facicon">${facilitySvg(x.icon==='foundry'?'mine':x.icon==='workshop'?'trade':x.icon)}</div><div class="facbody"><div class="fachead"><h4>${x.name}</h4><span class="level">Lv.${s.buildings[k]}</span></div><p>${x.sub}${x.consume?' · 消耗 '+Object.entries(x.consume).map(([r,v])=>`${v} ${resourceNames[r]}/秒/级`).join(' '):''}</p><div class="facfoot"><span class="yield">+${prod(k).toFixed(2)} /秒</span><div><button class="btn ${ok&&unlocked?'primary':''}" data-build="${k}" ${unlocked?'':'disabled'}>${unlocked?'建设 +1':`区域 ${x.unlock} 解锁`}</button><div class="cost">${costText(c)}</div></div></div></div></article>`}).join('');
 $('productionInfo').innerHTML=Object.entries(bld).map(([k,d])=>`<div class="barrow"><b>${esc(d.name)}</b>${progressHtml(prod(k),Math.max(totalProd(),1))}<span class="numeric">${prod(k).toFixed(2)}/秒</span></div>`).join('');
 $('policyCards').innerHTML=[['normal','均衡运行','不消耗额外能源，基础生产与火力'],['industry','工业超频','额外消耗 0.35 能源/秒，非能源产线 +45%'],['combat','战斗超频','额外消耗 0.35 能源/秒，全队火力 +35%']].map(([k,n,desc])=>`<button class="choice ${s.policy===k?'selected':''}" data-policy="${k}"><b>${n}</b><small>${desc}</small></button>`).join('');
 $('operatorCards').innerHTML=Object.entries(opDefs).map(([k,d])=>{let owned=s.recruited.includes(k),o=s.ops[k],tc=trainCost(k);return `<article class="operator-card"><div class="portrait">${portraitSvg(k)}<span class="rank">${owned?'ACTIVE':'LOCKED'} / ${d.tag}</span></div><div class="opbody"><div class="opname"><h3>${d.name}</h3><span>Lv.${o.level}</span></div><div class="opdesc">${d.desc}</div><div class="opstat"><span>基础战力</span><b>${opPower(k).toFixed(1)} DPS</b></div>${progressHtml(o.xp,levelCap(o.level))}<div class="cost" style="text-align:left">EXP ${fmt(o.xp)} / ${fmt(levelCap(o.level))}</div>${owned?`<button class="btn ${s.focus===k?'primary':'outline'}" data-focus="${k}">${s.focus===k?'当前集训目标 · 经验 ×2':'设为集训目标'}</button><button class="btn outline" data-train="${k}">集中培训 · ${costText(tc)}</button>`:`<button class="btn primary" data-recruit="${k}">招募 · ${costText(d.price)}</button>`}</div></article>`}).join('');
 $('gearCard').innerHTML=`<h3>战术模块 / Mk.${s.gear}</h3><p>全队火力增益 +${s.gear*22}%。另可在战利品库装备随机掉落的武器和芯片。</p><button class="btn primary" data-gear="1">强化战术模块 · ${costText(gearCost())}</button>`;
 $('inventorySlots').innerHTML=Object.entries(slotDefs).map(([k,d])=>{const i=equippedItem(k);return `<div class="equipslot"><span>${d.name}</span><strong>${i?esc(i.name):'尚未装配'}</strong><small>${i?itemStat(i):'击败敌人以获得装备'}</small>${i?`<button class="btn outline" data-unequip="${k}">卸下</button>`:''}</div>`}).join('');
 $('inventoryCards').innerHTML=s.inventory.length?s.inventory.map(i=>`<article class="itemcard ${rarityDefs[i.rarity].class}"><span class="item-rank">${rarityDefs[i.rarity].name} / ${slotDefs[i.slot].name}</span><h4>${esc(i.name)}</h4><p>${itemStat(i)} · 来自区域 ${i.zone}</p><div class="item-actions"><button class="btn ${s.equipped[i.slot]===i.id?'outline':'primary'}" data-equip="${i.id}" ${s.equipped[i.slot]===i.id?'disabled':''}>${s.equipped[i.slot]===i.id?'正在使用':'装备'}</button><button class="btn outline" data-salvage="${i.id}" ${Object.values(s.equipped).includes(i.id)?'disabled':''}>拆解 +${salvageReward(i)} 零件</button></div></article>`).join(''):'<div class="empty-state">装备库目前为空。前往前线击败敌人，首领会保证掉落至少一件装备。</div>';
 $('inventoryCount').textContent=`${s.inventory.length} / 60`;$('autoEquip').checked=s.autoEquip;
 $('researchCards').innerHTML=Object.entries(techDefs).map(([k,d])=>{const lv=researchLv(k),c=researchCost(k),lock=high()<d.unlock,max=lv>=d.max;return `<article class="panel tech-card ${lock?'softlock':''}"><div class="tech-head"><span>${d.category} / TECH</span><b>Lv.${lv} / ${d.max}</b></div><h3>${d.name}</h3><p>${d.desc}</p>${progressHtml(lv,d.max)}<button class="btn ${!lock&&!max&&afford(c)?'primary':''}" data-tech="${k}" ${lock||max?'disabled':''}>${lock?`区域 ${d.unlock} 解锁`:max?'研究已完成':`研究升级 · ${costText(c)}`}</button></article>`}).join('');
 $('missionCards').innerHTML=missions.map(m=>{const value=questProgress(m),claimed=!!s.claimed[m.id],done=value>=m.need;return `<article class="mission-card ${claimed?'mission-done':''}"><div class="missionline"><strong>${m.name}</strong><span>${claimed?'已领取':`${fmt(Math.min(m.need,value))} / ${m.need}`}</span></div><p>${m.desc} · 奖励 ${costText(m.reward)}</p>${progressHtml(value,m.need)}<button class="btn ${done&&!claimed?'primary':''}" data-claim="${m.id}" ${!done||claimed?'disabled':''}>${claimed?'奖励已领取':done?'领取奖励':'尚未达成'}</button></article>`}).join('');
 $('dispatchCards').innerHTML=Object.entries(dispatchDefs).map(([k,d])=>{const locked=high()<d.unlock;return `<article class="dispatch-card"><div class="missionline"><strong>${d.name}</strong><span>${d.sec} 秒</span></div><p>${d.detail}<br>消耗 ${costText(d.cost)}<br>获得 ${costText(d.reward)}</p><button class="btn ${!locked&&!s.dispatch?'primary':''}" data-dispatch="${k}" ${locked||s.dispatch?'disabled':''}>${locked?`区域 ${d.unlock} 解锁`:s.dispatch?'进行其他派遣中':'启动派遣'}</button></article>`}).join('');
 $('autoAdvance').checked=s.autoAdvance;$('autoAdvance').disabled=researchLv('autonomy')<1;$('autoHelp').textContent=researchLv('autonomy')?'自动导航已解锁':'需要先研究「自动导航」（区域 03）';
 $('regionCards').innerHTML=Array.from({length:Math.min(10,Math.max(5,high()+1))},(_,i)=>i+1).map(n=>{const z=zoneDefs[Math.min(n-1,zoneDefs.length-1)],locked=n>high();return `<button class="region ${s.stage===n?'selected':''}" data-zone="${n}" ${locked?'disabled':''}><b>${String(n).padStart(2,'0')} · ${z[0]}</b><small>${locked?'尚未解锁':n===s.stage?'正在调查':'已开放 · 可以回头刷装备'}</small></button>`}).join('');
 $('battleReport').innerHTML=`<div class="smallhead">// COMBAT READOUT / 交战数据</div><div class="btinfo"><span>活跃小队</span><strong>${s.recruited.length} / 3</strong></div><div class="btinfo"><span>基础 DPS</span><strong>${dps().toFixed(1)}</strong></div><div class="btinfo"><span>敌方持续威胁</span><strong>${enemyDmg().toFixed(2)} /秒</strong></div><div class="btinfo"><span>区域首领</span><strong>${enemyBoss()?'正在交战':'每第六只敌人出现'}</strong></div><div class="btinfo"><span>装备掉落几率</span><strong>${Math.round(chanceLoot()*100)}%（首领必掉）</strong></div><div class="btinfo"><span>历史最高区域</span><strong>${high()}</strong></div><p>小队会自动恢复耐久。护盾耗尽时撤退修复 10 秒，不会损失永久进度。敌人战斗与产线同时运行。</p>`;
 const can=high()>=5,earn=1+Math.floor(Math.max(0,high()-5)/2);$('prestigePanel').innerHTML=`<div class="smallhead">// PERMANENT DEVELOPMENT / 永久成长</div><div class="summary-value">${s.cores} <small>枚永久协议核心</small></div><p>每枚永久核心给予全队火力与全部资源生产 +15%。<br>当前倍率 ×${mult().toFixed(2)} · 历史最高区域 ${high()}。<br>达到区域 05 才可重启，本轮预计获得 ${can?earn:0} 枚核心。重启会重置当前轮次的装备、研究和资源。</p><button class="btn ${can?'primary':''}" id="rebootBtn" ${can?'':'disabled'}>执行协议重启</button>`;
}
function itemStat(i){return [i.atk?`攻击 +${i.atk}`:'',i.hp?`小队耐久 +${i.hp}`:'',i.loot?`掉率增幅 +${i.loot}%`:'' ].filter(Boolean).join(' · ')}
// 切页路由：所有导航均不刷新页面，手机可以左右滑动顶栏查看全部标签。
function go(t){if(!tabMeta[t]||!$(t))return;tab=t;document.querySelectorAll('.page').forEach(e=>e.classList.toggle('hidden',e.id!==t));document.querySelectorAll('.navbtn').forEach(e=>e.classList.toggle('active',e.dataset.tab===t));$('pageTitle').textContent=tabMeta[t][0];$('breadcrumb').textContent=tabMeta[t][0];$('pageSubtitle').textContent=tabMeta[t][1];render(true);window.scrollTo({top:0,behavior:'instant'});}
function animateAttack(){const a=$('heroFig'),e=$('enemyFig'),b=$('beam');for(const x of [a,e,b]){x.classList.remove('hit','attack','flash');void x.offsetWidth}a.classList.add('attack');e.classList.add('hit');b.classList.add('flash')}
function modal(title,value,importing){const root=$('modalRoot');root.innerHTML=`<div class="modalback"><div class="modal" role="dialog" aria-modal="true"><h3>${title}</h3><p>${importing?'粘贴由旧游戏或本游戏导出的 JSON 存档。':'以下文本为本机存档。更换浏览器或设备之前请保存副本。'}</p><textarea id="saveta" spellcheck="false" aria-label="存档文本"></textarea><div class="modalactions"><button class="btn outline" id="closeModal">关闭</button><button class="btn primary" id="modalSubmit">${importing?'确认导入':'复制存档'}</button></div></div></div>`;$('saveta').value=value||'';$('closeModal').onclick=()=>root.innerHTML='';$('modalSubmit').onclick=async()=>{if(importing){try{const obj=JSON.parse($('saveta').value);if(!obj||![1,2].includes(obj.version)||!Number.isFinite(obj.credits)||!obj.buildings||!obj.ops)throw Error('invalid');s=hydrate(obj);s.enemyHp=enemyMaxHp();s.lastSave=Date.now();root.innerHTML='';addLog('外部存档导入成功');changed();toast('导入成功')}catch(e){toast('导入失败，请检查 JSON 是否完整')}}else{try{await navigator.clipboard.writeText($('saveta').value);toast('已复制文本')}catch(e){$('saveta').select();toast('请手动复制选中的内容')}}};root.querySelector('.modalback').onclick=e=>{if(e.target===root.querySelector('.modalback'))root.innerHTML=''}}
function init(){load();render(true);$('runtimeNotice').hidden=true;document.documentElement.classList.add('app-ready');
 // 事件委托：动态卡片重绘后，按钮不需要重新绑定事件。
 document.addEventListener('click',e=>{const b=e.target.closest('[data-tab],button');if(!b||b.disabled)return;let k;
 if(k=b.dataset.tab){e.preventDefault();go(k)}else if(k=b.dataset.goto)go(k);else if(k=b.dataset.build)build(k);else if(k=b.dataset.recruit)recruit(k);else if(k=b.dataset.train)train(k);else if(k=b.dataset.focus)setFocus(k);else if(k=b.dataset.equip)equip(Number(k));else if(k=b.dataset.salvage)salvage(Number(k));else if(k=b.dataset.unequip)unequip(k);else if(k=b.dataset.tech)research(k);else if(k=b.dataset.claim)claimQuest(k);else if(k=b.dataset.dispatch)dispatch(k);else if(k=b.dataset.policy)setPolicy(k);else if(k=b.dataset.zone)selectZone(Number(k));else if(b.dataset.gear)strengthen();else if(b.id==='rebootBtn')reboot();else if(b.id==='forgeBtn')forge();});
 $('goalAction').onclick=()=>go('battle');$('advanceBtn').onclick=()=>advance();$('saveNow').onclick=()=>toast(save()?'存档已保存':'本机无法写入存档');$('exportSave').onclick=()=>{save();modal('导出存档',JSON.stringify(s),false)};$('importSave').onclick=()=>modal('导入存档','',true);$('hardReset').onclick=reset;
 $('autoAdvance').onchange=e=>{if(researchLv('autonomy')){s.autoAdvance=e.target.checked;changed()}};$('autoEquip').onchange=e=>{s.autoEquip=e.target.checked;changed()};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save();else{const now=Date.now();const off=Math.min(MAX_OFFLINE,Math.max(0,(now-lastTick)/1000));if(off>3)calculateOffline(off);lastTick=now;changed()}});window.addEventListener('pagehide',save);
 setInterval(()=>{if(document.hidden)return;const now=Date.now(),dt=Math.max(0,Math.min(.5,(now-lastTick)/1000));lastTick=now;const before=s.totalKills;tick(dt);render(false);if(before!==s.totalKills&&tab==='battle')animateAttack();if(now-lastFull>1200){lastFull=now;render(true)}if(now-lastSave>10000){lastSave=now;save()}},200);
}
init();