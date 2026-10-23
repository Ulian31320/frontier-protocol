"""《边境协议》浏览器 DOM 回归测试（桌面 / 手机）。

运行：python tests/browser_test.py
依赖：pip install playwright，并安装 Chromium。

使用真实 Chromium 在内存中加载 HTML、CSS、JavaScript，不依赖网络或本地端口。
由于环境可能拦截 file: 和 localhost: 导航，本测试只验证 DOM 交互、布局与
游戏脚本，不替代 GitHub Pages 上线后对真实网址及资源 HTTP 加载的检查。
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')
CSS = (ROOT / 'css/styles.css').read_text(encoding='utf-8')
ART = (ROOT / 'js/art.js').read_text(encoding='utf-8')
GAME = (ROOT / 'js/game.js').read_text(encoding='utf-8')
HTML = re.sub(r'<link\s+rel="stylesheet"[^>]*>', '', HTML)
HTML = re.sub(r'<script\s+src="[^"]+"\s+defer></script>', '', HTML)
STORAGE_SHIM = '''
(() => {
  const store = new Map();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: key => store.delete(key),
      clear: () => store.clear()
    }
  });
})();
'''


def test_device(browser, mobile=False):
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844} if mobile else {"width": 1366, "height": 850},
        is_mobile=mobile, has_touch=mobile,
        device_scale_factor=2 if mobile else 1,
    )
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    page.set_content(HTML, wait_until='load')
    page.add_style_tag(content=CSS)
    page.evaluate(STORAGE_SHIM)
    page.add_script_tag(content=ART)
    page.add_script_tag(content=GAME)
    page.wait_for_function("document.documentElement.classList.contains('app-ready')")
    assert page.locator('#runtimeNotice').is_hidden(), '脚本未完成初始化'

    for tab in ['factory', 'battle', 'operators', 'inventory', 'research', 'missions', 'protocol', 'overview']:
        page.locator(f'.navbtn[data-tab="{tab}"]').click()
        assert page.locator(f'section#{tab}').is_visible(), f'导航失败：{tab}'

    page.locator('.navbtn[data-tab="factory"]').click()
    initial = page.evaluate('s.buildings.mine')
    page.locator('[data-build="mine"]').first.click()
    assert page.evaluate('s.buildings.mine') == initial + 1, '点击建筑按钮无效'

    page.evaluate('s.credits=1e7;s.alloy=1e7;s.energy=1e7;s.data=1e7;s.parts=1e7;s.maxStage=5;changed()')
    page.locator('.navbtn[data-tab="research"]').click()
    page.locator('[data-tech="tactics"]').click()
    assert page.evaluate('s.tech.tactics') == 1, '点击研究按钮无效'
    page.locator('.navbtn[data-tab="operators"]').click()
    page.locator('[data-recruit="yor"]').click()
    assert page.evaluate("s.recruited.includes('yor')"), '点击招募按钮无效'
    page.locator('.navbtn[data-tab="inventory"]').click()
    page.locator('#forgeBtn').click()
    assert page.evaluate('s.inventory.length') > 0, '点击制造按钮无效'
    page.locator('button[data-detail]').first.click()
    assert page.locator('.equipment-detail').is_visible(), '装备详情未打开'
    page.locator('.equipment-detail button[data-equip]').first.click()
    assert page.evaluate('Object.values(s.loadouts.lin).some(Boolean)'), '点击装备按钮无效'
    page.locator('#storageExpand').click()
    assert page.evaluate('s.storageLevel') == 1, '仓库扩建按钮无效'
    page.locator('#autoSalvage').select_option('common')
    assert page.evaluate('s.autoSalvage') == 'common', '自动分解规则无效'
    page.locator('#rarityFilter').select_option('2')
    assert page.evaluate('s.inventoryFilter') == '2', '稀有度筛选无效'
    page.locator('#rarityFilter').select_option('all')
    page.locator('.navbtn[data-tab="protocol"]').click()
    page.locator('#saveNow').click()
    assert page.evaluate('!!localStorage.getItem(SAVEKEY)'), '保存功能无效'
    # 模拟内存状态清除后的重新载入，不修改其他页面或存档来源。
    page.evaluate('s=fresh();load();render(true)')
    assert page.evaluate("s.recruited.includes('yor')"), '加载存档没有恢复队员'
    assert page.evaluate('s.inventory.length') > 0, '加载存档没有恢复装备'
    widths = page.evaluate('({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth})')
    assert widths['scroll'] <= widths['viewport'] + 1, f'有水平溢出: {widths}'
    assert not errors, '浏览器 JavaScript 错误：' + ' | '.join(errors)
    print(f"PASS: {'mobile' if mobile else 'desktop'} clicks, navigation, economy, inventory, save/load, responsive width")
    ctx.close()


if __name__ == '__main__':
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            test_device(browser, mobile=False)
            test_device(browser, mobile=True)
        finally:
            browser.close()
