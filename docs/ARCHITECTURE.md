# 开发架构说明（v0.1.2）

## 运行顺序

`index.html` 加载 `css/styles.css`，并使用 `defer` 加载 `js/game.js`。JS 入口为 `init()`，先调用 `load()` 恢复存档，再首次执行 `render(true)`，最后注册点击处理和游戏循环。

## 数据模型

游戏状态位于 `js/game.js` 的 `s`。`fresh()` 建立全新角色，包含：
- `credits`、`alloy`、`energy`、`data`：基本资源
- `buildings`：建筑等级
- `ops`：队员等级和经验；`recruited`：已招募队员
- `gear`：装备强化等级；`cores`：永久协议核心
- `stage`：探索区域编号；`killsStage`：本区域清除目标数
- `enemyHp`：当前目标耐久
- `logs`、`totalKills`、`lastSave`：日志与统计

## 逻辑分层

- `bld`：设施配表，名称、生产速率、费用公式
- `opDefs`：队员配表，战力与招募成本
- `zones`：区域配表（超过定义数量后复用最后一组名称）
- `tick(dt)`：每个时间步增加建筑资源、降低敌方耐久、发放奖励与经验
- `build/recruit/strengthen/advance/reboot`：用户主动操作
- `render(full)`：局部高频刷新，和周期性完整界面刷新
- `go(tab)`：五个面板的切换
- `load/save/valid/modal`：localStorage 存档和 JSON 导入导出
- `init()`：事件绑定和定时器

## 重要约束与已知范围

1. 浏览器 Tab 被后台节流是正常情况，重新载入页面后由 `load()` 补算离线收益（上限 8 小时，收益系数 70%）。
2. 本版仅保留客户端存档，不能自动跨设备云同步。
3. `SAVEKEY = 'frontier_protocol_original_v1'` 不要随意更改；`version: 1` 是存档结构版本，不是游戏发行版号。
4. `valid()` 负责限制导入的数据结构。添加字段时请编写兼容旧存档的默认值或迁移方法。
5. 动态按钮依靠 `data-build`、`data-recruit`、`data-gear` 和顶层事件委托；修改 HTML 需同步维护。
6. 无联网接口，所有战斗与经济数值均在浏览器本地计算，因此不适合作为公平竞争的多人游戏服务端。
7. 修改游戏样式时请至少检查 375px（手机）和 1280px（桌面）布局。

## 后续推荐开发顺序

1. 分解 `game.js` 为配置、存档、核心模拟、渲染等模块，配合测试。
2. 扩展角色装备、随机掉落与自动装备规则。
3. 引入具有真实供需约束的生产链。
4. 多区域地图、编队和敌人类型。
5. 如果需要跨设备自动同步，再单独设计账号系统和后端存档。
