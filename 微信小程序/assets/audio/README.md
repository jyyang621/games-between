# 小游戏背景音乐资源

当前配乐来自用户提供的两份 MP3，按《平沙落雁》《阳关三叠》的顺序轮播，第二首结束后回到第一首：

| 曲目 | 原始文件（外层 `音频/`） | 运行副本 |
| --- | --- | --- |
| 平沙落雁 | `平沙落雁-李祥霆.mp3` | `pingsha-luoyan.mp3` |
| 阳关三叠 | `阳关三叠.埙.中阮二重奏.-传奇乐坊.mp3` | `yangguan-sandie.mp3` |

原始文件保留在 `D:\怀旧小游戏\音频\`。运行副本由同级数独工作目录中的 `scripts/prepare-background-music.mjs` 转码生成，游戏只读取本目录中的副本，不依赖外层音频目录或编码器。默认播放器音量为 0.4，音量及切曲衔接仍需在微信开发者工具和手机验收。

两份运行副本分别为 377.809 秒／1,511,357 字节和 250.279 秒／1,001,238 字节，合计 2,512,595 字节；均为 32 kbps、22,050 Hz、单声道 MP3，保留整曲且不裁剪。转码前使用 `loudnorm=I=-20:TP=-3:LRA=11` 调整响度。

`playlist.source.json` 记录播放顺序、原始文件及运行副本的 SHA256 和转码参数。素材来源为用户提供的音频文件。重新准备副本时指定 FFmpeg 可执行文件；日常核验不需要原始文件或 FFmpeg。在 `D:\怀旧小游戏\数独` 打开终端执行：

```sh
node scripts/prepare-background-music.mjs --check
```

重新准备副本时，将下例中的编码器路径替换为本机实际位置：

```sh
node scripts/prepare-background-music.mjs --ffmpeg "C:\工具\ffmpeg.exe"
```

旧 `calm-garden.wav` 和 `calm-garden.source.json` 已归档至 `数独/artifacts/audio-archive/`，不再随当前配乐使用。旧合成器只保留历史用途。播放边界、音乐开关及维护方式见 [背景音乐说明](../../../数独/docs/background-music.md)。
