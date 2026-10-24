'use strict';
/*
 * 《边境协议》v0.5.0 游戏主引擎
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
// 干员配表：沿用现有代码 ID，扩展到 12 名；视觉统一采用原创工业科幻 SVG 角色卡。
// 专精只在编入行动小队时生效；未入队的干员仍可配装和训练。
// v0.6 五名干员，保留旧键以便迁移训练及装备存档；以下技能数值为本作自定义。
const opDefs={
 lin:{name:'凛御银灰',role:'先锋 / VANGUARD',tag:'ARK-01',desc:'雪境先遣指挥者，善于战术部署。',base:7.2,bonus:.31,price:{credits:0,data:0},colors:['#c9d2db','#273445','#608dcf'],visual:'visor',talent:'雪境号令：普通敌人伤害 +16%',passive:'assault',amount:.16},
 yor:{name:'重岳',role:'近卫 / GUARD',tag:'ARK-02',desc:'炎国武术宗师，精于近身连续作战。',base:12.6,bonus:.35,price:{credits:310,data:18},colors:['#48484d','#262d37','#e0ae67'],visual:'blade',talent:'万壑崩云：全队伤害 +10%',passive:'power',amount:.10},
 shi:{name:'黍',role:'重装 / DEFENDER',tag:'ARK-03',desc:'岁家成员，以丰收之力守护行动小队。',base:10.4,bonus:.3,price:{credits:680,data:65},colors:['#d6cbb0','#637aa0','#e6c579'],visual:'shield',talent:'丰岁庇护：伤害减免 14%',passive:'guard',amount:.14},
 sai:{name:'祀',role:'辅助 / SUPPORT',tag:'END-04',desc:'终末地寒冷辅助干员，擅长持续战场支援。',base:8.8,bonus:.32,price:{credits:160,data:10},colors:['#a8d4c4','#436779','#9cd5d1'],visual:'antenna',talent:'青溯脉冲：护盾回复 +5 /秒',passive:'heal',amount:5},
 nuo:{name:'明河',role:'近卫 / GUARD',tag:'END-05',desc:'终末地锋线近卫，擅长精英目标突破。',base:16.8,bonus:.34,price:{credits:1200,data:95,alloy:80},colors:['#e2c68e','#354c6e','#e2b26c'],visual:'blade',talent:'龙吟断流：首领伤害 +30%',passive:'boss',amount:.30}
};
const bld={
 mine:{name:'远程采矿机',sub:'自动收集野外工业原料',product:'alloy',rate:.48,cost:{credits:70},mult:1.43,unlock:1,icon:'mine'},
 solar:{name:'流动供能塔',sub:'维持设备和护盾运转',product:'energy',rate:1.1,cost:{credits:85,alloy:12},mult:1.46,unlock:1,icon:'solar'},
 trade:{name:'物流交换站',sub:'承接货运，持续获得信用点',product:'credits',rate:2.0,cost:{credits:170,alloy:28,energy:10},mult:1.49,unlock:1,icon:'trade'},
 lab:{name:'边境观测所',sub:'分析异常信号，生成研究数据',product:'data',rate:.17,cost:{credits:315,alloy:65,energy:35},mult:1.57,unlock:1,icon:'lab'},
 foundry:{name:'自动精炼厂',sub:'消耗少量能源，高效精炼合金',product:'alloy',rate:1.9,consume:{energy:.34},cost:{credits:950,alloy:140,energy:60},mult:1.55,unlock:3,icon:'foundry'},
 workshop:{name:'装配零件厂',sub:'消耗合金与能源，制造机械零件',product:'parts',rate:.105,consume:{alloy:.32,energy:.28},cost:{credits:650,alloy:110,energy:45},mult:1.57,unlock:2,icon:'workshop'}
};
const chapterDefs=[
 {name:'灰岭边境',sub:'救援信标与地表交通线',key:'CH.01'},
 {name:'工业残响',sub:'机床噪音、回收工厂与高炉',key:'CH.02'},
 {name:'静海遗迹',sub:'无主工业群与旧日网络',key:'CH.03'},
 {name:'冻土干涉',sub:'低温通信与能源异常',key:'CH.04'},
 {name:'深环管制',sub:'高风险密封区与受控设施',key:'CH.05'},
 {name:'观测界面',sub:'零号信号与最终的封锁命令',key:'CH.06'}
];
// 每一项区域拥有自己的敌人、掉落提示和故事；每五个区域有一次章节压轴首领。
const zoneDefs=[
 ['灰岭外围','救援通道 · 前锋集结','巡游构装体','通向前线的公路刚刚完成清理。'],
 ['沉积平原','矿带探查 · 物资回收','异常勘探机','裸露矿床间仍散布着失控挖掘设备。'],
 ['风蚀回廊','风障穿越 · 传感器维修','警戒无人机','原本用于预警的无人机正在阻挡所有访客。'],
 ['北部联运区','交通线清理 · 运输护送','铁壳守卫','货运闸门拒绝执行人工开放指令。'],
 ['废墟中继站','章节首领 · 通信再连接','逆频监察机','持续回放的应急广播来自被封闭的控制室。'],
 ['锈港集装场','港区回收 · 材料检索','锈港掠行机','废弃集装箱沿着早已停止的轨道缓慢移动。'],
 ['封锁管线区','液压封锁 · 管道清障','增压切割机','高压设备仍在执行数年前的维修指令。'],
 ['高架转运桥','物流恢复 · 高架巡检','轨道警戒车','运输桥周围出现未经登记的装甲巡检车。'],
 ['倒塌反应堆','能源管控 · 冷却循环','负载暴走体','过载的安全程序正在毁坏剩余的反应设备。'],
 ['裂谷控制塔','章节首领 · 系统校准','裂谷枢纽者','废弃塔楼内的主控逻辑开始自我复制。'],
 ['静海卸载区','工业遗址 · 货箱收束','堆垛巡逻兵','海风中循环运行的装卸臂与危险轨道交错。'],
 ['浮游观测台','空中设备 · 目标回收','高空侦测球','浮游站的自动防卫系统拒绝任何靠近。'],
 ['镜面储备库','试验设施 · 物资接收','反射型单元','迷宫状仓库里充满用于误导定位的镜面墙。'],
 ['封存数据井','旧档分析 · 碎片拼合','存档执勤者','封存服务器的存储阵列传出不属于人类的回复。'],
 ['静海主处理机','章节首领 · 母机切断','静海母机','一次常规维修演变成了整片工业群的危机。'],
 ['霜线驻扎地','冻土地带 · 前哨建立','寒带侦察体','极寒天气下，自律机械仍守着空无一人的营地。'],
 ['雾凇输电线','能源线路 · 保护装置','冰晶伏击者','输电线塔上出现不断堆积的异常冰晶。'],
 ['寒流监测站','环境解析 · 安全测绘','霜压检定机','风雪掩埋了观测所的出口与撤离路线。'],
 ['低温冷却库','工业设施 · 恒温重启','低温控制体','气密舱门失控，整个基地被锁入循环冷却状态。'],
 ['白色终端','章节首领 · 极地回波','极夜调频者','北方极夜中心不断重复着同一段求救讯号。'],
 ['深环入口','核心禁区 · 身份认证','管制巡卫','高权限屏障启动，旧时代的指挥命令仍被执行。'],
 ['环流供能枢纽','深层回路 · 供能切断','环流重装体','巨大的供能轮机阻塞着通向地下的道路。'],
 ['终端警戒区','机密文件 · 安保压制','零距截击机','对外隔离系统已经把友军也登记为入侵目标。'],
 ['黑井升降台','密封井道 · 垂直突入','下降防卫机','整座升降井不断尝试抹除其自身的运行记录。'],
 ['深环守门者','章节首领 · 禁区接入','环核执法者','最古老的安保武装挡在通往观测环的最后入口。'],
 ['逐光边界','最终区域 · 信号采样','光学追猎者','夜间没有星星，只有光束从机械结构之间掠过。'],
 ['断续中继阵','信号重组 · 联结恢复','位相破坏者','数以千计的中继器在不同时刻重复相同数据。'],
 ['空白演算室','核心解析 · 异常调查','演算投影体','终端运行的最后一组参数指向未知区域。'],
 ['无声灯塔','边界校验 · 协议核查','静默执令机','失声许久的灯塔突然向无人区发出确认指令。'],
 ['零号观测环','终章首领 · 深层协议','零号观测者','所有失联记录在此汇合，一场漫长的调查结束了。']
];
const zoneAt=n=>{
 if(n<=zoneDefs.length)return zoneDefs[Math.max(0,n-1)];
 const pref=['旧约','远星','幽谷','暗潮','残响','回声','失重','深蓝','天穹','末端'];
 const suff=['装载站','反应井','监控塔','中继链','风洞','隔离带','通行桥','解析所','栖居站','观测环'];
 return [`${pref[(n*7)%10]}${suff[(n*3+Math.floor(n/10))%10]}`,`深层远征 · 区域 ${n}`,['协议守卫','异频构装','执行单元','核心督察'][n%4],`第 ${n} 区域属于动态深层远征，可反复探索并积累长期回收奖励。`];
};
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
const tabMeta={overview:['总控概览','当前目标、工业产能与远征动态'],factory:['基地建设','产业链 · 能源调度 · 自动生产'],battle:['前线探索','区域推进 · 首领遭遇 · 自动战斗'],operators:['行动小队','队员成长 · 培训分工 · 装备装配'],inventory:['装备仓库','角色独立配装 · 词条详情 · 自动回收'],research:['技术研发','规划前置研究 · 定向强化基地'],missions:['任务终端','里程碑 · 可重复后勤派遣'],protocol:['协议档案','永久成长 · 数据与存档']};

// 新档案结构。不改旧字段语义，额外字段在 hydrate 中补全。
function fresh(cores=0){return {version:5,credits:340,alloy:50,energy:34,data:0,parts:0,
 buildings:Object.fromEntries(Object.keys(bld).map(k=>[k,k==='mine'||k==='solar'?1:0])),
 ops:Object.fromEntries(Object.keys(opDefs).map(k=>[k,{level:1,xp:0}])),recruited:['lin'],
 gear:0,cores,stage:1,maxStage:1,killsStage:0,totalKills:0,totalEarned:0,totalAlloy:50,totalParts:0,
 lootCount:0,enemyHp:0,squadHp:100,retreat:0,tech:{},claimed:{},inventory:[],loadouts:Object.fromEntries(Object.keys(opDefs).map(k=>[k,emptyLoadout()])),storageLevel:0,autoSalvage:'none',uid:1, squad:['lin'],mapChapter:0,legacyRoster:{ops:{},recruited:[],loadouts:{}},
 focus:'lin',selectedOp:'lin',inventoryFilter:'all',policy:'normal',autoAdvance:false,autoEquip:false,dispatch:null,logs:[],created:Date.now(),lastSave:Date.now()};}
let s=fresh();let tab='overview';let lastTick=Date.now(),lastSave=Date.now(),lastFull=0,toastTimer=0,completedDispatches=0;
const zone=()=>zoneAt(s.stage);
const high=()=>s.maxStage||s.stage;
// 每 5 区形成一个章节；深层区域继续扩展章节而非重复第 10 区。
const chapterIndex=n=>Math.floor((n-1)/5);
const chapterAt=i=>chapterDefs[i]||{name:`深层协议 ${String(i+1).padStart(2,'0')}`,sub:'持续生成的高风险远征线路',key:`CH.${String(i+1).padStart(2,'0')}`};
const regionGoal=n=>6+2*Math.min(7,Math.floor((n-1)/5));
const activeOps=()=>s.squad.filter(k=>s.recruited.includes(k));
const squadBuff=k=>activeOps().reduce((v,id)=>v+(opDefs[id].passive===k?opDefs[id].amount:opDefs[id].passive==='hybrid'&&(k==='power'||k==='loot')?opDefs[id].amount:0),0);

const researchLv=k=>s.tech[k]||0;
const mult=()=>1+s.cores*.15;
const resourceBoost=key=>key==='alloy'?1+researchLv('mining')*.25:key==='credits'?1+researchLv('logistics')*.25:key==='energy'?1+researchLv('generators')*.3:key==='data'?1+researchLv('analysis')*.3:1;
const powerBoost=()=>s.policy==='industry'&&s.energy>1?1.45:1;
const prod=k=>{const x=bld[k],lv=s.buildings[k];return lv*x.rate*mult()*resourceBoost(x.product)*(x.product!=='energy'?powerBoost():1)};
const totalProd=()=>Object.keys(bld).reduce((v,k)=>v+prod(k),0);
const enemyBoss=()=>s.killsStage%regionGoal(s.stage)===regionGoal(s.stage)-1;
// 高区曲线按章节叠加，并提高首领系数；回刷低区仍按当地难度计算。
const enemyMaxHp=()=>Math.round(30*Math.pow(1.43,s.stage-1)*(1+chapterIndex(s.stage)*.32)*(enemyBoss()?(s.stage%5===0?5.2:3.2):1));
const enemyDmg=()=>.8*Math.pow(1.205,s.stage-1)*(1+chapterIndex(s.stage)*.26)*(enemyBoss()?(s.stage%5===0?2.05:1.6):1);
// 每名已招募角色分别有三个装备槽。装备通过物品唯一 ID 关联，不能被重复穿戴。
const equippedIds=()=>new Set(s.recruited.flatMap(k=>Object.values(s.loadouts[k]||{})).filter(Number.isInteger));
const equippedItem=(k,slot)=>s.inventory.find(i=>i.id===s.loadouts[k]?.[slot])||null;
const sumGear=field=>activeOps().reduce((acc,k)=>acc+Object.keys(slotDefs).reduce((v,slot)=>v+Number(equippedItem(k,slot)?.[field]||0),0),0);
const maxSquadHp=()=>100+researchLv('plating')*25+(activeOps().includes('shi')?55:0)+squadBuff('hp')+sumGear('hp');
const dps=()=>{const base=activeOps().reduce((sum,k)=>{
 const val=opDefs[k].base*(1+(s.ops[k].level-1)*opDefs[k].bonus)*(s.focus===k?1.08:1)+Object.keys(slotDefs).reduce((v,slot)=>v+Number(equippedItem(k,slot)?.atk||0),0);
 return sum+val*(enemyBoss()&&opDefs[k].passive==='boss'?1+opDefs[k].amount:1)*(opDefs[k].passive==='assault'&&!enemyBoss()?1+opDefs[k].amount:1);
},0);return base*(1+squadBuff('power'))*(1+sumGear('crit')*.0035)*(1+s.gear*.22)*(1+researchLv('tactics')*.2)*mult()*(s.policy==='combat'&&s.energy>1?1.35:1)};
const itemLootBonus=()=>sumGear('loot')+squadBuff('loot')*100;
const reward=()=>Math.ceil((14+s.stage*10)*(1+researchLv('mapping')*.2)*mult()*(enemyBoss()?(s.stage%5===0?5:3):1));
function addLog(msg){s.logs.unshift({ts:Date.now(),msg});s.logs=s.logs.slice(0,25)}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2300)}
function levelCap(level){return Math.round(45*(level+1)*Math.pow(1.025,level))}
function emptyLoadout(){return {weapon:null,armor:null,module:null}}
function assignedTo(id){for(const k of s.recruited)for(const slot of Object.keys(slotDefs))if(s.loadouts[k]?.[slot]===id)return k;return null}
const storageCapacity=()=>60+20*s.storageLevel;
const storageUsed=()=>s.inventory.filter(i=>!equippedIds().has(i.id)).length;
function storageCost(){const l=s.storageLevel;return {credits:Math.ceil(240*Math.pow(1.67,l)),alloy:Math.ceil(75*Math.pow(1.6,l)),parts:Math.ceil(3*Math.pow(1.53,l))}}
function upgradeStorage(){if(s.storageLevel>=25){toast('仓库已达当前容量上限');return}if(!pay(storageCost())){toast('仓库扩建所需资源不足');return}s.storageLevel++;addLog(`装备库扩建至 ${storageCapacity()} 格`);changed()}
const affixNames={atk:'攻击',hp:'耐久',loot:'回收概率',crit:'暴击效率',guard:'伤害抵抗',xp:'经验增幅'};
const affixInfo={atk:'直接提高角色造成的每秒伤害。',hp:'增加全队共享防护耐久上限。',loot:'提高击败普通目标后获得装备的概率。',crit:'提高全队伤害倍率，每点增加 0.35%。',guard:'降低敌人对小队造成的伤害，每点降低 0.3%，最多降低 55%。',xp:'提高已出战队员获得的战斗经验。'};
const affixUnit=k=>['loot','crit','guard','xp'].includes(k)?'%':'';
const affixes=i=>['atk','hp','loot','crit','guard','xp'].filter(k=>Number(i[k])>0).map(k=>({key:k,value:Number(i[k])}));
const statLabel=(k,v)=>`${affixNames[k]} +${Number(v).toLocaleString('zh-CN')}${affixUnit(k)}`;
const score=(i,k)=>{if(!i)return 0;const d=opDefs[k]||opDefs.lin;return Number(i.atk||0)*(d.base>=10?3.3:3)+Number(i.hp||0)*(k==='shi'?.34:.22)+Number(i.loot||0)*7+Number(i.crit||0)*2.5+Number(i.guard||0)*(k==='shi'?3:2)+Number(i.xp||0)*2};
// 自动配装是整队的全局贪心匹配：同一件装备只能分配给一个角色。
function autoEquipBest(){const used=new Set();for(const slot of Object.keys(slotDefs)){const available=s.inventory.filter(i=>i.slot===slot).sort((a,b)=>Math.max(...s.recruited.map(k=>score(b,k)))-Math.max(...s.recruited.map(k=>score(a,k))));const pending=new Set(s.recruited);while(pending.size){let best=null;for(const op of pending){for(const i of available){if(used.has(i.id))continue;const gain=score(i,op);if(!best||gain>best.gain)best={op,i,gain}}}if(!best)break;s.loadouts[best.op][slot]=best.i.id;used.add(best.i.id);pending.delete(best.op)}for(const op of pending)s.loadouts[op][slot]=null}}
function autoSalvageSweep(){if(s.autoSalvage==='none')return 0;const threshold=s.autoSalvage==='common'?0:1;let n=0;for(const i of [...s.inventory]){if(i.rarity>threshold||i.locked||assignedTo(i.id))continue;s.inventory=s.inventory.filter(x=>x.id!==i.id);credit('parts',salvageReward(i));n++}if(n)addLog(`自动分解 ${n} 件低稀有度装备`);return n}
function setAutoSalvage(rule){if(!['none','common','rare'].includes(rule))return;s.autoSalvage=rule;autoSalvageSweep();toast(rule==='none'?'已关闭自动分解':'已启用低阶自动分解（保护穿戴与锁定装备）');changed()}
function toggleLock(id){const i=s.inventory.find(x=>x.id===id);if(!i)return;i.locked=!i.locked;changed();openItem(id)}
function selectOp(k){if(!s.recruited.includes(k))return;s.selectedOp=k;render(true)}
// 编队操作：最多 4 人出战。待命干员不提供战斗能力或升级战斗经验。
function toggleSquad(k){if(!s.recruited.includes(k))return;const idx=s.squad.indexOf(k);
 if(idx>=0){if(s.squad.length<=1){toast('至少保留一名出战干员');return}s.squad.splice(idx,1);}
 else if(s.squad.length>=4){toast('小队已满（4/4），请先将其他干员撤下');return}
 else s.squad.push(k);
 addLog(`${opDefs[k].name} ${idx>=0?'返回后备席':'编入出战小队'}`);s.squadHp=Math.min(maxSquadHp(),s.squadHp);changed();}
function chooseMapChapter(index){const max=Math.max(5,chapterIndex(high()+1));if(!Number.isInteger(index)||index<0||index>max)return;s.mapChapter=index;render(true)}

function setInventoryFilter(k){if(!['all','0','1','2'].includes(k))return;s.inventoryFilter=k;render(true)}
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
function itemScore(i){return score(i,s.selectedOp)}
function chanceLoot(){return Math.min(.72,.20+researchLv('salvage')*.04+itemLootBonus()*.005)}
// 新装备属性：每个槽位有基础主词条，精良、卓越额外随机副词条。
// UI 仅显示主属性和词条数量，细项说明在装备详情弹窗中提供。
function makeItem(forceRarity){const roll=Math.random()*100,rarity=forceRarity??(roll<6?2:roll<30?1:0);const slots=Object.keys(slotDefs),slot=slots[Math.floor(Math.random()*slots.length)],d=rarityDefs[rarity],scale=Math.pow(1.235,s.stage-1)*d.mult; // 深层区域掉落的装备随难度指数成长，避免高区数值完全停滞。
 const i={id:s.uid++,slot,rarity,zone:s.stage,atk:0,hp:0,loot:0,crit:0,guard:0,xp:0,locked:false,name:`${slotDefs[slot].prefix[Math.floor(Math.random()*4)]}${slotDefs[slot].name} · ${itemSuffix[Math.floor(Math.random()*5)]}`};
 if(slot==='weapon')i.atk=Math.ceil((3+Math.random()*4)*scale);if(slot==='armor')i.hp=Math.ceil((12+Math.random()*18)*scale);if(slot==='module')i.loot=Number(((3+Math.random()*5)*d.mult).toFixed(1));
 const pool=slot==='weapon'?['crit','xp','guard']:slot==='armor'?['guard','xp','crit']:['xp','crit','guard'];
 for(let n=0;n<rarity;n++){const k=pool.splice(Math.floor(Math.random()*pool.length),1)[0];const v=Number((2+Math.random()*3+rarity*1.5).toFixed(1));i[k]=Number((i[k]+(k==='atk'?Math.ceil(v*scale):k==='hp'?Math.ceil(v*2*scale):v)).toFixed(1))}
 const oldLoadouts=JSON.stringify(s.loadouts);s.inventory.unshift(i);
 if(s.autoEquip)autoEquipBest();
 // 装备数量只计算未穿戴的物品，仓库满时不再暗中丢弃已有的高价值装备。
 autoSalvageSweep();
 if(storageUsed()>storageCapacity()){if(s.inventory.some(x=>x.id===i.id)){s.inventory=s.inventory.filter(x=>x.id!==i.id);s.loadouts=JSON.parse(oldLoadouts);for(const op of s.recruited)for(const slot of Object.keys(slotDefs))if(!s.inventory.some(x=>x.id===s.loadouts[op]?.[slot]))s.loadouts[op][slot]=null}addLog('仓库已满，本次拾取失败；可扩容或调整自动分解策略');return null}
 s.lootCount++;addLog(`回收装备：${d.name} · ${i.name}`);return i;
}
// 区域内每六只怪出现一次首领；首领保证掉落装备。击杀获得研究点和经验。
function victory(){const boss=enemyBoss(),name=boss?'区域首领':zone()[2],creds=reward();s.totalKills++;s.killsStage++;credit('credits',creds);credit('data',2+Math.ceil(s.stage*.85)*(boss?3:1));if(Math.random()<.26)credit('parts',boss?3:1+Math.floor(s.stage/3));
 if(Math.random()<.28)credit('alloy',Math.max(2,s.stage*2));
 for(const k of activeOps()){const o=s.ops[k];o.xp+=(13+s.stage*6)*(1+researchLv('training')*.25)*(1+sumGear('xp')*.01)*(s.focus===k?2:1)*(boss?2.2:1);let n=0;while(o.xp>=levelCap(o.level)&&n++<50){o.xp-=levelCap(o.level);o.level++;if(o.level%4===0)addLog(`${opDefs[k].name}训练晋升至 Lv.${o.level}`)}}
 const drop=boss||Math.random()<chanceLoot();if(drop)makeItem(boss?Math.min(2,1+(s.stage>=5&&Math.random()<.22?1:0)):undefined);
 if(boss||s.totalKills%8===0)addLog(`${name} 清除 · +${creds} 信用点${boss?' · 首领物资已回收':''}`);
 if(s.killsStage>=regionGoal(s.stage) && s.autoAdvance && researchLv('autonomy')>0){advance(true)}
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
 if(s.energy>.06){let heal=Math.min(hpMax-s.squadHp,dt*(1.15+researchLv('plating')*.18+squadBuff('heal')));s.squadHp+=heal;s.energy=Math.max(0,s.energy-heal*.07)}
 const incoming=enemyDmg()*dt*(offline?.7:1)*Math.max(.38,1-sumGear('guard')*.003-squadBuff('guard'));s.squadHp=Math.max(0,s.squadHp-incoming);
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
 if(!p||typeof p!=='object'||![1,2,3,4,5].includes(p.version))return base;
 for(const k of ['credits','alloy','energy','data','parts','gear','cores','stage','maxStage','killsStage','totalKills','totalEarned','totalAlloy','totalParts','lootCount','enemyHp','squadHp','retreat','uid','created','lastSave'])if(Number.isFinite(p[k])&&p[k]>=0)base[k]=p[k];
 base.maxStage=Math.max(base.stage,base.maxStage);base.stage=Math.max(1,Math.min(999,Math.floor(base.stage)));base.maxStage=Math.max(1,Math.min(999,Math.floor(base.maxStage)));base.mapChapter=Number.isInteger(p.mapChapter)?Math.max(0,Math.min(199,p.mapChapter)):chapterIndex(base.stage);
 for(const k of Object.keys(bld))if(Number.isInteger(p.buildings?.[k])&&p.buildings[k]>=0)base.buildings[k]=Math.min(10000,p.buildings[k]);
 for(const k of Object.keys(opDefs)){let o=p.ops?.[k];if(o&&Number.isInteger(o.level)&&o.level>=1&&Number.isFinite(o.xp)&&o.xp>=0)base.ops[k]={level:Math.min(10000,o.level),xp:o.xp}}
 if(Array.isArray(p.recruited))base.recruited=[...new Set(p.recruited.filter(k=>opDefs[k]))];if(!base.recruited.length)base.recruited=['lin'];
 // v0.3 存档没有编队字段：原已招募干员自动成为首批四名出战者。
 if(Array.isArray(p.squad)){base.squad=[...new Set(p.squad.filter(k=>base.recruited.includes(k)))].slice(0,4)}else base.squad=base.recruited.slice(0,4);if(!base.squad.length)base.squad=[base.recruited[0]];
 for(const k of Object.keys(techDefs))if(Number.isInteger(p.tech?.[k])&&p.tech[k]>=0)base.tech[k]=Math.min(techDefs[k].max,p.tech[k]);
 // 历史七人训练及穿戴归档，不显示在新版名册中。
 base.legacyRoster=(p.legacyRoster&&typeof p.legacyRoster==='object')?p.legacyRoster:{ops:Object.fromEntries(Object.entries(p.ops||{}).filter(([k])=>!opDefs[k])),recruited:(p.recruited||[]).filter(k=>!opDefs[k]),loadouts:Object.fromEntries(Object.entries(p.loadouts||{}).filter(([k])=>!opDefs[k]))};
 if(p.claimed&&typeof p.claimed==='object')for(const m of missions)if(p.claimed[m.id])base.claimed[m.id]=true;
 // v0.2 物品只有 3 个字段，新增词条缺省为 0；旧版全队装备分配给第一名角色。
 base.storageLevel=Number.isInteger(p.storageLevel)?Math.max(0,Math.min(25,p.storageLevel)):0;
 base.autoSalvage=['none','common','rare'].includes(p.autoSalvage)?p.autoSalvage:'none';
 if(Array.isArray(p.inventory))base.inventory=p.inventory.filter(x=>x&&Number.isInteger(x.id)&&x.id>0&&slotDefs[x.slot]&&rarityDefs[x.rarity]&&typeof x.name==='string'&&x.name.length<=80&&['atk','hp','loot'].every(k=>Number.isFinite(x[k])&&x[k]>=0))
 .slice(0,storageCapacityFrom(base)+Math.max(opCountFrom(base),36)).map(x=>({...x,crit:Number.isFinite(x.crit)&&x.crit>=0?Math.min(9999,x.crit):0,guard:Number.isFinite(x.guard)&&x.guard>=0?Math.min(9999,x.guard):0,xp:Number.isFinite(x.xp)&&x.xp>=0?Math.min(9999,x.xp):0,locked:x.locked===true}));
 base.uid=Math.max(base.uid,1,...base.inventory.map(i=>i.id+1));
 const occupied=new Set();
 for(const op of base.recruited){for(const slot of Object.keys(slotDefs)){const id=p.version>=3?p.loadouts?.[op]?.[slot]:op===base.recruited[0]?p.equipped?.[slot]:null;if(base.inventory.some(i=>i.id===id&&i.slot===slot)&&!occupied.has(id)){base.loadouts[op][slot]=id;occupied.add(id)}}}
 if(opDefs[p.selectedOp]&&base.recruited.includes(p.selectedOp))base.selectedOp=p.selectedOp;
 if(['all','0','1','2'].includes(p.inventoryFilter))base.inventoryFilter=p.inventoryFilter;
 if(opDefs[p.focus]&&base.recruited.includes(p.focus))base.focus=p.focus;
 if(['normal','industry','combat'].includes(p.policy))base.policy=p.policy;
 base.autoAdvance=!!p.autoAdvance;base.autoEquip=!!p.autoEquip;
 if(p.dispatch&&dispatchDefs[p.dispatch.id]&&Number.isFinite(p.dispatch.end))base.dispatch={id:p.dispatch.id,end:p.dispatch.end};
 if(Array.isArray(p.logs))base.logs=p.logs.filter(x=>x&&typeof x.msg==='string'&&Number.isFinite(x.ts)).slice(0,20);
 // v1 迁移：确保真实的旧武器强化、永久核心和建筑等级保留。
 if(p.version===1){base.totalAlloy=Math.max(base.totalAlloy,base.alloy);base.squadHp=maxHpFrom(base);addLogMigration(base)}
 base.version=5;return base;
}
function storageCapacityFrom(v){return 60+20*v.storageLevel}
function opCountFrom(v){return v.recruited.length*3}
function maxHpFrom(v){return 100+(v.recruited.includes('shi')?55:0)}
function addLogMigration(v){v.logs.unshift({ts:Date.now(),msg:'存档已从 v0.1 自动升级为 v0.2，原有资源、建筑和角色等级已保留'})}
function load(){try{const raw=localStorage.getItem(SAVEKEY);if(raw){s=hydrate(JSON.parse(raw));const off=Math.min(MAX_OFFLINE,Math.max(0,(Date.now()-(s.lastSave||Date.now()))/1000));calculateOffline(off);}else{s=fresh();addLog('前线指挥系统启动 · 采矿与能源生产自动运行')}}catch(e){console.warn('无法读取旧存档，已创建新档案',e);s=fresh();addLog('存档数据读取失败，已新建临时档案')}s.squadHp=Math.min(maxSquadHp(),s.squadHp);s.enemyHp=s.enemyHp||enemyMaxHp();}
function save(){try{s.lastSave=Date.now();localStorage.setItem(SAVEKEY,JSON.stringify(s));$('saveStatus').textContent='已保存';return true}catch(e){$('saveStatus').textContent='存档不可用';return false}}
function changed(){save();render(true)}

// 玩家主动操作。禁止交易负库存，资源不足时按钮不生效也会给予原因。
function build(k){if(!bld[k]||high()<bld[k].unlock)return;const c=buildCost(k);if(!pay(c)){toast('资源不足，请继续生产或调整优先级');return} s.buildings[k]++;addLog(`建造：${bld[k].name} Lv.${s.buildings[k]}`);toast('设施升级完成');changed()}
function recruit(k){if(s.recruited.includes(k))return;const d=opDefs[k];if(!d||!pay(d.price)){toast('招募所需资源不足');return}s.recruited.push(k);if(s.squad.length<4)s.squad.push(k);if(s.autoEquip)autoEquipBest();addLog(`队员 ${d.name} 已加入干员名册${s.squad.includes(k)?'，已部署':''}`);toast('新干员已招募');changed()}
function strengthen(){if(!pay(gearCost())){toast('强化材料不足');return}s.gear++;addLog(`战术装备等级 Mk.${s.gear}`);changed()}
function train(k){if(!s.recruited.includes(k)||!pay(trainCost(k))){toast('训练资源不足');return}s.ops[k].xp+=levelCap(s.ops[k].level)*.65;while(s.ops[k].xp>=levelCap(s.ops[k].level)){s.ops[k].xp-=levelCap(s.ops[k].level);s.ops[k].level++}addLog(`${opDefs[k].name} 完成集中训练`);changed()}
function equip(id,op=s.selectedOp){const i=s.inventory.find(x=>x.id===id);if(!i||!s.recruited.includes(op))return;const current=s.loadouts[op][i.slot];const from=assignedTo(id);if(from===op)return;
 // 背包已满时：交换两件装备不会占用额外位置；从背包首次穿戴也会腾出位置。
 if(from)s.loadouts[from][i.slot]=current||null; // 直接在两名队员间交换装备，不额外占用背包空间
 s.loadouts[op][i.slot]=id;addLog(`${opDefs[op].name} 已装备 ${i.name}`);toast(`${opDefs[op].name} 装备已更新`);changed()}
function unequip(slot,op=s.selectedOp){if(!s.recruited.includes(op)||!slotDefs[slot]||!s.loadouts[op][slot])return;if(storageUsed()>=storageCapacity()){toast('仓库已满，请先整理仓库再卸下装备');return}s.loadouts[op][slot]=null;changed()}
function salvage(id){const i=s.inventory.find(x=>x.id===id);if(!i)return;if(i.locked){toast('装备已锁定，请先解锁');return}if(assignedTo(id)){toast('正在穿戴的装备不可拆解');return}const gained=salvageReward(i);s.inventory=s.inventory.filter(x=>x.id!==id);credit('parts',gained);addLog(`拆解 ${i.name} · +${gained} 零件`);$('modalRoot').innerHTML='';changed()}
function forge(){const c={credits:180,alloy:45,parts:8};if(!pay(c)){toast('制造装备需要更多信用点、合金和零件');return}const item=makeItem(Math.random()<.2?1:0);toast(item?(s.inventory.some(i=>i.id===item.id)?`制造完成：${item.name}`:'制造完成，已按自动分解规则回收零件'):'仓库已满，无法收纳新装备');changed()}
function research(k){const d=techDefs[k];if(!d||high()<d.unlock||researchLv(k)>=d.max)return;const c=researchCost(k);if(!pay(c)){toast('研发资源不足');return}s.tech[k]=(s.tech[k]||0)+1;addLog(`研究完成：${d.name} Lv.${s.tech[k]}`);toast('技术研究完成');changed()}
function advance(auto=false){const need=regionGoal(s.stage);if(s.killsStage<need){if(!auto)toast(`请先清除本区 ${need} 个目标`);return}if(s.stage>=999)return;s.stage++;s.maxStage=Math.max(s.maxStage,s.stage);s.mapChapter=chapterIndex(s.stage);s.killsStage=0;s.enemyHp=enemyMaxHp();addLog(`已接入区域 ${s.stage}：${zone()[0]}`);if(!auto)toast(`新地区：${zone()[0]}`);changed()}
function selectZone(n){if(!Number.isInteger(n)||n<1||n>high())return;if(n===s.stage)return;s.stage=n;s.mapChapter=chapterIndex(n);s.killsStage=0;s.enemyHp=enemyMaxHp();addLog(`行动线路切换至区域 ${String(n).padStart(2,'0')}`);changed()}
function questProgress(m){switch(m.key){case 'kills':return s.totalKills;case 'buildings':return Object.values(s.buildings).reduce((a,b)=>a+b,0);case 'zone':return high();case 'tech':return Object.values(s.tech).reduce((a,b)=>a+b,0);case 'loot':return s.lootCount;case 'squad':return s.recruited.length;case 'parts':return s.totalParts;default:return 0}}
function claimQuest(k){const m=missions.find(x=>x.id===k);if(!m||s.claimed[k]||questProgress(m)<m.need)return;s.claimed[k]=true;gainRewards(m.reward);addLog(`任务「${m.name}」已领取奖励`);toast('里程碑奖励已领取');changed()}
function dispatch(k){const d=dispatchDefs[k];if(!d||s.dispatch||high()<d.unlock)return;if(!pay(d.cost)){toast('派遣物资不足');return}s.dispatch={id:k,end:Date.now()+d.sec*1000};addLog(`后勤派遣已出发：${d.name}`);changed()}
function setPolicy(k){if(!['normal','industry','combat'].includes(k))return;s.policy=k;toast(`已切换至${{normal:'均衡运行',industry:'工业超频',combat:'战斗超频'}[k]}`);changed()}
function setFocus(k){if(!s.recruited.includes(k))return;s.focus=k;addLog(`集训重点调整为 ${opDefs[k].name}`);changed()}
function reset(){if(!confirm('确认永久删除本地存档及全部永久核心？此操作无法撤销。'))return;s=fresh();toast('新档案建立');changed()}
function reboot(){if(high()<5){toast('需解锁区域 05 才能进行协议重启');return}const gain=1+Math.floor((high()-5)/3);if(!confirm(`重启将重置当前轮次的设施、角色、背包装备和科技，保留已获得的永久核心。获得 ${gain} 枚核心，是否执行？`))return;s=fresh(s.cores+gain);addLog(`协议重启完成：获得 ${gain} 枚永久核心`);toast(`永久核心 +${gain}`);changed()}

function opPower(k){const o=s.ops[k],d=opDefs[k];return d.base*(1+(o.level-1)*d.bonus)}
function progressHtml(a,b){const p=Math.min(100,Math.max(0,a/Math.max(1,b)*100));return `<div class="progress"><div style="width:${p.toFixed(2)}%"></div></div>`}
function logHtml(n=5){return s.logs.slice(0,n).map(x=>`<div class="logitem"><span class="logtime">${new Date(x.ts).toLocaleTimeString('zh-CN',{hour12:false,hour:'2-digit',minute:'2-digit'})}</span><span>${esc(x.msg)}</span></div>`).join('')||'<div class="logitem">等待新的前线信息。</div>'}
function renderResource(){for(const k of ['Credits','Alloy','Energy','Data','Parts']){const e=$('res'+k);if(e)e.textContent=fmt(s[k.toLowerCase()])} $('statStage').textContent=String(s.stage).padStart(2,'0');$('statDps').textContent=dps().toFixed(1);$('statProd').textContent=totalProd().toFixed(1);$('statKills').textContent=fmt(s.totalKills);$('areanum').textContent=String(s.stage).padStart(2,'0');$('statusText').textContent=`核心加成 ×${mult().toFixed(2)} · 战斗 ${s.retreat?'修复中':'自动进行'}`;
 $('enemyName').textContent=enemyBoss()?`首领 · ${zone()[2]}`:zone()[2];$('enemyHealthText').textContent=`${fmt(Math.ceil(s.enemyHp))} / ${fmt(enemyMaxHp())} HP`;$('enemyBar').style.width=`${Math.max(0,Math.min(100,s.enemyHp/enemyMaxHp()*100))}%`;
 $('battleZone').textContent=`AREA ${String(s.stage).padStart(2,'0')} · ${zone()[0]}`;$('zoneName').textContent=zone()[0];$('zoneDesc').textContent=zone()[3];$('sectorProgress').textContent=`${Math.min(regionGoal(s.stage),s.killsStage)} / ${regionGoal(s.stage)}`;$('sectorBar').style.width=`${Math.min(100,s.killsStage/regionGoal(s.stage)*100)}%`;$('killReward').textContent=`+${reward()} 信用点 / 自动战利品`;$('battleDps').textContent=dps().toFixed(1);
 $('advanceBtn').disabled=s.killsStage<regionGoal(s.stage);$('advanceBtn').textContent=s.killsStage>=regionGoal(s.stage)?'开启下一调查区域 →':`等待清除 ${regionGoal(s.stage)-s.killsStage} 个目标`;
 $('goalTitle').textContent=s.killsStage>=regionGoal(s.stage)?'区域调查完成，等待推进':'清除区域威胁，回收作战物资';$('goalDesc').textContent=`${zone()[0]} · 本地区清除 ${Math.min(s.killsStage,regionGoal(s.stage))}/${regionGoal(s.stage)}。${enemyBoss()?'遭遇区域首领，必定掉落装备。':'保持自动战斗，同时升级设施和技能。'}`;
 $('goalBar').style.width=`${Math.min(100,s.killsStage/regionGoal(s.stage)*100)}%`;$('goalPct').textContent=`${Math.round(Math.min(100,s.killsStage/regionGoal(s.stage)*100))}%`;$('goalAction').textContent=s.killsStage>=regionGoal(s.stage)?'前往解锁下一个区域 →':'查看实时战斗 →';
 const hpPct=Math.max(0,Math.min(100,s.squadHp/maxSquadHp()*100));$('squadHealth').textContent=`${fmt(Math.ceil(s.squadHp))} / ${fmt(maxSquadHp())}`;$('squadBar').style.width=hpPct+'%';$('battleStatus').textContent=s.retreat>0?`战损修复：${Math.ceil(s.retreat)}秒`:'小队防护正常';
 $('clock').textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false});if(s.dispatch)$('dispatchEta').textContent=`${dispatchDefs[s.dispatch.id].name} · ${Math.ceil(Math.max(0,s.dispatch.end-Date.now())/1000)} 秒`;else $('dispatchEta').textContent='当前没有派遣任务';}
function render(full=false){renderResource();if(!full)return;
 $('overviewLog').innerHTML=logHtml(6);$('battleLog').innerHTML=logHtml(7);
 const available=missions.filter(m=>!s.claimed[m.id]&&questProgress(m)>=m.need);const next=missions.find(m=>!s.claimed[m.id]);$('overviewTasks').innerHTML=`<div class="smallhead">// OPERATIONS / 可领取任务 ${available.length}</div>${next?`<div class="missionline"><b>${esc(next.name)}</b><span>${fmt(Math.min(next.need,questProgress(next)))} / ${next.need}</span></div>${progressHtml(questProgress(next),next.need)}<p>${esc(next.desc)} · 奖励 ${costText(next.reward)}</p>`:'<p>当前所有里程碑均已完成，可继续探索更深区域。</p>'}<button class="btn primary" data-goto="missions">任务与派遣 →</button>`;
 $('overviewLoot').innerHTML=`<div class="smallhead">// EQUIPMENT / 战利品</div><div class="summary-value">${storageUsed()} <small>/ ${storageCapacity()} 格背包</small></div><p>累计获得 ${s.lootCount} 件装备 · 武器、防护装具与芯片提供不同属性。首领必定掉落装备。</p><button class="btn outline" data-goto="inventory">打开装备库 →</button>`;
 $('facilityCards').innerHTML=Object.entries(bld).map(([k,x])=>{const unlocked=high()>=x.unlock,c=buildCost(k),ok=afford(c);return `<article class="panel facility ${unlocked?'':'softlock'}"><div class="facicon">${facilitySvg(x.icon==='foundry'?'mine':x.icon==='workshop'?'trade':x.icon)}</div><div class="facbody"><div class="fachead"><h4>${x.name}</h4><span class="level">Lv.${s.buildings[k]}</span></div><p>${x.sub}${x.consume?' · 消耗 '+Object.entries(x.consume).map(([r,v])=>`${v} ${resourceNames[r]}/秒/级`).join(' '):''}</p><div class="facfoot"><span class="yield">+${prod(k).toFixed(2)} /秒</span><div><button class="btn ${ok&&unlocked?'primary':''}" data-build="${k}" ${unlocked?'':'disabled'}>${unlocked?'建设 +1':`区域 ${x.unlock} 解锁`}</button><div class="cost">${costText(c)}</div></div></div></div></article>`}).join('');
 $('productionInfo').innerHTML=Object.entries(bld).map(([k,d])=>`<div class="barrow"><b>${esc(d.name)}</b>${progressHtml(prod(k),Math.max(totalProd(),1))}<span class="numeric">${prod(k).toFixed(2)}/秒</span></div>`).join('');
 $('policyCards').innerHTML=[['normal','均衡运行','不消耗额外能源，基础生产与火力'],['industry','工业超频','额外消耗 0.35 能源/秒，非能源产线 +45%'],['combat','战斗超频','额外消耗 0.35 能源/秒，全队火力 +35%']].map(([k,n,desc])=>`<button class="choice ${s.policy===k?'selected':''}" data-policy="${k}"><b>${n}</b><small>${desc}</small></button>`).join('');
 // 干员卡分出战和待命两种状态；招募新成员不再无限叠加出战 DPS。
 $('operatorCards').innerHTML=Object.entries(opDefs).map(([k,d])=>{
 const owned=s.recruited.includes(k),deployed=s.squad.includes(k),o=s.ops[k],tc=trainCost(k),size=s.squad.length;
 return `<article class="operator-card ${deployed?'squad-active':''}"><div class="portrait">${portraitSvg(k)}<div class="operator-portrait-sprite" style="background-position-x:${['lin','yor','shi','sai','nuo'].indexOf(k)*25}%"></div><span class="rank">${owned?(deployed?'DEPLOYED':'RESERVE'):'LOCKED'} / ${d.tag}</span></div><div class="opbody"><div class="opname"><h3>${d.name}</h3><span>Lv.${o.level}</span></div><div class="opdesc">${d.desc}</div><div class="op-talent">◈ 专精：${d.talent}</div><div class="opstat"><span>基础战力</span><b>${opPower(k).toFixed(1)} DPS</b></div>${progressHtml(o.xp,levelCap(o.level))}<div class="cost" style="text-align:left">EXP ${fmt(o.xp)} / ${fmt(levelCap(o.level))}</div>${owned?`<button class="btn ${deployed?'primary':'outline'}" data-squad="${k}">${deployed?'✓ 出战中 · 点击撤下':size>=4?'后备待命 · 队伍已满':'编入出战小队'}</button><button class="btn outline" data-opgear="${k}">配装管理 · ${Object.values(s.loadouts[k]).filter(Boolean).length}/3 →</button><button class="btn ${s.focus===k?'primary':'outline'}" data-focus="${k}">${s.focus===k?'当前集训目标 · 经验 ×2':'设为集训目标'}</button><button class="btn outline" data-train="${k}">集中培训 · ${costText(tc)}</button>`:`<button class="btn primary" data-recruit="${k}">招募 · ${costText(d.price)}</button>`}</div></article>`;
 }).join('');
 $('gearCard').innerHTML=`<h3>战术模块 / Mk.${s.gear}</h3><p>全队火力增益 +${s.gear*22}%。另可在战利品库装备随机掉落的武器和芯片。</p><button class="btn primary" data-gear="1">强化战术模块 · ${costText(gearCost())}</button>`;
 $('equipmentOperators').innerHTML=s.recruited.map(k=>`<button class="op-picker ${s.selectedOp===k?'selected':''}" data-opselect="${k}">${esc(opDefs[k].name)} <span>${Object.values(s.loadouts[k]).filter(Boolean).length}/3</span></button>`).join('');
 $('inventorySlots').innerHTML=Object.entries(slotDefs).map(([slot,d])=>{const i=equippedItem(s.selectedOp,slot);return `<div class="equipslot"><span>${d.name}</span><div class="slot-icon">${itemIcon(slot)}</div><strong>${i?esc(i.name):'空装备槽'}</strong><small>${i?itemStat(i):'选择下方装备，分配给 '+esc(opDefs[s.selectedOp].name)}</small>${i?`<div class="slot-buttons"><button class="btn outline" data-detail="${i.id}">详情</button><button class="btn outline" data-unequip="${slot}">卸下</button></div>`:''}</div>`}).join('');
 const chosen=s.inventory.filter(i=>s.inventoryFilter==='all'||String(i.rarity)===s.inventoryFilter).sort((a,b)=>b.rarity-a.rarity||b.zone-a.zone||b.id-a.id);
 $('inventoryCards').innerHTML=chosen.length?chosen.map(i=>{const owner=assignedTo(i.id),a=affixes(i),first=a[0],side=a.length-1;return `<button type="button" class="itemtile ${rarityDefs[i.rarity].class}" data-detail="${i.id}" aria-label="查看 ${esc(i.name)} 的详细词条"><div class="tile-top"><span class="rarity-mark">${rarityDefs[i.rarity].name.toUpperCase()}</span><span>${i.locked?'◆':''}${owner?'✓':''}</span></div><div class="tile-icon">${itemIcon(i.slot)}</div><div class="tile-bottom"><span class="tile-type">${slotDefs[i.slot].name} · A${String(i.zone).padStart(2,'0')}</span><strong title="${esc(i.name)}">${esc(i.name)}</strong><div class="tile-stats"><span>${first?statLabel(first.key,first.value):'暂无词条'}</span><span>${side>0?'副词条 ×'+side:'基础词条'}</span></div>${owner?`<span class="tile-owner">${esc(opDefs[owner].name)} · 已穿戴</span>`:''}</div></button>`}).join(''):'<div class="empty-state">暂无符合条件的装备。探索、击败首领或制造装备后会显示在这里。</div>';
 $('inventoryCount').textContent=`${storageUsed()} / ${storageCapacity()}`;
 $('storageExpand').textContent=s.storageLevel>=25?'容量已达上限':`扩建 +20 格 · ${costText(storageCost())}`;$('storageExpand').disabled=s.storageLevel>=25;
 $('storageLevel').textContent=`等级 ${s.storageLevel} · 已装备 ${equippedIds().size} 件（不占仓库格）`;
 $('autoEquip').checked=s.autoEquip;$('autoSalvage').value=s.autoSalvage;$('rarityFilter').value=s.inventoryFilter;
 $('researchCards').innerHTML=Object.entries(techDefs).map(([k,d])=>{const lv=researchLv(k),c=researchCost(k),lock=high()<d.unlock,max=lv>=d.max;return `<article class="panel tech-card ${lock?'softlock':''}"><div class="tech-head"><span>${d.category} / TECH</span><b>Lv.${lv} / ${d.max}</b></div><h3>${d.name}</h3><p>${d.desc}</p>${progressHtml(lv,d.max)}<button class="btn ${!lock&&!max&&afford(c)?'primary':''}" data-tech="${k}" ${lock||max?'disabled':''}>${lock?`区域 ${d.unlock} 解锁`:max?'研究已完成':`研究升级 · ${costText(c)}`}</button></article>`}).join('');
 $('missionCards').innerHTML=missions.map(m=>{const value=questProgress(m),claimed=!!s.claimed[m.id],done=value>=m.need;return `<article class="mission-card ${claimed?'mission-done':''}"><div class="missionline"><strong>${m.name}</strong><span>${claimed?'已领取':`${fmt(Math.min(m.need,value))} / ${m.need}`}</span></div><p>${m.desc} · 奖励 ${costText(m.reward)}</p>${progressHtml(value,m.need)}<button class="btn ${done&&!claimed?'primary':''}" data-claim="${m.id}" ${!done||claimed?'disabled':''}>${claimed?'奖励已领取':done?'领取奖励':'尚未达成'}</button></article>`}).join('');
 $('dispatchCards').innerHTML=Object.entries(dispatchDefs).map(([k,d])=>{const locked=high()<d.unlock;return `<article class="dispatch-card"><div class="missionline"><strong>${d.name}</strong><span>${d.sec} 秒</span></div><p>${d.detail}<br>消耗 ${costText(d.cost)}<br>获得 ${costText(d.reward)}</p><button class="btn ${!locked&&!s.dispatch?'primary':''}" data-dispatch="${k}" ${locked||s.dispatch?'disabled':''}>${locked?`区域 ${d.unlock} 解锁`:s.dispatch?'进行其他派遣中':'启动派遣'}</button></article>`}).join('');
 $('autoAdvance').checked=s.autoAdvance;$('autoAdvance').disabled=researchLv('autonomy')<1;$('autoHelp').textContent=researchLv('autonomy')?'自动导航已解锁':'需要先研究「自动导航」（区域 03）';
 const pageIndex=s.mapChapter||0;const maxPage=Math.max(5,chapterIndex(high()+1));const chap=chapterAt(pageIndex);
 $('regionCards').innerHTML=`<div class="map-pager"><button class="btn outline" data-map-chapter="${pageIndex-1}" ${pageIndex===0?'disabled':''}>← 上一章</button><div class="map-chapter"><b>${chap.key} · ${chap.name}</b><small>${chap.sub} · 已开放至 ${String(high()).padStart(2,'0')} 区 / 30 区主线 + 深层远征</small></div><button class="btn outline" data-map-chapter="${pageIndex+1}" ${pageIndex>=maxPage?'disabled':''}>下一章 →</button></div><div class="map-progress">${Array.from({length:Math.min(6,maxPage+1)},(_,idx)=>`<button class="chapter-chip ${idx===pageIndex?'active':''}" data-map-chapter="${idx}">${String(idx+1).padStart(2,'0')}</button>`).join('')}</div><div class="map-region-list">${Array.from({length:5},(_,i)=>pageIndex*5+i+1).map(n=>{const z=zoneAt(n),locked=n>high(),final=n%5===0;return `<button class="region ${s.stage===n?'selected':''} ${locked?'region-locked':''}" data-zone="${n}" ${locked?'disabled':''}><b>${String(n).padStart(2,'0')} · ${esc(z[0])} ${final?'◆':''}</b><small>${locked?'尚未解锁':n===s.stage?'正在调查':n<high()?'已开放 · 可回刷装备':'待调查'} · ${final?'章节压轴首领':`需清除 ${regionGoal(n)} 个目标`}</small></button>`}).join('')}</div>`;
 $('battleReport').innerHTML=`<div class="smallhead">// COMBAT READOUT / 交战数据</div><div class="btinfo"><span>活跃小队</span><strong>${s.squad.length} / 4（已招募 ${s.recruited.length} / 5）</strong></div><div class="btinfo"><span>基础 DPS</span><strong>${dps().toFixed(1)}</strong></div><div class="btinfo"><span>敌方持续威胁</span><strong>${enemyDmg().toFixed(2)} /秒</strong></div><div class="btinfo"><span>区域首领</span><strong>${enemyBoss()?'正在交战':`每 ${regionGoal(s.stage)} 个目标出现首领`}</strong></div><div class="btinfo"><span>装备掉落几率</span><strong>${Math.round(chanceLoot()*100)}%（首领必掉）</strong></div><div class="btinfo"><span>历史最高区域</span><strong>${high()}</strong></div><p>小队会自动恢复耐久。护盾耗尽时撤退修复 10 秒，不会损失永久进度。敌人战斗与产线同时运行。</p>`;
 const can=high()>=5,earn=1+Math.floor(Math.max(0,high()-5)/3);$('prestigePanel').innerHTML=`<div class="smallhead">// PERMANENT DEVELOPMENT / 永久成长</div><div class="summary-value">${s.cores} <small>枚永久协议核心</small></div><p>每枚永久核心给予全队火力与全部资源生产 +15%。<br>当前倍率 ×${mult().toFixed(2)} · 历史最高区域 ${high()}。<br>达到区域 05 才可重启，本轮预计获得 ${can?earn:0} 枚核心。重启会重置当前轮次的装备、研究和资源。</p><button class="btn ${can?'primary':''}" id="rebootBtn" ${can?'':'disabled'}>执行协议重启</button>`;
}
function itemStat(i){return affixes(i).map(a=>statLabel(a.key,a.value)).join(' · ')}
// 装备卡片只显示少量词条；查看详情后才显示全部属性、来源及词条描述。
function itemIcon(slot){const paths={weapon:'<path d="M14 51L50 15l7 7-35 36-8-7ZM40 15l9-9 13 13-9 9M12 51l-6 11"/>',armor:'<path d="M12 17l24-12 24 12v18c-2 19-15 26-24 32-10-6-23-13-24-32V17Zm14 12 10-7 10 7v15L36 51 26 44V29Z"/>',module:'<rect x="15" y="15" width="42" height="42" rx="3"/><rect x="25" y="25" width="22" height="22"/><path d="M7 25h8M7 44h8M57 25h8M57 44h8M25 7v8M44 7v8M25 57v8M44 57v8"/>'};return `<svg viewBox="0 0 72 72" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${paths[slot]}</svg>`}
function openItem(id){const i=s.inventory.find(x=>x.id===id);if(!i)return;const owner=assignedTo(id),root=$('modalRoot');const a=affixes(i);const r=rarityDefs[i.rarity];root.innerHTML=`<div class="modalback"><div class="modal equipment-detail ${r.class}" role="dialog" aria-modal="true" aria-label="装备详情"><div class="detail-header"><div class="detail-large-icon">${itemIcon(i.slot)}</div><div><div class="detail-rank">${r.name.toUpperCase()} / ${slotDefs[i.slot].name}</div><h3>${esc(i.name)}</h3><p>回收区域 ${String(i.zone).padStart(2,'0')} · 装备编码 #${i.id} · ${owner?esc(opDefs[owner].name)+' 正在穿戴':'存放在仓库中'}</p></div></div><div class="detail-subtitle">装备词条与效果</div><div class="affix-list">${a.map(v=>`<div class="affix-row"><strong>${statLabel(v.key,v.value)}</strong><small>${affixInfo[v.key]}</small></div>`).join('')}</div><div class="detail-subtitle">选择穿戴干员</div><div class="detail-operators">${s.recruited.map(k=>`<button class="btn ${owner===k?'outline':'primary'}" data-equip="${i.id}" data-equip-op="${k}" ${owner===k?'disabled':''}>${esc(opDefs[k].name)}${owner===k?' · 已穿戴':''}</button>`).join('')}</div><div class="detail-footer"><button class="btn outline" data-lock="${i.id}">${i.locked?'取消锁定':'锁定保护'}</button><button class="btn alert" data-salvage="${i.id}" ${owner||i.locked?'disabled':''}>拆解 +${salvageReward(i)} 零件</button><button class="btn outline" data-close-detail="1">关闭</button></div></div></div>`;root.querySelector('.modalback').onclick=e=>{if(e.target===root.querySelector('.modalback'))root.innerHTML=''}}
// 切页路由：所有导航均不刷新页面，手机可以左右滑动顶栏查看全部标签。
function go(t){if(!tabMeta[t]||!$(t))return;tab=t;document.querySelectorAll('.page').forEach(e=>e.classList.toggle('hidden',e.id!==t));document.querySelectorAll('.navbtn').forEach(e=>e.classList.toggle('active',e.dataset.tab===t));$('pageTitle').textContent=tabMeta[t][0];$('breadcrumb').textContent=tabMeta[t][0];$('pageSubtitle').textContent=tabMeta[t][1];render(true);window.scrollTo({top:0,behavior:'instant'});}
function animateAttack(){const a=$('heroFig'),e=$('enemyFig'),b=$('beam');for(const x of [a,e,b]){x.classList.remove('hit','attack','flash');void x.offsetWidth}a.classList.add('attack');e.classList.add('hit');b.classList.add('flash')}
function modal(title,value,importing){const root=$('modalRoot');root.innerHTML=`<div class="modalback"><div class="modal" role="dialog" aria-modal="true"><h3>${title}</h3><p>${importing?'粘贴由旧游戏或本游戏导出的 JSON 存档。':'以下文本为本机存档。更换浏览器或设备之前请保存副本。'}</p><textarea id="saveta" spellcheck="false" aria-label="存档文本"></textarea><div class="modalactions"><button class="btn outline" id="closeModal">关闭</button><button class="btn primary" id="modalSubmit">${importing?'确认导入':'复制存档'}</button></div></div></div>`;$('saveta').value=value||'';$('closeModal').onclick=()=>root.innerHTML='';$('modalSubmit').onclick=async()=>{if(importing){try{const obj=JSON.parse($('saveta').value);if(!obj||![1,2,3,4,5].includes(obj.version)||!Number.isFinite(obj.credits)||!obj.buildings||!obj.ops)throw Error('invalid');s=hydrate(obj);s.enemyHp=enemyMaxHp();s.lastSave=Date.now();root.innerHTML='';addLog('外部存档导入成功');changed();toast('导入成功')}catch(e){toast('导入失败，请检查 JSON 是否完整')}}else{try{await navigator.clipboard.writeText($('saveta').value);toast('已复制文本')}catch(e){$('saveta').select();toast('请手动复制选中的内容')}}};root.querySelector('.modalback').onclick=e=>{if(e.target===root.querySelector('.modalback'))root.innerHTML=''}}
function init(){load();render(true);$('runtimeNotice').hidden=true;document.documentElement.classList.add('app-ready');
 // 事件委托：动态卡片重绘后，按钮不需要重新绑定事件。
 document.addEventListener('click',e=>{const b=e.target.closest('[data-tab],button');if(!b||b.disabled)return;let k;
 if(k=b.dataset.tab){e.preventDefault();go(k)}else if(k=b.dataset.goto)go(k);else if(k=b.dataset.opselect)selectOp(k);else if(k=b.dataset.squad)toggleSquad(k);else if(b.dataset.mapChapter!==undefined)chooseMapChapter(Number(b.dataset.mapChapter));else if(k=b.dataset.opgear){s.selectedOp=k;go('inventory')}else if(k=b.dataset.detail)openItem(Number(k));else if(k=b.dataset.lock)toggleLock(Number(k));else if(b.dataset.closeDetail)$('modalRoot').innerHTML='';else if(k=b.dataset.build)build(k);else if(k=b.dataset.recruit)recruit(k);else if(k=b.dataset.train)train(k);else if(k=b.dataset.focus)setFocus(k);else if(k=b.dataset.equip){equip(Number(k),b.dataset.equipOp||s.selectedOp);$('modalRoot').innerHTML=''}else if(k=b.dataset.salvage)salvage(Number(k));else if(k=b.dataset.unequip)unequip(k);else if(k=b.dataset.tech)research(k);else if(k=b.dataset.claim)claimQuest(k);else if(k=b.dataset.dispatch)dispatch(k);else if(k=b.dataset.policy)setPolicy(k);else if(k=b.dataset.zone)selectZone(Number(k));else if(b.dataset.gear)strengthen();else if(b.id==='rebootBtn')reboot();else if(b.id==='forgeBtn')forge();else if(b.id==='storageExpand')upgradeStorage();});
 $('goalAction').onclick=()=>go('battle');$('advanceBtn').onclick=()=>advance();$('saveNow').onclick=()=>toast(save()?'存档已保存':'本机无法写入存档');$('exportSave').onclick=()=>{save();modal('导出存档',JSON.stringify(s),false)};$('importSave').onclick=()=>modal('导入存档','',true);$('hardReset').onclick=reset;
 $('autoAdvance').onchange=e=>{if(researchLv('autonomy')){s.autoAdvance=e.target.checked;changed()}};$('autoEquip').onchange=e=>{s.autoEquip=e.target.checked;if(s.autoEquip)autoEquipBest();changed()};$('autoSalvage').onchange=e=>setAutoSalvage(e.target.value);$('rarityFilter').onchange=e=>setInventoryFilter(e.target.value);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save();else{const now=Date.now();const off=Math.min(MAX_OFFLINE,Math.max(0,(now-lastTick)/1000));if(off>3)calculateOffline(off);lastTick=now;changed()}});window.addEventListener('pagehide',save);
 setInterval(()=>{if(document.hidden)return;const now=Date.now(),dt=Math.max(0,Math.min(.5,(now-lastTick)/1000));lastTick=now;const before=s.totalKills;tick(dt);render(false);if(before!==s.totalKills&&tab==='battle')animateAttack();if(now-lastFull>1200){lastFull=now;render(true)}if(now-lastSave>10000){lastSave=now;save()}},200);
}
init();
