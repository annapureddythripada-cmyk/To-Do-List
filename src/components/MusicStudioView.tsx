import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Info,
  Music,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { SOUND_MOODS } from '../types/task';
import type { SoundMood, SoundPreset } from '../types/task';

interface MusicStudioViewProps {
  presets: SoundPreset[];
  onSavePreset: (payload: {
    name: string;
    mood: SoundMood;
    bpm: number;
    warmth: number;
    padLevel: number;
    chimeLevel: number;
  }) => Promise<void>;
  onDeletePreset: (id: number) => Promise<void>;
}

const MOOD_SCALES: Record<SoundMood, number[]> = {
  'Lavender Drift': [220, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
  'Midnight Library': [196.0, 233.08, 261.63, 293.66, 349.23, 392.0, 466.16],
  'Crystal Rain': [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33],
  'Warm Rhodes': [174.61, 220.0, 261.63, 329.63, 349.23, 440.0, 523.25],
};

export function MusicStudioView({
  presets,
  onSavePreset,
  onDeletePreset,
}: MusicStudioViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [mood, setMood] = useState<SoundMood>('Lavender Drift');
  const [bpm, setBpm] = useState(76);
  const [warmth, setWarmth] = useState(65);
  const [padLevel, setPadLevel] = useState(70);
  const [chimeLevel, setChimeLevel] = useState(55);
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const padGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const stepTimerRef = useRef<number | null>(null);

  const paramsRef = useRef({ mood, bpm, warmth, padLevel, chimeLevel });
  paramsRef.current = { mood, bpm, warmth, padLevel, chimeLevel };

  const stopAudio = useCallback(() => {
    if (stepTimerRef.current !== null) {
      window.clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    filterRef.current = null;
    padGainRef.current = null;
    analyserRef.current = null;
    setIsPlaying(false);
  }, []);

  const triggerStep = useCallback((stepIndex: number) => {
    const ctx = audioCtxRef.current;
    const filter = filterRef.current;
    if (!ctx || !filter) return;

    const { mood: m, padLevel: padLvl, chimeLevel: chimeLvl } = paramsRef.current;
    const scale = MOOD_SCALES[m];
    const now = ctx.currentTime;

    if (stepIndex % 4 === 0 && padLvl > 0) {
      const root = scale[(stepIndex / 4) % 3];
      const fifth = root * 1.5;
      [root * 0.5, root, fifth].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = m === 'Warm Rhodes' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);
        const peak = (padLvl / 100) * 0.08;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(peak, now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
        osc.connect(gain);
        gain.connect(filter);
        osc.start(now);
        osc.stop(now + 2.45);
      });
    }

    if (chimeLvl > 0) {
      const note = scale[(stepIndex * 3 + 1) % scale.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, now);
      const peak = (chimeLvl / 100) * 0.11;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);
      osc.stop(now + 0.9);
    }
  }, []);

  const startAudio = useCallback(() => {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400 + (warmth / 100) * 2600;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.85;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    filter.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    audioCtxRef.current = ctx;
    filterRef.current = filter;
    padGainRef.current = masterGain;
    analyserRef.current = analyser;

    let step = 0;
    triggerStep(step++);
    const intervalMs = Math.round((60 / bpm / 2) * 1000);
    stepTimerRef.current = window.setInterval(() => {
      triggerStep(step++);
    }, intervalMs);

    setIsPlaying(true);
  }, [bpm, warmth, triggerStep]);

  useEffect(() => {
    if (filterRef.current && audioCtxRef.current) {
      filterRef.current.frequency.setTargetAtTime(
        400 + (warmth / 100) * 2600,
        audioCtxRef.current.currentTime,
        0.08
      );
    }
  }, [warmth]);

  useEffect(() => {
    if (!isPlaying) return;
    if (stepTimerRef.current !== null) {
      window.clearInterval(stepTimerRef.current);
    }
    let step = 0;
    const intervalMs = Math.round((60 / bpm / 2) * 1000);
    stepTimerRef.current = window.setInterval(() => {
      triggerStep(step++);
    }, intervalMs);
    return () => {
      if (stepTimerRef.current !== null) {
        window.clearInterval(stepTimerRef.current);
      }
    };
  }, [bpm, isPlaying, triggerStep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const dataArray = new Uint8Array(64);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#F3EFFC';
      ctx.fillRect(0, 0, w, h);

      if (analyserRef.current && isPlaying) {
        analyserRef.current.getByteFrequencyData(dataArray);
      } else {
        dataArray.fill(10);
      }

      const bars = 32;
      const barW = w / bars;
      for (let i = 0; i < bars; i++) {
        const val = dataArray[i] / 255;
        const barH = Math.max(6, val * (h - 16));
        ctx.fillStyle = isPlaying ? '#4C1D95' : '#C4B5FD';
        ctx.fillRect(
          i * barW + 3,
          h - barH - 6,
          Math.max(4, barW - 6),
          barH
        );
      }
      rafId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  const handleSave = async () => {
    const trimmed = presetName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSavePreset({
        name: trimmed,
        mood,
        bpm,
        warmth,
        padLevel,
        chimeLevel,
      });
      setPresetName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-[#D8CCF5] bg-[#F3EFFC] px-4 py-3 text-xs text-[#3B0764]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#4C1D95]" />
        <p>
          Cloud AI music generation with Lyria (<code className="font-mono">lyria-3-clip-preview</code> /{' '}
          <code className="font-mono">lyria-3-pro-preview</code>) requires a paid API key in{' '}
          <strong>Settings &gt; Secrets</strong>. In the meantime, the procedural Web Audio Focus
          Synthesizer below runs locally with custom presets saved to PostgreSQL.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-xl border border-[#E4DCF5] bg-white p-6 lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3EFFC] text-[#4C1D95]">
                <Music className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-[#1F1235]">
                  Focus Soundscape Synthesizer
                </h2>
                <p className="text-xs text-[#5B4F73]">
                  {mood} · <span className="font-mono-tabular">{bpm} BPM</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => (isPlaying ? stopAudio() : startAudio())}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#3B0764] px-5 text-sm font-semibold text-white hover:bg-[#4C1D95] transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                  <span>Stop Audio</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>Play Focus Audio</span>
                </>
              )}
            </button>
          </div>

          <canvas
            ref={canvasRef}
            width={640}
            height={110}
            className="w-full rounded-lg border border-[#E4DCF5]"
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SOUND_MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  mood === m
                    ? 'border-[#3B0764] bg-[#3B0764] text-white'
                    : 'border-[#E4DCF5] bg-[#FAF8FF] text-[#1F1235] hover:bg-[#F3EFFC]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-[#1F1235]">
              <div className="flex justify-between mb-1">
                <span>Tempo</span>
                <span className="font-mono-tabular text-[#5B4F73]">{bpm} BPM</span>
              </div>
              <input
                type="range"
                min={50}
                max={140}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-full accent-[#4C1D95] cursor-pointer"
              />
            </label>

            <label className="block text-xs font-medium text-[#1F1235]">
              <div className="flex justify-between mb-1">
                <span>Harmonic Warmth</span>
                <span className="font-mono-tabular text-[#5B4F73]">{warmth}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={warmth}
                onChange={(e) => setWarmth(Number(e.target.value))}
                className="w-full accent-[#4C1D95] cursor-pointer"
              />
            </label>

            <label className="block text-xs font-medium text-[#1F1235]">
              <div className="flex justify-between mb-1">
                <span>Ambient Pad</span>
                <span className="font-mono-tabular text-[#5B4F73]">{padLevel}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={padLevel}
                onChange={(e) => setPadLevel(Number(e.target.value))}
                className="w-full accent-[#4C1D95] cursor-pointer"
              />
            </label>

            <label className="block text-xs font-medium text-[#1F1235]">
              <div className="flex justify-between mb-1">
                <span>Chime Plucks</span>
                <span className="font-mono-tabular text-[#5B4F73]">{chimeLevel}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={chimeLevel}
                onChange={(e) => setChimeLevel(Number(e.target.value))}
                className="w-full accent-[#4C1D95] cursor-pointer"
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-[#E4DCF5] bg-white p-6 lg:col-span-5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-[#1F1235]">
              Saved Sound Presets
            </h3>
            <p className="mt-1 text-xs text-[#5B4F73]">
              Store your favorite focus synth mixes in PostgreSQL.
            </p>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                maxLength={80}
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name (e.g., Deep Coding)"
                className="h-10 flex-1 rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] px-3 text-sm text-[#1F1235] placeholder:text-[#7E709B] focus:border-[#4C1D95] focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                disabled={!presetName.trim() || saving}
                onClick={handleSave}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#3B0764] px-4 text-xs font-semibold text-white hover:bg-[#4C1D95] disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>

            {presets.length === 0 ? (
              <div className="mt-6 rounded-lg bg-[#FAF8FF] p-5 text-center text-xs text-[#5B4F73]">
                No saved presets yet. Adjust the synthesizer sliders and save a
                preset above.
              </div>
            ) : (
              <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {presets.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] px-3.5 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMood(p.mood);
                        setBpm(p.bpm);
                        setWarmth(p.warmth);
                        setPadLevel(p.padLevel);
                        setChimeLevel(p.chimeLevel);
                      }}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <p className="truncate text-sm font-semibold text-[#1F1235]">
                        {p.name}
                      </p>
                      <p className="text-xs text-[#5B4F73] font-mono-tabular">
                        {p.mood} · {p.bpm} BPM
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePreset(p.id)}
                      aria-label={`Delete preset ${p.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#BE123C] hover:bg-[#FFF1F2] cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
