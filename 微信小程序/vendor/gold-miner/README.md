# 黄金矿工来源与生成

`original/` 保存 `D:\黄金矿工\src` 的 engine、levels、modes、storage、viewport、renderer 原始 TypeScript（本地项目 v1.3.0）。原代码包含 40 个固定关卡、无尽生成、双人共享矿区、移动实体与 TNT、六种独立存档。

小游戏运行入口在 `../../src/games/gold-miner/index.js`，生成的 CommonJS 位于其 `core/`。`original/` 保持原始副本；本目录的 `levels.ts`、`engine.ts`、`renderer.ts` 是维护版本，用于矿群间的 TNT 布置、统一爆炸范围与可见警戒圈。生成器将 storage 改为调用注入的 read/write、将 renderer 改为在宿主提供的 Canvas 上绘图，并补上兼容的圆角路径。未使用 DOM、浏览器存储或 wx；无第三方运行时依赖。为减少每帧绘制，矿区装饰纹理数量上限为 120。原 Web Audio 尚未移植，当前小游戏为静音版。

在仓库根目录 `D:\怀旧小游戏` 打开终端，有 TypeScript 开发依赖时重新生成：

```powershell
node 微信小程序/vendor/gold-miner/generate.mjs --typescript D:/黄金矿工/node_modules/typescript/lib/typescript.js
```

无需开发依赖即可核验 SHA256 清单：

```powershell
node 微信小程序/vendor/gold-miner/generate.mjs --check
```

存档沿用原六份 key，不会访问或写入外部项目。进程重启从关卡开始时恢复；游戏内暂停保留即时矿石、抓钩和倒计时，后台及大厅离开都暂停。

TNT 的 `BARREL_BLAST_RADIUS` 在维护版 `levels.ts` 定义，`engine.ts` 复用并导出；`barrelBlastBounds()` 给提示和动画提供与伤害计算一致的横竖屏范围。炸毁的物件不计收入，已经钩住的物件不受波及，邻桶仍可连锁。清单同时校验原始副本、维护源与生成产物，修改后请重新生成，不能只改 `core/`。关卡布置与回归检查见 [TNT 设计说明](../../../数独/docs/gold-miner-barrels.md)。

矿区横竖屏形状变化时，Canvas 适配器清理旧坐标下的瞬时爆炸圈、粒子和浮字；矿石和抓钩继续由引擎转换并保留。仅显示缩放变化不会打断当前动画。
