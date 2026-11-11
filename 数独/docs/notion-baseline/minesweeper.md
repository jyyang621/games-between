# 💣 扫雷｜项目计划、实施与算法基准

所属项目：<mention-page url="https://app.notion.com/p/3fd90dbc56c3804385eec17277837dec">微信小程序——怀旧小游戏</mention-page>。基准 BL-2026-10-19-02；日期 <mention-date start="2026-10-19"/>，Asia/Shanghai。
## 当前配乐｜BL-2026-10-19-03
本节替代历史《庭间微光》单曲运行说明。现有五款游戏共用用户目录 `D:/怀旧小游戏/音频` 提供的《平沙落雁》（李祥霆）和《阳关三叠》（传奇乐坊），按第一首→第二首→第一首顺序循环，保留单播放器、音量0.4、音乐开关及原暂停/后台/弹窗/音频中断门控；游戏存档和音乐偏好key不变。
原MP3文件保持不变。两首完整运行副本在 `微信小程序/assets/audio/`，共2,512,595字节，32kbps/22.05kHz/单声道；时长377.809秒、250.279秒。来源及SHA256在 `playlist.source.json`；旧WAV与来源清单归档到本机 `数独/artifacts/audio-archive/`，不再进入运行包。
2026-10-19 22:19:45（Asia/Shanghai）核验：465/465全量测试、46模块/5游戏接口、12项资源与访问边界检查通过；工程文件估算3.49MiB，这是本项目的原始文件预算检查，不等于平台上传包测量。新曲及切曲的真机听感、循环衔接和设备静音仍待验收，未上传发布。维护说明 `数独/docs/background-music.md`，源码快照137文件 `数独/docs/notion-baseline/source-snapshot-user-music.json`，指纹 `9d2dc3fb7e13beeadc12984bf691e2627c1ad2518d36af72ff4566663cb4468c`。
## 用户目标与当前实现
为微信小游戏合集新增扫雷。扫雷以第五个独立模块接入大厅第二页；使用同一宿主、Canvas、安全区、共享音乐和浏览器预览，不向宿主加入扫雷分支。
- 已实现：初/中/高级，翻开与插旗切换，空白连开，点击数字快速排查，触雷与排雷成功，暂停/继续，确认重开/换难度，自动存档，各难度最佳用时，入口分享。
- 首次翻开才布雷并启动计时。首次格及其周围八邻域无雷，开局为零；普通随机棋盘仍可能需要猜测，不是无猜模式。
- 原地切换翻开/插旗；插旗后再点同格取消。翻开模式不会打开旗格。所有非雷格翻开即胜，插旗本身不判正确，也不要求全部雷插旗。
## 难度与参数
\<table header-row="true"\>\<tr\>\<td\>难度\</td\>\<td\>列 × 行\</td\>\<td\>雷数\</td\>\</tr\>\<tr\>\<td\>初级 beginner\</td\>\<td\>9 × 9\</td\>\<td\>10\</td\>\</tr\>\<tr\>\<td\>中级 intermediate\</td\>\<td\>9 × 12\</td\>\<td\>20\</td\>\</tr\>\<tr\>\<td\>高级 expert\</td\>\<td\>12 × 16\</td\>\<td\>40\</td\>\</tr\>\</table\>
</table>
\</table\>
\</table\>
\</table\>
上述尺寸针对手机竖屏；不是传统桌面高级 30×16 参数。每档分别保存最佳毫秒用时，但只有一个当前棋盘；换难度确认后替换当前棋盘，保留最佳。未开始的空棋盘可直接切换。
## 规则与算法
- 布雷：uint32 seed 和 firstIndex 共同决定雷图。Mulberry32 产生确定性随机数，排除首次格及邻格后，用部分 Fisher–Yates 从候选格中无放回选出地雷，无重试布雷循环。
- 数字按八邻域计数，不跨行绕边。迭代队列展开连通零区及数字边界，跳过旗格，避免递归栈。
- 点击已翻开数字，仅在周围旗数等于数字时打开其他相邻格；零格在旗取消后也可重新连开。错误旗仍可能使未标出的雷触发失败。
- 触雷记录 exploded，结束后绘出全部雷及错旗；结束不再接受棋盘操作。胜利记录本难度较小用时，停表和音乐。
- 规则核心为纯 CommonJS，不访问 wx/DOM；控制器负责计时与服务，渲染器负责布局和点击区域。
## 状态、存档与兼容
注册 ID：`minesweeper`；分享 query：`g=minesweeper`，只分享入口，不替换接收方本机棋盘。
独立键：`games-between:minesweeper:save:v1`。外层 version=1，保存 round、bests、mode；round 自身 version=1，含 difficulty、尺寸、mineCount、seed、firstIndex、雷/翻开/旗数组、started/status、elapsedMs、exploded。
恢复校验版本、档位尺寸/雷数、布尔数组、状态关系及 seed+firstIndex 重算雷图的一致性；损坏或不兼容棋盘重建，合法各档最佳独立保留。控制器拒绝超过 31,536,000,000 毫秒的存档用时，避免续局时间倒退。
只有首次实际翻开后计时，ready 插旗不计时；暂停、大厅、后台、原生弹窗和旋转暂停时停表。冷恢复及返回后手动继续。重开/换难度的迟到确认在导航、恢复或销毁后失效。存储失败不阻断对局。
本次没有修改其他游戏键、旧分享路由、维护源生成规则、AppID、私有配置或原网页数独。新增纯 JS 模块不需生成钩子；宿主、平台和大厅代码未改。
## 验证与交付
2026-10-19 21:58:28（Asia/Shanghai）全量 450/450 测试通过，38 文件，0 失败/跳过；新增扫雷 34 项（规则17、布局6、控制器/宿主11）。构建检查通过：46 原生模块、5 游戏接口，以及既有数独、移植核心和音乐来源检查。
实际命令在 `D:/怀旧小游戏/数独`：
```bash
node scripts/build-minigame.mjs
node scripts/build-minigame.mjs --check
node --test tests/minigame-minesweeper-engine.test.mjs tests/minigame-minesweeper-renderer.test.mjs tests/minigame-minesweeper.test.mjs
node --test tests/*.test.mjs
node scripts/build-minigame-preview.mjs
node scripts/serve.mjs
node artifacts/snapshot-minesweeper.mjs --check
git -c core.autocrlf=false diff --check
```
专项最初33项通过后，审查补上超限存档用时回归1项；最终全量含34项。规则覆盖480个首步安全样本、72个确定性通关样本；样本不代表所有随机种子或所有玩家可成功。
135 个运行/维护/资源/配置/测试文件前后哈希稳定：`88fd84ad5a8115eda9e030016c30dfb63b896b32a2425d85a9886a74f3afbbb1`。快照 `数独/docs/notion-baseline/source-snapshot-minesweeper.json`；日志 `数独/artifacts/minesweeper-tests.log`。
浏览器实际检查大厅入口、首步连开、插旗、刷新恢复、难度切换取消/确认、旋转暂停和继续；375×750、320×568 高级、844×390 横屏。记录和截图在 `数独/artifacts/minesweeper/`。浏览器证据不等于微信真机验收。
维护入口：`微信小程序/src/games/minesweeper/engine.js`、`index.js`、`renderer.js`；注册表 `微信小程序/src/registry.js`；设计 `数独/docs/minesweeper.md`。
## 已知限制与下一步
- 短屏高级棋格较小，当前无棋盘缩放或拖移；优先在手机验证误触、可读性与难度参数，再决定是否增加放大浏览。
- 未实现无猜生成、长按插旗、联网榜单、云存档、同题种子分享或撤销触雷。
- 微信开发者工具、iOS/Android 真机、安全区、原生分享和音频实际体验待验收。尚未提交、推送、上传、审核或发布。
## 界面验收截图
375×750 手机竖屏，首次连开后的初级棋盘
![](notion-file-block://81682918-4d5b-4360-8c54-4982f562526f/973023ef-523b-411a-bc83-84f9918a3e96?space_id=c88ab3a0-1e61-4fff-b6b1-6c7f388dc9e4&name=minesweeper-phone.jpg)
320×568 窄屏高级棋盘；完整显示，棋格较小
![](notion-file-block://2de62c64-a6bd-47de-974e-1e370ef82d52/c3c08f16-9f5c-494e-bd07-4aaa39a2a5ce?space_id=c88ab3a0-1e61-4fff-b6b1-6c7f388dc9e4&name=minesweeper-expert-small.jpg)
844×390 横屏高级棋盘与侧边操作区
![](notion-file-block://9c1e990d-9d92-441d-9921-f11b67268865/24431422-e9f7-476c-a8aa-e5aa06eee21d?space_id=c88ab3a0-1e61-4fff-b6b1-6c7f388dc9e4&name=minesweeper-landscape.jpg)
完整源码快照和逐文件哈希清单仅保留本机；本页保存实现与验证摘要。
### 扫雷阶段收尾的并行工作区边界
2026-10-19 22:17:09（Asia/Shanghai）重新核验当前合并态：另一会话随后替换公共音乐、预览、资源服务及构建检查，扫雷三个维护源未变。过程中先遇到音乐清单未完成和MP3首帧头校验失败，该会话完成产物并修复后，当前 `node scripts/build-minigame.mjs --check` 通过：46原生模块、5游戏接口、2首用户提供音乐来源、工程原始文件估算3.49 MiB。
`node --test tests/*.test.mjs` 最新全量465/465通过，0失败/跳过；较本扫雷原基准450多出的15项来自并行音乐相关更新，不计作扫雷新增用例。137文件在此次复核前后稳定，SHA256 `9d2dc3fb7e13beeadc12984bf691e2627c1ad2518d36af72ff4566663cb4468c`。
保留原 `source-snapshot-minesweeper.json` 和 `minesweeper-tests.log` 作为450项扫雷基准；最新合并态另存 `source-snapshot-minesweeper-final.json`、`minesweeper-final-tests.log`、`minesweeper-final-build.log`，均在数独目录对应docs/notion-baseline或artifacts下。完整文件清单仍留本机。扫雷截图表示之前浏览器验收时点；没有把新音乐的实际听感、微信工具或真机列为本聊天已验证。
