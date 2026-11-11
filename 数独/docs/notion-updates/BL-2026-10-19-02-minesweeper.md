# 扫雷阶段 Notion 同步记录（已同步）

扫雷独立子页、总览、架构、路线及阶段记录已写入并逐页回读。9个直属子页和5份历史附件保留，扫雷3张图片可回读。

扫雷页面：https://app.notion.com/p/3fe90dbc56c3816b80a7e00248814192
项目主页：https://app.notion.com/p/3fd90dbc56c3804385eec17277837dec

完整快照附件上传及阶段摘要第一次写入曾被自动审批拒绝；用户随后明确允许将草稿中的实现说明、源码相对路径、存档键、构建测试结果和快照摘要写入既有项目。经授权后完成摘要同步，完整逐文件清单仍保留本机，未重试上传。

## BL-2026-10-19-02｜扫雷作为第五个游戏接入
日期：<mention-date start="2026-10-19"/>（Asia/Shanghai）。用户要求为微信小游戏新增扫雷，新游戏接入触发阶段汇总。工作区 `D:/怀旧小游戏`，源码未提交。
### 最终行为与关键决策
新增 <mention-page url="https://app.notion.com/p/3fe90dbc56c3816b80a7e00248814192">扫雷｜项目计划、实施与算法基准</mention-page>；大厅第二页可进入。初级9列9行10雷，中级9列12行20雷，高级12列16行40雷；显式翻开/插旗、空白连开、点击数字等旗数排查、胜负结算、停表、确认重开/换难度、各档最佳与入口分享。
首次翻开时用 seed+firstIndex 延迟布雷，首格及八邻域无雷。Mulberry32、部分 Fisher–Yates 无放回选雷，队列展开空白区；普通随机棋盘可能需要猜测。点击数字时错旗仍可触雷，全非雷格翻开才获胜。
### 数据、兼容与维护源
独立存档键 `games-between:minesweeper:save:v1`，round和外层version均为1。一个当前棋盘与三档独立最佳，切换难度确认后覆盖棋盘；校验版本/尺寸/状态/数组/用时及重算雷图。超过控制器上限的计时快照重建，避免续局倒退；合法最佳独立保留。冷恢复、大厅、后台与旋屏保持暂停，手动继续。迟到弹窗确认在导航/恢复/销毁后失效。
新增 `微信小程序/src/games/minesweeper/` 的 engine/index/renderer 三个维护源，注册表增加一项；未增加宿主/平台/大厅专属分支，其他游戏key/旧分享/AppID/私有配置不改。沿用统一musicActive，首步前、暂停和结算不播放。
### 真实验证与交付
- 数独目录内 `node scripts/build-minigame.mjs`、`node scripts/build-minigame.mjs --check`、`node scripts/build-minigame-preview.mjs` 通过；46原生模块、5游戏接口，原维护源与音乐哈希通过。
- `node --test tests/*.test.mjs`：450/450通过，38文件，0失败/跳过。新增扫雷34项；规则17、布局6、控制器/宿主11。最初33专项通过后补上超限计时回归，全量含最终34项。日志 `数独/artifacts/minesweeper-tests.log`。
- 2026-10-19 21:58:28（Asia/Shanghai）135文件源码快照，验证前后稳定，SHA256 `88fd84ad5a8115eda9e030016c30dfb63b896b32a2425d85a9886a74f3afbbb1`；本机文件 `数独/docs/notion-baseline/source-snapshot-minesweeper.json`。完整内部文件清单留本机，远端仅保存摘要。
- 浏览器实际检查大厅进入、首步连开、插旗、刷新恢复暂停、换难度取消/确认、旋屏暂停继续、375×750、320×568和844×390；截图3张附扫雷页，本机4图及 `browser-qa.json` 在 `数独/artifacts/minesweeper/`。
- `git -c core.autocrlf=false diff --check` 和 `node artifacts/snapshot-minesweeper.mjs --check` 通过。README、架构、背景音乐说明与 `数独/docs/minesweeper.md` 更新。
### 风险、未完成与下一步
确定性480个首步安全样本和72个通关样本不等于所有种子/玩家可成功。短屏高级棋格较小，当前无缩放；无猜生成、长按插旗、联网榜单、云同步与同题分享未实现。微信工具、iOS/Android真机、真实分享与音频听感待验收；未提交、推送、上传、审核或发布。下一步先验证真机可读性、误触和后台恢复。

### 扫雷阶段收尾的并行工作区边界
2026-10-19 22:17:09（Asia/Shanghai）重新核验当前合并态：另一会话随后替换公共音乐、预览、资源服务及构建检查，扫雷三个维护源未变。过程中先遇到音乐清单未完成和MP3首帧头校验失败，该会话完成产物并修复后，当前 `node scripts/build-minigame.mjs --check` 通过：46原生模块、5游戏接口、2首用户提供音乐来源、工程原始文件估算3.49 MiB。
`node --test tests/*.test.mjs` 最新全量465/465通过，0失败/跳过；较本扫雷原基准450多出的15项来自并行音乐相关更新，不计作扫雷新增用例。137文件在此次复核前后稳定，SHA256 `9d2dc3fb7e13beeadc12984bf691e2627c1ad2518d36af72ff4566663cb4468c`。
保留原 `source-snapshot-minesweeper.json` 和 `minesweeper-tests.log` 作为450项扫雷基准；最新合并态另存 `source-snapshot-minesweeper-final.json`、`minesweeper-final-tests.log`、`minesweeper-final-build.log`，均在数独目录对应docs/notion-baseline或artifacts下。完整文件清单仍留本机。扫雷截图表示之前浏览器验收时点；没有把新音乐的实际听感、微信工具或真机列为本聊天已验证。
