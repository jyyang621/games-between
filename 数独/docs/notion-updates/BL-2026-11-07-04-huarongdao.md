# BL-2026-11-07-04｜华容道作为第八款游戏接入

日期2026-11-07，Asia/Shanghai。用户要求新增华容道，本地实现、自动检查与微信工具实操完成；工作区未提交。详情见 [华容道｜项目计划、实施与算法基准](https://app.notion.com/p/41090dbc56c381aaac10d33f781ec276)。

## 最终行为与关键决策

经典曹操脱困4×5，10块占18格，曹操2×2移到左上角x1/y3的底中央出口即胜，不需额外出界。只能四向平移不旋转，每移动1格计1步，拖动多格逐格计步，悔一步只退最后一格，终局也可悔棋。

新增第八款 `huarongdao`，大厅第三页与俄罗斯方块同页。默认入门，另有进阶、经典·横刀立马。棋块点选＋方向按钮或直线拖动；主轴锁定避免斜向误移，多指取消拖动。进行中有保留移动历史时重开／换关确认，取消保留棋盘并暂停；关卡菜单取消或选同关恢复之前暂停状态。

首次合法移动开始计时及音乐，`started`随存档保存，悔棋回0步后继续计时，只有重开重置。暂停、后台、返回大厅、分享、旋屏与重启后的未结束局需手动继续；终局停止计时。胜利遮罩保留悔一步。

## 开局、算法与解证据

三固定开局ID为beginner／intermediate／classic。入门、进阶取经典116单位格步最短路径第104／76步局面，再分别独立BFS验证为最短12／40步；经典最短116步，分别展开94／2065／24026个等价状态。原创求解按单位格移动等权，去重键合并同尺寸非曹操块，输出实际棋块ID供运行引擎重放验证。结论仅适用于三固定布局与本项目计步，不能与81步等其他口径比较，不表示玩家难度评级。

经典几何参考核对 [GNOME官方Klotski Red Donkey](https://raw.githubusercontent.com/GNOME/gnome-klotski/master/src/klotski-window.vala)，没有复制第三方算法。离线求解脚本／证据 `数独/artifacts/huarongdao/solve-levels.mjs`、`solutions.json`，解路径fixture `数独/tests/fixtures/huarongdao-solutions.json`。运行时不加载求解器，没有实时提示或自动解题。

`微信小程序/src/games/huarongdao/{levels,engine,index,renderer}.js` 维护固定开局、规则、控制和Canvas，仅新增注册工厂，无宿主、平台或公共契约专属分支。

## 数据、兼容与迁移

新键 `games-between:huarongdao:save:v1`、version1，保存单一当前局round／elapsedMs／started和每关最佳步数best。最佳只记最少步数，不记最快用时。合法移动／撤销／新开／暂停和宿主save保存，进行中另每5秒有效时间保存。

恢复从固定初盘逐步重放最多10000移动历史，并比对棋块顺序、ID、标签、尺寸、坐标和终局；非法历史、终局后追加移动或不一致快照拒绝。损坏当前局回退入门，合法每关最佳保留。达到10000步上限停止新增移动但仍可悔棋／重开。旧存档key、旧分享和私有工具设置保留，新入口分享仅 `g=huarongdao`，不覆盖接收方棋局。

## 实际验证与交付

工作目录为 `数独/`，执行：

```sh
node scripts/build-minigame.mjs
node scripts/build-minigame.mjs --check
node scripts/build-minigame-preview.mjs
node artifacts/huarongdao/verify-snapshot.mjs
node --test tests/*.test.mjs
node artifacts/huarongdao/verify-snapshot.mjs --check
```

全量 **684/684**，53测试文件，新增44项（引擎16、控制器17、布局11），0失败／跳过；57模块／8游戏接口、原核心和两首配乐来源哈希通过，工程原始文件估算3.60MiB，不等于上传包实测。日志 `数独/artifacts/huarongdao-full-tests.log`、`huarongdao-build-check.log`。

2026-11-07 01:59:07（Asia/Shanghai）164源码文件，摘要 `f700ff2737861098f31200a2a7ecbad5c34fc2a547deea20c8731544fa8a1d41`，测试和微信工具验收后快照核对stable，无源码漂移。完整快照仅在本机 `数独/docs/notion-baseline/source-snapshot-huarongdao.json`。

四尺寸390×844、320×568、844×390、480×320，进行中／暂停／胜利共12张生产Canvas离屏图已目视；胜利遮罩悔一步已核对。图片和 `canvas-verification.json` 在 `数独/artifacts/huarongdao/`，不是手机截图。Windows 微信开发者工具 Stable 2.02.2608080、基础库 3.17.4、iPhone 12/13 模拟器实际验证：大厅第三页进入默认入门；拖动兵二右移1步、点选兵三并点右移到2步、悔棋回1步且位置恢复。3步／0:38暂停后普通重新编译，大厅继续入口恢复，打开仍暂停；手动继续后3步／0:38及布局准确保持。随后真实拖动完成入门，同次拖动2格分别从4→6、6→8逐格计数，曹操到出口12步成功脱困，本关最佳12，结算用时1:16停止，显示再来／换一关／悔一步。记录 `数独/artifacts/huarongdao/acceptance.json`。 通关后点击遮罩“悔一步”，回到11步进行中，本关最佳仍12；点击关卡原生菜单并选“经典·横刀立马”，出现替换进度确认，点击“开始新局”进入经典初盘0步／0:00。本轮没有实际点击换关取消，该行为仅由自动化测试覆盖。原生弹窗期间工具自身app.asar出现worker path empty日志，弹窗与确认换关正常，没有华容道源码栈，列为工具观察待真机复核。

## 边界与下一步

本轮未执行浏览器真实交互，不把上一阶段访问失败作为本轮尝试；手机真机、真实分享与长局性能未执行，未提交、推送、上传、审核或发布。没有随机出题、实时提示／自动解题、联网或云存档。下一步优先小棋块触控、直线拖动／逐格撤销、计时与零步续局、三关切换确认、短屏出口和前后台／旋屏／重启恢复。无排期承诺。

本阶段完整源码清单、解证据与图片保留本机，不新增远端附件；其余游戏页面和历史材料保留。


## Notion同步核对

总览、华容道新独立页、架构目录、路线与阶段记录共5页已写入并回读。原11个直属子页及5份附件全部保留，新增后12个子页，无新增附件；父层级与内部链接正确。5份本地镜像、notion-links.json和notion-sync.md已更新，核对记录 `数独/docs/notion-baseline/documentation-huarongdao.json`。本阶段根目录 `git diff --check` 通过，仅有既有换行警告。
