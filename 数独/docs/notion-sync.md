# Notion 项目基准与同步

用户要求：将当前项目基础信息、架构及每个游戏的计划、实施、算法等资料保存在指定 Notion 项目页，之后每次重大更新完成后阶段性汇总。

- 项目主页：[微信小程序——怀旧小游戏](https://app.notion.com/p/3fd90dbc56c3804385eec17277837dec)
- 总体架构：[总体架构与新游戏接入规范](https://app.notion.com/p/3fd90dbc56c3817c9858f15fa3116996?pvs=204)
- 数独：[项目计划、课堂训练与算法基准](https://app.notion.com/p/3fd90dbc56c3819e8b89c0a410be6bfe?pvs=204)
- Zuma：[项目计划、实施与算法基准](https://app.notion.com/p/3fd90dbc56c3810389f6f122f3f6765e?pvs=204)
- 黄金矿工：[项目计划、实施与算法基准](https://app.notion.com/p/3fd90dbc56c3814ca73cf9ee9b276047?pvs=204)
- 2048：[项目计划、实施与算法基准](https://app.notion.com/p/3fd90dbc56c3812b9402ddc514f744a8?pvs=204)
- 扫雷：[项目计划、实施与算法基准](https://app.notion.com/p/3fe90dbc56c3816b80a7e00248814192?pvs=204)
- 五子棋：[项目计划、实施与算法基准](https://app.notion.com/p/41090dbc56c381ee9df9ec35ef0cafc6?pvs=204)
- 俄罗斯方块：[项目计划、实施与算法基准](https://app.notion.com/p/41090dbc56c38165b15ff3fcd3d94bfa?pvs=204)
- 华容道：[项目计划、实施与算法基准](https://app.notion.com/p/41090dbc56c381aaac10d33f781ec276?pvs=204)
- 实施路线：[实施路线与发布验收](https://app.notion.com/p/3fd90dbc56c381ee99fcd9e9f8b947b1?pvs=204)
- 阶段记录：[阶段更新记录](https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf?pvs=204)
- 更新流程：[重大更新后同步 Notion｜规范与模板](https://app.notion.com/p/3fd90dbc56c381b8b502faecced11ab4?pvs=204)

## 当前同步状态

当前基准为 **BL-2026-11-07-04**。华容道作为第八款接入大厅第三页：4×5曹操脱困、三固定开局、点选方向按钮／直线拖动、逐格计步和撤销、计时、每关最佳与本机续局。新华容道独立页、总览、架构目录、路线和阶段记录共5页已写入并逐页回读；原11个直属子页与5份附件全部保留，新增后12个子页，无新增附件。

实际核验cwd为 `数独/`，执行 `node scripts/build-minigame.mjs`、`node scripts/build-minigame.mjs --check`、`node scripts/build-minigame-preview.mjs`、`node artifacts/huarongdao/verify-snapshot.mjs`、`node --test tests/*.test.mjs` 和快照 `--check`。全量 **684/684**、53文件，新增44项（引擎16、控制器17、布局11）；57模块／8游戏接口、原核心与配乐来源哈希通过，工程原始文件估算3.60MiB。日志 `数独/artifacts/huarongdao-full-tests.log`、`huarongdao-build-check.log`。

2026-11-07 01:59:07（Asia/Shanghai）164文件快照，摘要 `f700ff2737861098f31200a2a7ecbad5c34fc2a547deea20c8731544fa8a1d41`，测试和微信工具验收后再次核对稳定。完整清单仅保留本机 `数独/docs/notion-baseline/source-snapshot-huarongdao.json`。

原创离线BFS独立验证入门／进阶／经典最短12／40／116单位格步，经典展开24026等价状态；前两关取经典解路径第104／76步局面。结论限定三个固定布局和“每格一步、到出口不另加出界步”规则，不与81步等其他口径混用。证据 `数独/artifacts/huarongdao/solutions.json`，fixture `数独/tests/fixtures/huarongdao-solutions.json`；运行时无求解器、实时提示或自动解题。

四尺寸12张生产Canvas离屏图已目视。Windows微信工具Stable2.02.2608080、基础库3.17.4、iPhone12/13模拟器实际验证拖动／方向／撤销、3步0:38局面普通重新编译后恢复、两格拖动逐格计数、入门12步通关最佳12、胜后悔到11步保留最佳、原生菜单确认切入经典0步0:00。记录 `数独/artifacts/huarongdao/acceptance.json`。工具自身app.asar出现worker path empty弹窗日志，界面与确认换局正常，无华容道源码栈，真机待复核；本轮没有实际点击换关取消（自动化覆盖），没有实际试听。

本轮未做浏览器UI；手机真机、真实分享、上传／审核／发布均未执行，未提交或推送。下一步优先真机小棋块触控、直线拖动、零步已开始局计时恢复、三关切换、短屏出口及生命周期，补浏览器实操。根 `git diff --check` 通过，仅既有换行警告。

远端保留与回读核对 `数独/docs/notion-baseline/documentation-huarongdao.json`，5页镜像、notion-links.json和本索引已更新。阶段归档 `数独/docs/notion-updates/BL-2026-11-07-04-huarongdao.md`，历史BL-03原样保留。

## 上一基准 BL-2026-11-07-03（历史）

当前基准为 **BL-2026-11-07-03**。俄罗斯方块作为第七款接入大厅第三页，10×20、七袋、旋转／软降／直落、消行加速、下三块预告／幽灵落点、暂停和本机续局已实现。新俄罗斯方块独立页、总览、架构目录、路线与阶段记录共5页已写入并逐页回读；原10个直属子页及5份历史附件全部保留，新增后11个子页，本阶段无新增远端附件。

自动核验工作目录为 `数独/`，实际执行 `node scripts/build-minigame.mjs`、`node scripts/build-minigame.mjs --check`、`node scripts/build-minigame-preview.mjs`、`node --test tests/*.test.mjs`、`node artifacts/tetris/verify-snapshot.mjs --check`。全量 **640/640**、50文件，新增48项（引擎25、控制器14、布局9）；53原生模块／7游戏接口、原核心与配乐来源哈希通过，工程原始文件估算3.57MiB。日志 `数独/artifacts/tetris-full-tests.log`、`tetris-build-check.log`。

2026-11-07 01:41:42（Asia/Shanghai）156文件快照，摘要 `ed8eddc1f24f59d201629522b2739a6a9c365d6753b8f13c0ca4365136e6edee`，测试及微信工具实操后再次核对稳定。完整清单仅在本机 `数独/docs/notion-baseline/source-snapshot-tetris.json`；旧游戏key、旧分享与私有配置保留。

四尺寸12张生产Canvas离屏图已目视核对。Windows微信开发者工具Stable 2.02.2608080、基础库3.17.4、iPhone12/13模拟器已实际验证第三页进入、O右移／直落得14分、T旋转、暂停、普通重新编译后的同局恢复与原生重开取消；记录 `数独/artifacts/tetris/acceptance.json`。工具弹窗另有app.asar的worker path empty日志，界面正常且无tetris源码栈，真机待复核。

浏览器IAB本地4173与独立4187访问超时，真实交互未完成；4187本地fetch失败，未把HTTP算通过。手机真机、真实分享、上传／审核／发布未执行，未提交或推送。首版无Hold、键盘、完整SRS、T-spin／连击或联网。下一步优先真机连续操作、窄屏横屏、生命周期和长局性能。

远端回读与保留核对 `数独/docs/notion-baseline/documentation-tetris.json`，5页本地镜像、`notion-links.json`和本索引已更新。阶段归档 `数独/docs/notion-updates/BL-2026-11-07-03-tetris.md`；历史BL-02原样保留。

## 上一基准 BL-2026-11-07-02（历史）

当前基准为 **BL-2026-11-07-02**。五子棋简单／普通／困难三档已同步到既有五子棋页、总览、阶段记录和路线，共4页，逐页回读确认；原10个直属子页及5个历史附件完整保留，未新增页面或上传附件，公共架构未改。

算法为本地JavaScript，无模型API：简单浅层评分后在前3个且不少于最高分72%的候选按棋谱哈希选择；普通保留原版攻防评分；困难negamax/alpha-beta最多3手，候选上限10／8／6、600节点预算，使用局部评分缓存。旧v1存档缺difficulty补normal，显式非法值拒绝；难度菜单取消/同档恢复原局，换档确认取消则保留局面并暂停。

2026-11-07 01:18:40（Asia/Shanghai）快照150文件，摘要 `d7785f790e9c3f22a9cf1981f4fade0b9c813ad9be42ad1266e97662ba703c87`，测试后稳定。全量 **592/592**、47文件，新增32项；50模块/6游戏、旧核心与音乐来源校验通过，原始工程估算3.54MiB。日志 `数独/artifacts/gomoku-difficulty-full-tests.log`；快照 `数独/docs/notion-baseline/source-snapshot-gomoku-difficulty.json`。

桌面Node v24.22.1对50个合法无立即成五局面×3次×3档共450次选点测量：困难冷调用33.59ms，中位12.18ms、P95 26.46ms、最大31.20ms，不等于手机性能。固定10手战术样本验证困难相较普通能识别对应双杀应对，仅证明样本范围。复现脚本和结果在 `数独/artifacts/gomoku-difficulty/ai-benchmark.mjs`、`ai-benchmark.json`。

新增四尺寸三档12张Canvas离屏图；微信开发者工具已实际验收旧2手局迁移普通、难度菜单取消恢复、困难选档确认换局及人机应手；最终重新编译后困难2手和原棋子位置准确恢复，继续/再暂停正常。记录 `数独/artifacts/gomoku-difficulty/acceptance.json`。浏览器真实点击、手机真机、上传、审核和发布未执行，未提交或推送。下一步优先真机困难耗时、触控和生命周期验证。

回读与保留核对 `数独/docs/notion-baseline/documentation-gomoku-difficulty.json`，4页本地镜像和链接索引已更新；阶段归档 `数独/docs/notion-updates/BL-2026-11-07-02-gomoku-difficulty.md`。历史BL-01原样保留。

## 上一基准 BL-2026-11-07-01（历史）

当前基准为 **BL-2026-11-07-01**。五子棋作为第六款接入，人机＋同机双人、换先后、悔棋、暂停和本机续局完成；用户确认当前范围已经足够。总览、五子棋独立页、架构目录、路线及阶段记录共5页已写入并回读，原9个直属子页和5个历史附件保留，新增五子棋后共10个直属子页。其他游戏页面未改写。

2026-11-07 00:58:48（Asia/Shanghai）最终快照：148文件，摘要 `753c2ad138ba480ea3bc04a71c56e5d77de87c5180c87abbc8317f2856b57686`。构建/检查/预览生成通过，50原生模块、6游戏接口与旧核心及配乐来源通过，原始工程估算3.53MiB；全量 **560/560** 通过，45测试文件，新五子棋41项，0失败/跳过。日志 `数独/artifacts/gomoku-full-tests.log`，快照 `数独/docs/notion-baseline/source-snapshot-gomoku.json`。

390×844、320×568、844×390、480×320各含对局/获胜/暂停，共12张生产Canvas离屏图已目视检查。微信开发者工具Stable 2.02.2608080、基础库3.17.4、iPhone12/13模拟器实际验证大厅进入、24→26手人机应手、悔棋回到24、切模式确认取消、规则原生弹窗，以及2手局暂停后普通重新编译、大厅续局和底部继续按钮，棋子与手数保持。工具有来自app.asar的worker path为空日志，但弹窗工作；需真机复核。验收记录 `数独/artifacts/gomoku/acceptance.json`。

浏览器真实交互未完成（本地访问超时/自动化绑定失败），预览包及VM回归通过不替代浏览器点击。手机真机、上传、审核和发布未执行；未提交或推送。下一步优先手机真机验收，更强电脑与联网仅为后续可选需求，当前不继续扩展。

远端回读、层级、内部链接与附件保留核对见 `数独/docs/notion-baseline/documentation-gomoku.json`；镜像已更新，阶段正文归档在 `数独/docs/notion-updates/BL-2026-11-07-01-gomoku.md`。源码完整逐文件清单仅保留本机，未上传私有配置或截图。

## 上一基准 BL-2026-11-06-01（历史）

当前基准为 **BL-2026-11-06-01**，数独提示修复和只读答案功能已同步总览、数独子页、阶段记录及路线4页，并回读确认。项目9个直属子页和历史附件保留；数独新增2张生产Canvas离屏效果图，明确标注非微信真机截图。

提示确认改为四字“应用提示”，原生弹窗失败可见反馈；填写错误时可确认修正一格，正常逻辑排除候选有明确说明、高亮和定位。新增“显示答案”及“返回题目”，不改原填写/笔记/撤销，不自动通关，查看时暂停计时和音乐。未完成局查看后本局不计普通或实战成绩；已完成局查看不追溯取消原成绩。answerViewed是schema1/2新增可选布尔值，原key/版本保留，旧存档缺省false，撤销和恢复保留标记。

2026-11-06 21:34:49（Asia/Shanghai）核验：**519/519**测试通过，42文件，新增54项；46原生模块、5游戏接口及配乐来源检查通过，工程文件估算3.50MiB。141文件验证前后及文档同步后哈希一致：`a0b3d34a597bec1316731710a835fe3049011c43d8d33514fc4c425c5298c692`。快照 `数独/docs/notion-baseline/source-snapshot-sudoku-help.json`，日志 `数独/artifacts/sudoku-help-full-tests.log`。

Canvas已目视核对390×844、320×568、844×390、480×320，普通页和答案页共8图在 `数独/artifacts/sudoku-help/`。原生API限制使用微信团队类型说明及真实宿主严格假平台回归；当前环境没有可调用的Windows UI执行入口，未把离屏渲染当成微信/浏览器交互。微信工具与手机真机点击、原生弹窗、前后台和旋转仍待验收；本阶段未提交、推送、上传或发布。

## 上一基准 BL-2026-10-19-03（历史）

当前基准为 **BL-2026-10-19-03**，用户提供的两首完整配乐已接入五款游戏，按《平沙落雁》→《阳关三叠》顺序循环。Notion总览、架构、路线、五个游戏子页及阶段记录共9页均已更新并回读；9个直属子页、2048的4张图片、扫雷的3张图片及历史附件保留。

音频原文件保留于 `D:\怀旧小游戏\音频`；运行MP3共2,512,595字节，32kbps/22050Hz/mono，377.809秒和250.279秒，完整不裁剪。旧WAV及清单归档于 `数独/artifacts/audio-archive/`。当前来源记录为 `微信小程序/assets/audio/playlist.source.json`。

核验时间2026-10-19 22:19:45（Asia/Shanghai）：465/465测试通过（38文件，0失败/跳过），46原生模块、5游戏接口，12项HTTP资源/访问边界检查；工程文件估算3.49MiB。本阶段新增15项音乐平台/真实预览适配器回归，保留单播放器、音乐开关/存储键和暂停门控，修复事件分发期间重绑导致的切曲重入风险。

137文件源码快照在 `数独/docs/notion-baseline/source-snapshot-user-music.json`，SHA256为 `9d2dc3fb7e13beeadc12984bf691e2627c1ad2518d36af72ff4566663cb4468c`，文档同步后比对稳定。日志 `数独/artifacts/user-music-tests.log`、`user-music-http.json`。原音频哈希未变，连续准备输出一致，峰值检查无削波。

本阶段没有新增浏览器实际试听截图，微信开发工具/手机真机的音量、两曲交接、静音及系统中断仍待验收；未提交、推送、上传、审核或发布。

## 上一基准 BL-2026-10-19-02（历史）

当前基准为 **BL-2026-10-19-02**。扫雷独立子页、项目总览、总体架构、路线与阶段记录共5页已写入并逐页回读；主页9个直属子页和5份历史附件均保留，扫雷页包含3张本阶段界面截图。原游戏页面未改写。

自动核验于2026-10-19 21:58:28（Asia/Shanghai）开始：全量 **450/450** 测试通过（38文件，新增扫雷34项，0失败/跳过），构建检查 **46原生模块、5游戏接口**，原数独/移植核心/原创音乐来源检查通过。维护源码、入口及浏览器预览已生成。

扫雷初级9×9/10雷、中级9列12行/20雷、高级12列16行/40雷；首步及邻格无雷、翻开/插旗、连开/点击数字排查、胜负、计时及三档最佳、暂停/手动恢复、确认换局、独立v1存档与入口分享已实现。普通棋盘可能需要猜测，短屏高级无缩放。

浏览器已验证大厅第二页、首步连开、插旗、刷新恢复、难度切换取消/确认与旋屏暂停继续，覆盖375×750、320×568和844×390。4张本机截图和browser-qa.json在 `数独/artifacts/minesweeper/`，其中3张已附Notion扫雷子页。

135文件源码快照前后稳定，SHA256 `88fd84ad5a8115eda9e030016c30dfb63b896b32a2425d85a9886a74f3afbbb1`。快照 `数独/docs/notion-baseline/source-snapshot-minesweeper.json`，日志 `数独/artifacts/minesweeper-tests.log`；完整逐文件清单保留本机，不上传Notion。只向Notion同步用户补充明确批准的实现说明、相对源码路径、存档键、构建测试结果与快照摘要。

远端及本地回读记录：`数独/docs/notion-baseline/minesweeper-sync-verification.json`；同步内容归档：`数独/docs/notion-updates/BL-2026-10-19-02-minesweeper.md`。微信开发者工具、iOS/Android真机、真实分享、上传、审核和发布仍待验收，本阶段未提交或推送。

## 上一基准 BL-2026-10-19-01（历史）

当前基准为 **BL-2026-10-19-01**，目录重组已同步总览、架构、四游戏、路线、阶段记录及同步规范共9页，并逐页回读确认。8个直属子页、2048原4张截图和主页5份历史附件均保留。

完整工作区为 `D:\怀旧小游戏`，独立网页版及原开发资料在 `数独/`，微信导入工程在 `微信小程序/`。根目录npm命令调用同一套Node脚本；本机没有npm，实际使用Node命令验证。

2026-10-19 21:48:58（Asia/Shanghai）新路径核验：416/416测试通过（35文件），43原生模块、4游戏接口和来源检查通过，15项HTTP资源/访问边界检查通过。原383文件均映射存在；运行代码、vendor维护源、AppID/私有配置和WAV逐字节保持。Git HEAD与origin不变，工作区未提交。

当前源码快照129文件，SHA256为 `9e9d46866fec70fe24dfc034013d28061f7ea10b83c4dc9165c9e69ebaf96034`，文档同步后再次比对稳定。快照在 `数独/docs/notion-baseline/source-snapshot-relocation.json`；日志和核对记录在 `数独/artifacts/relocation-final-tests.log`、`relocation-http.json`、`relocation-verification.json`。

旧D:\数独已无文件，空目录仍被进程占用，一次性清理脚本仅在空目录释放后删除，发现新文件会停止；本机状态见 `数独/artifacts/cleanup-old-directory.status.json`。微信工具和Codex需更新导入/项目路径；本阶段未执行微信工具、真机、真实分享、提交、推送、上传、审核或发布。

收尾配置边界（2026-10-19 21:48:58 Asia/Shanghai）：快照检查发现微信工程公开及私有配置发生后续更新，已保留工具设置，AppID、compileType和项目根仍正确；当前配置下重新通过416项测试及构建检查。游戏运行代码、vendor源与WAV未变化。迁移时的配置快照另存 `数独/docs/notion-baseline/source-snapshot-relocation-before-tool-settings.json`，当前129文件快照包含更新后的公开工程配置；“配置逐字节保持”仅指迁移完成时的核对，不表示工具之后没有更新。

## 上一基准 BL-2026-10-18-04（历史）

当前基准为 **BL-2026-10-18-04**，四游戏共享原创舒缓背景音乐已同步至总览、架构、四个游戏子页、路线与阶段记录并逐页回读确认。八个直属子页、2048 原四张截图和全部历史附件均保留。

核验时间：2026-10-18 23:30:57 Asia/Shanghai；全量 **416/416** 测试通过（35 文件，新增 33 项音乐相关测试），构建检查 43 原生模块、4 游戏接口及原创音乐来源哈希。123 个源码/资源/配置/测试文件验证前后稳定：`d62bac40a42e2ff706743a45b5af46f33f7f683eb1c196cc24af61ecab87a3d0`。快照 `docs/notion-baseline/source-snapshot-background-music.json`，日志 `artifacts/background-music-tests.log`。

《庭间微光》48 秒，16 kHz 单声道 PCM WAV，1,536,044 字节，音量 0.4；默认开启，顶部胶囊左侧开关，前后台/暂停/菜单/结算/原生弹窗/音频中断门控。浏览器确认数独和 Zuma 实际播放、暂停/续播及关闭偏好刷新保留，320×568 窄屏开关可用；截图在 `artifacts/background-music/`。微信工具及手机真机听感、静音、循环衔接和中断仍待验收；本阶段未上传、发布、提交或推送。

## 上一基准 BL-2026-10-18-03（历史）

当前基准为 **BL-2026-10-18-03**，数独笔记开关与“更多”触控修复已同步至数独子页、阶段记录、项目总览并回读确认；八个直属子页与历史附件均保留。

核验时间：2026-10-18 23:14:15 Asia/Shanghai；全量 **383/383** 测试通过（32 文件，新增 17 项笔记开关专项），构建检查 41 原生模块、4 游戏接口。114 文件验证前后哈希稳定：`c54a13f47eff6bfda97870c189fdb41f095713b390754faec8def19ff9443851`。快照 `docs/notion-baseline/source-snapshot-sudoku-interaction.json`，日志 `artifacts/sudoku-interaction-tests.log`。

浏览器验证旧存档取消、新填全/取消、刷新恢复、320×568 窄屏和 480×320 短横屏、菜单取消后可再次打开；截图在 `artifacts/sudoku-interaction/`。微信工具与手机真机仍待验收，本阶段未上传、发布、提交或推送。

## 上一基准 BL-2026-10-18-02（历史）

当前基准为 **BL-2026-10-18-02**。已新增 2048 独立子页面，更新总览、架构、路线及阶段记录并逐页回读；主页现有八个直属子页，包含新 2048，原七个子页均保留，两个历史附件保持原状，另附本阶段源码快照。

2026-10-18 本轮资料补充：重新回读九页正文，2048 页新增可直接查看的最终界面、大厅第二页、320×568 窄屏及 844×390 横屏四图；主页附 135,793 字节的当前九页正文备份。修正当前快照指向、预览 URL、仓库路径伪链接，路线补上 2048 v1 存档验收。22:57:23（Asia/Shanghai）比对 113 文件与上次测试快照一致；本轮只改文档，没有重新运行测试，继续引用下方真实核验记录。回读和附件索引见 `docs/notion-baseline/documentation-refresh-2048.json`。

**同步收尾边界：**23:07:49（Asia/Shanghai）再次比对时，数独、预览适配及相关测试已有 7 个文件相对已验证快照发生后续并行修改。该差异已写入 Notion 总览、阶段记录与数独页，并附 `parallel-source-check-2026-10-18.json`；本地记录在 `docs/notion-baseline/`。这些后续变更未纳入 BL-02 的测试结论，需在对应开发阶段重新核验；正文备份按生成时状态留存。本次没有改写运行代码或覆盖其他会话的修改。

核验时间：2026-10-18 22:38:51 Asia/Shanghai；全量 **362/362** 测试通过（31 文件，含 35 项 2048 专项），构建检查 41 原生模块、4 游戏接口。113 个运行/维护/配置/测试文件在验证前后稳定，SHA256 为 `c8cb7b127f948ee64fd5b90fe294877d34d4838243b61e53146fd6f79229428c`。本地快照为 `docs/notion-baseline/source-snapshot-2048.json`，日志为 `artifacts/2048-tests.log`。

浏览器验证了第二页进入、方向按钮和真实拖动合并、刷新恢复、320×568 窄屏及 844×390 横屏，截图在 `artifacts/2048/`。首页名称为「花自飘零的游戏空间」。微信工具、真机、真实分享与正式发布仍待验收；此次没有提交、推送或上传发布。

## 首次基准（历史）

基准 BL-2026-10-18-01 已写入，并回读确认 8 个页面正文与 7 个直属子页链接；工作流已对当前用户的 MCP 客户端启用。源码核验时间为 2026-10-18 18:12:42 Asia/Shanghai，327 项测试通过、构建检查通过，校验期间 107 个文件的源码树哈希保持一致。

这份基准以 source-snapshot.json 所列工作区文件为界，不把 main/37e88c9 当作包含全部新功能的提交，也不把旧 ZIP 修改时间当作最新源码证明。真机、上传、审核和发布仍待验证。

主页已附本次全册正文 Markdown 和源码快照 JSON，回读确认两个附件及七个直属子页保留。附件表示建立本基准时的快照；后续阶段应生成新的版本，不能把旧附件冒充最新状态。

## 后续执行

重大更新后读取远端现有页面与规范，更新受影响游戏的当前实现和参数，必要时更新架构，追加阶段记录并更新总览的验证证据。保留用户新增笔记与原有子页；本地镜像在 docs/notion-baseline/。

若 Notion 不可访问，保留本地总结到 docs/notion-updates/ 并报告待同步，恢复后先检查阶段是否已经存在再补写。不要新建重复项目或误报同步成功。此流程由项目协作约定触发，不是后台仓库监控或定时任务。
### 扫雷阶段收尾的并行工作区边界
2026-10-19 22:17:09（Asia/Shanghai）重新核验当前合并态：另一会话随后替换公共音乐、预览、资源服务及构建检查，扫雷三个维护源未变。过程中先遇到音乐清单未完成和MP3首帧头校验失败，该会话完成产物并修复后，当前 `node scripts/build-minigame.mjs --check` 通过：46原生模块、5游戏接口、2首用户提供音乐来源、工程原始文件估算3.49 MiB。
`node --test tests/*.test.mjs` 最新全量465/465通过，0失败/跳过；较本扫雷原基准450多出的15项来自并行音乐相关更新，不计作扫雷新增用例。137文件在此次复核前后稳定，SHA256 `9d2dc3fb7e13beeadc12984bf691e2627c1ad2518d36af72ff4566663cb4468c`。
保留原 `source-snapshot-minesweeper.json` 和 `minesweeper-tests.log` 作为450项扫雷基准；最新合并态另存 `source-snapshot-minesweeper-final.json`、`minesweeper-final-tests.log`、`minesweeper-final-build.log`，均在数独目录对应docs/notion-baseline或artifacts下。完整文件清单仍留本机。扫雷截图表示之前浏览器验收时点；没有把新音乐的实际听感、微信工具或真机列为本聊天已验证。
