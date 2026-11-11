# 📒 阶段更新记录

- URL: https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf?pvs=204
- Baseline: BL-2026-11-07-04
- Verified: 2026-11-07 (Asia/Shanghai)

所属项目：<mention url="https://app.notion.com/p/3fd90dbc56c3804385eec17277837dec">微信小程序——怀旧小游戏</mention>。基准日期：<date start="2026-10-18" />。

## 基准记录 BL-2026-10-18-01

记录日期：2026-10-18（Asia/Shanghai）。本次将当前本地实现整理成首次 Notion 基准，不为此前各次编码虚构单独日期、工期或提交号。

### 需求与结果

- 将原本以数独为中心的工程扩展为通用游戏大厅，集成黄金矿工与 Zuma。
- 将宿主、平台、大厅、注册表和游戏实现分离，为后续增加游戏保留统一接入方式。
- Zuma 增加六关六轨道、无尽波次、渐进速度与危险缓速；加入四档难度、稀有万能彩球和可靠换球反馈；按反馈将各档速度相对初版四档提高到 2–3 倍。
- 黄金矿工 TNT 移至部分混合金钻矿群间，增加范围提示与毁坏反馈，保留左右取矿方向与爆后价值余量。
- 核验时当前工作区还包含数独课堂、逻辑评级题库、专项训练与整题实战，这些以本次代码事实纳入，细节见数独子页。

### 技术影响

1. 新增游戏不需要改写宿主游戏分支，统一由 registry 工厂懒加载。
2. Zuma 存档升级为 v3 的四档八槽，旧 v1/v2 和已知旧速度配置有显式迁移；彩球随机位置与间隔也保存。
3. 矿工保留六组合 key 与本关检查点恢复规则，TNT 的警戒圈、动画和伤害共用半径源；维护源与原始副本分开校验。
4. 数独当前同时保留旧 seed 链路和新逻辑评级对局，教学/训练记录独立；不应把原旧版线索数难度说明覆盖到全部新版玩法。

### 本地验证

核验时点：2026-10-18 18:12:42（Asia/Shanghai）。

- 构建检查通过：12 道旧版同题、6 个日期边界、259 道逻辑评级整题、74 张专项卡；38 个原生模块、3 个游戏接口，来源哈希校验通过。
- 全量自动测试：327 项通过，0 失败、0 跳过，共 28 个测试文件。
- 验证前后源码树 SHA256 一致，覆盖 107 个源文件、配置、生成文件与测试文件；验证期间未发生源变更。
- 源码树 SHA256：<code>9364d1884a3f3a4f59975ada7cd510e5b8850b808e3137fe5cea7c6981c3dd03</code>。
- 本地工作区有未提交修改；当前实现不等同于 HEAD 单个提交。校验日志与 source-snapshot.json 随本次资料保留。
- 微信开发者工具、手机真机和正式发布尚无本次验收凭证，继续标为待验证。

历史会话中 108、149、216、234 等通过数量仅代表各自当时的阶段，不能作为当前源码永久验收数字。本条采用本次重新核验结果；后续每次阶段结束重新记录。

### 交付与追踪

- 当前工作区：D:/数独；微信工程：wechat-minigame/。
- Git 参照：main / 37e88c9；存在大量未提交的扩展，未将本次完整基准冒充为该提交内容。
- 本次提供 Notion 页面及 docs/notion-baseline/ 本地镜像、源码快照哈希和可下载正文备份。
- 本次整理没有自动提交、推送或执行微信上传、审核、发布。

### 风险与未完成

- 微信工具、真机、真实分享和平台发布仍待验收，浏览器截图和本地测试不能代替这些证据。
- Zuma 高速地狱档和高波次的机器人通关仅为确定性样本，仍需人类体验数据。
- 矿工 TNT 布置通过指定矿图、种子和方向矩阵回归；不把采样检查表述为无穷种子空间的形式证明。
- 数独体验画像不是实际玩家训练得到的难度模型；后续应根据真机反馈校准。

### 下一阶段

优先完成可追踪候选版本与微信真机验收；各游戏后续项见实施路线和各自子页。后续更新从这里追加新阶段，不修改本条的历史结论来伪造过去状态。

## BL-2026-10-18-02｜经典 2048 接入

日期：<date start="2026-10-18" />，Asia/Shanghai；核验时点 22:38:51。本阶段为新游戏接入，触发重大更新汇总。需求是为现有微信游戏合集增加经典 2048，计划、算法与实施详见 <mention url="https://app.notion.com/p/3fd90dbc56c3812b9402ddc514f744a8" />。

### 最终行为与实现

- 大厅新增独立 2048 卡片与数字方块图标，四款游戏自动分为两页；首页继续使用“花自飘零的游戏空间”。
- 4×4 棋盘，初始两块；有效步后在空格生 2（90%）或 4（10%），无效步不生块或消耗 RNG；相同数字每步只合并一次，合并结果计分。
- 支持四向滑动和方向按钮、130ms 滑动/合并动画、分数与本机最佳、自动保存；合成 2048 可继续挑战，满盘无合法合并时结束。
- 单指起滑、18px 与主轴 1.2 倍阈值；多指/取消/后台/返回/旋屏清手势。已有进行中棋盘重开要确认，过期确认不能覆写新局。
- 规则、控制器和渲染均位于 game-2048 模块；宿主与平台没有新玩法分支。纯 JavaScript 维护源，无需额外运行时或 vendor 生成。

### 数据与兼容

新增 <code>games-between:game-2048:save:v1</code> 保存 round 与 best，随机状态一起恢复；旧三款 key/schema 与分享未改。损坏或少于两个数字的棋盘拒绝恢复，合法最佳仍保留。写入失败不阻断玩法并显示提示。分享 <code>g=game-2048</code> 只到入口，不替换接收方棋盘；存档恢复后需手动继续。

### 实际验证

- <code>node scripts/build-minigame.mjs</code>、<code>node scripts/build-minigame.mjs --check</code>、<code>node scripts/build-minigame-preview.mjs</code> 和 <code>git -c core.autocrlf=false diff --check</code> 通过。
- <code>node --test --test-reporter=tap tests/*.test.mjs</code> 全量 362/362 通过，31 文件，0 失败/跳过；2048 规则 13、渲染 5、控制/真实宿主 17，共 35 专项。
- 构建检查 41 原生模块、4 游戏接口，以及旧数独同题/日期、259 逻辑题、74 专项卡和移植来源清单。
- 自动验证期间 113 文件源码哈希一致：<code>c8cb7b127f948ee64fd5b90fe294877d34d4838243b61e53146fd6f79229428c</code>。快照 <code>docs/notion-baseline/source-snapshot-2048.json</code>，日志 <code>artifacts/2048-tests.log</code>。
- 浏览器实际操作：大厅第二页进入、方向按钮合并到 4 分、真实拖动后 8 分、刷新暂停恢复 8 分、320×568 窄屏与 844×390 横屏暂停/手动继续；截图 <code>artifacts/2048/</code>。

### 交付、限制与下一步

本地维护源码、测试、README、架构与 2048 设计说明、独立 Notion 子页、源码快照及截图。main/37e88c9 上仍为未提交工作区；没有提交、推送、微信上传或发布。保留首次基准历史记录与附件。

微信开发者工具、iOS/Android 真机、真实分享与长局设备体验仍待验收；建议按路线清单验证，未虚构负责人或排期。

### BL-2026-10-18-02｜资料补充核对

用户要求更新 Notion 后，于 2026-10-18 22:57:23（Asia/Shanghai）重新逐文件比对本阶段 113 文件快照，全部一致；继续引用 22:38:51 的 362/362 测试与构建记录，本轮没有修改运行代码或重复运行全量测试。

补入 2048 最终界面、大厅第二页、320×568 窄屏、844×390 横屏共四张可直接查看的真实本地预览图；修正总览当前快照文件名、预览 URL、仓库路径伪链接；发布路线补上 2048 v1 存档和跨游戏隔离验收。保留 BL-01 历史记录、BL-02 原实施记录与既有子页面。本次只补齐文档证据，没有新增玩法、上传微信或发布。

截图及游戏说明：<mention url="https://app.notion.com/p/3fd90dbc56c3812b9402ddc514f744a8" />。

### 资料同步收尾：并行源码差异

2026-10-18 23:07:49（Asia/Shanghai）收尾核对时，原快照所列 113 文件中有 7 个文件已出现后续并行修改，集中在数独的控制/渲染/状态、预览适配及相关测试。本次文档操作没有修改这些代码。

这些后续差异尚未纳入 BL-2026-10-18-02 的已验证实现，也没有复用 22:38:51 的 362 项通过记录作为其验收结论。已验证基准与 2048 截图保持可追踪；本轮正文备份按生成时内容留存，后续源码差异需要在相应开发阶段重新构建、测试并汇总。

差异记录：<code>docs/notion-baseline/parallel-source-check-2026-10-18.json</code>。

- <code>preview/wx-preview.js</code>
- <code>tests/minigame-platform.test.mjs</code>
- <code>tests/minigame-sudoku.test.mjs</code>
- <code>wechat-minigame/src/games/sudoku/index.js</code>
- <code>wechat-minigame/src/games/sudoku/rated-state.js</code>
- <code>wechat-minigame/src/games/sudoku/renderer.js</code>
- <code>wechat-minigame/src/games/sudoku/state.js</code>

## BL-2026-10-18-03｜数独笔记开关与“更多”触控修复

日期：<date start="2026-10-18" />，Asia/Shanghai；核验时点 2026-10-18 23:14:15。本阶段修复候选笔记撤销交互与原生菜单可用性，属于重要交互修复，触发阶段汇总。详见 <mention url="https://app.notion.com/p/3fd90dbc56c3819e8b89c0a410be6bfe" />。

### 最终行为与关键决策

- “填全笔记”首次补全候选并高亮为“取消填全”；再次点击恢复原手动笔记，保留之后填入的数字。手动笔记编辑同步维护备份，两次切换各占一个撤销步。
- 取消不额外纠正用户原本手动记错的候选。实际填写和提示只清理受影响的候选；评级数独已验证的逻辑排除仍保留。
- 保留内部 fillAllNotes() 重算用途，工具栏改用 toggleFillAllNotes()；普通题、每日题及课程整题实战共用该行为。
- “更多”原有七项超过 wx.showActionSheet 六项限制；保留规则、重开、冲突提示、关联高亮、成绩、难度说明六项，返回大厅继续使用页头按钮。原生失败会提示，主动取消不报错；预览也检查六项限制。依据：[微信官方接口类型定义](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts)。
- “更多”可见按钮至少 72×44 逻辑像素，横排图标文字。短横屏和短竖屏优先预留控件高度，棋盘与暂停按钮自适应，底栏避开底部安全区。

### 存档与兼容

v1/v2 对局和历史快照新增可选 fillNotesActive 与 notesBeforeFill，原 key/schema 与分享入口保持不变。缺字段的旧档仅在笔记等于完整且非空的可信候选时推断为已填全，取消后为空（旧档没有原手动笔记备份）；部分笔记不推断。暂停和刷新恢复开关，撤销恢复相应备份。推理证明独立验证，不能凭手动少记笔记构造推理。

### 实际验证与交付

- node scripts/build-minigame.mjs --check 通过：41 原生模块、4 游戏接口；12 旧同题、6 日期边界、259 逻辑评级整题、74 专项卡与移植来源清单。
- node --test --test-reporter=tap tests/\*.test.mjs 全量 383/383 通过，32 文件，0 失败/跳过；新增 17 项笔记开关专项，覆盖新旧模型、原手动笔记、错误手动候选、数字、逻辑排除、撤销、刷新、旧档识别和畸形备份。模块与宿主回归另覆盖菜单六项、失败/取消重开和短屏安全区。
- 验证前后 114 文件哈希稳定：c54a13f47eff6bfda97870c189fdb41f095713b390754faec8def19ff9443851。快照 docs/notion-baseline/source-snapshot-sudoku-interaction.json；日志 artifacts/sudoku-interaction-tests.log。
- 浏览器实际操作验证旧存档直接取消、新开启/取消、刷新恢复、320×568 窄屏、480×320 短横屏，以及菜单取消后重复打开。截图 artifacts/sudoku-interaction/notes-on-small.jpg、notes-off-small.jpg、more-menu-small.jpg、short-landscape.jpg。
- node scripts/build-minigame-preview.mjs 和 git -c core.autocrlf=false diff --check 通过。维护代码、测试、docs/[sudoku-rating.md](http://sudoku-rating.md) 与本阶段资料保存在本地未提交工作区，main/37e88c9 不能代表完整实现。

### 限制与下一步

浏览器与模拟原生 API 通过，不替代微信工具或 iOS/Android 真机触控与原生弹层验证；未上传审核、发布、提交或推送。下一步在真机确认菜单打开、短屏安全区和存档兼容。原始网页数独入口与其他游戏玩法不在本次修改范围。

## BL-2026-10-18-04｜四游戏共享舒缓背景音乐

日期：<date start="2026-10-18" />，Asia/Shanghai；自动核验时点 2026-10-18 23:30:57。用户要求游玩时增加舒缓轻音乐。本阶段增加公共音频能力与可选模块契约，属于公共架构与体验更新。

### 最终行为与实现

- 四款游戏共用原创《庭间微光》：48 秒，60 BPM，柔和键盘与轻音垫，无鼓点/人声；本地 PCM WAV，16 kHz、单声道、16 bit，共 1,536,044 字节。Node 脚本可复现，没有第三方歌曲或采样。
- platform/music.js 惰性创建单个 wx.createInnerAudioContext，loop=true、volume=0.4。暂停保留进度，跨游戏共享播放器，不叠音；宿主销毁时解绑监听并释放。
- 游戏提供可选只读 musicActive。数独普通/实战未暂停未完成时播放，课堂仅未完成交互练习播放，阅读与推演保持安静；Zuma 仅 play 且 playing、非帮助；矿工仅 playing 且 engine 未结束；2048 仅未暂停且 playing。
- 宿主用前台/模块活动/原生弹层/系统音频中断共同门控。回大厅、菜单、暂停、分享、结算、后台暂停；中断结束仅在仍满足播放条件时恢复。原生弹窗回调先应用最终游戏状态再判断恢复，避免瞬间重播。
- 音乐开关位于原生胶囊左侧，44×44 逻辑像素；顶部保留矩形合并到 capsuleRect，标题与游戏控件避让。默认开启，关闭后刷新仍保留；既有数独设置和游戏存档不被覆盖。
- 同步/异步音频失败不会阻断玩法，单次错误反馈；普通帧不自动重试，下一次真实交互可重试；迟到 Promise、onPlay 与销毁回调不能在后台重新播放。预览用 HTMLAudio 适配，服务提供 audio/wav。

### 数据与来源

独立偏好键 games-between\:music\:settings:v1，仅保存 enabled；四游戏原 key/schema/分享未变。音频 SHA256：12ea747eafbe79e04e22425903f749018224353de74154ddf08f350ee308e626；脚本 scripts/generate-calm-music.mjs，来源 assets/audio/calm-garden.source.json。峰值 -11.06 dBFS，RMS -24.84 dBFS，无削波或整秒静音；循环采用跨边界尾音叠加，信号检查通过。系统 API 依据 [微信官方小游戏类型定义](https://github.com/wechat-miniprogram/minigame-api-typings/blob/master/types/wx/lib.wx.api.d.ts)，包括 WAV 支持与音频中断事件；听感与无缝解码仍以真机为准。

### 实际验证

- node scripts/build-minigame.mjs --check：43 原生模块、4 游戏接口；旧数独同题/日期、259 逻辑题、74 专项卡、移植核心及音乐来源哈希全部通过。
- node --test --test-reporter=tap tests/\*.test.mjs：416/416 通过，35 文件，0 失败/跳过；音乐新增 33 项。
- node scripts/generate-calm-music.mjs --check 逐字节复现通过；node scripts/build-minigame-preview.mjs、git -c core.autocrlf=false diff --check 通过。
- 123 个运行/维护/资源/配置/测试文件在验证前后稳定，SHA256 d62bac40a42e2ff706743a45b5af46f33f7f683eb1c196cc24af61ecab87a3d0；快照 docs/notion-baseline/source-snapshot-background-music.json，日志 artifacts/background-music-tests.log。
- 浏览器实际播放：数独进度 11.03 秒、Zuma 7.73 秒，duration=48、loop=true、readyState=4、paused=false。关闭音乐 paused=true，17.12 秒处暂停，再开启约 17.39 秒续播；游戏暂停、大厅静音，关闭偏好刷新保留。320×568 画面与按钮核对通过。
- 截图 artifacts/background-music/sudoku-music-small.jpg、zuma-music-small.jpg、hub-music-small.jpg。本次本地预览服务用 4177 端口；本机地址不作微信入口。

### 交付与边界

维护源码、WAV 与生成清单、测试、docs/[background-music.md](http://background-music.md)、README 与架构文档及既有 Notion 页面同步；工作区仍未提交，main/37e88c9 不等于完整阶段源码。未上传、审核、发布、提交或推送。微信工具与 iOS/Android 真机音量、静音、循环间隙、电话中断与包体仍待验收；暂无下钩/射击/消除等操作音效。

## BL-2026-10-19-01｜目录重组与开发入口迁移

收尾配置边界（2026-10-19 21:48:58 Asia/Shanghai）：快照检查发现微信工程公开及私有配置发生后续更新，已保留工具设置，AppID、compileType和项目根仍正确；当前配置下重新通过416项测试及构建检查。游戏运行代码、vendor源与WAV未变化。迁移时的配置快照另存 <code>数独/docs/notion-baseline/source-snapshot-relocation-before-tool-settings.json</code>，当前129文件快照包含更新后的公开工程配置；“配置逐字节保持”仅指迁移完成时的核对，不表示工具之后没有更新。

日期：<date start="2026-10-19" />（Asia/Shanghai）。公共目录及构建入口变化，触发本次架构阶段总结。用户要求把原工作区改为D:/怀旧小游戏，数独与微信小程序分为两个子目录。

### 最终结果与兼容

- 完整项目现位于 <code>D:/怀旧小游戏</code>。<code>数独/</code> 收录网页版及原脚本、测试、预览、文档、模板和历史产物；<code>微信小程序/</code> 是可导入的运行工程。Git/.github、协作约定、根README及统一npm入口保留外层。
- 构建定位同级微信工程，33个测试文件改用新导入路径；Pages仍从数独子目录复制到发布包根层，原站点和分享参数布局不变。预览音乐改用仅映射微信assets的 <code>/wechat-assets/</code>。
- AppID、游戏ID、存档key、旧分享、原生运行代码、vendor维护源和WAV字节保持；生成器仅改变输出定位并重建来源元数据。旁边的独立黄金矿工/Zuma项目未移动。
- 微信开发工具占用阻止原目录改名，用户已关闭该工程；内部微信工程已改名。外层目录仍有进程占用，直接改名失败，最终通过完整文件迁移到目标位置。迁移中修正了回退脚本错误，改为逐文件复制和哈希验证，新路径构建通过后才清理原文件。
- 旧D:/数独目前无文件，只剩占用中的空目录；一次性隐藏清理程序最多等待24小时，仅删除空目录，若发现新文件则停止。它不是定时项目汇总或发布任务；清理状态保存在本机artifacts中。

### 验证与证据

- 新路径全量416/416测试通过（35文件，0失败/跳过）；构建检查43原生模块、4游戏接口、12旧同题、6日期边界、259逻辑题、74专项卡及音乐哈希。
- 网页、预览、JS/CSS、WAV、HEAD、拒绝目录穿越和私有配置访问等15项HTTP检查通过；本阶段没有新浏览器截图、微信工具或真机验收。
- 原383文件均映射存在；游戏运行代码、维护源、AppID/私有配置和WAV逐字节核对通过。129文件源码快照于2026-10-19 21:48:58（Asia/Shanghai）生成，SHA256 <code>9e9d46866fec70fe24dfc034013d28061f7ea10b83c4dc9165c9e69ebaf96034</code>，文件 <code>数独/docs/notion-baseline/source-snapshot-relocation.json</code>。
- 日志 <code>数独/artifacts/relocation-final-tests.log</code>、<code>relocation-http.json</code>、<code>relocation-verification.json</code>。Git HEAD仍为37e88c91cc258e9474d806e329181d6547aa6c75，origin不变；没有提交、推送、上传、审核或发布。

### 开发入口与下一步

在外层使用npm统一入口，或执行 <code>node 数独/scripts/build-minigame.mjs --check</code>、<code>node --test 数独/tests/*.test.mjs</code>。本机未提供npm命令，实际检查使用同一Node脚本直接执行。独立网页仍为本机同一端口根路径，小游戏预览仍为/preview/。

微信工具重新导入 <code>D:/怀旧小游戏/微信小程序</code>；Codex项目文件夹更新为 <code>D:/怀旧小游戏</code>。既有聊天记录工作目录不保证自动迁移；手机安全区、音频循环/静音、中断、真实分享等仍需在微信环境验收。

## BL-2026-10-19-02｜扫雷作为第五个游戏接入

日期：<date start="2026-10-19" />（Asia/Shanghai）。用户要求为微信小游戏新增扫雷，新游戏接入触发阶段汇总。工作区 <code>D:/怀旧小游戏</code>，源码未提交。

### 最终行为与关键决策

新增 <mention url="https://app.notion.com/p/3fe90dbc56c3816b80a7e00248814192" />；大厅第二页可进入。初级9列9行10雷，中级9列12行20雷，高级12列16行40雷；显式翻开/插旗、空白连开、点击数字等旗数排查、胜负结算、停表、确认重开/换难度、各档最佳与入口分享。

首次翻开时用 seed+firstIndex 延迟布雷，首格及八邻域无雷。Mulberry32、部分 Fisher–Yates 无放回选雷，队列展开空白区；普通随机棋盘可能需要猜测。点击数字时错旗仍可触雷，全非雷格翻开才获胜。

### 数据、兼容与维护源

独立存档键 <code>games-between:minesweeper:save:v1</code>，round和外层version均为1。一个当前棋盘与三档独立最佳，切换难度确认后覆盖棋盘；校验版本/尺寸/状态/数组/用时及重算雷图。超过控制器上限的计时快照重建，避免续局倒退；合法最佳独立保留。冷恢复、大厅、后台与旋屏保持暂停，手动继续。迟到弹窗确认在导航/恢复/销毁后失效。

新增 <code>微信小程序/src/games/minesweeper/</code> 的 engine/index/renderer 三个维护源，注册表增加一项；未增加宿主/平台/大厅专属分支，其他游戏key/旧分享/AppID/私有配置不改。沿用统一musicActive，首步前、暂停和结算不播放。

### 真实验证与交付

- 数独目录内 <code>node scripts/build-minigame.mjs</code>、<code>node scripts/build-minigame.mjs --check</code>、<code>node scripts/build-minigame-preview.mjs</code> 通过；46原生模块、5游戏接口，原维护源与音乐哈希通过。
- <code>node --test tests/*.test.mjs</code>：450/450通过，38文件，0失败/跳过。新增扫雷34项；规则17、布局6、控制器/宿主11。最初33专项通过后补上超限计时回归，全量含最终34项。日志 <code>数独/artifacts/minesweeper-tests.log</code>。
- 2026-10-19 21:58:28（Asia/Shanghai）135文件源码快照，验证前后稳定，SHA256 <code>88fd84ad5a8115eda9e030016c30dfb63b896b32a2425d85a9886a74f3afbbb1</code>；本机文件 <code>数独/docs/notion-baseline/source-snapshot-minesweeper.json</code>。完整内部文件清单留本机，远端仅保存摘要。
- 浏览器实际检查大厅进入、首步连开、插旗、刷新恢复暂停、换难度取消/确认、旋屏暂停继续、375×750、320×568和844×390；截图3张附扫雷页，本机4图及 <code>browser-qa.json</code> 在 <code>数独/artifacts/minesweeper/</code>。
- <code>git -c core.autocrlf=false diff --check</code> 和 <code>node artifacts/snapshot-minesweeper.mjs --check</code> 通过。README、架构、背景音乐说明与 <code>数独/docs/minesweeper.md</code> 更新。

### 风险、未完成与下一步

确定性480个首步安全样本和72个通关样本不等于所有种子/玩家可成功。短屏高级棋格较小，当前无缩放；无猜生成、长按插旗、联网榜单、云同步与同题分享未实现。微信工具、iOS/Android真机、真实分享与音频听感待验收；未提交、推送、上传、审核或发布。下一步先验证真机可读性、误触和后台恢复。

### 扫雷阶段收尾的并行工作区边界

2026-10-19 22:17:09（Asia/Shanghai）重新核验当前合并态：另一会话随后替换公共音乐、预览、资源服务及构建检查，扫雷三个维护源未变。过程中先遇到音乐清单未完成和MP3首帧头校验失败，该会话完成产物并修复后，当前 <code>node scripts/build-minigame.mjs --check</code> 通过：46原生模块、5游戏接口、2首用户提供音乐来源、工程原始文件估算3.49 MiB。

<code>node --test tests/*.test.mjs</code> 最新全量465/465通过，0失败/跳过；较本扫雷原基准450多出的15项来自并行音乐相关更新，不计作扫雷新增用例。137文件在此次复核前后稳定，SHA256 <code>9d2dc3fb7e13beeadc12984bf691e2627c1ad2518d36af72ff4566663cb4468c</code>。

保留原 <code>source-snapshot-minesweeper.json</code> 和 <code>minesweeper-tests.log</code> 作为450项扫雷基准；最新合并态另存 <code>source-snapshot-minesweeper-final.json</code>、<code>minesweeper-final-tests.log</code>、<code>minesweeper-final-build.log</code>，均在数独目录对应docs/notion-baseline或artifacts下。完整文件清单仍留本机。扫雷截图表示之前浏览器验收时点；没有把新音乐的实际听感、微信工具或真机列为本聊天已验证。

## BL-2026-10-19-03｜用户配乐替换与顺序轮播

日期：<date start="2026-10-19" />，Asia/Shanghai。用户要求把游玩背景音乐换为D:/怀旧小游戏/音频下的音频循环播放；本阶段调整公共播放器、资源准备和预览事件接口，纳入重大更新记录。

### 实现与兼容

- 使用两首用户提供的录音：《平沙落雁 - 李祥霆》《阳关三叠 - 传奇乐坊》，保留原MP3，游戏使用32kbps/22050Hz/mono运行副本。完整曲目377.809秒、250.279秒，合计2,512,595字节；无剪裁，编码帧填充约26ms。经响度调整，解码峰值-2.5/-1.3dBFS，无削波。
- 单个InnerAudioContext按A→B→A轮播；真实结束事件关闭单曲loop并在Promise微任务中切源/重新绑定，避免事件分发时重入。旧适配器没有onEnded时降级为首曲循环。代次和待切换标记拦截重复/迟到回调，下一首失败后等待真实交互重试，不按帧跳歌或反复播放。
- 音量0.4、音乐偏好key、44像素开关及五款游戏的运行门控不变；暂停保留曲目和位置，关闭/菜单/后台/弹窗/音频中断均静音，曲终后立即暂停/关闭/销毁也不会继续播放。游戏算法、存档key和AppID未变。
- 预览转发DOM ended；分发监听器时先快照，避免换曲期间新注册的回调在同一事件中再次执行。静态服务支持MP3的audio/mpeg。
- 来源、原文件和运行副本哈希、完整时长及转码参数记录在playlist.source.json。prepare-background-music.mjs显式准备才依赖指定FFmpeg，常规--check只使用Node和随工程提交的资源，不依赖原音频或编码器。旧WAV及清单归档于数独/artifacts/audio-archive，不进入当前运行包。

### 验证与证据

- 构建/检查/预览生成通过：46原生模块、5游戏接口、12旧同题、6日期边界、259逻辑题、74专项卡、移植来源和两首配乐哈希。工程文件估算3.49MiB，为本项目4MiB保守原始文件预算，不能当作平台上传包验收结果。
- 全量465/465测试，38文件，0失败/跳过；较已归档扫雷450项增加15项（音乐平台14、真实预览音频集成1）。49项音乐/宿主/游戏活动/预览检查包含A-B-A、单实例、暂停续播、错误重试、旧Promise/回调、原生live Set、微任务前抢先暂停/关闭/销毁和真实适配器事件分发。
- 两首MP3的GET/HEAD、MIME/长度/哈希、网页/预览、旧WAV退出及访问边界共12项HTTP检查通过。原两首文件SHA256未改；FFmpeg完整解码及峰值检查通过，连续两次准备得到同一运行文件哈希。
- 2026-10-19 22:19:45（Asia/Shanghai）137文件源码快照：9d2dc3fb7e13beeadc12984bf691e2627c1ad2518d36af72ff4566663cb4468c，文件数独/docs/notion-baseline/source-snapshot-user-music.json。日志数独/artifacts/user-music-tests.log、user-music-http.json；与并行扫雷收尾的合并态指纹一致，保留其原450项及收尾465项记录，不覆盖其他阶段。

### 边界与下一步

本次没有新增浏览器实际试听截图，也未执行微信开发工具、手机真机、真实分享、提交、推送、上传、审核或发布。下一步在微信环境试听两首交接、实际音量、静音、系统中断和前后台恢复。低码率副本用于包体控制，不作无损承诺；原始音频保留，未来调整可重新准备。

## BL-2026-11-06-01｜数独提示修复与只读答案

日期：<date start="2026-11-06" />，Asia/Shanghai。本阶段修复微信数独提示无响应，并增加普通对局及整题实战的“显示答案”。独立网页版行为保留。

### 当前行为

- “提示”弹窗确认改为“应用提示”，确认和取消文字均不超过微信接口的4字符约束；原生弹窗失败会给出可见反馈，失败后可重试。
- 已填错时，先定位选中的错误格，否则定位第一处错误；确认后按本题唯一解修正一格，可撤销，保留笔记模式和计时。此类纠错明确使用正确答案，不伪称逻辑推理。无错误时继续先展示逻辑理由，再确认应用；排除候选时明确不会直接填数，应用后高亮相关格并定位。
- 工具栏新增“显示答案”。未完成局首次查看需确认，随后打开独立只读81格答案棋盘；深色为题面、蓝色为补全答案。“返回题目”恢复原填写、笔记和撤销记录，不会自动填满或触发通关。
- 查看时暂停计时和背景音乐。返回恢复原先暂停状态；查看期间经过后台或旋转后，返回仍暂停，需手动继续。迟到的提示/答案确认在导航、切局、后台或旋转后失效。
- schema1/2新增可选布尔answerViewed，原存档版本和key不变，旧存档缺省false。查看标记不进入撤销快照，撤销与冷恢复均保留。未完成局查看后，本局手填完成也不计普通或实战成绩；已完成局查看不追溯取消原成绩。显式重开是新round，清除本轮查看标记。

### 验证与边界

2026-11-06 21:34:49（Asia/Shanghai）：全量519/519测试通过，42文件，0失败/跳过；较上阶段新增54项，覆盖状态17、布局9、原生提示平台7、控制器21。构建检查46原生模块、5游戏接口和配乐来源通过，工程文件估算3.50MiB。

141文件在最终检查前后哈希一致，SHA256为 <code>a0b3d34a597bec1316731710a835fe3049011c43d8d33514fc4c425c5298c692</code>；快照 <code>数独/docs/notion-baseline/source-snapshot-sudoku-help.json</code>，日志 <code>数独/artifacts/sudoku-help-full-tests.log</code>。320×568、390×844、480×320、844×390的普通页与答案页共8张Canvas离屏实渲图已目视检查；它们不是浏览器交互或微信真机截图。提示及答案点击范围至少44像素，原“更多”按钮保留72×44。

微信开发工具、手机真机触控/原生弹窗仍待验收，未提交、推送、上传、审核或发布。当前说明在 <code>数独/docs/sudoku-rating.md</code>，实现位于微信工程数独模块；宿主公共契约、其他游戏和配乐规则未改。

### 原问题与修复证据

严格模拟微信showModal四字符上限时，旧“应用这一步”被拒绝且没有明确失败反馈；修复前7项平台回归中5项宿主用例失败，日志数独/artifacts/sudoku-hint-platform-before.log。改为四字按钮并补失败反馈后，这些用例均通过。另复现无行列直接冲突的错误数字会令旧提示直接拒绝；现已提供确认纠错。原型、字段与旧分享验证均保留，未修改生成的规则核心。

### 后续验收

在微信工具及手机实际点击提示、取消/确认、修正错误、显示答案、返回题目、后台恢复及横竖屏切换。UI证据采用生产Canvas离屏实渲，未冒充设备验收；页面图片保存于数独子页。本次没有发布或提交Git。

## BL-2026-11-07-01｜五子棋作为第六款游戏接入

日期：<date start="2026-11-07" />，Asia/Shanghai。用户确认人机对战＋同机双人；收尾时确认当前功能范围已经足够，本阶段冻结范围。源码仍为未提交工作区，不把旧 HEAD 当作本次完整实现。

### 原问题与验收目标

在既有小游戏合集加入可直接游玩的五子棋，接入通用大厅、生命周期、配乐与本机存档，保持已有五款游戏和原分享兼容。具体规则、算法与下一步见 <mention url="https://app.notion.com/p/41090dbc56c381ee9df9ec35ef0cafc6" />。

### 最终行为与关键决策

15×15 自由规则，黑先、连续五子及以上获胜、无禁手、满盘和棋；人机默认执黑且可换先后，同机双人轮流操作。固定休闲电脑优先成五和防成五，再按周围两格候选、五格窗口与活形/复合威胁攻防评分；确定性局部启发式，无多层搜索或必胜保证。

人机悔棋退回最近一次玩家落子及电脑应手，双人退一手，终局可悔棋。最近一手和获胜连线高亮；进行中非空棋盘重开、换模式或先后手需确认。暂停、返回大厅、后台、分享和旋屏后需手动继续。应手延迟 320ms 由宿主 tick 推进，无独立定时器。目视验收发现暂停底部继续按钮命中与禁用样式问题，已修复并新增布局回归。

新增 <code>src/games/gomoku/{engine,ai,index,renderer}.js</code> 与注册条目，宿主、平台、公共契约无五子棋专属分支。大厅仍每页三款，第二页为 2048、扫雷、五子棋；背景音乐复用共享播放器。

### 数据、兼容与迁移

新键 <code>games-between:gomoku:save:v1</code>；棋谱逐手重放验证棋盘、轮次和终局，损坏/不兼容数据安全回退新人机局。未结束合法存档恢复为暂停，存储失败可继续游玩并显示提示。分享 <code>g=gomoku</code> 仅打开入口。旧游戏键、旧分享、AppID 与私有开发工具设置保留；回滚旧代码只会缺少五子棋入口。

### 真实验证与交付

仓库根目录执行：

```bash
node 数独/scripts/build-minigame.mjs
node 数独/scripts/build-minigame.mjs --check
node --test --test-reporter=tap 数独/tests/*.test.mjs
node 数独/scripts/build-minigame-preview.mjs
```

全量 <b>560/560</b> 通过，45 文件，0 失败/跳过；新增五子棋 41 项（规则/电脑 22、控制器 11、布局 8）。构建检查 50 原生模块、6 游戏接口及旧核心/配乐来源通过，工程原始文件估算 3.53MiB，不等于微信上传包实测。日志 <code>数独/artifacts/gomoku-full-tests.log</code>。

2026-11-07 00:58:48（Asia/Shanghai）源码快照 148 文件，摘要 <code>753c2ad138ba480ea3bc04a71c56e5d77de87c5180c87abbc8317f2856b57686</code>，测试后比对稳定；完整清单只保留本机 <code>数独/docs/notion-baseline/source-snapshot-gomoku.json</code>。

生产 Canvas 离屏 12 张图覆盖 390×844、320×568、844×390、480×320 的对局/获胜/暂停，已全部目视检查并在修复后重新生成；文件在 <code>数独/artifacts/gomoku/</code>。

微信开发者工具 Stable 2.02.2608080、基础库 3.17.4、iPhone 12/13 模拟器实际点击通过：大厅第二页进入、恢复 24 手局、玩家和电脑落子到 26 手、悔棋回到 24 手、换模式确认取消保留棋局、规则原生弹窗。另用 2 手局验证暂停后普通重新编译、大厅继续、同局恢复及底部继续；棋子和手数保持。记录 <code>数独/artifacts/gomoku/acceptance.json</code>。工具弹窗期间有来自 app.asar 的 worker path 为空日志，弹窗仍工作，列为开发工具观察待真机复核。

浏览器实际交互未完成：内置浏览器访问本地地址超时、Chrome 自动化绑定失败；预览包构建和 VM 回归通过，不替代浏览器点击验收。未做手机真机、上传、审核、发布、提交或推送。

### 风险、未完成与下一步

优先补齐手机真机的交叉点误触、窄屏/横屏、先后手、终局悔棋、前后台/重启恢复、真实分享与长局性能，并补浏览器真实点击。休闲电脑对复杂组合可能失误，无棋力等级承诺。更强电脑、联网房间仅为后续可选需求，本阶段不继续扩展。

## BL-2026-11-07-02｜五子棋三档难度与本地算法说明

日期 <date start="2026-11-07" />，Asia/Shanghai。用户新增要求是提供电脑难度，并解释如何实现。本阶段在既有五子棋模块扩展，未新增游戏或改变公共架构。详情见 <mention url="https://app.notion.com/p/41090dbc56c381ee9df9ec35ef0cafc6" />。

### 最终行为与关键决策

人机界面显示当前“简单难度／普通难度／困难难度”，点击打开原生三档菜单，默认普通；同机双人隐藏难度。取消菜单或选原档位恢复此前对局；选择新档位时，非空进行中棋局先确认替换，取消确认保留棋局并暂停。难度随重开、悔棋、换先后和模式切换保留。

这是本地 JavaScript 棋类算法，不调用大模型 API 或远端服务。三档均先判断己方一步成五，再防对手一步成五，普通候选在已有棋子周围两格。简单用连续子数/开放端浅层评分，在前 3 个且不少于最高分 72% 的候选按棋谱哈希选点；普通保留原版五格窗口/活形/复合威胁评分（进攻＋防守×1.08）；困难使用 negamax / alpha-beta，最多 3 手（电脑→玩家→电脑），每层候选上限 10／8／6、节点预算 600，紧急成五/防守独立识别。试算仅增量更新四方向前后 4 格评分，撤回恢复缓存。

320ms 应手展示延迟与宿主暂停规则不变。困难是有界战术搜索，无专业棋力或必胜保证，手机难度体验与耗时待验。

### 存档、兼容与迁移

保留 <code>games-between:gomoku:save:v1</code>、外层 version 1、ID 和分享入口。新增 <code>round.difficulty</code>；旧存档缺字段补 <code>normal</code>，显式未知值按损坏处理。分享不改接收者难度，跨游戏数据和私有配置不变。

### 实际验证与交付

根目录构建、<code>--check</code>、<code>node --test --test-reporter=tap 数独/tests/*.test.mjs</code> 及预览生成通过：<b>592/592</b>、47 测试文件，新增 32 项（算法 21、控制器/迁移 9、布局 2）；50 模块/6 游戏及旧核心和配乐来源通过，原始工程估算 3.54MiB。日志 <code>数独/artifacts/gomoku-difficulty-full-tests.log</code>。

2026-11-07 01:18:40（Asia/Shanghai）150 文件快照，摘要 <code>d7785f790e9c3f22a9cf1981f4fade0b9c813ad9be42ad1266e97662ba703c87</code>，测试后稳定；逐文件清单仅在本机 <code>数独/docs/notion-baseline/source-snapshot-gomoku-difficulty.json</code>。

固定战术样本验证普通会允许对方双杀、困难能选择强制应手后己方双杀的点，并枚举样本全部合法防守。此结论只针对样本。桌面 Node v24.22.1 对 50 局面×3 次×3 档共 450 次选点测量：困难冷调用 33.59ms，后续中位数 12.18ms、P95 26.46ms、最大 31.20ms；不是手机性能保证。可复现脚本和结果在 <code>数独/artifacts/gomoku-difficulty/ai-benchmark.mjs</code> 与 <code>ai-benchmark.json</code>。

新增四尺寸三档共 12 张离屏图。微信开发者工具实际验证旧 2 手普通迁移、菜单取消继续、选困难与确认换局、困难人机应手；最终重新编译后困难 2 手保存、暂停恢复和原棋子位置保持。验收记录 <code>数独/artifacts/gomoku-difficulty/acceptance.json</code>。浏览器真实点击及手机真机未执行；无提交、推送、上传、审核或发布。

### 风险、未完成与下一步

优先手机真机检查困难档耗时、三档体验、窄屏触控、前后台/旋屏、续局和音乐。搜索候选/深度/节点均有界，会漏掉更长组合；样本胜负和桌面耗时不能代表全部局面或设备。更深搜索和联网房间不在本阶段扩展承诺中。

## BL-2026-11-07-03｜俄罗斯方块作为第七款游戏接入

日期：<date start="2026-11-07" />，Asia/Shanghai。用户要求新增俄罗斯方块；本地实现、自动检查及微信工具验收完成，当前源码仍为未提交工作区。游戏详见 <mention url="https://app.notion.com/p/41090dbc56c38165b15ff3fcd3d94bfa" />。

### 用户目标与最终行为

用户要求“再帮我加一个俄罗斯方块的游戏”。新增单人无尽俄罗斯方块，通过稳定 ID <code>tetris</code> 接入大厅第三页，保留已有六款游戏、原存档、旧分享及私有工具配置。

10×20 棋盘，I/O/T/S/Z/J/L 七袋出块、左右移动、顺时针旋转、软降／直落、下三块预告和幽灵落点。消除 1／2／3／4 行分别为 100／300／500／800 × 锁定前等级，手动下移每格 1 分、直落每格 2 分；每 10 行升一级，最高 20。基础下落间隔 <code>max(80, round(800×0.82^(level−1)))</code> 毫秒；触地 500ms 落锁，同块触地后的成功左右移动／旋转最多重置 15 次。每帧最多补算 100ms，避免后台恢复突然结算。

按钮和棋盘手势可操作，棋盘点按旋转、左右滑动移动、下滑逐格下降。进行中的局面重开需确认，取消保留原局且暂停；暂停、返回大厅、后台、分享和旋屏后手动继续。音乐沿用共享播放器。

### 关键实现决策

新增 <code>微信小程序/src/games/tetris/{engine,index,renderer}.js</code> 及注册条目，无宿主、平台或公共契约的俄罗斯方块专属分支。使用直接维护的 CommonJS JavaScript，由原依赖图生成微信入口和浏览器预览。

Mulberry32 + Fisher–Yates 七袋，队列保存 5 块、界面展示 3 块，袋剩余 0～6 块。旋转按固定有限偏移尝试普通墙／地面踢位，不声称完整 SRS；O 块旋转无变化。锁定时有格子仍在棋盘上方即顶出，不利用清行挽救该块；下一块无合法出生位置也结束。

首版未实现 Hold、键盘控制、T-spin／连击／Back-to-back 奖励、联网、排行榜或完整竞技规则。计分饱和于最大安全整数，避免极大存档值加分后损坏。

### 数据、兼容与迁移

新键 <code>games-between:tetris:save:v1</code>，外层 version 1，保存 round、best、timing。timing 同时保存下落累计、落锁累计和当前块重置次数，恢复时验证范围；暂停／恢复不额外重置落锁机会。每累计一秒有效游戏时间、落锁、暂停、重开、有效手势结束及宿主保存时持久化；恢复未完成局面先暂停。

引擎验证棋盘尺寸、格值、合法活动块、队列／袋、32 位 RNG、计数和等级一致性，拒绝未消除满行，并核对 <code>4×pieces−10×lines=已占格数</code>。这是结构与局面一致性校验，不是历史重放或防作弊认证。损坏／不兼容棋盘重建新局，合法最佳保留；存储失败可继续游玩并提示。

分享仅为 <code>g=tetris</code> 入口，不替换接收者本机局面。旧游戏 key 和旧分享保持兼容；回滚旧代码缺少新入口，但不读写这个独立槽。

### 实际验证与交付

在 <code>数独/</code> 目录执行：

```bash
node scripts/build-minigame.mjs
node scripts/build-minigame.mjs --check
node --test tests/*.test.mjs
node scripts/build-minigame-preview.mjs
node artifacts/tetris/verify-snapshot.mjs --check
```

全量 <b>640/640</b>，50 测试文件，0 失败／跳过；新增俄罗斯方块 48 项（引擎 25、控制器 14、布局 9）。构建检查 <b>53 原生模块／7 游戏接口</b> 通过，旧数独、移植核心与两首配乐来源哈希通过。原始工程文件估算 <b>3.57MiB</b>，不等于平台实际上传包大小。

2026-11-07 01:41:42（Asia/Shanghai）156 文件源码快照在测试及微信工具验收后再次核对保持一致，摘要为 <code>ed8eddc1f24f59d201629522b2739a6a9c365d6753b8f13c0ca4365136e6edee</code>。完整清单仅保留本机 <code>数独/docs/notion-baseline/source-snapshot-tetris.json</code>；全量日志 <code>数独/artifacts/tetris-full-tests.log</code>、构建日志 <code>数独/artifacts/tetris-build-check.log</code>。

生产 Canvas 离屏图包含 390×844、320×568、844×390、480×320 四尺寸的进行中／暂停／结束，共 12 张，及可复现 <code>数独/artifacts/tetris/render.mjs</code> 与 <code>canvas-verification.json</code>。12 张均已目视检查，不把离屏图片当成浏览器或手机截图。

Windows 微信开发者工具 Stable 2.02.2608080、基础库 3.17.4、iPhone 12/13 模拟器实际验证：大厅第1→2→3页进入；O块右移、直落得14分并生成T；T顺时针旋转；暂停后普通重新编译，返回大厅继续入口显示14分／0行／1级，打开仍暂停，手动继续后底部O、T朝向／位置、14分和队列均保持；重开原生弹窗选择“保留进度”后原局未重置且暂停。记录 <code>数独/artifacts/tetris/acceptance.json</code>。弹窗时工具自身 app.asar 出现 worker path empty 日志，界面正常且无俄罗斯方块源码栈，列为工具观察待真机复核。

浏览器 IAB 对本地预览4173和独立4187两次超时，未完成真实交互；4187本地fetch也失败，未将HTTP算通过。生成预览和VM测试不替代浏览器点击验收。根目录 <code>git diff --check</code> 通过，只有既有LF/CRLF警告。

### 风险、遗留与下一步

浏览器真实交互未完成；手机真机、真实分享、长局耗时与连续触控手感待验收。下一步优先 iOS／Android 的左右连续操作、旋转／软降／直落、短屏可读性、暂停／后台／旋屏／重启恢复与本机存档。固定样本不等于所有种子或所有玩家可成功。

未提交、推送、上传、审核或发布。完整源码逐文件清单和本阶段图片仅保留本机，没有新增远端附件；其他游戏子页与历史附件保留。

## BL-2026-11-07-04｜华容道作为第八款游戏接入

日期<date start="2026-11-07" />，Asia/Shanghai。用户要求新增华容道，本地实现、自动检查与微信工具实操完成；工作区未提交。详情见 <mention url="https://app.notion.com/p/41090dbc56c381aaac10d33f781ec276" />。

### 最终行为与关键决策

经典曹操脱困4×5，10块占18格，曹操2×2移到左上角x1/y3的底中央出口即胜，不需额外出界。只能四向平移不旋转，每移动1格计1步，拖动多格逐格计步，悔一步只退最后一格，终局也可悔棋。

新增第八款 <code>huarongdao</code>，大厅第三页与俄罗斯方块同页。默认入门，另有进阶、经典·横刀立马。棋块点选＋方向按钮或直线拖动；主轴锁定避免斜向误移，多指取消拖动。进行中有保留移动历史时重开／换关确认，取消保留棋盘并暂停；关卡菜单取消或选同关恢复之前暂停状态。

首次合法移动开始计时及音乐，<code>started</code>随存档保存，悔棋回0步后继续计时，只有重开重置。暂停、后台、返回大厅、分享、旋屏与重启后的未结束局需手动继续；终局停止计时。胜利遮罩保留悔一步。

### 开局、算法与解证据

三固定开局ID为beginner／intermediate／classic。入门、进阶取经典116单位格步最短路径第104／76步局面，再分别独立BFS验证为最短12／40步；经典最短116步，分别展开94／2065／24026个等价状态。原创求解按单位格移动等权，去重键合并同尺寸非曹操块，输出实际棋块ID供运行引擎重放验证。结论仅适用于三固定布局与本项目计步，不能与81步等其他口径比较，不表示玩家难度评级。

经典几何参考核对 [GNOME官方Klotski Red Donkey](https://raw.githubusercontent.com/GNOME/gnome-klotski/master/src/klotski-window.vala)，没有复制第三方算法。离线求解脚本／证据 <code>数独/artifacts/huarongdao/solve-levels.mjs</code>、<code>solutions.json</code>，解路径fixture <code>数独/tests/fixtures/huarongdao-solutions.json</code>。运行时不加载求解器，没有实时提示或自动解题。

<code>微信小程序/src/games/huarongdao/{levels,engine,index,renderer}.js</code> 维护固定开局、规则、控制和Canvas，仅新增注册工厂，无宿主、平台或公共契约专属分支。

### 数据、兼容与迁移

新键 <code>games-between:huarongdao:save:v1</code>、version1，保存单一当前局round／elapsedMs／started和每关最佳步数best。最佳只记最少步数，不记最快用时。合法移动／撤销／新开／暂停和宿主save保存，进行中另每5秒有效时间保存。

恢复从固定初盘逐步重放最多10000移动历史，并比对棋块顺序、ID、标签、尺寸、坐标和终局；非法历史、终局后追加移动或不一致快照拒绝。损坏当前局回退入门，合法每关最佳保留。达到10000步上限停止新增移动但仍可悔棋／重开。旧存档key、旧分享和私有工具设置保留，新入口分享仅 <code>g=huarongdao</code>，不覆盖接收方棋局。

### 实际验证与交付

工作目录为 <code>数独/</code>，执行：

```bash
node scripts/build-minigame.mjs
node scripts/build-minigame.mjs --check
node scripts/build-minigame-preview.mjs
node artifacts/huarongdao/verify-snapshot.mjs
node --test tests/*.test.mjs
node artifacts/huarongdao/verify-snapshot.mjs --check
```

全量 <b>684/684</b>，53测试文件，新增44项（引擎16、控制器17、布局11），0失败／跳过；57模块／8游戏接口、原核心和两首配乐来源哈希通过，工程原始文件估算3.60MiB，不等于上传包实测。日志 <code>数独/artifacts/huarongdao-full-tests.log</code>、<code>huarongdao-build-check.log</code>。

2026-11-07 01:59:07（Asia/Shanghai）164源码文件，摘要 <code>f700ff2737861098f31200a2a7ecbad5c34fc2a547deea20c8731544fa8a1d41</code>，测试和微信工具验收后快照核对stable，无源码漂移。完整快照仅在本机 <code>数独/docs/notion-baseline/source-snapshot-huarongdao.json</code>。

四尺寸390×844、320×568、844×390、480×320，进行中／暂停／胜利共12张生产Canvas离屏图已目视；胜利遮罩悔一步已核对。图片和 <code>canvas-verification.json</code> 在 <code>数独/artifacts/huarongdao/</code>，不是手机截图。Windows 微信开发者工具 Stable 2.02.2608080、基础库 3.17.4、iPhone 12/13 模拟器实际验证：大厅第三页进入默认入门；拖动兵二右移1步、点选兵三并点右移到2步、悔棋回1步且位置恢复。3步／0:38暂停后普通重新编译，大厅继续入口恢复，打开仍暂停；手动继续后3步／0:38及布局准确保持。随后真实拖动完成入门，同次拖动2格分别从4→6、6→8逐格计数，曹操到出口12步成功脱困，本关最佳12，结算用时1:16停止，显示再来／换一关／悔一步。记录 <code>数独/artifacts/huarongdao/acceptance.json</code>。 通关后点击遮罩“悔一步”，回到11步进行中，本关最佳仍12；点击关卡原生菜单并选“经典·横刀立马”，出现替换进度确认，点击“开始新局”进入经典初盘0步／0:00。本轮没有实际点击换关取消，该行为仅由自动化测试覆盖。原生弹窗期间工具自身app.asar出现worker path empty日志，弹窗与确认换关正常，没有华容道源码栈，列为工具观察待真机复核。

### 边界与下一步

本轮未执行浏览器真实交互，不把上一阶段访问失败作为本轮尝试；手机真机、真实分享与长局性能未执行，未提交、推送、上传、审核或发布。没有随机出题、实时提示／自动解题、联网或云存档。下一步优先小棋块触控、直线拖动／逐格撤销、计时与零步续局、三关切换确认、短屏出口和前后台／旋屏／重启恢复。无排期承诺。

本阶段完整源码清单、解证据与图片保留本机，不新增远端附件；其余游戏页面和历史材料保留。
