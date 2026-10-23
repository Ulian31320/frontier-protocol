# 边境协议 v0.3.0 架构说明

## 基本运行

`index.html` 会依次加载 `css/styles.css`、`js/art.js`、`js/game.js`。游戏入口是 `init()`：读取并升级存档、渲染页面、绑定事件，之后以定时器更新资源和战斗。

没有后端，所有游戏逻辑和存档都在浏览器内执行。

## 数据模型与旧存档

全局运行状态为 `s`，由 `fresh(cores)` 创建。`hydrate(p)` 会把 v1 / v2 / v3 的存档映射到当前默认数据模型。**保持 `SAVEKEY='frontier_protocol_original_v1'` 不变**，这样原版本浏览器同源存档可以自动升级。

- 资源：`credits, alloy, energy, data, parts`。
- 建筑：`buildings`，键来自 `bld` 配表。
- 干员：`ops, recruited, focus`。
- 装备：`inventory, loadouts, uid, autoEquip, autoSalvage, storageLevel, selectedOp, inventoryFilter`。
- 地区和战斗：`stage, maxStage, killsStage, enemyHp, squadHp, retreat, totalKills`。
- 技术与任务：`tech, claimed, dispatch, policy, autoAdvance`。
- 永久成长：`cores`。

新增状态字段须同时在 `fresh()` 和 `hydrate()` 中维护默认值，不能修改旧字段含义。

## 配置与计算

- `opDefs`：角色初始属性，包含肖像绘制需要的 `colors`（三个颜色）。
- `bld`：建筑的基本产出、原料消耗、升级成本与解锁条件。
- `zoneDefs`：区域名称、描述与敌人。
- `techDefs`：研究成本、倍率、最大等级及区域前置条件。
- `missions`：任务进度字段、阈值、奖励。
- `dispatchDefs`：派遣时间、消耗、奖励。
- `simulateProduction(dt)`：产量和能源约束，支持离线倍率。
- `simulateCombat(dt)`：敌方反击、敌人击杀、队伍撤退与维修。
- `makeItem()`：装备随机化（主词条与随机副词条）。
- `affixes()`：统一展示所有真实生效的装备属性（旧装备缺省副词条为 0）。
- `loadouts[op][slot]`：每名干员独立 3 个装备槽，`equippedIds()` 和 `assignedTo(id)` 用于保护已穿戴装备。
- `autoEquipBest()`：每个装备部位进行全队唯一分配，禁止一个 ID 同时属于多人。
- `autoSalvageSweep()`：只处理符合配置稀有度、未穿戴且未锁定的装备。
- `storageUsed()`：只统计未穿戴装备；`storageCapacity()` 为 60 + 20 × 扩容等级。
- `openItem()`：在弹窗中展示完整词条，装备卡片只显示主要信息。
- `render(true)`：8 个页面的动态内容；`render(false)`：资源与战斗即时数字。
- `go(tab)`：导航，8 个页面 ID 必须和 `tabMeta` 保持一致。

## 部署和测试注意

1. 初次设置 GitHub Pages 为 `main` + `/(root)`。静态源码推送后即可由 GitHub Pages 部署。
2. 项目没有 CDN / API 依赖，所有必须的文件都在仓库内。
3. 修改动态卡片内的 `data-*` 按钮时，同时修改 `init()` 中的点击委托逻辑。
4. 修改角色配表时记得同步 `colors` 字段，否则 `portraitSvg()` 无法渲染，可能造成整页 UI 初始化失败。
5. GitHub Pages 与本地文件是不同的 localStorage 来源，请用游戏内 JSON 导出 / 导入进行迁移。
6. 浏览器脚本因受限而不能执行时，页面会显示运行环境提示。**不要把静态 HTML 预览视为真实游戏测试**。
7. 存档由 v2 → v3 时，`p.equipped` 的全队旧装备迁移至第一名已招募干员，仓库、规则、锁定状态保持默认；不要删除此迁移。
8. 每次发布前运行 `node --check js/game.js` 和 `node tests/smoke.cjs` 及 `node tests/inventory_extended.cjs`；有本地浏览器权限时再运行 Playwright 测试，检查宽屏 / 390px 手机布局。

## 下一阶段方向

扩充干员与敌人技能表现、装备词条和掉落池、具备独立编成位置的小队系统、任务叙事及声音反馈。现有版本已经可以循环游玩，但尚不属于有完整剧情、多角色 Live2D 和复杂 3D 动画的正式商业游戏。
