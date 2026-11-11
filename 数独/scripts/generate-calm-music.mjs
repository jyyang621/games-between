import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Original, deterministic score and additive synthesis. No samples, downloads,
// third-party encoders, or music-generation dependencies are used.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.resolve(ROOT, '..', '微信小程序/assets/audio');
const RATE = 16000;
const SECONDS = 48;
const FRAMES = RATE * SECONDS;
const PEAK = 0.28;
const TWO_PI = Math.PI * 2;
const PCM_LSB = 1 / 32767;

const smooth = value => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
const frequency = midi => 440 * (2 ** ((midi - 69) / 12));
const hash = data => createHash('sha256').update(data).digest('hex');

// Eight six-beat bars, one second per beat. The open voicings avoid a dense
// low register; the sparse melody is written specifically for this project.
const SCORE = [
  { chord: [50, 57, 61, 64, 66], bass: 38, melody: [[0, 74], [3.5, 73]] },
  { chord: [49, 57, 59, 64, 69], bass: 37, melody: [[1, 71], [4, 69]] },
  { chord: [47, 54, 57, 62, 66], bass: 35, melody: [[0.5, 66], [3.5, 69]] },
  { chord: [43, 54, 57, 62, 66], bass: 31, melody: [[1, 71], [4, 69]] },
  { chord: [54, 57, 62, 64, 69], bass: 42, melody: [[0.5, 69], [3.5, 66]] },
  { chord: [52, 55, 59, 62, 66], bass: 40, melody: [[1, 67], [4, 66]] },
  { chord: [43, 54, 57, 62, 66], bass: 31, melody: [[0.5, 64], [3.5, 66]] },
  { chord: [45, 55, 59, 62, 64], bass: 33, melody: [[0, 64], [3, 61]] },
];

function synthesize() {
  const samples = new Float64Array(FRAMES);
  let events = 0;

  function note(start, midi, length, gain, voice) {
    const first = Math.round(start * RATE);
    const count = Math.round(length * RATE);
    const hz = frequency(midi);
    const attack = voice === 'pad' ? 1.1 : voice === 'bass' ? 0.11 : 0.035;
    const release = voice === 'pad' ? 2.3 : 0.8;
    const partials = voice === 'pad' ? [1, 0.12, 0.025]
      : voice === 'bass' ? [1, 0.14, 0.025]
      : [1, 0.23, 0.075, 0.027, 0.009];
    events += 1;

    for (let i = 0; i < count; i += 1) {
      const t = i / RATE;
      const envelope = smooth(t / attack) * smooth((length - t) / release);
      const decay = voice === 'pad' ? 1
        : voice === 'bass' ? Math.exp(-t / 3.7)
        : 0.76 * Math.exp(-t / 1.2) + 0.24 * Math.exp(-t / 3.8);
      let tone = 0;
      for (let p = 0; p < partials.length; p += 1) {
        const harmonic = p + 1;
        // High keyboard harmonics fade earlier to keep the sound rounded.
        const harmonicDecay = voice === 'keys' ? Math.exp(-p * t / 1.8) : 1;
        // The tiny pad vibrato is local to an enveloped note, so the wrapped
        // releases remain continuous at the sample boundary.
        const drift = voice === 'pad' ? 0.012 * Math.sin(TWO_PI * t / 4) : 0;
        tone += partials[p] * harmonicDecay
          * Math.sin(TWO_PI * hz * harmonic * t + drift);
      }
      // Notes crossing 48 seconds wrap their complete release to the start.
      // There is no fade-to-silence or cut-off chord at the loop seam.
      samples[(first + i) % FRAMES] += tone * gain * envelope * decay;
    }
  }

  SCORE.forEach((bar, b) => {
    const start = b * 6;
    note(start, bar.bass, 8.5, 0.041, 'bass');
    bar.chord.slice(1).forEach((midi, index) => {
      note(start + index * 0.017, midi, 8.7, 0.0092, 'pad');
    });
    const pattern = [0, 2, 3, 1];
    pattern.forEach((chordIndex, i) => {
      const midi = bar.chord[chordIndex] + 12;
      note(start + [0, 1.6, 3, 4.65][i], midi, 3.8,
        [0.039, 0.032, 0.035, 0.029][i], 'keys');
    });
    bar.melody.forEach(([beat, midi], i) => {
      note(start + beat, midi, 4.6, i ? 0.035 : 0.04, 'keys');
    });
  });

  const mean = samples.reduce((sum, sample) => sum + sample, 0) / FRAMES;
  let maximum = 0;
  for (let i = 0; i < FRAMES; i += 1) {
    samples[i] -= mean;
    maximum = Math.max(maximum, Math.abs(samples[i]));
  }
  const multiplier = PEAK / maximum;
  const pcm = new Int16Array(FRAMES);
  for (let i = 0; i < FRAMES; i += 1) {
    pcm[i] = Math.round(samples[i] * multiplier * 32767);
  }
  return { pcm, events };
}

function wav(pcm) {
  const bytes = Buffer.alloc(44 + pcm.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); // Standard uncompressed integer PCM.
  bytes.writeUInt16LE(1, 22); // Mono keeps this optional asset compact.
  bytes.writeUInt32LE(RATE, 24);
  bytes.writeUInt32LE(RATE * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(pcm.length * 2, 40);
  pcm.forEach((value, i) => bytes.writeInt16LE(value, 44 + i * 2));
  return bytes;
}

function analyze(pcm) {
  let square = 0;
  let mean = 0;
  let peak = 0;
  let largestStep = 0;
  const steps = [];
  const blocks = [];
  for (let i = 0; i < pcm.length; i += 1) {
    const sample = pcm[i] / 32767;
    square += sample * sample;
    mean += sample;
    peak = Math.max(peak, Math.abs(sample));
    const step = Math.abs(pcm[(i + 1) % pcm.length] - pcm[i]) / 32767;
    largestStep = Math.max(largestStep, step);
    steps.push(step);
  }
  for (let second = 0; second < SECONDS; second += 1) {
    let power = 0;
    for (let i = second * RATE; i < (second + 1) * RATE; i += 1) {
      power += (pcm[i] / 32767) ** 2;
    }
    blocks.push(Math.sqrt(power / RATE));
  }
  steps.sort((a, b) => a - b);
  const rms = Math.sqrt(square / pcm.length);
  const seamStep = Math.abs(pcm[0] - pcm.at(-1)) / 32767;
  const round = value => Number(value.toFixed(8));
  const percentile999 = steps[Math.floor(steps.length * 0.999)];
  if (peak >= 0.281 || !Number.isFinite(rms) || rms < 0.02 || rms > 0.13) {
    throw new Error(`Unexpected signal level: peak=${peak}, RMS=${rms}`);
  }
  if (Math.min(...blocks) < 0.008 || Math.abs(mean / pcm.length) > PCM_LSB) {
    throw new Error('Unexpected silence or DC offset');
  }
  if (seamStep > percentile999) throw new Error('Loop seam has an abnormal step');
  return {
    peak: round(peak), peakDbfs: round(20 * Math.log10(peak)),
    rms: round(rms), rmsDbfs: round(20 * Math.log10(rms)),
    dcOffset: round(mean / pcm.length), clippedSamples: 0,
    minOneSecondRms: round(Math.min(...blocks)),
    maxOneSecondRms: round(Math.max(...blocks)),
    seamStep: round(seamStep),
    maxAdjacentStepIncludingSeam: round(largestStep),
    adjacentStepPercentile999: round(percentile999),
    seamWithinNormalAdjacentVariation: seamStep <= percentile999,
  };
}

const { pcm, events } = synthesize();
const audio = wav(pcm);
const generator = await readFile(fileURLToPath(import.meta.url));
const metadata = {
  title: '庭间微光 / Calm Garden',
  description: 'Original gentle keyboard and soft pad loop for games-between',
  source: 'scripts/generate-calm-music.mjs',
  originality: 'Original score and additive synthesis; no third-party audio or samples',
  format: 'RIFF WAVE, PCM signed 16-bit little-endian, mono',
  sampleRate: RATE, channels: 1, bitsPerSample: 16,
  durationSeconds: SECONDS, sampleFrames: FRAMES, bytes: audio.length,
  tempoBeatsPerMinute: 60, bars: 8, beatsPerBar: 6,
  synthesisEvents: events,
  sha256: hash(audio), generatorSha256: hash(generator),
  analysis: analyze(pcm),
  loopMethod: 'Periodic overlap-add: note releases crossing the boundary wrap to the beginning',
};
const json = `${JSON.stringify(metadata, null, 2)}\n`;
const audioPath = path.join(OUTPUT, 'calm-garden.wav');
const metadataPath = path.join(OUTPUT, 'calm-garden.source.json');
if (process.argv.includes('--check')) {
  const actualAudio = await readFile(audioPath);
  const actualMetadata = await readFile(metadataPath, 'utf8');
  if (!audio.equals(actualAudio) || actualMetadata !== json) {
    throw new Error('Calm music asset differs from its deterministic source; regenerate it');
  }
  console.log(`Calm music verified: ${metadata.bytes} bytes, ${SECONDS}s, SHA256 ${metadata.sha256}`);
} else {
  await mkdir(OUTPUT, { recursive: true });
  await writeFile(audioPath, audio);
  await writeFile(metadataPath, json);
  console.log(JSON.stringify(metadata, null, 2));
}
