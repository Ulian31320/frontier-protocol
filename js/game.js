'use strict';
/* Original game inspired by open-source incremental design patterns of Progress Knight (Unlicense).
   No official Arknights / Endfield art, names, UI assets or copyrighted code embedded. */

// ── 基础工具及格式化 ────────────────────────────────────────
// $ 用于获取 DOM 元素；fmt 统一格式化资源数字。
const $=id=>document.getElementById(id), fmt=n=>{n=Math.max(0,n||0);return n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e4?(n/1e3).toFixed(1)+'K':Math.floor(n).toLocaleString('zh-CN')};

// ── 建筑配置 ────────────────────────────────────────────────
// 在此增删建筑：product 是产出资源；rate 是每秒产出；
// cost 是初始成本；mult 表示每建造 1 级后的成本增长倍数。
// 新建筑还需同步添加到 fresh().buildings（旧存档需迁移）。
const bld={mine:{name:'远程采矿机',sub:'回收无人区中的合金原料',product:'alloy',rate:.36,cost:{credits:70,alloy:0,energy:0},mult:1.49,icon:'mine'},solar:{name:'流动供能塔',sub:'为基地提供持续的工业能源',product:'energy',rate:.52,cost:{credits:85,alloy:12,energy:0},mult:1.5,icon:'solar'},trade:{name:'物流交换站',sub:'将配送任务转化为信用点',product:'credits',rate:1.65,cost:{credits:170,alloy:28,energy:10},mult:1.55,icon:'trade'},lab:{name:'边境观测所',sub:'解析异常样本并产生数据',product:'data',rate:.17,cost:{credits:315,alloy:65,energy:35},mult:1.62,icon:'lab'}};

// ── 队员配置 ────────────────────────────────────────────────
// base 是基础每秒伤害；bonus 是每次升级的属性增幅。
// 新队员需要同步 fresh().ops、显示布局、存档验证。
const opDefs={lin:{name:'临川',role:'侦察 / VANGUARD',tag:'SR-01',desc:'前线侦察员，机动与射击训练出身。',base:5.8,bonus:.38,price:{credits:0,data:0},colors:['#8ea7a1','#334953','#d9c58d']},yor:{name:'尧灯',role:'技术 / CASTER',tag:'SR-02',desc:'擅长远程能量调制与装置干扰。',base:10.5,bonus:.47,price:{credits:310,data:18},colors:['#b7a6a7','#424e69','#dac4be']},shi:{name:'初砾',role:'护卫 / GUARD',tag:'SR-03',desc:'基地护卫队员，使用重型近战装备。',base:18.0,bonus:.53,price:{credits:680,data:65},colors:['#9aadae','#53595c','#e7c47e']}};

// ── 区域和敌人配置 ──────────────────────────────────────────
// 数组各项是 [区域名称, 区域说明, 敌人名称]。
const zones=[['灰岭外围','废弃通路上的机械残骸仍有活动迹象。','巡游构装体'],['沉积平原','采矿遗迹散布其间，异常反应正在增强。','异常勘探机'],['风蚀回廊','通往旧工业区的道路尚未重新开启。','失控防卫装置'],['北部联运区','高价值的设备区遭到旧式防卫系统占据。','铁壳守卫'],['废墟中继站','历史档案中记载的旧时代节点。','失联哨卫'],['边境禁入带','信号模糊，危险等级持续上升。','区域清剿者']];

// ── 存档版本与离线收益设置 ──────────────────────────────────
// ⚠️ 请不要随意修改 SAVEKEY，否则旧玩家会丢失自动读取入口。
// 修改存档结构时，应同步维护 valid() 和载入迁移逻辑。
const SAVEKEY='frontier_protocol_original_v1';const maxOffline=8*3600;

// ── 新游戏默认状态 ──────────────────────────────────────────
// fresh() 是游戏的唯一初始数据模板；协议重启也会复用。
function fresh(core=0){return {version:1,credits:340,alloy:50,energy:34,data:0,buildings:{mine:1,solar:1,trade:0,lab:0},ops:{lin:{level:1,xp:0},yor:{level:1,xp:0},shi:{level:1,xp:0}},recruited:['lin'],gear:0,cores:core,stage:1,killsStage:0,totalKills:0,totalEarned:0,enemyHp:0,logs:[],created:Date.now(),lastSave:Date.now()}};
let s=fresh(),tab='overview',lastTick=Date.now(),lastUi=0,lastSave=Date.now(),toastTimer=0,animTick=0;

// ── 存档读取、验证与保存 ────────────────────────────────────
// 数据保存在当前域名的 localStorage；不同域名不共享，
// GitHub Pages 上线后请使用「导出 / 导入」迁移旧存档。
function load(){try{let raw=localStorage.getItem(SAVEKEY);if(!raw)return;const parsed=JSON.parse(raw);if(!valid(parsed))return; s=parsed;const sec=Math.min(maxOffline,Math.max(0,(Date.now()-(s.lastSave||Date.now()))/1000));if(sec>5){const out=[];for(const [k,d] of Object.entries(bld)){const v=(s.buildings[k]||0)*d.rate*mult()*sec*.7;s[d.product]+=v;if(v>=1)out.push(`${titleResource(d.product)} +${fmt(v)}`)}addLog(`离线 ${Math.floor(sec/60)} 分钟，生产收益：${out.join(' / ')||'少量资源'}`);}
 s.lastSave=Date.now();}catch(e){console.warn('无法读取存档',e)}}
function valid(p){return p&&p.version===1&&['credits','alloy','energy','data','stage','cores','gear','totalKills'].every(k=>Number.isFinite(p[k])&&p[k]>=0)&&p.buildings&&Object.keys(bld).every(k=>Number.isInteger(p.buildings[k])&&p.buildings[k]>=0&&p.buildings[k]<1e6)&&p.ops&&Object.keys(opDefs).every(k=>p.ops[k]&&Number.isInteger(p.ops[k].level)&&p.ops[k].level>=1&&Number.isFinite(p.ops[k].xp)&&p.ops[k].xp>=0)&&Array.isArray(p.recruited)&&p.recruited.every(x=>opDefs[x])&&Array.isArray(p.logs)}
function save(){try{s.lastSave=Date.now();localStorage.setItem(SAVEKEY,JSON.stringify(s));$('saveStatus').textContent='刚刚已保存';return true}catch(e){$('saveStatus').textContent='存档不可用';return false}}
function titleResource(k){return ({credits:'信用点',alloy:'合金',energy:'能源',data:'数据'})[k]};function mult(){return 1+s.cores*.15};function prod(k){return (s.buildings[k]||0)*bld[k].rate*mult()};function totalProd(){return Object.keys(bld).reduce((sum,k)=>sum+prod(k),0)}

// ── 经济与生产系统 ──────────────────────────────────────────
// 购买成本随建筑等级指数增长，pay() 是扣除资源的唯一入口。
function buildCost(k){const d=bld[k],n=s.buildings[k];return Object.fromEntries(Object.entries(d.cost).map(([r,v])=>[r,Math.ceil(v*Math.pow(d.mult,n))]))}
function afford(c){return Object.entries(c).every(([r,v])=>s[r]+1e-6>=v)};function pay(c){if(!afford(c))return false;for(const [r,v] of Object.entries(c))s[r]-=v;return true}
function costText(c){return Object.entries(c).filter(([r,v])=>v>0).map(([r,v])=>`${fmt(v)} ${titleResource(r)}`).join(' / ')}
function addLog(msg){s.logs.unshift({ts:Date.now(),msg});s.logs=s.logs.slice(0,14)};
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2400)}

// ── 战斗与成长数值 ──────────────────────────────────────────
// 可在这里修改升级经验公式、敌人耐久、敌人奖励和队伍 DPS。
function xpNeed(l){return Math.round(52*(l+1)*Math.pow(1.01,l))} // progression inspired by Progress Knight's increasing threshold
function combatDps(){return s.recruited.reduce((sum,k)=>{const o=s.ops[k],d=opDefs[k];return sum+d.base*(1+(o.level-1)*d.bonus)},0)*(1+s.gear*.22)*mult()};
function zone(){return zones[Math.min(s.stage-1,zones.length-1)]};function enemyMaxHp(){return Math.round(29*Math.pow(1.45,s.stage-1))};function reward(){return Math.round((18+s.stage*8)*mult())};

// ── 游戏主循环：自动产出、自动战斗、经验与掉落 ──────────────
// dt 是经过的秒数；逻辑更新与 UI 刷新分开运行。
// 注意避免在 tick 内直接频繁修改 DOM，否则手机会掉帧。
function tick(dt){for(const [k,d] of Object.entries(bld))s[d.product]+=prod(k)*dt;
 s.enemyHp ||=enemyMaxHp();s.enemyHp-=combatDps()*dt;
 let count=0;while(s.enemyHp<=0&&count++<12){s.totalKills++;s.killsStage++;s.credits+=reward();s.totalEarned+=reward();s.data+=Math.max(2,2+Math.floor(s.stage*.6));if(Math.random()<.14)s.alloy+=Math.max(1,Math.ceil(s.stage*.8));for(const k of s.recruited){const o=s.ops[k];o.xp+=15+s.stage*4;let g=0;while(o.xp>=xpNeed(o.level)&&g++<100){o.xp-=xpNeed(o.level);o.level++;if(o.level%3===0)addLog(`${opDefs[k].name}晋升至 Lv.${o.level}`)}}if(s.totalKills%4===0)addLog(`侦察报告：清除 ${zone()[2]}，回收信用点 ${reward()}`);s.enemyHp+=enemyMaxHp();if(tab==='battle')animateAttack();}}

// ── 玩家操作 ────────────────────────────────────────────────
// 建筑建造 / 招募 / 强化 / 推进关卡 / 协议重启 / 重置存档。
function build(k){const c=buildCost(k);if(!pay(c)){toast('资源不足，前哨会持续生产');return}s.buildings[k]++;addLog(`工业设施已部署：${bld[k].name} × ${s.buildings[k]}`);toast(`${bld[k].name}完成部署`);save();render(true)}
function recruit(k){if(s.recruited.includes(k))return;if(!pay(opDefs[k].price)){toast('招募所需资源不足');return}s.recruited.push(k);addLog(`新干员 ${opDefs[k].name} 加入行动小队`);toast(`${opDefs[k].name} 已加入前线`);save();render(true)}
function strengthen(){const c={credits:Math.ceil(100*Math.pow(1.52,s.gear)),alloy:Math.ceil(20*Math.pow(1.48,s.gear)),energy:Math.ceil(12*Math.pow(1.4,s.gear))};if(!pay(c)){toast('装备强化资源不足');return}s.gear++;addLog(`战术模块提升至 Mk.${s.gear}`);toast('装备强化成功');save();render(true)}
function advance(){if(s.killsStage<6){toast('先清除 6 个目标完成当前调查');return}s.stage++;s.killsStage=0;s.enemyHp=enemyMaxHp();addLog(`调查区域已拓展至 ${String(s.stage).padStart(2,'0')}：${zone()[0]}`);toast(`进入 ${zone()[0]}`);save();render(true)}
function reboot(){if(s.stage<5){toast('调查至区域 05 才能开启协议重启');return}const gain=1+Math.floor((s.stage-5)/2);if(!confirm(`重启后会失去本轮全部资源和进度，获得 ${gain} 枚永久核心。确定重启？`))return;const c=s.cores+gain;s=fresh(c);addLog(`协议重启完成 · 永久核心共 ${c} 枚`);save();toast(`获得永久核心 × ${gain}`);render(true)}
function reset(){if(!confirm('确定清空所有游戏进度及永久核心？此操作不可撤销。'))return;s=fresh();save();toast('新档案建立成功');render(true)}

// ── 页面路由：五个标签页 ────────────────────────────────────
// 支持的页面：overview、factory、battle、operators、protocol。
// 添加新页面时，同时修改 index.html 页面 section 与侧栏链接。
function go(t){if(!$(t))return;tab=t;document.querySelectorAll('.page').forEach(e=>e.classList.toggle('hidden',e.id!==t));document.querySelectorAll('.navbtn').forEach(e=>e.classList.toggle('active',e.dataset.tab===t));const meta={overview:['总控概览','无人区前哨 · 区域调查与工业生产同步进行'],factory:['基地建设','自动化生产矩阵 · 扩张、供能与资源物流'],battle:['前线探索','部署战术小队 · 自动排除区域威胁'],operators:['干员档案','作战人员管理 · 成长与战术装备'],protocol:['协议记录','永久成长 · 本地存档与版本管理']};$('pageTitle').textContent=meta[t][0];$('breadcrumb').textContent=meta[t][0];$('pageSubtitle').textContent=meta[t][1];render(true);window.scrollTo({top:0,behavior:'instant'})}

// ── SVG 原创视觉素材 ────────────────────────────────────────
// 设施和队员肖像均以内联 SVG 绘制，不依赖外部 CDN。
function facilitySvg(k){const common='fill="none" stroke="#536f70" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';let body={mine:'<path d="M12 62H78L85 48 69 40 55 53 40 35 24 48 12 43Z" fill="#849f9b"/><path d="M42 33L53 17 62 21 64 34" fill="#eac365"/><path d="M14 64h76v8H14Z" fill="#455b63"/><path d="M24 72v12m18-12v12m18-12v12m18-12v12" stroke="#344e56" stroke-width="6"/>',solar:'<path d="M42 12h24l13 62H29Z" fill="#8baba1"/><path d="M31 73h47v8H31Z" fill="#485d62"/><rect x="40" y="25" width="30" height="37" rx="3" fill="#455f66"/><path d="M45 33h20M45 41h20M45 49h20" stroke="#ebc66b" stroke-width="3"/><path d="M53 13V5M36 19l-7-5M77 19l7-5" stroke="#c6a34b" stroke-width="4"/>',trade:'<path d="M13 40h73v35H13Z" fill="#8da6a1"/><path d="M18 24h63v17H18Z" fill="#ced7cc"/><path d="M27 28h46v8H27Z" fill="#485c62"/><path d="M22 47h20v18H22ZM55 47h20v18H55Z" fill="#556c6b"/><path d="M8 75h84v8H8Z" fill="#435b62"/><path d="M32 48h3M65 48h3" stroke="#efc76e" stroke-width="4"/>',lab:'<path d="M18 71V28l26-15 36 15v43Z" fill="#8ca6a5"/><path d="M35 21h29v50H35Z" fill="#d4dfd6"/><path d="M44 27h13v34H44Z" fill="#57777b"/><circle cx="51" cy="44" r="7" fill="#e7c878"/><path d="M13 70h76v10H13Z" fill="#3e545c"/><path d="M51 9V1" stroke="#758f90" stroke-width="5"/>'}[k];return `<svg viewBox="0 0 100 90" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g ${common}>${body}</g></svg>`}
function portraitSvg(key){const [hair,coat,accent]=opDefs[key].colors;return `<svg viewBox="0 0 270 185" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="g${key}" x2="1" y2="1"><stop stop-color="#d1dfd7"/><stop offset="1" stop-color="#91aaa7"/></linearGradient></defs><rect width="270" height="185" fill="url(#g${key})"/><path d="M0 182L270 85v100H0Z" fill="#7f9995" opacity=".5"/><path d="M11 0v185M35 0v185M0 25h270M0 74h270M0 140h270" stroke="#eff6ef" stroke-width="1" opacity=".28"/><circle cx="164" cy="62" r="75" fill="#e9ece0" opacity=".25"/><path d="M70 190Q78 127 113 115L158 113Q195 132 211 190" fill="${coat}"/><path d="M105 122L124 110H160L174 126 146 170Z" fill="#e4e8e3"/><path d="M139 118l18 0 13 62h-26Z" fill="${accent}" opacity=".76"/><path d="M117 65Q115 32 149 29Q179 39 173 74L167 115 134 126 111 98Z" fill="${hair}"/><path d="M126 72Q145 50 165 72V105Q143 127 127 103Z" fill="#ead0bf"/><path d="M117 66L125 31Q149 17 171 34L180 81Q163 69 155 49Q141 78 117 78Z" fill="${hair}"/><path d="M135 86l6 1m14-1 6-1" stroke="#56676b" stroke-width="2"/><path d="M143 102q5 3 10 0" stroke="#ab918b" stroke-width="2" fill="none"/><path d="M114 119L92 182H69L87 132ZM176 122l39 59h23l-35-67Z" fill="${coat}"/><path d="M93 137L110 120M175 126l25 23" stroke="${accent}" stroke-width="5"/><path d="M127 114l-2-11m39 0-1 11" stroke="#dec3ad" stroke-width="4"/><path d="M32 157h36m-36 6h26M205 24h38m-24-5v26" stroke="#f7f5e4" opacity=".8" stroke-width="2"/></svg>`}
function logHtml(n=4){return s.logs.slice(0,n).map(x=>`<div class="logitem"><span class="logtime">${new Date(x.ts).toLocaleTimeString('zh-CN',{hour12:false,hour:'2-digit',minute:'2-digit'})}</span><span>${esc(x.msg)}</span></div>`).join('')||'<div class="logitem">前哨终端启动，自动生产与探索已开始。</div>'};
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

// ── UI 渲染 ─────────────────────────────────────────────────
// render(false) 高频更新资源与进度，render(true) 重新绘制卡片。
// data-build、data-recruit、data-gear 是点击事件的关键属性。
function render(full=false){$('resCredits').textContent=fmt(s.credits);$('resAlloy').textContent=fmt(s.alloy);$('resEnergy').textContent=fmt(s.energy);$('resData').textContent=fmt(s.data);$('areanum').textContent=String(s.stage).padStart(2,'0');$('statusText').textContent=`核心倍率 ×${mult().toFixed(2)}`;$('statStage').textContent=String(s.stage).padStart(2,'0');$('statDps').textContent=combatDps().toFixed(1);$('statProd').textContent=totalProd().toFixed(1);$('statKills').textContent=fmt(s.totalKills);
 $('clock').textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false});$('enemyBar').style.width=`${Math.max(0,100*s.enemyHp/enemyMaxHp())}%`;$('enemyHealthText').textContent=`${Math.ceil(Math.max(0,s.enemyHp))} / ${enemyMaxHp()} HP`;const [zn,zd,en]=zone();$('enemyName').textContent=en;$('battleZone').textContent=`AREA ${String(s.stage).padStart(2,'0')} · ${zn}`;$('zoneName').textContent=zn;$('zoneDesc').textContent=zd;$('sectorProgress').textContent=`${Math.min(6,s.killsStage)} / 6`;$('sectorBar').style.width=`${Math.min(100,s.killsStage/6*100)}%`;$('killReward').textContent=`+${reward()} 信用点 / +${Math.max(2,2+Math.floor(s.stage*.6))} 数据`;$('battleDps').textContent=combatDps().toFixed(1);$('advanceBtn').disabled=s.killsStage<6;$('advanceBtn').textContent=s.killsStage>=6?'解锁下一调查区域 →':`尚需清除 ${6-s.killsStage} 个目标`;
 let goalN=6,goalV=Math.min(6,s.killsStage);$('goalTitle').textContent=s.killsStage>=6?'当前区域调查完成':'完成区域调查';$('goalDesc').textContent=s.killsStage>=6?'已完成目标清除，可以在前线终端解锁下一区域。':`前线正在自动清除 ${en}。当前区域已清除 ${s.killsStage} 个目标，达到 6 个即可推进。`;$('goalBar').style.width=`${goalV/goalN*100}%`;$('goalPct').textContent=`${Math.round(goalV/goalN*100)}%`;$('goalAction').textContent=s.killsStage>=6?'前往开启下一调查区 →':'查看前线行动 →';
 if(!full)return;$('overviewLog').innerHTML=logHtml(4);$('battleLog').innerHTML=logHtml(6);
 $('facilityCards').innerHTML=Object.entries(bld).map(([k,d])=>{const c=buildCost(k),ok=afford(c);return `<div class="panel facility"><div class="facicon">${facilitySvg(k)}</div><div class="facbody"><div class="fachead"><h4>${d.name}</h4><span class="level">LV ${s.buildings[k]}</span></div><p>${d.sub}</p><div class="facfoot"><span class="yield">+${prod(k).toFixed(2)} /秒</span><div><button class="btn ${ok?'primary':''}" data-build="${k}" ${ok?'':'disabled'}>建造 +1</button><div class="cost">${costText(c)}</div></div></div></div></div>`}).join('');
 $('productionInfo').innerHTML=Object.entries(bld).map(([k,d])=>`<div class="barrow"><b>${titleResource(d.product)}</b><div class="progress"><div style="width:${Math.max(1,Math.min(100,prod(k)/(totalProd()||1)*100))}%"></div></div><span class="numeric">+${prod(k).toFixed(2)}/秒</span></div>`).join('');
 $('operatorCards').innerHTML=Object.entries(opDefs).map(([k,d])=>{const owned=s.recruited.includes(k),o=s.ops[k],c=d.price,xp=Math.max(0,Math.min(100,(o.xp/xpNeed(o.level))*100));return `<div class="operator-card"><div class="portrait">${portraitSvg(k)}<span class="rank">${owned?'ACTIVE':'LOCKED'} / ${d.role.split(' / ')[1]}</span><span class="code">${d.tag} // ${owned?'ON DUTY':'STANDBY'}</span></div><div class="opbody"><div class="opname"><h3>${d.name}</h3><span>Lv.${o.level}</span></div><div style="color:#b89d5d;font-size:10px;margin-top:4px;letter-spacing:1px">${d.role}</div><div class="opdesc">${d.desc}</div><div class="opstat"><span>单人火力</span><b>${(d.base*(1+(o.level-1)*d.bonus)*(1+s.gear*.22)*mult()).toFixed(1)} DPS</b></div><div class="progress"><div style="width:${owned?xp:0}%"></div></div>${owned?`<div class="cost" style="text-align:left">成长经验 ${Math.floor(o.xp)} / ${xpNeed(o.level)}</div><button disabled class="btn">已编入自动战斗队伍</button>`:`<button class="btn ${afford(c)?'primary':''}" data-recruit="${k}" ${afford(c)?'':'disabled'}>招募干员</button><div class="cost">${costText(c)}</div>`}</div></div>`}).join('');
 const gc={credits:Math.ceil(100*Math.pow(1.52,s.gear)),alloy:Math.ceil(20*Math.pow(1.48,s.gear)),energy:Math.ceil(12*Math.pow(1.4,s.gear))};$('gearCard').innerHTML=`<h3 style="margin:0 0 6px">战术模块 / Mk.${s.gear}</h3><p>已获得火力强化 +${Math.round(s.gear*22)}%（与干员等级加成相乘）。强化消耗信用点、合金和能源，不需要手动操作战斗。</p><button class="btn ${afford(gc)?'primary':''}" data-gear="1" ${afford(gc)?'':'disabled'}>强化战术模块</button><div class="cost" style="text-align:left;margin-top:9px">需要 ${costText(gc)}</div>`;
 const can=s.stage>=5,gain=1+Math.floor(Math.max(0,s.stage-5)/2);$('prestigePanel').innerHTML=`<div style="display:flex;justify-content:space-between;gap:13px;align-items:center"><div><div class="smallhead">// PROTOCOL CORE</div><h3 style="margin:0 0 8px;font-size:26px">${s.cores} <span style="font-size:12px;color:#87918e">枚永久核心</span></h3><p>工业生产及全队火力：×${mult().toFixed(2)}<br>当前进度：区域 ${s.stage} / 5（最低要求）<br>本次重启预计获取 ${can?gain:0} 枚核心</p></div><div style="color:#d2c189;font-size:80px;opacity:.75">◇</div></div><button class="btn ${can?'primary':''}" id="rebootBtn" ${can?'':'disabled'}>执行协议重启 →</button>`;
 $('battleReport').innerHTML=`<div class="smallhead">// OPERATION READOUT</div><div class="btinfo"><span>当前活动干员</span><strong>${s.recruited.length} / 3</strong></div><div class="btinfo"><span>自动清除总数</span><strong>${fmt(s.totalKills)}</strong></div><div class="btinfo"><span>下一目标耐久</span><strong>${enemyMaxHp()} HP</strong></div><div class="btinfo"><span>全队基础火力</span><strong>${combatDps().toFixed(1)} /秒</strong></div><div class="btinfo"><span>永久核心加成</span><strong>+${Math.round((mult()-1)*100)}%</strong></div><p>敌人不会反击造成减员。首版主要展示挂机成长循环；未来可加入队伍编成、战术技能、敌人波次及装备随机词条。</p>`;
}
function animateAttack(){const a=$('heroFig'),e=$('enemyFig'),b=$('beam');for(const el of [a,e,b]){el.classList.remove('hit','attack','flash');void el.offsetWidth}a.classList.add('attack');e.classList.add('hit');b.classList.add('flash')}

// ── 存档导入 / 导出窗口 ─────────────────────────────────────
// 导出是 JSON 文本；导入前必须通过 valid() 校验。
function modal(title,value,canImport){const root=$('modalRoot');root.innerHTML=`<div class="modalback"><div class="modal" role="dialog" aria-modal="true"><h3>${title}</h3><p>${canImport?'粘贴从其他设备导出的完整 JSON 存档，再点确认导入。':'下方是完整存档文本，可以复制到备忘录或其他设备保存。'}</p><textarea id="saveta" spellcheck="false" aria-label="存档文本"></textarea><div class="modalactions"><button class="btn outline" id="closeModal">关闭</button>${canImport?'<button class="btn primary" id="submitImport">确认导入</button>':'<button class="btn primary" id="copySave">复制文本</button>'}</div></div></div>`;$('saveta').value=value||'';$('closeModal').onclick=()=>root.innerHTML='';if(canImport){$('submitImport').onclick=()=>{try{const d=JSON.parse($('saveta').value);if(!valid(d))throw Error('存档格式不正确');s=d;s.enemyHp=Math.min(enemyMaxHp(),Math.max(0,s.enemyHp||enemyMaxHp()));s.lastSave=Date.now();save();root.innerHTML='';toast('导入成功');render(true)}catch(e){toast('导入失败：请确认存档文本完整')}}}else{$('copySave').onclick=async()=>{try{await navigator.clipboard.writeText($('saveta').value);toast('已复制存档文本')}catch(e){$('saveta').focus();$('saveta').select();toast('请手动复制选中的文字')}}}root.querySelector('.modalback').onclick=e=>{if(e.target.classList.contains('modalback'))root.innerHTML=''}}

// ── 游戏启动与事件绑定 ──────────────────────────────────────
// 事件委托处理动态渲染出来的按钮。
// 页面隐藏时自动存档；每 200 毫秒计算时间增量，
// 每 10 秒自动保存一次，定期完整刷新卡片。
function init(){load();s.enemyHp=Math.min(enemyMaxHp(),Math.max(0,s.enemyHp||enemyMaxHp()));if(!s.logs.length)addLog('边境前哨指挥系统已启动，工业产线与战术小队自动运行');render(true);
 document.addEventListener('click',e=>{const b=e.target.closest('button,[data-tab]');if(!b)return;let k;if(k=b.dataset.tab){e.preventDefault();go(k);return}if(k=b.dataset.goto){go(k);return}if(k=b.dataset.build){build(k);return}if(k=b.dataset.recruit){recruit(k);return}if(b.dataset.gear){strengthen();return}});
 $('goalAction').onclick=()=>go('battle');$('advanceBtn').onclick=advance;$('saveNow').onclick=()=>toast(save()?'存档已保存':'本机无法写入存档');$('exportSave').onclick=()=>{save();modal('导出游戏存档',JSON.stringify(s),false)};$('importSave').onclick=()=>modal('导入游戏存档','',true);$('hardReset').onclick=reset;document.addEventListener('click',e=>{if(e.target.id==='rebootBtn')reboot()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)save();else lastTick=Date.now()});window.addEventListener('pagehide',save);setInterval(()=>{const now=Date.now(),dt=Math.max(0,Math.min(.6,(now-lastTick)/1000));lastTick=now;tick(dt);render(false);if(now-lastUi>1800){lastUi=now;render(true)}if(now-lastSave>10000){lastSave=now;save()}},200);
 document.documentElement.classList.add('app-ready');
}
init();
