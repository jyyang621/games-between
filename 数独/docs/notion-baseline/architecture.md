# 🏗️ 总体架构与新游戏接入规范

- URL: https://app.notion.com/p/3fd90dbc56c3817c9858f15fa3116996?pvs=204
- Baseline: BL-2026-11-07-04
- Verified: 2026-11-07 (Asia/Shanghai)

所属项目：<mention url="https://app.notion.com/p/3fd90dbc56c3804385eec17277837dec">微信小程序——怀旧小游戏</mention>。基准日期：<date start="2026-10-18" />。

## 当前配乐｜BL-2026-10-19-03

本节替代历史《庭间微光》单曲运行说明。现有五款游戏共用用户目录 <code>D:/怀旧小游戏/音频</code> 提供的《平沙落雁》（李祥霆）和《阳关三叠》（传奇乐坊），按第一首→第二首→第一首顺序循环，保留单播放器、音量0.4、音乐开关及原暂停/后台/弹窗/音频中断门控；游戏存档和音乐偏好key不变。

原MP3文件保持不变。两首完整运行副本在 <code>微信小程序/assets/audio/</code>，共2,512,595字节，32kbps/22.05kHz/单声道；时长377.809秒、250.279秒。来源及SHA256在 <code>playlist.source.json</code>；旧WAV与来源清单归档到本机 <code>数独/artifacts/audio-archive/</code>，不再进入运行包。

2026-10-19 22:19:45（Asia/Shanghai）核验：465/465全量测试、46模块/5游戏接口、12项资源与访问边界检查通过；工程文件估算3.49MiB，这是本项目的原始文件预算检查，不等于平台上传包测量。新曲及切曲的真机听感、循环衔接和设备静音仍待验收，未上传发布。维护说明 <code>数独/docs/background-music.md</code>，源码快照137文件 <code>数独/docs/notion-baseline/source-snapshot-user-music.json</code>，指纹 <code>9d2dc3fb7e13beeadc12984bf691e2627c1ad2518d36af72ff4566663cb4468c</code>。

## 目录迁移｜BL-2026-10-19-01

收尾配置边界（2026-10-19 21:48:58 Asia/Shanghai）：快照检查发现微信工程公开及私有配置发生后续更新，已保留工具设置，AppID、compileType和项目根仍正确；当前配置下重新通过416项测试及构建检查。游戏运行代码、vendor源与WAV未变化。迁移时的配置快照另存 <code>数独/docs/notion-baseline/source-snapshot-relocation-before-tool-settings.json</code>，当前129文件快照包含更新后的公开工程配置；“配置逐字节保持”仅指迁移完成时的核对，不表示工具之后没有更新。

核验日期：<date start="2026-10-19" />（Asia/Shanghai）。完整工作区现为 <code>D:/怀旧小游戏</code>：<code>数独/</code> 保存独立网页版及原构建、测试、预览、文档和历史产物；<code>微信小程序/</code> 是微信开发者工具导入的工程。Git 历史、GitHub Actions 和统一 npm 入口保留外层。

从外层可执行 <code>node 数独/scripts/build-minigame.mjs --check</code>、<code>node --test 数独/tests/*.test.mjs</code>；进入数独目录后仍使用原脚本命令。AppID、游戏 ID、存档 key、旧分享参数和游戏运行代码保持一致。Pages 复制源改为数独子目录，发布后的站点根层布局保持原样；本地网页与预览仍为同一端口的 <code>/</code> 与 <code>/preview/</code>。

新路径复核：416/416 测试、43 原生模块与4游戏接口、15项 HTTP 资源/边界检查通过；原383个文件均已找到，运行代码、vendor源、AppID/私有配置和WAV字节保持一致。源码快照129文件，SHA256 <code>9e9d46866fec70fe24dfc034013d28061f7ea10b83c4dc9165c9e69ebaf96034</code>。微信工具重导入与真机验收尚未执行，未提交、推送、上传或发布。旧 <code>D:/数独</code> 已无文件，仅有被进程占用的空目录，一次性清理脚本等待释放；若出现新文件会停止清理。

当前路径索引以本节及以下更新为准；历史附件和旧阶段快照按原验证时间保留。

构建钩子中的 <code>root</code> 仍表示数独维护目录，<code>output</code> 指同级微信工程。预览音频仅通过 <code>/wechat-assets/</code> 映射微信 <code>assets/</code>，不会将整个微信工程暴露为站点。

## 基准与阅读边界

本页目录对应 BL-2026-11-07-04，日期 <date start="2026-11-07" />（Asia/Shanghai），新增第八款华容道；游戏模块契约、宿主、平台和共享音乐生命周期保持原样，本次只同步模块目录。平台验收边界见各游戏及阶段记录。

当前数独已在模块内部扩展逻辑评级、题库、课堂、专项训练和整题实战；下文 js/sudoku.js 作为源文件的说明特指保留的旧 seed 引擎。新版 logic.js、rated-state.js、bank.js 等是独立维护源，具体见数独子页。黄金矿工和 Zuma 的维护 TS 源、原始副本、生成产物同时保留，不能把 vendor 下所有文件都当成不可修改的唯一原始代码。

微信小游戏以通用大厅为入口。宿主只处理平台与导航，数独、黄金矿工、Zuma、2048、扫雷、五子棋、俄罗斯方块和华容道八款游戏通过相同接口运行。增加游戏时，游戏自身管理玩法与状态，注册表提供展示信息和工厂。

```txt
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
        minesweeper/             扫雷纯规则、手机触控、计时与独立存档
        gomoku/                  五子棋纯规则、休闲电脑、双人、Canvas 与独立存档
        tetris/                  俄罗斯方块七袋、落锁时序、Canvas 与独立存档
        huarongdao/              华容道固定开局、滑块规则、逐格撤销、Canvas 与独立存档
    vendor/                      原 TypeScript、生成器与来源哈希；上传排除
    assets/audio/                用户配乐MP3、播放列表与来源清单
```

## 依赖与状态归属

<code>main → app/host → registry → games/<id></code> 是创建游戏的路径。宿主通过 <code>platform</code> 使用微信，通过 <code>hub</code> 绘制大厅，不导入任何具体游戏。注册表内的静态相对 <code>require</code> 由构建器收集，游戏实例在首次进入时创建并缓存。

<code>controller.screen</code> 为 <code>home</code> 或游戏 ID，<code>controller.activeGame</code> 为当前模块或 <code>null</code>。游戏状态从 <code>controller.activeGame.model</code> 读取；宿主没有数独专属模型或动作分支。大厅每页三个卡片，根据注册表数量计算页数。当前八款游戏分三页，俄罗斯方块和华容道在第三页。返回大厅时展示最后游玩游戏的继续入口。

游戏依赖自己的规则、状态与渲染文件，通过注入的能力调用存档、弹窗和分享相关行为。游戏内部不直接访问 <code>wx</code>、浏览器全局、其他游戏的状态或宿主内部变量。无需抽象不同游戏的规则模型，也无需建立共享的巨型状态对象。

Zuma 的扩展仍位于自己的模块内：<code>index.js</code> 导出控制器，<code>levels.js</code> 定义轨道和四档难度，<code>session.js</code> 管理每档闯关/无尽的进度和独立存档槽，<code>state.js</code> 保存含彩球弹药的单局快照，<code>renderer.js</code> 展示菜单与棋面。关卡、难度或模式增加不需要修改宿主。具体参数见 Zuma 关卡设计（<code>zuma-levels.md</code>，仓库内路径）。

## 游戏接口

工厂签名为 <code>create({ read, write, now, services })</code>，返回对象的接口由 <code>src/app/game-contract.js</code> 校验。<code>read(key)</code> 返回保存值或 <code>null</code>，<code>write(key, value)</code> 返回是否成功，<code>now()</code> 返回毫秒时间戳。

<table fit-page-width="true" header-row="true">
<tr>
<td>
成员
</td>
<td>
约定
</td>
</tr>
<tr>
<td>
<code>id</code>
</td>
<td>
与注册表一致的稳定游戏 ID
</td>
</tr>
<tr>
<td>
<code>frameInterval</code>
</td>
<td>
更新间隔，单位毫秒；数独为 1000，连续动画为 16
</td>
</tr>
<tr>
<td>
<code>enter(query, { source })</code>
</td>
<td>
从大厅、启动分享或前台分享进入；解析自己的 query，需要时切换关局
</td>
</tr>
<tr>
<td>
<code>resize(viewport)</code>
</td>
<td>
接收逻辑像素宽高、<code>safeTop</code>、<code>safeBottom</code>、<code>capsuleRect</code>，保留游戏状态
</td>
</tr>
<tr>
<td>
<code>render(ctx)</code>
</td>
<td>
在宿主 Canvas 上绘图，返回 <code>{ x, y, w, h, action, payload?, label }[]</code> 点击区域
</td>
</tr>
<tr>
<td>
<code>tick(deltaMs)</code>
</td>
<td>
推进当前游戏；内部仍须检查暂停和结束状态，动画应限制长帧补偿
</td>
</tr>
<tr>
<td>
<code>activate(action, payload)</code>
</td>
<td>
处理游戏动作，成功返回 <code>true</code>，忽略或拒绝返回 <code>false</code>
</td>
</tr>
<tr>
<td>
<code>pointer(type, points)</code>
</td>
<td>
处理 <code>start/move/end/cancel</code> 和触点；无需拖动时返回 <code>false</code>
</td>
</tr>
<tr>
<td>
<code>pause(reason)</code>
</td>
<td>
停止计时和动画并清理手势；进入后台或返回大厅调用
</td>
</tr>
<tr>
<td>
<code>save()</code>
</td>
<td>
保存模块自己的版本化数据；容忍存储失败
</td>
</tr>
<tr>
<td>
<code>sharePayload()</code>
</td>
<td>
返回 <code>{ title, query }</code>，query 至少包含 <code>g=NOTION_MARKDOWN_ESCAPED_LT_SENTINELid&gt;</code>
</td>
</tr>
<tr>
<td>
<code>getResumeInfo()</code>
</td>
<td>
返回 <code>{ text, available }</code>，供大厅显示进度与继续入口
</td>
</tr>
<tr>
<td>
<code>statusText</code>
</td>
<td>
人类可读的当前状态说明
</td>
</tr>
<tr>
<td>
<code>model</code>
</td>
<td>
游戏自己的模型或调试快照，宿主不解读内部结构
</td>
</tr>
<tr>
<td>
<code>dispose()</code>
</td>
<td>
可选；释放模块独占资源，宿主销毁时调用
</td>
</tr>
</table>

<code>services</code> 包含 <code>toast(message)</code>、<code>modal(config, onConfirm)</code>、<code>actionSheet(config)</code>、<code>home()</code>、<code>invalidate()</code> 和只读 <code>storageAvailable</code>。服务由宿主注入，负责弹窗期间的计时和失效回调隔离。<code>invalidate()</code> 请求立即重绘，适用于异步回调后的界面更新。

所有绘制尺寸使用逻辑像素，由平台层设置设备像素比。<code>home</code>、<code>share</code> 是宿主保留动作；其余按钮使用 <code><id>:<action></code> 前缀。模块接收同样带前缀的动作，自行解析。点击区域必须落在安全区域内，且提供可读的 <code>label</code>，供预览检查和辅助交互使用。

宿主只推进当前游戏的时钟与动画。返回大厅、后台、分享和旋转会调用暂停；重新进入不隐式解除游戏暂停。游戏应将继续操作留给玩家。需要计时或动画时使用 <code>tick</code>，避免建立模块自己的长期定时器。

## 添加游戏

1. 复制 模块骨架（<code>../templates/minigame/index.cjs</code>，仓库内路径） 为 <code>微信小程序/src/games/<id>/index.js</code>，修改 <code>ID</code> 并添加自己的状态、渲染、规则文件。骨架不注册为可玩游戏，仅用于接入。采用 CommonJS 和静态相对 <code>require('./file.js')</code>；不要依赖浏览器或第三方运行时。
2. 实现完整游戏接口。先用注入的内存 <code>read/write</code>、固定 <code>now</code> 与 Canvas 替身测试规则、暂停、存档恢复和触控。
3. 在 <code>src/registry.js</code> 内加入一条注册。使用现有 <code>play</code> 图标即可复用通用图形，无需改大厅绘制代码：

```javascript
{
  id: 'new-game',
  title: '新游戏',
  subtitle: '给快乐一点时间。',
  icon: 'play',
  status: 'ready',
  create: context => require('./games/new-game/index.js').createGame(context),
}
```

1. 为新游戏选择独立存档键。可引用 <code>../../platform/storage.js</code> 的 <code>saveKey('new-game', 'save', 1)</code>。已有游戏继续使用原键，版本变更时在模块内部迁移，避免影响其他游戏。
2. 若存在源码转换或独有生成校验，在 <code>数独/scripts/games/</code> 添加一个 <code>.mjs</code> 文件，按需导出异步 <code>build({ root, output })</code>、<code>check({ root, output })</code>。通用构建自动发现，不需要修改游戏名单；纯 JavaScript 游戏无需增加钩子。
3. 执行构建、构建检查和完整测试，再生成预览检查窄屏、横屏、返回/继续、前后台、分享与刷新后恢复。最后在微信开发者工具和真机复核。

```bash
node 数独/scripts/build-minigame.mjs
node 数独/scripts/build-minigame.mjs --check
node --test 数独/tests/*.test.mjs
node 数独/scripts/build-minigame-preview.mjs
node 数独/scripts/serve.mjs
```

新注册项自动进入大厅分页、分享路由、模块依赖图、预览包和统一接口检查，不需要修改 <code>main.js</code>、宿主或通用检查器。预告项使用 <code>status: 'soon'</code>，提供展示信息即可。

## 构建产物和兼容性

网页的 <code>index.html</code>、<code>styles.css</code>、<code>数独/js/app.js</code>、<code>数独/js/sudoku.js</code> 和 GitHub Pages 发布路径保留。<code>数独/js/sudoku.js</code> 仍是数独算法源，<code>数独/scripts/games/sudoku.mjs</code> 生成 <code>src/games/sudoku/core/engine.js</code> 并校验跨平台同题与北京时间日期边界。

黄金矿工与 Zuma 的原 TypeScript 在 <code>vendor/</code> 内，生成的 CommonJS 规则在各自 <code>core/</code> 内。目录迁移保留生成内容和规则行为，清单校验原始源码及产物哈希。普通构建不需要 TypeScript 或旁边的原项目目录；只有主动更新 vendor 核心时，才按 vendor README 重新生成。Zuma 的 MIT 许可同时随运行模块保留。

构建只在显式传入 <code>--appid=...</code> 时更改 AppID，保留已有微信开发工具设置，不生成或覆盖 <code>project.private.config.json</code>。<code>vendor/</code> 和微信工程 README 由上传排除项过滤。<code>数独/preview/</code> 使用同一游戏依赖图和浏览器适配层，不属于微信工程或网页发布包。

所有已有游戏存档键、版本和分享游戏 ID 保持兼容。数独无 <code>g</code> 的旧同题链接由注册表的 <code>matchLegacyQuery</code> 分派，再交给数独模块校验；宿主无需认识数独题号语法。

## 宿主时序与生命周期

宿主从注入的时间函数计算非负 delta，只有可交互的当前游戏收到 tick。大厅/后台不继续推进游戏；resize、hide、home、share 会通过模块 pause/save 处理。连续动画的 catch-up 限制由各游戏控制，避免切回前台补算整个离开时段。

触摸统一标准化 clientX/clientY，优先使用 changedTouches；点击区域按逆序命中以支持上层面板。按钮动作交回 activate(action,payload)，矿区/棋面手势通过 pointer(start/move/end/cancel,points) 分派。宿主使用导航代次避免一次触摸中的第二指穿透到刚打开的游戏。

原生 modal/actionSheet 期间暂停宿主派发时钟和输入，回调关联页面代次与拥有者；离开游戏、切到后台或销毁后，过期确认不会覆盖新局。所有 loaded 模块可在宿主 dispose 时清理，事件与主循环由平台边界统一管理。

## 数据边界与兼容策略

大厅 key 为 games-between\:hub\:v1，只存最后游戏与继续摘要；它不理解棋盘、矿石或球链。各游戏保留自己的 schema 和 key。createStorage 将读取异常转为 null、写入异常转为 false，storageAvailable 用于界面反馈，不把存储失败升级成玩法崩溃。

新模块可用 saveKey(gameId,slot,version) 生成命名空间；已有 key 不因整理目录而改名。状态迁移应显式校验配置、版本和取值，恢复失败时隔离受损槽，而不是重置所有游戏。

## 构建、数据与维护源

数独旧引擎由 scripts/games/sudoku.mjs 转译为 CommonJS；新版离线题库由 scripts/build-sudoku-bank.mjs 生成与检查，普通构建不自动搜索或覆写题库。题库 ID 与 ratingVersion 是分享和训练的兼容边界。

Zuma 维护源为 vendor/zuma/model.ts、track.ts，original/ 留原始副本，core-manifest.json 核对维护源与输出。黄金矿工的 levels.ts、engine.ts、renderer.ts 为维护版本，其余沿用 original/；manifest.json 同时核对原始副本、维护源、输出与生成器。

普通构建只依赖随工程保留的产物，不要求旁边原游戏目录和编译器；主动改规则后必须重新生成并通过哈希检查。project.config.json 显式上传排除 vendor 和 README；构建器不覆盖本机工具私有配置，交付包应另行排除它。生成文件不作为唯一修改入口。

## 验证分层

规则单测验证算法、状态和随机确定性；模块测试验证统一接口、渲染可点击区域与生命周期；宿主测试验证跨游戏隔离、懒加载、未知 ID、分享、原生弹窗和多指输入；预览 bundle 测试验证无 Node 或外部依赖的加载。来源清单验证生成产物没有漂移。

浏览器和 Canvas 录制用于布局及交互验证。微信开发者工具、手机触控、真实分享、设备性能、上传审核与发布必须另有真实证据，不能用单测数量替代。

## 当前扩展建议

保持游戏内部演进，不为不同玩法抽象巨型共享模型。共享背景音乐已由宿主与平台层统一实现；操作音效、通用资源加载、性能采样和云端服务仍是待评估项。

重大架构更新应同步模块契约、骨架、接入说明和 Notion 阶段记录。只有新增游戏或契约确实变化时才改变公共层，避免给单个游戏需求添加宿主专属分支。

## 扫雷接入：BL-2026-10-19-02

独立模块 <mention url="https://app.notion.com/p/3fe90dbc56c3816b80a7e00248814192" /> 以注册工厂接入第五游戏。engine/index/renderer 分别管理规则、控制和绘制，不修改通用宿主、平台或大厅。新命名空间存档键 <code>games-between:minesweeper:save:v1</code>；分享 <code>g=minesweeper</code>；只在 playing 且未暂停时报告 musicActive。

首步延迟布雷、首格及邻域无雷、三档参数、空白连开和点击数字排查均位于扫雷模块。三档最佳独立，一个当前棋盘；严格校验存档及确定性雷图。全量450项、46模块5接口通过；详情与限制见扫雷子页。

## 2048 接入：BL-2026-10-18-02

独立游戏 <mention url="https://app.notion.com/p/3fd90dbc56c3812b9402ddc514f744a8" /> 已接入。<code>game-2048/engine.js</code> 管理纯函数规则和随机状态；<code>index.js</code> 管理手势、动画锁、暂停、确认重开与独立 key；<code>renderer.js</code> 管理横竖屏棋盘。仅在注册表增加工厂，并在大厅增加数字方块图标，宿主、平台和模块契约没有 2048 专属分支。

新增存档 <code>games-between:game-2048:save:v1</code>，分享 <code>g=game-2048</code> 仅定位入口；旧三款游戏和旧分享保持兼容。第四游戏使大厅自然出现第二页，本次在真实 host 和浏览器检查了分页与恢复。完整构建依赖图由 38 个原生模块增加至 41 个；四个接口均通过通用检查。

## 共享背景音乐｜BL-2026-10-18-04

本阶段已接入原创《庭间微光》轻柔键盘与音垫循环，48 秒、16 kHz、单声道 PCM16，1,536,044 字节；没有外部歌曲、录音采样或网络音源。默认开启，播放音量 0.4，顶部原生胶囊左侧有 44×44 音乐开关。

宿主只在当前模块 musicActive 为 true、前台、没有原生弹窗或系统音频中断时播放；大厅、菜单、暂停、完成/结算、后台均暂停。全项目共用一个惰性播放器，暂停保留进度，切游戏不叠音；退出释放。开关独立保存在 games-between\:music\:settings:v1，游戏存档与分享不变。浏览器失败只在真实交互后重试，不逐帧重播。

本阶段全项目 416/416 测试通过（35 文件），新增 33 项音乐相关测试（平台 14、宿主 13、游戏状态 6）。浏览器实际解码到 48 秒，数独与 Zuma 播放时 paused=false，开关/游戏暂停后 paused=true，续播保留位置；关闭偏好刷新保留。微信工具与手机真机的静音开关、听感、循环衔接和来电音频仍待实测。素材与协议详见 <mention url="https://app.notion.com/p/3fd90dbc56c3817c9858f15fa3116996">总体架构与新游戏接入规范</mention>，阶段证据见 <mention url="https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf" />。

实现入口：src/platform/music.js 管理播放器，src/app/music-control.js 绘制开关并计算顶部避让，host.js 管理音频生命周期。可选 musicActive 未提供时静音，宿主不解析游戏模型或中文状态。capsuleRect 为原生胶囊与音乐按钮合并后的顶部保留矩形。构建校验音频与生成器哈希；源码验证快照纳入 assets/audio/。

## 五子棋接入｜BL-2026-11-07-01

第六款游戏通过 <code>gomoku</code> 注册项惰性加载，独立 <code>engine.js / ai.js / index.js / renderer.js</code> 管理规则、选点、状态和渲染；新增键 <code>games-between:gomoku:save:v1</code>，入口分享 <code>g=gomoku</code>。公共契约、宿主、平台与构建机制保持原样，本页仅同步模块目录。棋谱重放验证存档；电脑 320ms 应手由宿主 tick 推进，暂停/后台不计算。详细实现与验收见 <mention url="https://app.notion.com/p/41090dbc56c381ee9df9ec35ef0cafc6" />。

## 俄罗斯方块接入｜BL-2026-11-07-03

第七款游戏由 <code>tetris</code> 注册工厂惰性创建，独立 <code>engine.js / index.js / renderer.js</code> 管理七袋规则、宿主时钟／落锁／输入和 Canvas。新键 <code>games-between:tetris:save:v1</code> 同时持久化当前局面、最佳和落锁计时／重置次数，分享仅 <code>g=tetris</code>。普通 CommonJS 维护源按原依赖图构建，公共契约、宿主和平台无游戏专属分支。53 模块／7 游戏检查通过；规则、参数、640 项全量测试及微信工具验收边界见 <mention url="https://app.notion.com/p/41090dbc56c38165b15ff3fcd3d94bfa" />。

## 华容道接入｜BL-2026-11-07-04

第八款 <code>huarongdao</code> 通过独立注册工厂加载。模块 <code>levels.js / engine.js / index.js / renderer.js</code> 分别管理固定开局、移动／撤销及历史重放校验、宿主时钟与操作／确认／保存、Canvas安全区与命中。新键 <code>games-between:huarongdao:save:v1</code> 保存单一当前局、计时／started和每关最佳步数；分享仅 <code>g=huarongdao</code>。求解器只用于开发期BFS验证，不进入运行依赖图。

保持通用宿主、平台、音乐和契约，没有游戏专属公共分支。57模块／8游戏及来源检查通过；684项全量测试、三关12／40／116单位格最短解与平台验收详见 <mention url="https://app.notion.com/p/41090dbc56c381aaac10d33f781ec276" />。
