import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const REPOSITORY = path.dirname(ROOT);
const OUTPUT = path.join(REPOSITORY, '微信小程序', 'assets', 'audio');
const MANIFEST = path.join(OUTPUT, 'playlist.source.json');
const SOURCE = path.join(REPOSITORY, '音频');
const ARCHIVE = path.join(ROOT, 'artifacts', 'audio-archive');
const TRACKS = [
  { title: '平沙落雁 - 李祥霆', sourceFile: '平沙落雁-李祥霆.mp3', filename: 'pingsha-luoyan.mp3' },
  { title: '阳关三叠 - 传奇乐坊', sourceFile: '阳关三叠.埙.中阮二重奏.-传奇乐坊.mp3', filename: 'yangguan-sandie.mp3' },
];
const BITRATE = 32;
const SAMPLE_RATE = 22050;
const FILTER = 'loudnorm=I=-20:TP=-3:LRA=11:print_format=json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const rounded = value => Number(value.toFixed(6));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

// Read MPEG Layer III frame headers directly, so normal builds need only Node.
// Duration includes codec frame padding; complete decoded content is retained.
export function inspectMp3(bytes) {
  let offset = 0;
  if (bytes.subarray(0, 3).toString('ascii') === 'ID3') {
    assert(bytes.length >= 10, 'Truncated ID3 header');
    assert([...bytes.subarray(6, 10)].every(value => value < 128), 'Invalid ID3 size');
    offset = 10 + bytes.subarray(6, 10).reduce((size, value) => size * 128 + value, 0);
    if (bytes[5] & 0x10) offset += 10;
  }
  const highRates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const lowRates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const bitrateCounts = new Map();
  let frames = 0;
  let duration = 0;
  let encodedBytes = 0;
  let reference = null;
  let frameSamples = 0;
  while (offset + 4 <= bytes.length) {
    // MPEG1:1152 samples/frame; MPEG2/2.5:576 samples/frame.
    const [a, b, c, d] = bytes.subarray(offset, offset + 4);
    const version = (b >> 3) & 3;
    const rateIndex = (c >> 2) & 3;
    const bitrateIndex = c >> 4;
    if (a !== 255 || (b & 0xe0) !== 0xe0 || version === 1 || (b & 6) !== 2
        || rateIndex === 3 || bitrateIndex === 0 || bitrateIndex === 15) {
      if (!frames) { offset += 1; continue; }
      break;
    }
    const sampleRate = [44100, 48000, 32000][rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
    const bitrateKbps = (version === 3 ? highRates : lowRates)[bitrateIndex];
    const channels = d >> 6 === 3 ? 1 : 2;
    const length = Math.floor((version === 3 ? 144000 : 72000) * bitrateKbps / sampleRate) + ((c >> 1) & 1);
    if (offset + length > bytes.length) break;
    if (!reference) reference = { sampleRate, bitrateKbps, channels };
    assert(reference.sampleRate === sampleRate && reference.channels === channels, 'MP3 format changes within track');
    frameSamples = version === 3 ? 1152 : 576;
    bitrateCounts.set(bitrateKbps, (bitrateCounts.get(bitrateKbps) || 0) + 1);
    frames += 1;
    duration += frameSamples / sampleRate;
    encodedBytes += length;
    offset += length;
  }
  assert(frames > 1 && duration > 0 && reference, 'No complete MP3 audio frames');
  // The Xing/Info seek header can use a higher bitrate than the CBR audio.
  const bitrateKbps = [...bitrateCounts].sort((a, b) => b[1] - a[1])[0][0];
  return { ...reference, bitrateKbps, durationSeconds: rounded(duration), frames, encodedBytes, frameSamples };
}

export async function checkBackgroundMusic() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  assert(manifest.version === 1 && manifest.playback === 'sequential-loop', 'Unsupported music manifest');
  assert(manifest.sourceDirectory === '音频' && manifest.preparedBy === 'scripts/prepare-background-music.mjs', 'Invalid music provenance');
  assert(manifest.preparerSha256 === sha256(await readFile(SCRIPT)), 'Music preparer changed; explicitly prepare the playlist again');
  assert(Array.isArray(manifest.tracks) && manifest.tracks.length === TRACKS.length, 'Unexpected playlist length');
  const seen = new Set();
  for (let index = 0; index < manifest.tracks.length; index += 1) {
    const track = manifest.tracks[index];
    const expected = TRACKS[index];
    assert(track.title === expected.title && track.sourceFile === expected.sourceFile, 'Music order or source title changed');
    assert(track.src === `assets/audio/${expected.filename}` && !seen.has(track.src), 'Unexpected or duplicated music path');
    seen.add(track.src);
    assert(/^[a-f0-9]{64}$/.test(track.sourceSha256), `Missing source checksum: ${track.title}`);
    const bytes = await readFile(path.join(OUTPUT, expected.filename));
    assert(bytes.length === track.bytes && sha256(bytes) === track.sha256, `Music bytes changed: ${track.title}`);
    const audio = inspectMp3(bytes);
    assert(track.codec === 'mp3' && track.sampleRate === SAMPLE_RATE && track.channels === 1
      && track.bitrateKbps === BITRATE, `Unexpected music encoding: ${track.title}`);
    assert(audio.sampleRate === track.sampleRate && audio.channels === track.channels
      && audio.bitrateKbps === track.bitrateKbps, `MP3 header mismatch: ${track.title}`);
    assert(Number.isFinite(track.durationSeconds) && track.durationSeconds > 0
      && Math.abs(audio.durationSeconds - track.durationSeconds) < 0.001, `MP3 duration mismatch: ${track.title}`);
    assert(Number.isFinite(track.sourceDurationSeconds)
      && Math.abs(track.sourceDurationSeconds - track.durationSeconds) < 0.2, `Music was shortened: ${track.title}`);
    assert(Number.isFinite(track.analysis?.decodedMaxDbfs) && track.analysis.decodedMaxDbfs < -0.5, `Missing peak verification: ${track.title}`);
  }
  return manifest;
}

function ffmpegRun(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (result.error) throw result.error;
  assert(result.status === 0, `FFmpeg failed (${result.status}): ${result.stderr.slice(-6000)}`);
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

async function archiveOldMusic() {
  await mkdir(ARCHIVE, { recursive: true });
  const archiveRoot = path.resolve(ARCHIVE);
  assert(archiveRoot.startsWith(`${path.resolve(ROOT)}${path.sep}`), 'Audio archive must remain under the maintenance directory');
  for (const filename of ['calm-garden.wav', 'calm-garden.source.json']) {
    const previous = path.join(OUTPUT, filename);
    let bytes;
    try { bytes = await readFile(previous); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const target = path.join(archiveRoot, filename);
    let existing;
    try { existing = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing) assert(bytes.equals(existing), `Refusing to overwrite a different archive: ${filename}`);
    // rename is deliberately limited to these two exact files, never a directory.
    await rename(previous, target);
  }
}

export async function prepareBackgroundMusic(ffmpeg) {
  assert(ffmpeg, 'Pass --ffmpeg <absolute path> or set FFMPEG_PATH; the encoder is a preparation tool only');
  assert(path.isAbsolute(ffmpeg), 'FFmpeg must be an explicit absolute path');
  const version = ffmpegRun(ffmpeg, ['-version']).split(/\r?\n/).find(line => line.startsWith('ffmpeg version'));
  await mkdir(OUTPUT, { recursive: true });
  const tracks = [];
  for (const track of TRACKS) {
    const sourcePath = path.join(SOURCE, track.sourceFile);
    const sourceBytes = await readFile(sourcePath);
    const sourceAudio = inspectMp3(sourceBytes);
    const destination = path.join(OUTPUT, track.filename);
    const log = ffmpegRun(ffmpeg, [
      '-hide_banner', '-nostdin', '-y', '-i', sourcePath,
      '-vn', '-map_metadata', '-1', '-af', FILTER, '-ar', String(SAMPLE_RATE), '-ac', '1',
      '-codec:a', 'libmp3lame', '-b:a', `${BITRATE}k`, '-id3v2_version', '3', '-write_xing', '1', destination,
    ]);
    const outputBytes = await readFile(destination);
    const outputAudio = inspectMp3(outputBytes);
    assert(Math.abs(sourceAudio.durationSeconds - outputAudio.durationSeconds) < 0.2,
      `Full-track duration changed: ${track.title}`);
    const analysisLog = ffmpegRun(ffmpeg, ['-hide_banner', '-nostdin', '-i', destination, '-af', 'volumedetect', '-f', 'null', '-']);
    const decodedMaxDbfs = Number(analysisLog.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]);
    assert(Number.isFinite(decodedMaxDbfs) && decodedMaxDbfs < -0.5, `Encoded peak is too high: ${track.title}`);
    const loudnessJson = log.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];
    assert(loudnessJson, `FFmpeg loudness report is missing: ${track.title}`);
    const normalization = JSON.parse(loudnessJson);
    tracks.push({
      title: track.title, sourceFile: track.sourceFile,
      sourceSha256: sha256(sourceBytes), sourceBytes: sourceBytes.length,
      sourceDurationSeconds: sourceAudio.durationSeconds,
      src: `assets/audio/${track.filename}`, sha256: sha256(outputBytes), bytes: outputBytes.length,
      durationSeconds: outputAudio.durationSeconds, codec: 'mp3', sampleRate: SAMPLE_RATE,
      channels: 1, bitrateKbps: BITRATE,
      analysis: { decodedMaxDbfs, normalization },
    });
  }
  const manifest = {
    version: 1, playback: 'sequential-loop', sourceDirectory: '音频',
    preparedBy: 'scripts/prepare-background-music.mjs', preparerSha256: sha256(await readFile(SCRIPT)),
    attribution: 'User-provided third-party music. The filenames identify the supplied recordings; these tracks are not original compositions or recordings of this project.',
    transformation: { fullTracks: true, trim: false, filter: FILTER, channelLayout: 'mono', encoder: 'libmp3lame', ffmpegVersion: version },
    tracks,
  };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  await archiveOldMusic();
  await checkBackgroundMusic();
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT)) {
  if (process.argv.includes('--check')) {
    const manifest = await checkBackgroundMusic();
    console.log(`Background playlist verified: ${manifest.tracks.length} tracks, ${manifest.tracks.reduce((sum, track) => sum + track.bytes, 0)} bytes`);
  } else {
    const argument = process.argv.find(value => value.startsWith('--ffmpeg='));
    const option = process.argv.indexOf('--ffmpeg');
    const ffmpeg = argument?.slice('--ffmpeg='.length) || (option >= 0 ? process.argv[option + 1] : undefined) || process.env.FFMPEG_PATH;
    const manifest = await prepareBackgroundMusic(ffmpeg);
    console.log(JSON.stringify(manifest, null, 2));
  }
}
