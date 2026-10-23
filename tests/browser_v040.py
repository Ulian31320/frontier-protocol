"""v0.4 UI 检查：真实 Chromium 中模拟章节切换、编队与 5 列仓库。"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
html=re.sub(r'<link\s+rel="stylesheet"[^>]*>','',html)
html=re.sub(r'<script\s+src="[^"]+"\s+defer></script>','',html)
style=(ROOT/'css/styles.css').read_text()
art=(ROOT/'js/art.js').read_text()
game=(ROOT/'js/game.js').read_text()
SHIM='''Object.defineProperty(window,'localStorage',{configurable:true,value:(()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}})()})'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width,height,output in [(1366,860,'v040_desktop_inventory.png'),(390,844,'v040_mobile_operators.png'),(390,844,'v040_mobile_map.png')]:
  context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
  page=context.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  page.set_content(html);page.add_style_tag(content=style);page.evaluate(SHIM);page.add_script_tag(content=art);page.add_script_tag(content=game)
  page.wait_for_function('document.documentElement.classList.contains("app-ready")')
  page.evaluate('''s.credits=1e9;s.alloy=1e9;s.energy=1e9;s.parts=1e9;s.data=1e9;s.maxStage=30;s.stage=14;s.mapChapter=2;for(let n=0;n<20;n++)makeItem(n%3);changed()''')
  if 'inventory' in output:
   page.locator('[data-tab="inventory"]').click()
   grid=page.locator('#inventoryCards').evaluate('e=>getComputedStyle(e).gridTemplateColumns.split(" ").length')
   assert grid==5,f'desktop expected 5 columns got {grid}'
  elif 'operators' in output:
   page.evaluate("for(const k of Object.keys(opDefs)){if(!s.recruited.includes(k))s.recruited.push(k)};s.squad=['lin','yor','shi','sai'];changed()")
   page.locator('[data-tab="operators"]').click()
   assert page.locator('#operatorCards .operator-card').count()==12
   page.locator('[data-squad="sai"]').click()
   assert page.evaluate('s.squad.length')==3
   page.locator('[data-squad="li"]').click()
   assert page.evaluate('s.squad.includes("li")')
  else:
   page.locator('[data-tab="battle"]').click()
   page.locator('[data-map-chapter="3"]').first.click()
   assert '冻土干涉' in page.locator('#regionCards').inner_text()
  assert not errors,errors
  dims=page.evaluate('({scroll:document.documentElement.scrollWidth,inner:innerWidth})')
  assert dims['scroll'] <= dims['inner']+1, dims
  page.screenshot(path=str(ROOT/output),full_page=True)
  print('PASS',output,'screen',width,'scroll',dims['scroll'])
  context.close()
 browser.close()
