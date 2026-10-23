# v0.4 架构说明

## 存档与升级
`SAVEKEY='frontier_protocol_original_v1'` 保持不变。`fresh` 初始化全部 12 名角色、出战小队 `s.squad`、地图章节 `s.mapChapter` 和原有建筑/装备等字段。`hydrate` 支持旧 v1~v4 存档；v3 用户首次升级时自动把原先最多三名已招募干员加入出战小队。

## 地图
`zoneDefs` 包含 30 个人工配置地区；`chapterDefs` 包含 6 章节。`zoneAt(index)` 在第 31 区后按种子编号生成区域名称和敌人，`regionGoal(index)` 决定一张图的击杀数量。`enemyMaxHp/ enemyDmg` 按区域和首领调整倍率，`advance/selectZone/chooseMapChapter` 管理地图切换。**不要直接以 30 为最终关卡上限。**

## 编队
`opDefs` 包含角色、职业、专精、招募价格与 SVG 标识。`s.recruited` 是永久本轮已招募名册；`s.squad` 是最多四名出战者，`activeOps()` 是当前生效成员。`toggleSquad` 增删战斗队员，`squadBuff` 计算出战专精。装备归属仍由 `s.loadouts[operatorId]` 管理，与编队无关。

## 数值
`simulateProduction` 与 `simulateCombat` 是引擎核心，资源与伤害计算应在此完成；`dps` 只统计 `activeOps`。`victory` 给出经验、物资和装备；`makeItem` 的 `scale` 随区域提高，`reboot` 负责永久核心。

## 美术
`portraitSvg` 在 `basePortraitSvg` 上按角色轮廓增加原创帽子、护目镜、机械肩甲等细节。所有素材是项目自产生的矢量 SVG。后续若制作特定官方角色的二次创作，请单独登记来源，勿误称为官方图片。

## 测试
`node tests/smoke.cjs && node tests/inventory_extended.cjs && node tests/zone_roster.cjs`
然后运行 `python tests/browser_test.py` 检查桌面和手机布局、所有导航、仓库及编队交互。GitHub Pages 发布后需要额外通过公网 URL 测试资源加载。
