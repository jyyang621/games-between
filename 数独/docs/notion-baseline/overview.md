# 🎮 微信小程序——怀旧小游戏

- URL: https://app.notion.com/p/3fd90dbc56c3804385eec17277837dec?pvs=204
- Baseline: BL-2026-11-07-04
- Verified: 2026-11-07 (Asia/Shanghai)

## 当前基准

基准编号 <b>BL-2026-11-07-04</b>。日期 <date start="2026-11-07" />，Asia/Shanghai。华容道作为第八款加入大厅第三页：4×5曹操脱困、三固定开局、点选方向按钮／直线拖动、每格计步／撤销、计时、每关最佳及本机续局。入门／进阶／经典独立BFS最短12／40／116单位格步，限定本项目计步口径；无实时提示或自动解题。详见 <mention url="https://app.notion.com/p/41090dbc56c381aaac10d33f781ec276">华容道｜项目计划、实施与算法基准</mention>。

全量 <b>684/684</b>、53测试文件，新增44项；<b>57模块／8游戏</b>及原核心／两首配乐来源检查通过，原始工程估算3.60MiB。2026-11-07 01:59:07（Asia/Shanghai）164文件快照摘要 <code>f700ff2737861098f31200a2a7ecbad5c34fc2a547deea20c8731544fa8a1d41</code>，测试和微信工具验收后核对稳定。

四尺寸12张生产Canvas离屏图已目视。微信工具实际验证移动／撤销、3步0:38局面重新编译后恢复、两格拖动逐格计数、入门12步通关及最佳12、胜后悔到11步保留最佳、原生菜单确认切入经典0步0:00。本轮换关取消只由自动化覆盖，浏览器真实交互未执行；手机真机、真实分享和正式上传审核发布仍未完成。未提交或推送；详见 <mention url="https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf">阶段更新记录</mention>。

## 上一基准 BL-2026-11-07-03（历史）

基准编号：<b>BL-2026-11-07-03</b>。日期 <date start="2026-11-07" />，Asia/Shanghai。俄罗斯方块作为第七款接入大厅第三页：10×20、七袋、旋转／软降／直落、消行计分与加速、下三块预告／幽灵落点、暂停、本机最佳及续局。详见 <mention url="https://app.notion.com/p/41090dbc56c38165b15ff3fcd3d94bfa">俄罗斯方块｜项目计划、实施与算法基准</mention>。

全量 <b>640/640</b>、50 测试文件，新增48项；<b>53模块／7游戏</b>及旧核心、配乐来源通过，工程原始文件估算3.57MiB。2026-11-07 01:41:42（Asia/Shanghai）156文件快照摘要 <code>ed8eddc1f24f59d201629522b2739a6a9c365d6753b8f13c0ca4365136e6edee</code>，测试及微信工具验收后核对稳定。

四尺寸12张生产Canvas离屏图已目视检查。微信开发者工具实际验证第三页进入、O块右移／直落得14分、T旋转、暂停、普通重新编译后同局恢复及原生重开取消。浏览器本地预览访问超时，真实交互未完成；手机真机、真实分享及上传审核发布仍待验收。未提交或推送；记录见 <mention url="https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf">阶段更新记录</mention>。

## 上一基准 BL-2026-11-07-02（历史）

基准编号：<b>BL-2026-11-07-02</b>。日期 <date start="2026-11-07" />，Asia/Shanghai。五子棋新增简单／普通／困难三档，默认普通；原生菜单与换局确认、旧存档补普通和难度持久化已实现。对手由本地 JavaScript 棋形评分和有界搜索实现，无模型 API。困难最多试算 3 手、候选 10／8／6、600 节点，不保证获胜。详见 <mention url="https://app.notion.com/p/41090dbc56c381ee9df9ec35ef0cafc6">五子棋｜项目计划、实施与算法基准</mention>。

全量 <b>592/592</b>、47 文件，新增 32 项；50 模块/6 游戏及来源检查通过，原始工程估算 3.54MiB。2026-11-07 01:18:40（Asia/Shanghai）150 文件快照摘要 <code>d7785f790e9c3f22a9cf1981f4fade0b9c813ad9be42ad1266e97662ba703c87</code>，测试后稳定。微信开发者工具已验证旧局迁移、菜单取消、困难换局/应手及最终重新编译后困难 2 手局暂停续玩。

桌面 Node 450 次选点测量中，困难冷调用 33.59ms，中位数 12.18ms、P95 26.46ms、最大 31.20ms；不代表手机性能。浏览器真实点击、手机真机及上传发布仍未完成；未提交或推送。下一步优先真机耗时与操作验收，详见 <mention url="https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf">阶段更新记录</mention>。

## 上一基准 BL-2026-11-07-01（历史）

基准编号：<b>BL-2026-11-07-01</b>。日期 <date start="2026-11-07" />，Asia/Shanghai。新增第六款五子棋，人机＋同机双人、换先后、悔棋、暂停与本机续局已实现。用户确认当前功能范围已经足够，本阶段冻结范围。详情见 <mention url="https://app.notion.com/p/41090dbc56c381ee9df9ec35ef0cafc6">五子棋｜项目计划、实施与算法基准</mention>。

全量 <b>560/560</b> 测试通过，45 文件，新增五子棋 41 项；50 原生模块、6 游戏接口及来源检查通过，原始文件估算 3.53MiB。2026-11-07 00:58:48（Asia/Shanghai）148 文件快照摘要 <code>753c2ad138ba480ea3bc04a71c56e5d77de87c5180c87abbc8317f2856b57686</code>，测试后比对稳定。12 张四尺寸生产 Canvas 离屏图已目视检查；微信开发者工具已实际验证落子/电脑应手、悔棋、原生弹窗和普通重新编译后暂停续局。

浏览器真实交互与手机真机仍待验收；未提交、推送、上传、审核或发布。日志和验收记录在 <code>数独/artifacts/gomoku/</code> 及 <code>数独/artifacts/gomoku-full-tests.log</code>；完整源清单仅保留本机。阶段细节见 <mention url="https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf">阶段更新记录</mention>。

## 上一基准 BL-2026-11-06-01（历史）

基准编号：BL-2026-11-06-01。基准日期：2026-11-06，时区Asia/Shanghai。本阶段修复数独提示无响应与错误格纠错，并新增确认后查看完整答案的只读界面，保留原棋盘、暂停和成绩边界。519项全量测试通过，微信工具与真机仍待验收。

### 本阶段结果

数独普通对局和整题实战新增“显示答案”：查看不填盘、不自动通关，返回原题；未完成局查看后不计本局成绩，已完成成绩不追溯改变。提示确认文字符合原生接口限制，失败可见反馈，填错可确认纠正一格，逻辑排除候选有明确提示和高亮。详见 <mention url="https://app.notion.com/p/3fd90dbc56c3819e8b89c0a410be6bfe">数独｜项目计划、课堂训练与算法基准</mention>。

2026-11-06 21:34:49（Asia/Shanghai）核验519/519测试、42文件，46模块/5游戏及来源检查；141文件源码指纹 <code>a0b3d34a597bec1316731710a835fe3049011c43d8d33514fc4c425c5298c692</code> 前后稳定，快照 <code>数独/docs/notion-baseline/source-snapshot-sudoku-help.json</code>。4种尺寸Canvas离屏渲染通过，原有其他游戏、存档key与配乐保留。

### 上一基准（历史）

基准编号：BL-2026-10-19-03。基准日期：2026-10-19，时区Asia/Shanghai。本阶段用用户提供的两首完整曲目替换原背景音乐并顺序循环，五款游戏共用，465项全量检查通过；微信平台和真机听感待验收。

## 当前配乐｜BL-2026-10-19-03

本节替代历史《庭间微光》单曲运行说明。现有五款游戏共用用户目录 <code>D:/怀旧小游戏/音频</code> 提供的《平沙落雁》（李祥霆）和《阳关三叠》（传奇乐坊），按第一首→第二首→第一首顺序循环，保留单播放器、音量0.4、音乐开关及原暂停/后台/弹窗/音频中断门控；游戏存档和音乐偏好key不变。

原MP3文件保持不变。两首完整运行副本在 <code>微信小程序/assets/audio/</code>，共2,512,595字节，32kbps/22.05kHz/单声道；时长377.809秒、250.279秒。来源及SHA256在 <code>playlist.source.json</code>；旧WAV与来源清单归档到本机 <code>数独/artifacts/audio-archive/</code>，不再进入运行包。

2026-10-19 22:19:45（Asia/Shanghai）核验：465/465全量测试、46模块/5游戏接口、12项资源与访问边界检查通过；工程文件估算3.49MiB，这是本项目的原始文件预算检查，不等于平台上传包测量。新曲及切曲的真机听感、循环衔接和设备静音仍待验收，未上传发布。维护说明 <code>数独/docs/background-music.md</code>，源码快照137文件 <code>数独/docs/notion-baseline/source-snapshot-user-music.json</code>，指纹 <code>9d2dc3fb7e13beeadc12984bf691e2627c1ad2518d36af72ff4566663cb4468c</code>。

### 上一阶段基准（历史）

基准编号：BL-2026-10-19-02。基准日期：2026-10-19，时区Asia/Shanghai。新增第五款扫雷，已完成本地实现、450项全量检查和浏览器验收；微信工具与手机真机仍待验收。扫雷规则、存档与3张截图见 <mention url="https://app.notion.com/p/3fe90dbc56c3816b80a7e00248814192">扫雷｜项目计划、实施与算法基准</mention>。

## 目录迁移｜BL-2026-10-19-01

收尾配置边界（2026-10-19 21:48:58 Asia/Shanghai）：快照检查发现微信工程公开及私有配置发生后续更新，已保留工具设置，AppID、compileType和项目根仍正确；当前配置下重新通过416项测试及构建检查。游戏运行代码、vendor源与WAV未变化。迁移时的配置快照另存 <code>数独/docs/notion-baseline/source-snapshot-relocation-before-tool-settings.json</code>，当前129文件快照包含更新后的公开工程配置；“配置逐字节保持”仅指迁移完成时的核对，不表示工具之后没有更新。

核验日期：<date start="2026-10-19" />（Asia/Shanghai）。完整工作区现为 <code>D:/怀旧小游戏</code>：<code>数独/</code> 保存独立网页版及原构建、测试、预览、文档和历史产物；<code>微信小程序/</code> 是微信开发者工具导入的工程。Git 历史、GitHub Actions 和统一 npm 入口保留外层。

从外层可执行 <code>node 数独/scripts/build-minigame.mjs --check</code>、<code>node --test 数独/tests/*.test.mjs</code>；进入数独目录后仍使用原脚本命令。AppID、游戏 ID、存档 key、旧分享参数和游戏运行代码保持一致。Pages 复制源改为数独子目录，发布后的站点根层布局保持原样；本地网页与预览仍为同一端口的 <code>/</code> 与 <code>/preview/</code>。

新路径复核：416/416 测试、43 原生模块与4游戏接口、15项 HTTP 资源/边界检查通过；原383个文件均已找到，运行代码、vendor源、AppID/私有配置和WAV字节保持一致。源码快照129文件，SHA256 <code>9e9d46866fec70fe24dfc034013d28061f7ea10b83c4dc9165c9e69ebaf96034</code>。微信工具重导入与真机验收尚未执行，未提交、推送、上传或发布。旧 <code>D:/数独</code> 已无文件，仅有被进程占用的空目录，一次性清理脚本等待释放；若出现新文件会停止清理。

当前路径索引以本节及以下更新为准；历史附件和旧阶段快照按原验证时间保留。

游戏首页名称为“花自飘零的游戏空间”，工程代号为 games-between，知识库标题保留“微信小程序——怀旧小游戏”。实际导入工程类型是微信小游戏（compileType 为 game），入口采用 Canvas 游戏大厅，已接入数独、黄金矿工、Zuma、2048、扫雷、五子棋、俄罗斯方块和华容道八款。各游戏通过同一宿主运行，独立管理玩法、渲染、状态与本机存档；大厅每页三款，2048／扫雷／五子棋位于第二页，俄罗斯方块和华容道位于第三页。

<b>本地实现及自动检查已完成；微信工具的阶段性实操见各游戏记录，八游戏完整发布验收、手机真机、真实分享与正式上传审核发布仍待完成。</b> 浏览器预览只作为本地交互证据，不能视为微信发布凭证。

## 资料导航

- 总体架构、模块契约与新游戏接入：<mention url="https://app.notion.com/p/3fd90dbc56c3817c9858f15fa3116996">总体架构与新游戏接入规范</mention>
- 数独项目计划、教学训练和算法：<mention url="https://app.notion.com/p/3fd90dbc56c3819e8b89c0a410be6bfe">数独｜项目计划、课堂训练与算法基准</mention>
- Zuma 项目计划、关卡、难度和彩球算法：<mention url="https://app.notion.com/p/3fd90dbc56c3810389f6f122f3f6765e">Zuma｜项目计划、实施与算法基准</mention>
- 黄金矿工项目计划、抓钩和 TNT 算法：<mention url="https://app.notion.com/p/3fd90dbc56c3814ca73cf9ee9b276047">黄金矿工｜项目计划、实施与算法基准</mention>
- 2048 项目计划、合并算法与独立存档：<mention url="https://app.notion.com/p/3fd90dbc56c3812b9402ddc514f744a8">2048｜项目计划、实施与算法基准</mention>
- 扫雷项目计划、首步安全算法与独立存档：<mention url="https://app.notion.com/p/3fe90dbc56c3816b80a7e00248814192">扫雷｜项目计划、实施与算法基准</mention>
- 五子棋项目计划、休闲电脑与独立存档：<mention url="https://app.notion.com/p/41090dbc56c381ee9df9ec35ef0cafc6">五子棋｜项目计划、实施与算法基准</mention>
- 俄罗斯方块项目计划、七袋／落锁与独立存档：<mention url="https://app.notion.com/p/41090dbc56c38165b15ff3fcd3d94bfa">俄罗斯方块｜项目计划、实施与算法基准</mention>
- 华容道项目计划、固定开局／逐格撤销与独立存档：<mention url="https://app.notion.com/p/41090dbc56c381aaac10d33f781ec276">华容道｜项目计划、实施与算法基准</mention>
- 跨游戏实施路线与发布验收：<mention url="https://app.notion.com/p/3fd90dbc56c381ee99fcd9e9f8b947b1">实施路线与发布验收</mention>
- 阶段更新历史：<mention url="https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf">阶段更新记录</mention>
- 重大更新汇总规范与模板：<mention url="https://app.notion.com/p/3fd90dbc56c381b8b502faecced11ab4">重大更新后同步 Notion｜规范与模板</mention>

<page url="https://app.notion.com/p/3fd90dbc56c3817c9858f15fa3116996">
总体架构与新游戏接入规范
</page>

<page url="https://app.notion.com/p/3fd90dbc56c3819e8b89c0a410be6bfe">
数独｜项目计划、课堂训练与算法基准
</page>

<page url="https://app.notion.com/p/3fd90dbc56c3810389f6f122f3f6765e">
Zuma｜项目计划、实施与算法基准
</page>

<page url="https://app.notion.com/p/3fd90dbc56c3814ca73cf9ee9b276047">
黄金矿工｜项目计划、实施与算法基准
</page>

<page url="https://app.notion.com/p/3fd90dbc56c3812b9402ddc514f744a8">
2048｜项目计划、实施与算法基准
</page>

<page url="https://app.notion.com/p/3fd90dbc56c381ee99fcd9e9f8b947b1">
实施路线与发布验收
</page>

<page url="https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf">
阶段更新记录
</page>

<page url="https://app.notion.com/p/3fd90dbc56c381b8b502faecced11ab4">
重大更新后同步 Notion｜规范与模板
</page>

## 基础信息

<table fit-page-width="true" header-row="true">
<colgroup>
<col width="232.25" />
<col width="593" />
</colgroup>
<tr>
<td>
项目
</td>
<td>
当前值
</td>
</tr>
<tr>
<td>
工作区
</td>
<td>
D:/怀旧小游戏
</td>
</tr>
<tr>
<td>
微信工程
</td>
<td>
D:/怀旧小游戏/微信小程序
</td>
</tr>
<tr>
<td>
AppID
</td>
<td>
wxdf7e7953e1db2558
</td>
</tr>
<tr>
<td>
projectname / package 名称
</td>
<td>
games-between
</td>
</tr>
<tr>
<td>
package.json 版本
</td>
<td>
1.0.0；这是工程元数据，不代表微信已发布版本
</td>
</tr>
<tr>
<td>
主入口
</td>
<td>
微信小程序/game.js → src/main.js → src/app/host.js
</td>
</tr>
<tr>
<td>
实现方式
</td>
<td>
微信 Canvas 2D；小游戏运行模块使用 CommonJS，开发脚本使用 Node.js ESM
</td>
</tr>
<tr>
<td>
开发运行时
</td>
<td>
Node.js 20 或更新版本；日常检查不要求安装 TypeScript
</td>
</tr>
<tr>
<td>
数据与联网
</td>
<td>
单机本地存档；未实现账户、跨设备同步、云排行榜或业务服务器
</td>
</tr>
<tr>
<td>
原项目
</td>
<td>
D:/黄金矿工、D:/祖玛Zuma；已移植维护源保存在微信工程 vendor 中
</td>
</tr>
<tr>
<td>
网页数独
</td>
<td>
仓库根 index.html、styles.css、js；保留独立网页入口
</td>
</tr>
<tr>
<td>
基准 Git 参照
</td>
<td>
main，HEAD 37e88c9；当前扩展主要仍在工作区中，HEAD 不等于本次完整基准快照
</td>
</tr>
</table>

## 游戏目录与能力

<table fit-page-width="true" header-row="true">
<colgroup>
<col />
<col width="468" />
<col width="491" />
</colgroup>
<tr>
<td>
游戏
</td>
<td>
当前能力
</td>
<td>
关键边界
</td>
</tr>
<tr>
<td>
数独
</td>
<td>
正式对局、每日挑战、笔记/填全笔记、撤销、提示、分享；新版逻辑评级题库、课堂教学、专项训练和整题实战
</td>
<td>
新版逻辑评级与旧版 seed 同题链路并存；具体算法、题库与学习存档见子页
</td>
</tr>
<tr>
<td>
Zuma
</td>
<td>
六条轨道、六关逐关解锁、无尽波次、四档速度和球数、稀有万能彩球、换球反馈
</td>
<td>
每档闯关/无尽独立保存；无尽速度封顶并在险境减速；共享背景音乐可开关；暂无操作音效
</td>
</tr>
<tr>
<td>
黄金矿工
</td>
<td>
40 关/无尽，单人/合作/对战，商店、移动伙伴、TNT 范围爆炸
</td>
<td>
六种组合独立检查点；重新打开从本关起点恢复；共享背景音乐可开关；暂无操作音效
</td>
</tr>
<tr>
<td>
2048
</td>
<td>
经典 4×4，四向滑动/方向按钮，合并计分、最佳成绩、自动存档、暂停、重开、2048 后继续
</td>
<td>
独立 game-2048 模块；有效移动才生块；入口分享保留接收方本机棋盘
</td>
</tr>
<tr>
<td>
扫雷
</td>
<td>
三档手机棋盘、首步安全、翻开/插旗、空白连开、点击数字排查、胜负、计时/最佳、自动存档和暂停
</td>
<td>
独立minesweeper模块，一个当前棋盘与三档最佳；普通棋盘可能猜测，换难度确认覆盖当前局，短屏高级无缩放
</td>
</tr>
<tr>
<td>
五子棋
</td>
<td>
15×15 自由规则、三档人机/同机双人、换先后、悔棋、暂停、本机续局与获胜连线
</td>
<td>
独立 gomoku 模块，本地评分与最多3手有界搜索；无禁手、无联网，手机真机仍待验收
</td>
</tr>
<tr>
<td>
俄罗斯方块
</td>
<td>
10×20、七袋、旋转／软降／直落、消行加速、幽灵落点／下三块、暂停与本机续局
</td>
<td>
独立tetris模块，500ms落锁及15次重置；普通墙踢非完整SRS；手机真机仍待验收
</td>
</tr>
<tr>
<td>
华容道
</td>
<td>
4×5曹操脱困、三固定开局、点选／方向／拖动、逐格计步和撤销、计时与本机续局
</td>
<td>
独立huarongdao模块；12／40／116最短单位格步限定固定布局与本项目规则；手机真机待验
</td>
</tr>
</table>

## 关键架构决策

1. 大厅与宿主是通用基础设施，不再以数独模型作为整个项目的中心。新增游戏在自己的目录实现模块，再在注册表加条目。
2. 游戏只接收注入的存档、时间和服务；不直接访问 wx、DOM、其他游戏状态。平台能力集中到 platform，游戏规则保留在各游戏内。
3. 同一代码通过浏览器 wx 适配层用于本地预览；预览构建按静态相对 require 收集依赖，不另写游戏名单。
4. 游戏的规则和存档独立；已有存档键及旧分享入口保持兼容。需要升级时采用显式迁移并进行回归验证。
5. 生成文件和维护源分离。数独旧引擎来自 js/sudoku.js；Zuma、黄金矿工维护 TypeScript 源与 SHA256 清单，原始副本保留，不直接修改生成产物。
6. 阶段总结同时保存“已实现行为、测试证据、已知限制和后续建议”。未实施、未真机验证、未发布的事项必须明确标记。

## 本次检查证据

BL-2026-11-07-04：实际cwd为 <code>数独/</code>，构建、--check、预览、全量测试及快照检查通过；684/684、53文件、57模块／8游戏。日志 <code>数独/artifacts/huarongdao-full-tests.log</code>、<code>huarongdao-build-check.log</code>，独立BFS证据 <code>artifacts/huarongdao/solutions.json</code>，平台记录 <code>artifacts/huarongdao/acceptance.json</code>。164文件完整清单仅保留本机，无新增远端附件。规则与平台边界见 <mention url="https://app.notion.com/p/41090dbc56c381aaac10d33f781ec276">华容道｜项目计划、实施与算法基准</mention>。

## BL-2026-11-07-03 检查证据（历史）

BL-2026-11-07-03：在 <code>数独/</code> 运行 build、--check、preview、<code>node --test tests/*.test.mjs</code> 与源码快照检查，640/640、50文件、53模块／7游戏通过。日志 <code>数独/artifacts/tetris-full-tests.log</code>、<code>tetris-build-check.log</code>，微信工具与离屏验收 <code>数独/artifacts/tetris/acceptance.json</code>、<code>canvas-verification.json</code>。156文件完整清单仅保留本机，本次未上传附件。源码摘要、平台未完成事项见当前基准及 <mention url="https://app.notion.com/p/41090dbc56c38165b15ff3fcd3d94bfa">俄罗斯方块｜项目计划、实施与算法基准</mention>。

## BL-2026-11-07-02 检查证据（历史）

BL-2026-11-07-02：构建、检查、全量 592/592 测试及预览生成通过，50 模块/6 游戏。日志 <code>数独/artifacts/gomoku-difficulty-full-tests.log</code>；工具验收和桌面选点测量在 <code>数独/artifacts/gomoku-difficulty/acceptance.json</code>、<code>ai-benchmark.json</code>。150 文件源码摘要及未完成边界见当前基准与 <mention url="https://app.notion.com/p/41090dbc56c381ee9df9ec35ef0cafc6">五子棋｜项目计划、实施与算法基准</mention>。

## BL-2026-11-07-01 检查证据（历史）

BL-2026-11-07-01：仓库根执行 <code>node 数独/scripts/build-minigame.mjs</code>、<code>node 数独/scripts/build-minigame.mjs --check</code>、<code>node --test --test-reporter=tap 数独/tests/*.test.mjs</code>、<code>node 数独/scripts/build-minigame-preview.mjs</code> 均通过。560/560 测试、45 文件、50 模块/6 游戏、148 文件快照及工具验收边界见本页当前基准与 <mention url="https://app.notion.com/p/41090dbc56c381ee9df9ec35ef0cafc6">五子棋｜项目计划、实施与算法基准</mention>。完整日志 <code>数独/artifacts/gomoku-full-tests.log</code>，交互记录 <code>数独/artifacts/gomoku/acceptance.json</code>。

## BL-2026-10-19-02 检查证据（历史）

核验阶段 BL-2026-10-19-02，日期2026-10-19（Asia/Shanghai）；自动检查开始时点21:58:28。

- <code>node scripts/build-minigame.mjs</code>、<code>node scripts/build-minigame.mjs --check</code> 和预览生成通过：46原生模块、5游戏接口，原数独、移植核心及音乐来源检查继续通过。
- <code>node --test tests/*.test.mjs</code> 全量450/450通过，38文件，0失败/跳过；本阶段新增扫雷34项。日志 <code>数独/artifacts/minesweeper-tests.log</code>。
- 135文件验证前后稳定，SHA256 <code>88fd84ad5a8115eda9e030016c30dfb63b896b32a2425d85a9886a74f3afbbb1</code>。完整快照 <code>数独/docs/notion-baseline/source-snapshot-minesweeper.json</code> 和逐文件清单仅保留本机，Notion保存摘要。
- 浏览器验收大厅第二页、首步连开、插旗、刷新恢复暂停、换难度取消/确认、旋转暂停和继续，覆盖375×750、320×568、844×390；3张验收截图见 <mention url="https://app.notion.com/p/3fe90dbc56c3816b80a7e00248814192">扫雷｜项目计划、实施与算法基准</mention>，本地记录 <code>数独/artifacts/minesweeper/browser-qa.json</code>。
- <code>git -c core.autocrlf=false diff --check</code> 和源码快照复核通过。工作区未提交；微信工具、iOS/Android真机、真实分享、上传、审核与发布未执行。短屏高级棋格较小，当前无缩放；普通随机棋盘可能需要猜测。

本阶段记录见 <mention url="https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf">阶段更新记录</mention>。历史基准、附件和已有游戏资料保留。

## 上一阶段 BL-2026-10-19-01 检查证据（历史）

核验时点：2026-10-19 21:48:58（Asia/Shanghai）；阶段 BL-2026-10-19-01。

- 在新路径执行构建、检查和预览生成；43原生模块、4游戏接口、12旧同题、6日期边界、259逻辑题、74专项卡与音乐来源检查通过。
- 全量自动测试416/416通过，35文件，0失败/跳过。日志：<code>数独/artifacts/relocation-final-tests.log</code>。
- 网页、预览、JS/CSS、48秒WAV及路径访问边界15项HTTP检查通过；不属于微信工具或手机验收。记录：<code>数独/artifacts/relocation-http.json</code>。
- 迁移前383文件均映射存在，运行代码、维护源、AppID/私有配置和WAV逐字节保持；Git HEAD仍为37e88c91cc258e9474d806e329181d6547aa6c75，origin仓库不变，工作区包含尚未提交的功能。
- 当前源码快照129文件：<code>数独/docs/notion-baseline/source-snapshot-relocation.json</code>；SHA256 <code>9e9d46866fec70fe24dfc034013d28061f7ea10b83c4dc9165c9e69ebaf96034</code>。音乐WAV原SHA256不变，生成器定位改变后已重建来源清单。
- 旧 <code>D:/数独</code> 已无文件，空目录仍被占用；隐藏的一次性清理程序仅在目录为空且占用释放时删除，若出现新文件会停止。状态见 <code>数独/artifacts/cleanup-old-directory.status.json</code>。
- 微信工具需重新导入新工程，Codex项目路径需改到新外层目录。微信工具、真机、真实分享和上传审核发布均未执行。

在外层运行：

```bash
node 数独/scripts/build-minigame.mjs --check
node --test 数独/tests/*.test.mjs
node 数独/scripts/build-minigame-preview.mjs
node 数独/scripts/serve.mjs
```

### 上一阶段 BL-2026-10-18-04 音乐验证记录（历史）

以下保留原检查时点、路径与命令；当前目录及命令以前文为准。

核验时点：2026-10-18 23:30:57（Asia/Shanghai）；本次阶段 BL-2026-10-18-04，详见 <mention url="https://app.notion.com/p/3fd90dbc56c381929c94da17298aeecf">阶段更新记录</mention>。

- 构建检查：43 原生模块、4 游戏接口；12 旧同题、6 日期边界、259 逻辑题、74 专项卡、移植核心与 48 秒音乐来源哈希通过。
- 全量自动测试：416/416 通过，0 失败/跳过，35 文件；新增音乐平台/宿主/游戏状态 33 项。
- 123 个运行/维护/资源/配置/测试文件前后哈希一致：d62bac40a42e2ff706743a45b5af46f33f7f683eb1c196cc24af61ecab87a3d0。
- 快照 docs/notion-baseline/source-snapshot-background-music.json；日志 artifacts/background-music-tests.log。工作区未提交，HEAD 不等于完整实现。
- 浏览器实际音频：数独与 Zuma duration=48、loop=true、paused=false，关闭/暂停/大厅 paused=true、续播位置保留，关闭偏好刷新保留；320×568 开关可见，截图 artifacts/background-music/。
- 音乐素材逐字节复现通过；默认音量 0.4，顶部开关独立持久化，四款游戏共用一个播放器。
- 微信工具、真机听感/静音/循环间隙/系统中断、真实分享与上传审核发布仍待验收。

当前源码快照对应 BL-2026-10-18-04；source-snapshot-sudoku-interaction.json、source-snapshot-2048.json、source-snapshot.json 分别为历史 BL-03/02/01，保留各自真实核验结果。

```bash
node scripts/build-minigame.mjs --check
node --test --test-reporter=spec tests/*.test.mjs
node scripts/build-minigame-preview.mjs
node scripts/serve.mjs
```

本地默认预览地址是 [本地小游戏预览](http://127.0.0.1:4173/preview/)。本阶段调试另使用过 4175 端口。<code>localhost</code> 只在运行服务的机器可访问，不能作为微信正式游戏入口。

## 当前交付边界与下一步

- 优先完成开发工具和真机验收：安全区、横竖屏、后台恢复、持久存档、双人多指触控、真实分享及性能。
- 将当前未提交工作区整理为可追踪的里程碑版本；本次文档整理不自动提交、推送、上传或发布。
- 在真实体验数据基础上调整 Zuma 高速难度、黄金矿工 TNT 风险和数独教学曲线，调整时保存参数前后对照。
- 共享背景音乐已实现并可开关；操作音效、云同步、联网榜单、广告仍为待评估项，不作排期承诺。

## 后续维护方式

重大更新完成并验证后，先更新受影响游戏子页及必要的总体架构，再追加阶段记录，最后更新本页的基准编号、时间、测试证据和风险。已明确的用户要求由仓库 <code>AGENTS.md</code> 和更新规范共同承接；不覆盖历史，也不把未完成计划写成结果。

## 源码与交付物索引

- 产品与导入：<code>README.md</code>、<code>微信小程序/README.md</code>、微信小程序/project.config.json。
- 架构与模块骨架：<code>数独/docs/architecture.md</code>、数独/templates/minigame/index.cjs。
- 数独评级：<code>数独/docs/sudoku-rating.md</code>；实现和训练源见数独子页。
- Zuma 参数：<code>数独/docs/zuma-levels.md</code>。
- 2048 设计：<code>数独/docs/2048.md</code>；计划、算法与界面截图见 <mention url="https://app.notion.com/p/3fd90dbc56c3812b9402ddc514f744a8">2048｜项目计划、实施与算法基准</mention>。
- 扫雷设计：<code>数独/docs/minesweeper.md</code>；规则、参数、迁移及3张截图见 <mention url="https://app.notion.com/p/3fe90dbc56c3816b80a7e00248814192">扫雷｜项目计划、实施与算法基准</mention>。
- TNT 布置：<code>数独/docs/gold-miner-barrels.md</code>。
- 构建与测试：数独/scripts/、数独/tests/；生成源及来源清单在 微信小程序/vendor/。
- 本地压缩包与截图：数独/artifacts/。该目录被 Git 忽略；已有 ZIP 的修改时间不等于版本一致性，使用前应核对本次源码快照。
- 本次知识库正文的本地镜像：数独/docs/notion-baseline/。Notion 页面是便于阅读的资料入口，源码及实际验证结果是实现证据。

## 历史基准 BL-2026-10-18-01 的附件

以下是首次基准 BL-2026-10-18-01 的历史快照，包含当时的总览、架构、三个游戏子页、路线、记录和规范；不包含随后新增的 2048，不代表当前最新实现。

<file source="notion-file-block://e6b9b65d-fb36-40ea-8653-af8c6438b83e/e134668f-d9de-425a-a115-6df5dd8e4a10?space_id=c88ab3a0-1e61-4fff-b6b1-6c7f388dc9e4&name=games-between-baseline-BL-2026-10-18-01.md" />

源码快照包含核验时间、工作区参照、构建/测试结果，以及 107 个运行/维护/配置/测试文件的 SHA256，用于比较后续更新。

<file source="notion-file-block://d92d39c2-05a6-4684-9891-4123fd5cc021/c6a7bb10-760c-4d79-a676-b07d02979141?space_id=c88ab3a0-1e61-4fff-b6b1-6c7f388dc9e4&name=source-snapshot-BL-2026-10-18-01.json" />

## 历史阶段 BL-2026-10-18-02 附件

2048 计划与算法见 <mention url="https://app.notion.com/p/3fd90dbc56c3812b9402ddc514f744a8">2048｜项目计划、实施与算法基准</mention>。下列源码快照对应 362 项测试和 113 文件稳定核验；不替换或删除历史附件。

<file source="notion-file-block://72e12ff4-8653-4701-8a07-ecc8aea00200/b76374e6-a485-4288-b675-e62e59e7cd58?space_id=c88ab3a0-1e61-4fff-b6b1-6c7f388dc9e4&name=source-snapshot-BL-2026-10-18-02.json" />

## BL-2026-10-18-02 资料补充（历史）

2026-10-18 22:57:23（Asia/Shanghai）复核：113 文件与 BL-2026-10-18-02 快照逐项一致，本轮仅更新资料，沿用该基准。已补上可直接查看的 2048 主界面、大厅、窄屏与横屏截图，详见 <mention url="https://app.notion.com/p/3fd90dbc56c3812b9402ddc514f744a8">2048｜项目计划、实施与算法基准</mention>。本轮未修改游戏代码；测试与平台验收仍按各自真实核验时间记录。

### 本轮项目正文备份

包含总览、架构、数独、Zuma、黄金矿工、2048、实施路线、阶段记录和更新流程共九页正文。对应 BL-2026-10-18-02；保留原有附件。四张界面图片已放在 2048 页面，备份中的图片引用仍指向 Notion 文件。本附件为技术文档，不是源码包。

<file source="notion-file-block://ed068528-d5c9-4aee-89a6-4f3d38240cc5/ec816467-25a8-4763-8ddb-51061f653df7?space_id=c88ab3a0-1e61-4fff-b6b1-6c7f388dc9e4&name=games-between-docs-BL-2026-10-18-02-refreshed.md" />

## 同步收尾的源码边界

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

收尾差异明细附件（只记录核对时点的源码差异，不表示测试通过）：

<file source="notion-file-block://9a566bce-2628-4e61-831d-d87ffab3fd9f/dd52a309-c7c4-4e7e-afcc-6324adbdd08d?space_id=c88ab3a0-1e61-4fff-b6b1-6c7f388dc9e4&name=parallel-source-check-2026-10-18.json" />

<page url="https://app.notion.com/p/3fe90dbc56c3816b80a7e00248814192">
扫雷｜项目计划、实施与算法基准
</page>

### 扫雷阶段收尾的并行工作区边界

2026-10-19 22:17:09（Asia/Shanghai）重新核验当前合并态：另一会话随后替换公共音乐、预览、资源服务及构建检查，扫雷三个维护源未变。过程中先遇到音乐清单未完成和MP3首帧头校验失败，该会话完成产物并修复后，当前 <code>node scripts/build-minigame.mjs --check</code> 通过：46原生模块、5游戏接口、2首用户提供音乐来源、工程原始文件估算3.49 MiB。

<code>node --test tests/*.test.mjs</code> 最新全量465/465通过，0失败/跳过；较本扫雷原基准450多出的15项来自并行音乐相关更新，不计作扫雷新增用例。137文件在此次复核前后稳定，SHA256 <code>9d2dc3fb7e13beeadc12984bf691e2627c1ad2518d36af72ff4566663cb4468c</code>。

保留原 <code>source-snapshot-minesweeper.json</code> 和 <code>minesweeper-tests.log</code> 作为450项扫雷基准；最新合并态另存 <code>source-snapshot-minesweeper-final.json</code>、<code>minesweeper-final-tests.log</code>、<code>minesweeper-final-build.log</code>，均在数独目录对应docs/notion-baseline或artifacts下。完整文件清单仍留本机。扫雷截图表示之前浏览器验收时点；没有把新音乐的实际听感、微信工具或真机列为本聊天已验证。

<page url="https://app.notion.com/p/41090dbc56c381ee9df9ec35ef0cafc6">
五子棋｜项目计划、实施与算法基准
</page>

<page url="https://app.notion.com/p/41090dbc56c38165b15ff3fcd3d94bfa">
俄罗斯方块｜项目计划、实施与算法基准
</page>

<page url="https://app.notion.com/p/41090dbc56c381aaac10d33f781ec276">
华容道｜项目计划、实施与算法基准
</page>
