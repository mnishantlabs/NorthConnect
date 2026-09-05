import fs from "fs";
import path from "path";
import { app } from "electron";

function generateWav(sampleRate: number, durationSec: number, generator: (t: number) => number): Buffer {
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // PCM format = 1
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = generator(t);
    // Clamp to -1..1
    sample = Math.max(-1, Math.min(1, sample));
    const intVal = Math.floor(sample * 32767);
    // Left & Right
    buffer.writeInt16LE(intVal, offset);
    buffer.writeInt16LE(intVal, offset + 2);
    offset += 4;
  }

  return buffer;
}

export interface SoundboardPreset {
  id: string;
  name: string;
  category: string;
  icon: string;
  duration: string;
  filePath: string;
}

let soundCacheDir = "";

export function ensurePresetSounds(): SoundboardPreset[] {
  try {
    const base = app.getPath("userData");
    soundCacheDir = path.join(base, "sounds");
    if (!fs.existsSync(soundCacheDir)) {
      fs.mkdirSync(soundCacheDir, { recursive: true });
    }

    const presets: Array<{
      id: string;
      name: string;
      category: string;
      icon: string;
      durationSec: number;
      fn: (t: number) => number;
    }> = [
      {
        id: "airhorn",
        name: "Air Horn",
        category: "Meme & Hype",
        icon: "Flame",
        durationSec: 1.5,
        fn: (t) => {
          if (t > 1.2) return 0;
          // Classic dissonant horn chord
          const f1 = Math.sin(2 * Math.PI * 466.16 * t);
          const f2 = Math.sin(2 * Math.PI * 622.25 * t);
          const f3 = Math.sin(2 * Math.PI * 932.33 * t);
          const f4 = Math.sin(2 * Math.PI * 155.56 * t);
          const env = Math.min(1, t * 50) * Math.max(0, 1 - (t / 1.2) ** 2);
          const distortion = Math.tanh((f1 * 0.4 + f2 * 0.35 + f3 * 0.2 + f4 * 0.3) * 2.2);
          return distortion * env * 0.85;
        },
      },
      {
        id: "victory",
        name: "Victory Fanfare",
        category: "Gaming",
        icon: "Trophy",
        durationSec: 2.2,
        fn: (t) => {
          // Triplet note fanfare: C5, C5, C5, G5
          let freq = 523.25;
          let noteT = t;
          if (t < 0.2) { freq = 523.25; noteT = t; }
          else if (t < 0.4) { freq = 523.25; noteT = t - 0.2; }
          else if (t < 0.6) { freq = 523.25; noteT = t - 0.4; }
          else if (t < 1.0) { freq = 659.25; noteT = t - 0.6; }
          else if (t < 2.0) { freq = 783.99; noteT = t - 1.0; }
          else return 0;

          const env = Math.min(1, noteT * 60) * Math.exp(-noteT * 3.5);
          const wave = Math.sin(2 * Math.PI * freq * t) * 0.6 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.3;
          return wave * env * 0.8;
        },
      },
      {
        id: "notification",
        name: "Discord Chime",
        category: "Effects",
        icon: "Bell",
        durationSec: 1.0,
        fn: (t) => {
          const f1 = 880;
          const f2 = 1320;
          const env1 = Math.exp(-t * 6);
          const env2 = t > 0.1 ? Math.exp(-(t - 0.1) * 7) : 0;
          const w1 = Math.sin(2 * Math.PI * f1 * t) * env1;
          const w2 = Math.sin(2 * Math.PI * f2 * (t - 0.1)) * env2;
          return (w1 * 0.5 + w2 * 0.6) * 0.8;
        },
      },
      {
        id: "levelup",
        name: "Level Up",
        category: "Gaming",
        icon: "Sparkles",
        durationSec: 1.6,
        fn: (t) => {
          // Ascending notes
          const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
          const idx = Math.min(notes.length - 1, Math.floor(t * 5));
          const freq = notes[idx];
          const noteT = (t * 5) % 1;
          const env = Math.exp(-noteT * 4) * (t < 1.4 ? 1 : Math.max(0, 1 - (t - 1.4) * 5));
          const wave = Math.sin(2 * Math.PI * freq * t) + Math.sin(2 * Math.PI * freq * 2 * t) * 0.4;
          return wave * env * 0.45;
        },
      },
      {
        id: "bassdrop",
        name: "Sub Bass Drop",
        category: "Meme & Hype",
        icon: "Zap",
        durationSec: 2.0,
        fn: (t) => {
          const freq = 160 * Math.exp(-t * 1.8) + 38;
          const phase = 2 * Math.PI * (160 / -1.8 * (Math.exp(-t * 1.8) - 1) + 38 * t);
          const env = Math.min(1, t * 20) * Math.max(0, 1 - t / 2.0);
          const wave = Math.sin(phase);
          return Math.tanh(wave * 1.8) * env * 0.9;
        },
      },
      {
        id: "laser",
        name: "Laser Blaster",
        category: "Effects",
        icon: "Radio",
        durationSec: 0.8,
        fn: (t) => {
          const freq = 2400 * Math.exp(-t * 9) + 80;
          const env = Math.exp(-t * 5);
          const wave = Math.sin(2 * Math.PI * freq * t);
          return Math.tanh(wave * 2.5) * env * 0.7;
        },
      },
      {
        id: "applause",
        name: "Crowd Cheers",
        category: "Effects",
        icon: "ThumbsUp",
        durationSec: 2.5,
        fn: (t) => {
          const env = Math.min(1, t * 3) * (t > 1.8 ? Math.max(0, 1 - (t - 1.8) / 0.7) : 1);
          // Pseudo-random noise + rhythmic claps
          const noise = (Math.random() * 2 - 1) * 0.5;
          const clapRate = 12;
          const clapEnv = (Math.sin(2 * Math.PI * clapRate * t) > 0.7 ? 1.5 : 0.6);
          return noise * clapEnv * env * 0.65;
        },
      },
      {
        id: "gg",
        name: "Good Game (GG)",
        category: "Gaming",
        icon: "Gamepad2",
        durationSec: 1.4,
        fn: (t) => {
          const chord = [392.0, 493.88, 587.33, 783.99]; // G Major
          const env = Math.min(1, t * 40) * Math.exp(-t * 2.2);
          let sum = 0;
          for (const f of chord) {
            sum += Math.sin(2 * Math.PI * f * t);
          }
          return (sum / chord.length) * env * 0.8;
        },
      },
    ];

    const result: SoundboardPreset[] = [];
    for (const p of presets) {
      const targetFile = path.join(soundCacheDir, `${p.id}.wav`);
      if (!fs.existsSync(targetFile)) {
        const wavBuf = generateWav(48000, p.durationSec, p.fn);
        fs.writeFileSync(targetFile, wavBuf);
      }
      result.push({
        id: p.id,
        name: p.name,
        category: p.category,
        icon: p.icon,
        duration: `${p.durationSec.toFixed(1)}s`,
        filePath: targetFile,
      });
    }

    return result;
  } catch (e) {
    console.error("Failed to generate preset sounds:", e);
    return [];
  }
}
