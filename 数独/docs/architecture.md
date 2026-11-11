# 小游戏架构与接入指南

微信小游戏以通用大厅为入口。宿主只处理平台与导航，数独、黄金矿工、Zuma、2048、扫雷、五子棋、俄罗斯方块和华容道都通过相同接口运行。增加游戏时，游戏自身管理玩法与状态，注册表提供展示信息和工厂。

外层仓库为 `D:\怀旧小游戏`，只分 `数独/` 和 `微信小程序/` 两个工作目录；Git 历史、CI 配置、协作约定及 npm 代理留在外层。网页、脚本、测试和文档位于 `数独/`，微信运行工程位于同级 `微信小程序/`。以下脚本命令均以 `数独/` 为工作目录；微信侧 `src/`、`vendor/`、`assets/` 的说明均相对于 [微信工程](../../微信小程序/README.md)。完整操作说明见 [目录布局与迁移](directory-layout.md)。

```text
怀旧小游戏/
  .git/                          外层保留原 Git 历史
  .github/workflows/             外层 GitHub Actions 工作流
  AGENTS.md                      项目协作约定
  package.json                   转发至数独目录的 npm 入口
  数独/
    index.html、styles.css        独立网页数独入口与样式
    js/                          网页数独交互与算法源文件
    scripts/
      build-minigame.mjs          通用构建、工程配置与接口检查
      games/                     自动发现的游戏 build/check 钩子
      minigame-modules.mjs        收集相对 CommonJS 依赖
      build-minigame-preview.mjs  由同一依赖图生成浏览器预览
    preview/                     本地 wx 适配层及交互 QA
    tests/                       引擎、模块及宿主回归
    docs/                        架构、游戏设计与 Notion 本地镜像
    templates/minigame/          新游戏接入骨架
  微信小程序/
    game.js                      生成的微信启动入口
    src/
      main.js                    启动通用宿主
      registry.js                游戏元信息、工厂、旧分享兼容匹配
      app/
        host.js                  导航、生命周期、计时、分享、实例缓存
        game-contract.js         统一游戏接口校验
        input.js                 触控标准化与命中检测
        music-control.js         通用音乐按钮及胶囊避让区域
      platform/
        wx.js                    Canvas、窗口安全区域、事件与循环
        storage.js               存储异常隔离及新存档键生成工具
        music.js                 单个背景音乐播放器、开关偏好与失败恢复
      hub/renderer.js            目录卡片、分页与最后游玩入口
      games/
        sudoku/                  数独界面、状态、算法产物
        gold-miner/              黄金矿工界面及规则产物
        zuma/                    Zuma 界面、状态、规则产物与 MIT 归属
        game-2048/               2048 纯规则、触控控制与 Canvas 渲染
        minesweeper/             扫雷纯规则、延迟布雷、存档与 Canvas 渲染
        gomoku/                  五子棋纯规则、休闲 AI、存档与 Canvas 渲染
        tetris/                  俄罗斯方块纯规则、时钟与触控、存档及 Canvas 渲染
        huarongdao/              华容道滑块规则、固定开局、逐格撤销、存档与 Canvas 渲染
    vendor/                      原 TypeScript、生成器与来源哈希；上传排除
    assets/audio/                用户配乐的 MP3 运行副本与来源清单
```

## 依赖与状态归属

`main → app/host → registry → games/<id>` 是创建游戏的路径。宿主通过 `platform` 使用微信，通过 `hub` 绘制大厅，不导入任何具体游戏。注册表内的静态相对 `require` 由构建器收集，游戏实例在首次进入时创建并缓存。

`controller.screen` 为 `home` 或游戏 ID，`controller.activeGame` 为当前模块或 `null`。游戏状态从 `controller.activeGame.model` 读取；宿主没有数独专属模型或动作分支。大厅每页三个卡片，根据注册表数量计算页数；当前八款游戏分三页，2048、扫雷和五子棋在第二页，俄罗斯方块和华容道在第三页。返回大厅时展示最后游玩游戏的继续入口。

游戏依赖自己的规则、状态与渲染文件，通过注入的能力调用存档、弹窗和分享相关行为。游戏内部不直接访问 `wx`、浏览器全局、其他游戏的状态或宿主内部变量。无需抽象不同游戏的规则模型，也无需建立共享的巨型状态对象。

Zuma 的扩展仍位于自己的模块内：`index.js` 导出控制器，`levels.js` 定义轨道和四档难度，`session.js` 管理每档闯关/无尽的进度和独立存档槽，`state.js` 保存含彩球弹药的单局快照，`renderer.js` 展示菜单与棋面。关卡、难度或模式增加不需要修改宿主。具体参数见 [Zuma 关卡设计](zuma-levels.md)。

2048 的 `engine.js` 独立实现确定性的移动、合并、生块和快照校验；`index.js` 管理滑动、动画锁、暂停、确认重开与独立存档；`renderer.js` 管理横竖屏棋盘和方向按钮。注册 ID 为 `game-2048`，大厅自动分页，分享仅传 `g=game-2048` 入口。宿主与平台层没有增加 2048 分支。详见 [2048 设计说明](2048.md)。

## 游戏接口

工厂签名为 `create({ read, write, now, services })`，返回对象的接口由 `src/app/game-contract.js` 校验。`read(key)` 返回保存值或 `null`，`write(key, value)` 返回是否成功，`now()` 返回毫秒时间戳。

| 成员 | 约定 |
| --- | --- |
| `id` | 与注册表一致的稳定游戏 ID |
| `frameInterval` | 更新间隔，单位毫秒；数独为 1000，连续动画为 16 |
| `enter(query, { source })` | 从大厅、启动分享或前台分享进入；解析自己的 query，需要时切换关局 |
| `resize(viewport)` | 接收逻辑像素宽高、`safeTop`、`safeBottom`、`capsuleRect`，保留游戏状态 |
| `render(ctx)` | 在宿主 Canvas 上绘图，返回 `{ x, y, w, h, action, payload?, label }[]` 点击区域 |
| `tick(deltaMs)` | 推进当前游戏；内部仍须检查暂停和结束状态，动画应限制长帧补偿 |
| `activate(action, payload)` | 处理游戏动作，成功返回 `true`，忽略或拒绝返回 `false` |
| `pointer(type, points)` | 处理 `start/move/end/cancel` 和触点；无需拖动时返回 `false` |
| `pause(reason)` | 停止计时和动画并清理手势；进入后台或返回大厅调用 |
| `save()` | 保存模块自己的版本化数据；容忍存储失败 |
| `sharePayload()` | 返回 `{ title, query }`，query 至少包含 `g=<id>` |
| `getResumeInfo()` | 返回 `{ text, available }`，供大厅显示进度与继续入口 |
| `statusText` | 人类可读的当前状态说明 |
| `model` | 游戏自己的模型或调试快照，宿主不解读内部结构 |
| `musicActive` | 可选只读布尔值；仅进行中的玩法为 true，菜单、暂停、结算和讲解为 false；未实现时保持静音 |
| `dispose()` | 可选；释放模块独占资源，宿主销毁时调用 |

`services` 包含 `toast(message)`、`modal(config, onConfirm)`、`actionSheet(config)`、`home()`、`invalidate()` 和只读 `storageAvailable`。服务由宿主注入，负责弹窗期间的计时和失效回调隔离。`invalidate()` 请求立即重绘，适用于异步回调后的界面更新。

所有绘制尺寸使用逻辑像素，由平台层设置设备像素比。`home`、`share` 是宿主保留动作；其余按钮使用 `<id>:<action>` 前缀。模块接收同样带前缀的动作，自行解析。点击区域必须落在安全区域内，且提供可读的 `label`，供预览检查和辅助交互使用。

宿主只推进当前游戏的时钟与动画。返回大厅、后台、分享和旋转会调用暂停；重新进入不隐式解除游戏暂停。游戏应将继续操作留给玩家。需要计时或动画时使用 `tick`，避免建立模块自己的长期定时器。

背景音乐由宿主与 `platform/music.js` 统一管理，不在各游戏内创建播放器。仅当前模块 `musicActive === true` 且前台、没有原生弹窗或系统音频中断时播放；大厅、暂停、结算、后台和退出均停止推进音频。使用一次惰性创建的 `wx.createInnerAudioContext` 顺序播放本地《平沙落雁》《阳关三叠》，通过结束事件切到下一首，末首后回到首曲；支持结束事件时关闭单曲 `loop`，旧适配器没有 `onEnded` 时降级为首曲循环。默认音量 0.4，暂停保留当前曲目和播放位置，宿主销毁时释放。浏览器用 HTMLAudio 适配同一接口及结束事件；播放失败后不会每帧重试，可在下一次真实交互或重新开启音乐时重试。

公共音乐按钮位于原生胶囊左侧，44×44 逻辑像素。宿主将按钮与原生胶囊合并后的避让矩形传给模块 `capsuleRect`，供标题和顶部控件避让；它表示宿主顶部保留区域，不再仅代表原生胶囊本身。开关独立保存到 `games-between:music:settings:v1`，不写入数独设置或游戏存档。外层 `音频/` 保留用户提供的原始 MP3，`scripts/prepare-background-music.mjs` 将其转为微信工程内的运行副本，并维护 `assets/audio/playlist.source.json`；构建检查核验运行文件及来源清单，`node scripts/prepare-background-music.mjs --check` 无需原始音频或 FFmpeg。游戏运行不依赖外层音频目录、编码器或联网加载。旧《庭间微光》音频及清单归档在 `数独/artifacts/audio-archive/`，合成脚本仅保留历史用途。

## 添加游戏

1. 复制 [模块骨架](../templates/minigame/index.cjs) 到同级微信工程的 `src/games/<id>/index.js`，最终路径为 `D:\怀旧小游戏\微信小程序\src\games\<id>\index.js`，修改 `ID` 并添加自己的状态、渲染、规则文件。骨架不注册为可玩游戏，仅用于接入。采用 CommonJS 和静态相对 `require('./file.js')`；不要依赖浏览器或第三方运行时。
2. 实现完整游戏接口。先用注入的内存 `read/write`、固定 `now` 与 Canvas 替身测试规则、暂停、存档恢复和触控。
3. 在 `src/registry.js` 内加入一条注册。使用现有 `play` 图标即可复用通用图形，无需改大厅绘制代码：

```js
{
  id: 'new-game',
  title: '新游戏',
  subtitle: '给快乐一点时间。',
  icon: 'play',
  status: 'ready',
  create: context => require('./games/new-game/index.js').createGame(context),
}
```

4. 为新游戏选择独立存档键。可引用 `../../platform/storage.js` 的 `saveKey('new-game', 'save', 1)`。已有游戏继续使用原键，版本变更时在模块内部迁移，避免影响其他游戏。
5. 若存在源码转换或独有生成校验，在 `数独/scripts/games/` 添加一个 `.mjs` 文件，按需导出异步 `build({ root, output })`、`check({ root, output })`。`root` 指数独维护目录，`output` 指同级微信工程目录，均由脚本位置解析，不依赖外层文件夹名称。通用构建自动发现，不需要修改游戏名单；纯 JavaScript 游戏无需增加钩子。
6. 执行构建、构建检查和完整测试，再生成预览检查窄屏、横屏、返回/继续、前后台、分享与刷新后恢复。最后在微信开发者工具和真机复核。

```sh
node scripts/build-minigame.mjs
node scripts/build-minigame.mjs --check
node --test tests/*.test.mjs
node scripts/build-minigame-preview.mjs
node scripts/serve.mjs
```

新注册项自动进入大厅分页、分享路由、模块依赖图、预览包和统一接口检查，不需要修改 `main.js`、宿主或通用检查器。预告项使用 `status: 'soon'`，提供展示信息即可。

## 扫雷接入实例

第五款游戏的稳定 ID 为 `minesweeper`，由注册表惰性加载 `src/games/minesweeper/index.js`；使用通用 `play` 图标、现有大厅分页和入口分享 `g=minesweeper`。本次没有向宿主添加扫雷规则或游戏专属分支。

`engine.js` 管理三档固定棋盘、Mulberry32 与部分 Fisher–Yates 延迟布雷、首格及邻格排除、空白连开、旗标、数字排查、胜负和纯存档验证；`index.js` 处理按钮动作、宿主时钟、确认弹窗、最佳用时和持久化；`renderer.js` 计算安全区域内的竖屏/横屏布局并返回可读点击区域。规则与渲染都是直接维护的 CommonJS 源，没有新增生成器或 vendor 副本。

扫雷独立键为 `games-between:minesweeper:save:v1`。版本 1 保存一个当前棋盘、三档最佳用时和点击模式；更换难度会替换当前棋盘，已有进度时先确认。恢复时严格校验维度、状态、布尔数组、数值范围，并以 `seed + firstIndex` 重算雷区比对；损坏/不兼容棋盘改建初级新局，合法最佳用时可保留。模块只在未暂停的 `playing` 状态累计时间并返回 `musicActive=true`；恢复的未结束棋盘需玩家点击继续。详细参数、限制与验收见 [扫雷说明](minesweeper.md)。

## 构建产物和兼容性

五子棋以 `gomoku` 注册为第六款游戏。`engine.js` 负责自由五子棋规则与棋谱重放校验，`ai.js` 负责休闲攻防评分，`index.js` 在宿主时钟内推进电脑应手并管理暂停/悔棋/存档，`renderer.js` 绘制棋盘和控制区。独立键为 `games-between:gomoku:save:v1`，分享仅传 `g=gomoku`。采用直接维护的 CommonJS 源，没有生成核心；没有修改宿主或公共契约。详见 [五子棋说明](gomoku.md)。

俄罗斯方块以 `tetris` 注册为第七款游戏。`engine.js` 负责七袋随机、碰撞、旋转与有限墙踢、消行计分和严格快照校验；`index.js` 使用宿主时钟推进重力与落锁延迟，管理触控、暂停及持久化；`renderer.js` 绘制棋盘、落点虚影、下三块预览和横竖屏按钮。独立键为 `games-between:tetris:save:v1`，分享仅传 `g=tetris`。规则和界面均为直接维护的 CommonJS 源，没有生成核心或宿主专属分支；不覆盖已有游戏存档。详见 [俄罗斯方块说明](tetris.md)。

华容道以 `huarongdao` 注册为第八款游戏。`engine.js` 管理4×5滑块、固定可解开局、每格一步的移动与撤销和局面校验；`index.js` 管理选择／方向／拖动操作、宿主计时、关卡确认与本机最佳，`renderer.js` 管理棋盘、安全区与点击区域。独立键为 `games-between:huarongdao:save:v1`，分享仅传 `g=huarongdao`；保留一个当前关卡的局面及每关最佳。沿用公共契约和共享音乐，运行时没有实时求解或自动提示。详见 [华容道说明](huarongdao.md)。

网页的 `index.html`、`styles.css`、`js/app.js`、`js/sudoku.js` 一起迁入 `数独/`，内部相对路径保留。GitHub Pages 工作流从该目录复制网页文件，发布输出仍位于站点根目录，保留线上入口与同题链接的原布局。`数独/js/sudoku.js` 仍是数独算法源，`数独/scripts/games/sudoku.mjs` 生成同级微信工程的 `src/games/sudoku/core/engine.js` 并校验跨平台同题与北京时间日期边界。

黄金矿工与 Zuma 的原 TypeScript 在 `vendor/` 内，生成的 CommonJS 规则在各自 `core/` 内。目录迁移保留生成内容和规则行为，清单校验原始源码及产物哈希。普通构建不需要 TypeScript 或旁边的原项目目录；只有主动更新 vendor 核心时，才按 vendor README 重新生成。Zuma 的 MIT 许可同时随运行模块保留。

构建只在显式传入 `--appid=...` 时更改 AppID，保留已有微信开发工具设置，不生成或覆盖 `project.private.config.json`。`vendor/` 和微信工程 README 由上传排除项过滤。`preview/` 使用同一游戏依赖图和浏览器适配层，不属于微信工程或网页发布包。

本地服务器仍以 `/` 提供网页数独、以 `/preview/` 提供小游戏预览；预览音乐通过受限的 `/wechat-assets/` 路由读取同级微信工程的 `assets/`，不将整个仓库或微信工程公开为静态目录。外层改名后，微信开发工具需要导入 `D:\怀旧小游戏\微信小程序`；目录整理本身不更换 AppID、游戏 ID 或任何存档键。

所有已有游戏存档键、版本和分享游戏 ID 保持兼容。数独无 `g` 的旧同题链接由注册表的 `matchLegacyQuery` 分派，再交给数独模块校验；宿主无需认识数独题号语法。
