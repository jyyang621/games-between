# 🧩 数独｜项目计划、课堂训练与算法基准

所属项目：<mention url="https://app.notion.com/p/3fd90dbc56c3804385eec17277837dec">微信小程序——怀旧小游戏</mention>。基准日期：<date start="2026-10-18" />。

## 提示与答案查看｜BL-2026-11-06-01

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

### 本阶段界面效果

<image source="notion-file-block://25c4b1a8-e876-4da3-8dfd-66df45bf9800/9298fff7-7b1f-42fc-8348-9f7e6e776123?space_id=c88ab3a0-1e61-4fff-b6b1-6c7f388dc9e4&name=sudoku-play-help-BL-2026-11-06-01.png">
新增显示答案入口；320×568生产Canvas离屏实渲，非微信真机截图
</image>

<image source="notion-file-block://00cb18c1-7048-472b-8d87-d01f6a89d957/654e736b-cc30-4e7c-ba29-2c1551029da4?space_id=c88ab3a0-1e61-4fff-b6b1-6c7f388dc9e4&name=sudoku-answer-BL-2026-11-06-01.png">
只读正确答案与返回题目；320×568生产Canvas离屏实渲，非微信真机截图
</image>

提示按钮原缺陷依据：[微信团队接口类型说明](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts)；确认按钮原文案为5个汉字，超过接口约束。

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

## 基准状态与定位

基准日期：2026-10-18。本文依据当前工作区源码、题库实测和自动化测试整理，供后续优化比较使用。状态为<b>已实现并完成本地验证，微信真机待验，未上传审核或发布</b>；不把建议项、历史聊天中的测试总数或浏览器预览等同于线上状态。

数独是小游戏集合中的一个独立模块，定位为可离线游玩的经典数独与逐步学习的技巧课堂。普通对局、专项练习和整题实战各有明确记录口径。当前版本既保留旧题、旧存档与旧分享链接，又为新局引入按逻辑技巧评级的题库。

## 项目计划书

### 目标与用户体验

- 玩家可以在经典模式和每日挑战中选择简单、中等、困难、专家四档，使用填写、擦除、候选笔记、填全笔记、撤销、提示与暂停。
- 初学者可以先看四页基础教程，再按“条件 → 推理 → 结果”学习 12 项技巧，通过跟练、独立、混合、条件辨认和整题实战建立学习闭环。
- 同题分享能打开相同初盘；关闭、返回大厅、进入课堂后保留进度，前后台切换不应继续消耗解题时间。
- 每次题库或算法升级都可核验其唯一解、评级、推理轨迹、存档兼容性和分享稳定性。

### 当前功能范围

<table fit-page-width="true" header-row="true">
<tr>
<td>
范围
</td>
<td>
已实现内容
</td>
</tr>
<tr>
<td>
普通游玩
</td>
<td>
经典与每日模式、四档难度、棋盘选择与数字输入、不可修改题目给定数、暂停、重开本题、新局确认
</td>
</tr>
<tr>
<td>
辅助工具
</td>
<td>
手动笔记、填全候选、关联高亮、重复冲突提示、最多 100 步撤销、提示次数与计时
</td>
</tr>
<tr>
<td>
新题评级
</td>
<td>
259 道离线核验整题；简单 64、中等 64、困难 64、专家 67
</td>
</tr>
<tr>
<td>
课堂素材
</td>
<td>
四页基础教程、12 项技巧课程、74 张真实逻辑局面专项卡；指向排除与显性三数组各 7 张，其余每项 6 张
</td>
</tr>
<tr>
<td>
练习闭环
</td>
<td>
跟练、独立、隐藏技巧名称的混合练习、依据成立/不成立辨认、错题复习、完成后最多 4 步真实推演、按技巧选择整题实战
</td>
</tr>
<tr>
<td>
本地记录
</td>
<td>
普通通关与最快用时、新旧评级记录分开、可信局面去重、首次无辅助通过、提示/错误/复习和整题完成
</td>
</tr>
<tr>
<td>
分享
</td>
<td>
旧版 seed 同题、新版题库 ID 同题、课程/练习/辨认/混合/基础教程与整题实战入口
</td>
</tr>
</table>

当前基准范围不包含账号系统、云端存档、跨设备同步、排行榜、联网对战和经过真实玩家研究校准的难度或学习效果评估。它们均不得在对外说明中写成已上线功能。

### 本阶段验收标准

1. 每道普通题唯一解；新题能以所属档及以下技巧解完，非简单档不能被低一级求解器完整解出。
2. 同 seed 的旧分享和同题库 ID 的新分享保持初盘；切换课堂、整题实战、前后台时不串改普通对局。
3. 候选来自当前盘面约束及已验证推理，不能把最终答案伪装成候选提示；训练答案必须验证依据与动作。
4. 存档不能改写题目给定数或凭伪造“已完成”获得记录；损坏存档安全退回可信题目。
5. 提示、示范、重复作答和撤销不能重复赚取首次独立掌握记录；普通完成次数以 roundId 去重。
6. 紧凑手机、横屏、安全区和胶囊区域下，棋盘与训练交互可用。微信真机生命周期和实际触控验收仍为待办。

## 当前实施情况与后续实施计划

<b>已完成、可从代码与测试确认：</b> 原确定性引擎适配微信；数独从平台宿主中拆成独立模块；v1 旧题兼容；新题库与 v2 对局；逻辑求解/评级；课程及棋盘图解；可信候选专项练习；复习与学习记录；独立保存的整题实战；题库结构去重范围与体验画像；分享、延迟弹窗和生命周期回归测试。

<b>建议待办，尚未实施或尚未验收：</b>

<table fit-page-width="true" header-row="true">
<tr>
<td>
优先级
</td>
<td>
计划
</td>
<td>
验收产物
</td>
</tr>
<tr>
<td>
P0
</td>
<td>
在微信开发者工具和至少一台真机核验冷启动/热分享、后台恢复、胶囊遮挡、课堂与实战草稿、存储失败
</td>
<td>
设备/版本/步骤/结果清单与截图；不以浏览器通过替代
</td>
</tr>
<tr>
<td>
P0
</td>
<td>
在发布前固定并归档题库版本、稳定 ID 和旧 seed 样本
</td>
<td>
存档/分享兼容回归记录，发布包与源代码对应关系
</td>
</tr>
<tr>
<td>
P1
</td>
<td>
用真实玩家观察校准四档体验，重点观察高级技巧识别成本与提示可理解性
</td>
<td>
匿名耗时/错误/放弃情况及评级改动依据；有结果后再考虑星级
</td>
</tr>
<tr>
<td>
P1
</td>
<td>
按覆盖缺口扩充素材，继续追加而非替换已分享题
</td>
<td>
唯一解、低档停滞、轨迹重放、形态覆盖与去重检查报告
</td>
</tr>
<tr>
<td>
P2
</td>
<td>
评估是否需要跨设备备份、存档导入导出和更多辅助设置
</td>
<td>
独立方案与兼容设计，确认需求后实施
</td>
</tr>
<tr>
<td>
P2
</td>
<td>
评估完整数独同构去重与更多逻辑技巧
</td>
<td>
性能、题库兼容和新 ratingVersion 迁移方案
</td>
</tr>
</table>

未指定负责人、里程碑日期和上线时间；这些应在确定资源与验收条件后补充。

## 模块结构与主要接口

数独遵守大厅统一游戏契约，由 <code>src/games/sudoku/index.js</code> 导出 <code>createSudokuGame({read, write, now, services})</code>。它返回 <code>id: 'sudoku'</code>、<code>frameInterval: 1000</code>、<code>resize/render/tick/activate/enter/pause/save/sharePayload/getResumeInfo</code> 及 <code>model/statusText</code> 等接口。平台宿主提供存储、时间和 toast/modal/actionSheet/home/invalidate 服务；数独负责自己的规则、设置、视图、记录与分享内容。

<table fit-page-width="true" header-row="true">
<tr>
<td>
文件/层
</td>
<td>
职责与接口
</td>
</tr>
<tr>
<td>
<code>数独/js/sudoku.js</code>
</td>
<td>
网页端权威旧引擎：<code>generatePuzzle/solve/countSolutions/getCandidates/getAllCandidates/getConflicts/isComplete/dailySeed</code>
</td>
</tr>
<tr>
<td>
<code>src/games/sudoku/core/engine.js</code>
</td>
<td>
由构建脚本生成的 CommonJS 引擎，保留源 SHA-256；不可直接修改生成文件
</td>
</tr>
<tr>
<td>
<code>state.js</code>
</td>
<td>
<code>SudokuGame</code>：旧版 seed 对局、基础输入/笔记/撤销/计时/存档
</td>
</tr>
<tr>
<td>
<code>rated-state.js</code>
</td>
<td>
<code>RatedSudokuGame extends SudokuGame</code>：题库对局、可信推理记录、逻辑提示、schema 2
</td>
</tr>
<tr>
<td>
<code>logic.js</code>
</td>
<td>
12 项逻辑技巧、bitmask 候选、规则验证与应用、固定顺序分析评级
</td>
</tr>
<tr>
<td>
<code>bank.js</code> / <code>data/puzzle-bank.js</code>
</td>
<td>
稳定题目 ID、确定性选题、专项卡、按技巧选整题、版本/覆盖/画像查询
</td>
</tr>
<tr>
<td>
<code>training.js</code> / <code>learning-records.js</code>
</td>
<td>
课堂状态机、选依据/填数/删候选、练习草稿、首次作答与复习记录
</td>
</tr>
<tr>
<td>
<code>lessons.js</code> / <code>foundation-lessons.js</code>
</td>
<td>
原创课程文案、前置知识、四页基础教程
</td>
</tr>
<tr>
<td>
<code>training-recognition.js</code> / <code>teaching-visuals.js</code>
</td>
<td>
可信条件辨认素材、枢纽/两翼/鱼形线等图解信息
</td>
</tr>
<tr>
<td>
<code>renderer.js</code> / <code>training-renderer.js</code>
</td>
<td>
Canvas 布局、棋盘、候选、状态、按钮及命中目标；不直接调用微信 API
</td>
</tr>
<tr>
<td>
<code>rating-profile.js</code>
</td>
<td>
<code>experience-v1</code> 附加体验画像和 <code>coverage-v1</code> 形态/去重统计
</td>
</tr>
</table>

<code>bank.js</code> 的返回值为独立拷贝，玩家修改不能污染题库。重要查询包括 <code>selectPuzzle(seed, difficulty)</code>、<code>getPuzzle(id)</code>、<code>getTrainingExamples(id)</code>、<code>getTrainingSource(id)</code>、<code>getPuzzlesByTechnique</code>、<code>selectPuzzleByTechnique</code>、<code>getBankSummary/getProfileSummary/getCoverageSummary</code>。不存在的技巧或无匹配题目返回空结果，不暗中降档。

## 算法与规则基线

### 旧版确定性出题、求解和唯一解

旧版难度按给定数数量：简单 42、中等 35、困难 29、专家 25；<b>这不是人类技巧评级</b>。随机流用 UTF-16 字符单元上的 FNV-1a 哈希及 Mulberry32，命名空间固定为 <code>sudoku:v1:<difficulty>:<seed></code>，保证历史同题链接可重现。

求解器用行/列/宫 9-bit 占用掩码。每次选择候选最少的空格（MRV），遇 0 或 1 个候选提前停止扫描，递归枚举候选并回溯。<code>solve</code> 返回一个解，<code>countSolutions(board, 2)</code> 找到第二解即停止，均不修改调用者棋盘。随机完整解在同样 MRV 框架中打乱候选顺序。

```txt
以固定 seed 初始化随机流
生成完整合法解，打乱 81 格挖空顺序
逐格暂时挖空；若解数不是 1，恢复该格
达到本档给定数后返回
若有限次尝试仍达不到：对固定唯一解 17 线索题作保唯一变换，再补正确线索
```

普通档最多尝试 2 次，专家 5 次。兜底使用数字重命名、宫带/宫栈及内部行列置换和转置，保持唯一解；补入正确给定数后达到精确线索数量。构建时以同一源文件生成微信引擎，并对新旧导出、同题、候选、求解和日期边界作一致性检查。

### 新版逻辑题库与四档评级

新微信对局默认使用题库，<code>bankVersion = ratingVersion = 'logic-v1'</code>。从对应档池中按 <code>FNV-1a('logic-v1:<difficulty>:<seed>') % pool.length</code> 选题，运行时不在手机上批量搜索随机题或进行整库唯一解检查。题库本身由项目原生成器离线生成，未引入外部题库数据。

<table fit-page-width="true" header-row="true">
<tr>
<td>
难度
</td>
<td>
最高可用技巧
</td>
<td>
入库判据
</td>
</tr>
<tr>
<td>
简单
</td>
<td>
唯一候选数、唯一位置
</td>
<td>
仅用该组可完整解出
</td>
</tr>
<tr>
<td>
中等
</td>
<td>
加宫内/行列区块排除、显性/隐性数对
</td>
<td>
简单档停滞，本档解完
</td>
</tr>
<tr>
<td>
困难
</td>
<td>
加显性/隐性三数组、X-Wing
</td>
<td>
中等档停滞，本档解完
</td>
</tr>
<tr>
<td>
专家
</td>
<td>
加 XY-Wing、XYZ-Wing、剑鱼
</td>
<td>
困难档停滞，本档解完
</td>
</tr>
</table>

<code>logic.js</code> 的 <code>analyze</code> 不使用搜索或猜测；按固定技巧与区域扫描顺序选择下一步，保留候选删除，再反复应用到完成/停滞/步数上限。默认最多 1000 步，可配置上限封顶 10000；内部步骤权重按档为 1/8/24/60。评级依据最高实际使用档；步骤分不是 SE 分，也不是耗时预测。“需要该技巧”只相对于当前求解器、固定扫描顺序和前置技巧集，不是对所有人类解法的最短解证明。

题库另提供 <code>experience-v1</code> 画像：候选密度、最高档步骤次数、删除量、参考路径每个局面的可用结构数量等；不改变 <code>logic-v1</code>，未按真实玩家耗时校准。259 道题在“数字重命名 + D4 八种旋转/镜像”范围互不等价，未做全部宫带、宫栈和内部行列置换下的完整同构去重。74 张专项卡来自真实轨迹，同技巧来自不同生成源结构；不能以旋转/改数字充当新的独立素材。

### 候选、冲突、撤销与提示

- <code>getAllCandidates</code> 依据当前玩家盘面局部约束计算 81 格候选，已填格为空；不查最终答案来缩减候选。冲突提示标出行/列/宫重复的所有参与格；“没有重复”不代表盘面一定可解。
- 填入数字会清掉该格笔记及同区域相同候选；手动笔记可自行增删。“填全笔记”补全候选并高亮为“取消填全”，再次点击恢复手动笔记，保留后续数字；取消不额外纠正原本手动记错的候选。开启时手动编辑同步维护备份，实际填写和推理只清理相关候选。两次切换各可撤销；最多保留 100 份快照，撤销不退回计时和提示次数。
- “更多”保留规则、重开、冲突提示、关联高亮、成绩、难度说明六项，避免超过微信原生菜单上限；返回大厅使用页头按钮。按钮至少 72×44，短屏按安全区预留控件，失败可重试，主动取消不报错。
- 新版额外保存带原盘面锚点的候选排除证明；每次重放用 <code>validateStep/applyStep</code> 验证，手动少记的笔记不构成逻辑依据。填全笔记保留已证明排除；添加正确数字可保留证明，改填、擦除已有值或填错会使相关证明整体失效，撤销可还原。
- 新版提示先显示技巧与理由，经确认才应用；若玩家有与可信解不符的填写，则停止给出逻辑提示，要求先检查，不直接泄露答案。旧版存档仍保留从已知解填入/修正一个格子的旧提示行为。
- 普通新版对局仅在应用提示时增加 hints；整题实战查看提示即永久记录本题辅助，即使取消应用或重开也不能恢复无提示资格。

### 课堂、训练与学习记录

专项卡含当前完整盘面、81 个候选 bitmask、目标题法步骤、源题 ID 与轨迹下标；候选来自真实前置推理，所有前置技巧在截取点不可用，目标动作必须带来实际改变。<code>createLogicState/validateStep/applyStep</code> 验证支撑格和动作，接受另一组合法结构或有效删除集合的非空子集，不能仅因删除数字不是最终答案就判正确。

跟练起始提示为 2 级，独立从 0 级开始；提示最多 3 级。示范不算自主完成。混合练习从已学技巧池选择并隐藏技巧名，允许其他已学规则的有效解；辨认练习保留完整可信候选，只修改提议依据，要求判断规则是否成立。完成后最多继续 4 步，逐步应用真实规则，恢复时重新重放。

学习记录按完整盘面与候选状态去重，保留首次答案，单题最多 32 条事件；错误、提示、示范或提前看过同源图解不能变成首次无辅助通过。旧活动次数独立保留，不冒充新增的掌握人数或独立局面。复习策略为错误立即复习、辅助成功 12 小时后、连续无辅助成功按 1/3/7/14 天安排；这是产品规则，未做教学效果研究验证。

整题实战新选题限定本课所在难度档，参考路径必须包含本课技巧，并仅使用截至本课的技巧集，避免初级课程跳出未学高级技巧；旧草稿和明确分享仍按原题 ID 恢复以保持兼容。普通对局暂存并暂停，每课各自保留草稿。完成以 <code>课程 ID + 题目 ID</code> 去重并保留首次辅助结果；允许使用其他正确解法，因此完成整题不等于证明玩家已使用目标题法。

### 日期、计时和完成次数

每日 seed 为北京时间日历 <code>YYYY-MM-DD</code>，与设备时区无关。网页用 <code>Intl</code> 的 <code>Asia/Shanghai</code>，微信生成引擎用时间戳加 UTC+8 再取 UTC 日期，避免依赖微信 <code>Intl</code>。跨日不会静默改掉正在做的题；每日模式新局按当前日生成，同日同难度提示可重玩。

计时只由宿主传入的正、有限前台 <code>deltaMs</code> 累加；暂停、完成、课堂界面均不走普通对局时钟。回大厅、分享或后台等宿主生命周期调用 <code>pause/save</code>；恢复后由玩家继续。完成必须同时匹配可信唯一解并通过全盘合法性检查。普通成绩分旧版与 rated 两组，按 roundId 在最近 200 条记录内去重，记录本档完成数与最快时间；撤销后再次完成同局不会重复计数，重开生成新的 roundId。

## 本地存档与分享兼容

<table fit-page-width="true" header-row="true">
<tr>
<td>
存储键
</td>
<td>
当前内容与版本
</td>
</tr>
<tr>
<td>
<code>games-between:sudoku:v1</code>
</td>
<td>
同一键兼容旧 <code>schemaVersion: 1</code> 与新 <code>schemaVersion: 2</code>；v1 由 seed 重建，v2 带 <code>bankId/ratingVersion/deductions</code>
</td>
</tr>
<tr>
<td>
<code>games-between:settings:v1</code>
</td>
<td>
数独 <code>conflicts/highlight</code> 布尔设置；无内部 schemaVersion 字段
</td>
</tr>
<tr>
<td>
<code>games-between:stats:v1</code>
</td>
<td>
旧 <code>completed/rounds</code> 与新 <code>rated.completed/rated.rounds</code>；无内部 schemaVersion 字段
</td>
</tr>
<tr>
<td>
<code>games-between:sudoku:training:v1</code>
</td>
<td>
新写入内部 <code>schemaVersion: 2</code>，兼容旧 1；含课堂位置、技巧索引、已学、旧活动次数、练习草稿及 learning
</td>
</tr>
<tr>
<td>
训练内 <code>learning</code>
</td>
<td>
<code>schemaVersion: 1</code>，可信题 ID、暴露/提示、作答事件、首次答案、复习时间及 fullPuzzles
</td>
</tr>
<tr>
<td>
<code>games-between:sudoku:full-practice:v1</code>
</td>
<td>
内部 <code>schemaVersion: 1</code>，按技巧保存 v2 整题草稿和 <code>practiceHintViews</code>，并以 assistance 持久保留同题辅助记录
</td>
</tr>
</table>

对局共同字段包括 seed/difficulty/mode、board/notes/selected/noteMode、history、elapsed/paused/hints/roundId；puzzle 与 solution 从可信 seed 或 bankId 重建，不信任存档注入。校验种子编码、81 格取值、给定数、笔记去重、历史长度等；v2 不兼容 ratingVersion 或 bankId 会拒绝恢复，伪造推理记录会丢弃并重建安全候选。

本阶段新增可选 fillNotesActive 与 notesBeforeFill 字段，并写入撤销快照；key/schema 不变。旧档仅在笔记恰好为完整非空可信候选时推断已填全（备份为空），部分旧笔记不推断。新开关与备份随暂停、刷新、撤销恢复；取消不会撤销数字，也不影响已验证的逻辑排除。

<table fit-page-width="true" header-row="true">
<tr>
<td>
分享参数
</td>
<td>
行为
</td>
</tr>
<tr>
<td>
<code>g=sudoku&amp;p=NOTION_MARKDOWN_ESCAPED_LT_SENTINELseed&gt;&amp;d=NOTION_MARKDOWN_ESCAPED_LT_SENTINELdifficulty&gt;&amp;m=classic/daily</code>
</td>
<td>
无 v 为旧版题；历史没有 g 的同题链接仍接受
</td>
</tr>
<tr>
<td>
以上加 <code>v=2&amp;b=NOTION_MARKDOWN_ESCAPED_LT_SENTINELbankId&gt;</code>
</td>
<td>
新版题库同题，核对题目难度与版本；未知版本/ID 拒绝，不用另一题冒充
</td>
</tr>
<tr>
<td>
以上新版加 <code>fp=NOTION_MARKDOWN_ESCAPED_LT_SENTINELtechniqueId&gt;</code>
</td>
<td>
同一整题实战，先核对参考路径确有该技巧，保留接收者普通对局
</td>
</tr>
<tr>
<td>
<code>g=sudoku&amp;learn=basics/mixed</code>
</td>
<td>
基础教程/隐藏技巧混合练习入口
</td>
</tr>
<tr>
<td>
<code>g=sudoku&amp;tr=NOTION_MARKDOWN_ESCAPED_LT_SENTINELtechniqueId&gt;</code>
</td>
<td>
课程页；可加 <code>ex=NOTION_MARKDOWN_ESCAPED_LT_SENTINELexerciseId&gt;</code> 指定专项卡，或 <code>rc=NOTION_MARKDOWN_ESCAPED_LT_SENTINELrecognitionId&gt;</code> 指定可信辨认提议
</td>
</tr>
</table>

普通对局的冷启动不同题分享可直接进入，热分享替换有改动的当前题要确认；同题重入保留进度，从课堂打开当前普通题的分享会返回游戏界面且不重置该局。整题实战另行保护课程草稿：若朋友的实战题会替换本课尚未完成且有填写/笔记的草稿，冷启动与热进入均需确认；取消后当前实战、已保存草稿和普通对局保持原状。生命周期、切局或课堂切换递增 generation，迟到弹窗不能改写后来的对局；逻辑提示另核对 roundId 和盘面。

## 测试证据与风险边界

末次核验：2026-10-18 23:14:15（Asia/Shanghai），阶段 BL-2026-10-18-03。全项目 383/383 测试通过（32 文件），构建检查通过；其中新增笔记开关专项 17 项。覆盖切换、撤销、原手动候选保留、逻辑排除、刷新、旧档和畸形备份，以及原生菜单限制与短屏触控。114 文件验证前后哈希一致，快照 docs/notion-baseline/source-snapshot-sudoku-interaction.json。首次数独集中核验 117 项和项目 327/327、2048 阶段 362/362 均为历史时点，参见 <mention url="https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf" />。

覆盖求解/MRV 与唯一解、固定 v1 题样、候选/冲突、北京时间边界、题库四档及低档停滞、专项重放、12 项技巧正反例、合法替代结构、损坏/伪造存档、证明保持与撤销、训练首答/提示/复习去重、整题与普通保存隔离、按本课及前置技巧选择整题、实战分享替换草稿确认、课堂中打开同一普通题分享、过期弹窗与多尺寸交互目标。<code>node 数独/scripts/build-minigame.mjs --check</code> 还覆盖 12 个新旧引擎同题样本、6 个日期边界和整库检查；<code>node 数独/scripts/build-sudoku-bank.mjs --check</code> 是独立只读题库复核命令。

主要限制：本地存档仅在当前设备，清理微信数据或换机不保证保留；存档校验用于健壮性而非防作弊安全边界；离线题库有限，seed 不等于无限新初盘；评级和画像依赖固定参考路径，不能等同玩家能力或耗时；200 条 roundId 去重是有界历史而非永久全局去重；真机触控、性能、系统弹窗和微信分享行为仍待真实环境验收。

## 源码与验证证据索引

以下路径均相对仓库根目录 <code>D:/怀旧小游戏</code>，后续应结合对应发布版本读取，不依赖本页永久保存旧代码细节：

- <code>数独/js/sudoku.js</code>；<code>数独/scripts/games/sudoku.mjs</code>；<code>微信小程序/src/games/sudoku/core/engine.js</code>：确定性旧引擎、构建适配和跨平台检查。
- <code>微信小程序/src/games/sudoku/index.js</code>、<code>state.js</code>、<code>rated-state.js</code>：统一接口、生命周期、旧新存档、普通/实战隔离和分享解析。
- <code>微信小程序/src/games/sudoku/logic.js</code>、<code>bank.js</code>、<code>data/puzzle-bank.js</code>、<code>rating-profile.js</code>；<code>数独/scripts/build-sudoku-bank.mjs</code>：逻辑、题库、评级与构建校验。
- <code>微信小程序/src/games/sudoku/training.js</code>、<code>learning-records.js</code>、<code>training-recognition.js</code>、<code>lessons.js</code>、<code>foundation-lessons.js</code>、<code>teaching-visuals.js</code>：课程、训练、可信记录和复习。
- <code>微信小程序/src/games/sudoku/renderer.js</code>、<code>training-renderer.js</code>：Canvas 与交互布局。
- <code>数独/tests/sudoku.test.mjs</code>、<code>数独/tests/minigame-sudoku.test.mjs</code>、<code>数独/tests/minigame-sudoku-rated-state.test.mjs</code>、<code>数独/tests/minigame-sudoku-integration.test.mjs</code>：引擎、模块、存档和分享。
- <code>数独/tests/minigame-sudoku-logic.test.mjs</code>、<code>数独/tests/minigame-sudoku-bank.test.mjs</code>、<code>数独/tests/minigame-sudoku-profile.test.mjs</code>：技巧正确性、全库与画像/去重。
- <code>数独/tests/minigame-sudoku-training.test.mjs</code>、<code>数独/tests/minigame-sudoku-training-renderer.test.mjs</code>、<code>数独/tests/minigame-sudoku-learning.test.mjs</code>、<code>数独/tests/minigame-sudoku-full-practice.test.mjs</code>、<code>数独/tests/minigame-sudoku-teaching-visuals.test.mjs</code>：训练、教学、学习记录与整题。
- <code>数独/docs/sudoku-rating.md</code>：当前评级、素材范围与兼容策略说明；<code>数独/docs/architecture.md</code>：小游戏集合总体架构。

## 后续阶段汇总规则

每次数独重大更新应先更新本页“基准状态/功能/存档分享/算法”中受影响的现状，再追加一条阶段记录：变更目的、已实现范围、明确未完成项、涉及版本和迁移策略、实际测试命令及结果、浏览器/微信开发者工具/真机各自证据、已知风险、下一步。新增技巧或调整扫描规则时明确是否变更 ratingVersion；追加题目不得让已有 bankId 或分享初盘失效。不要用计划、测试样本、累计活动次数或演示截图替代上线状态与真实学习成效。

## 本轮文档核对的验证边界

2026-10-18 23:07:49（Asia/Shanghai）检测到数独模块、预览适配与相关测试相对 BL-2026-10-18-02 快照已有后续修改。本页既有内容继续代表之前的已验证实现；后续差异尚待相应开发阶段重新验收，不能用旧 362 项测试结果证明它们已通过。变动清单与时间见 <mention url="https://app.notion.com/p/3fd90dbc56c3804385eec17277837dec">微信小程序——怀旧小游戏</mention> 末尾及 <code>数独/docs/notion-baseline/parallel-source-check-2026-10-18.json</code>。

## 共享背景音乐｜BL-2026-10-18-04

本阶段已接入原创《庭间微光》轻柔键盘与音垫循环，48 秒、16 kHz、单声道 PCM16，1,536,044 字节；没有外部歌曲、录音采样或网络音源。默认开启，播放音量 0.4，顶部原生胶囊左侧有 44×44 音乐开关。

宿主只在当前模块 musicActive 为 true、前台、没有原生弹窗或系统音频中断时播放；大厅、菜单、暂停、完成/结算、后台均暂停。全项目共用一个惰性播放器，暂停保留进度，切游戏不叠音；退出释放。开关独立保存在 games-between\:music\:settings:v1，游戏存档与分享不变。浏览器失败只在真实交互后重试，不逐帧重播。

本阶段全项目 416/416 测试通过（35 文件），新增 33 项音乐相关测试（平台 14、宿主 13、游戏状态 6）。浏览器实际解码到 48 秒，数独与 Zuma 播放时 paused=false，开关/游戏暂停后 paused=true，续播保留位置；关闭偏好刷新保留。微信工具与手机真机的静音开关、听感、循环衔接和来电音频仍待实测。素材与协议详见 <mention url="https://app.notion.com/p/3fd90dbc56c3817c9858f15fa3116996" />，阶段证据见 <mention url="https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf" />。

本游戏 musicActive：普通和整题实战未暂停且未完成；课堂仅未完成的交互练习为 true，目录、讲解、基础页、完成与推演均为 false。
