'use strict';
/* v0.5 战斗立绘动画；纯表现层，不修改战斗公式、编队存档或掉落概率。
 * s.squad 决定真实出战者；立绘图集的 5 个槽位依次对应凛御银灰、重岳、黍、祀、明河。
 * 图片未加载时自动退回 art.js 的原创 SVG 半身像，避免出现空白角色。
 */
(() => {
 const artIndex={lin:0,yor:1,shi:2,sai:3,nuo:4};
 const stage=document.querySelector('.battlefield'),team=document.getElementById('heroFig'),enemy=document.getElementById('enemyFig');
 if(!stage||!team||!enemy)return;
 const spriteUrl='./assets/five-operators.webp';
 stage.classList.add('portrait-mode');
 stage.insertAdjacentHTML('beforeend','<div class="combat-fx-layer" id="combatFx" aria-hidden="true"></div><div class="combat-actionline" id="combatActionline">TACTICAL ENGAGEMENT · 自动作战</div><div class="combat-badge">SQUAD <b id="combatSquadCount">1 / 4</b></div>');
 let rosterKey='',cursor=0;
 const card=id=>{
   const d=opDefs[id],level=s.ops[id]?.level||1,index=artIndex[id];
   return '<div class="combat-operator" data-fighter="'+id+'" style="--op-color:'+(d.colors?.[2]||'#e4c477')+'"><div class="combat-art"><div class="combat-vector">'+portraitSvg(id)+'</div>'+(index===undefined?'':'<div class="combat-sprite" style="background-position-x:'+(index*25)+'%"></div>')+'<div class="combat-flare"></div></div><div class="combat-identity"><strong>'+esc(d.name)+'</strong><span>Lv.'+level+'</span></div><div class="combat-role">'+esc(d.role.split('/').pop().trim())+'</div><div class="combat-charge"><i></i></div></div>';
 };
 const sync=()=>{
   const roster=(s.squad||[]).filter(id=>s.recruited.includes(id)&&opDefs[id]).slice(0,4);
   const key=roster.join('|');
   if(key!==rosterKey){rosterKey=key;team.innerHTML=roster.map(card).join('');document.getElementById('combatSquadCount').textContent=roster.length+' / 4';cursor=0}
   else for(const id of roster){const el=team.querySelector('[data-fighter="'+id+'"] .combat-identity span');if(el)el.textContent='Lv.'+(s.ops[id]?.level||1)}
   return roster;
 };
 const strike=(finisher=false)=>{
   if(document.hidden || (typeof tab!=='undefined'&&tab!=='battle') || s.retreat>0)return;
   const roster=sync();if(!roster.length)return;
   const id=roster[cursor++%roster.length],el=team.querySelector('[data-fighter="'+id+'"]');if(!el)return;
   const title=document.getElementById('combatActionline');
   title.textContent=opDefs[id].name+' // '+(finisher?'目标清除':opDefs[id].talent);
   el.classList.remove('combat-strike');void el.offsetWidth;el.classList.add('combat-strike');
   title.classList.remove('combat-line-flash');void title.offsetWidth;title.classList.add('combat-line-flash');
   if(window.matchMedia?.('(prefers-reduced-motion:reduce)').matches)return;
   const a=el.getBoundingClientRect(),b=enemy.getBoundingClientRect(),f=stage.getBoundingClientRect();
   if(!a.width||!b.width)return;
   const left=a.right-f.left-8,top=a.top-f.top+a.height*.44;
   const ray=document.createElement('i');ray.className='combat-tracer';
   ray.style.cssText='left:'+left+'px;top:'+top+'px;--tx:'+Math.max(0,b.left-f.left+b.width*.24-left)+'px;--ty:'+(b.top-f.top+b.height*.48-top)+'px;--op-color:'+(opDefs[id].colors?.[2]||'#edc16c');
   const fx=document.getElementById('combatFx');fx.appendChild(ray);
   ray.addEventListener('animationend',()=>ray.remove(),{once:true});
   if(fx.childElementCount>12)fx.firstElementChild?.remove();
   if(finisher){enemy.classList.remove('hit');void enemy.offsetWidth;enemy.classList.add('hit')}
 };
 // 引擎原本在击杀后触发 animateAttack；替换该函数而不改变任何 DPS 运算。
 if(typeof animateAttack==='function')animateAttack=()=>strike(true);
 sync();
 const portraitSheet=new Image();portraitSheet.onload=()=>{stage.classList.add('battle-art-ready');document.documentElement.classList.add('operator-art-ready')};portraitSheet.onerror=()=>stage.classList.remove('battle-art-ready');portraitSheet.src=spriteUrl;
 const timer=window.setInterval(()=>{sync();strike(false)},1600);
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();