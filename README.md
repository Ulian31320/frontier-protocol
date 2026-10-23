# 边境协议 / FRONTIER PROTOCOL

原创工业科幻题材网页放置养成游戏。**v0.1.2**，支持桌面与移动设备。

## 在线部署（GitHub Pages）

将本文件夹**内部的全部文件和目录**放入仓库的 `main` 分支根目录，确保 `index.html` 直接位于仓库顶层。

在 GitHub 仓库中打开 **Settings → Pages → Build and deployment**，选择：
- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/ (root)**
- 点击 Save。

GitHub Pages 将自动在每次向 `main` 分支提交更新后重新发布。普通项目仓库的网址格式：

`https://<GitHub用户名>.github.io/<仓库名>/`

注意：游戏存档存于浏览器的 `localStorage`，GitHub Pages 和本地文件的存档不会自动同步。更换设备/浏览器前请在游戏内导出 JSON 存档，并在新设备上导入。

## 本地运行

在支持 JavaScript 的浏览器中打开 `index.html`。**不要直接在 ChatGPT 附件静态预览里游玩**，预览可能禁止脚本执行。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构、菜单、五个主要页面、内联原创 SVG 场景 |
| `css/styles.css` | 颜色、卡片、工业风布局、响应式与手机端 |
| `js/game.js` | 建筑、经济、战斗、角色成长、区域推进、存档、交互 |
| `docs/ARCHITECTURE.md` | 系统设计、常见修改位置、未来更新注意事项 |
| `CHANGELOG.md` | 版本改动记录 |
| `.nojekyll` | GitHub Pages 按原样发布静态文件 |

## 开发约定

1. 每项功能修改都应有**中文注释**，说明用途、参数及与其它系统的关联。
2. 不要把主游戏逻辑重新塞进 `index.html`；对应修改 `js/game.js`。
3. 每次修改后更新 `CHANGELOG.md`，使用 `feat: ...` / `fix: ...` / `docs: ...` 的提交信息。
4. 修改资源、数值时检查建筑与队员是否能正常解锁，避免卡死。
5. 改动存档字段时必须考虑向后兼容，禁止未经迁移直接重命名现有存档键。
6. 如需加入第三方素材或代码，核对其许可证并在项目内保留必要署名。

## 灵感与版权说明

游戏中的场景、SVG 角色和界面为本项目原创素材，不包含《明日方舟》或《明日方舟：终末地》官方角色立绘、Logo 或游戏文件。本项目仅借鉴工业科幻美术氛围。放置成长的设计思路参考公开游戏 [Progress Knight](https://github.com/ihtasham42/progress-knight)，该项目使用 Unlicense。

此仓库是单机静态网页，不需要后端。**代码通过 GitHub 托管不代表本仓库已自动上线；需要首次开启 GitHub Pages。**
