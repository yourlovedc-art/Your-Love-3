import type { TrackItem } from '../shared/types.ts';

interface PresetConfig {
  scaleHz: number[];
  tempoMs: number;
  wave: OscillatorType;
  subHz: number;
}

// Traditional Japanese Hirajoshi & In-sen pentatonic scales
const PRESETS: Record<string, PresetConfig> = {
  kamakura: {
    scaleHz: [220, 246.94, 261.63, 329.63, 349.23, 440, 493.88, 523.25],
    tempoMs: 680,
    wave: 'triangle',
    subHz: 110,
  },
  torii: {
    scaleHz: [196, 207.65, 261.63, 293.66, 349.23, 392, 415.3],
    tempoMs: 760,
    wave: 'sine',
    subHz: 98,
  },
  enso: {
    scaleHz: [261.63, 293.66, 311.13, 392, 415.3, 523.25],
    tempoMs: 840,
    wave: 'triangle',
    subHz: 130.81,
  },
  edo: {
    scaleHz: [146.83, 164.81, 174.61, 220, 233.08, 293.66, 329.63],
    tempoMs: 560,
    wave: 'sawtooth',
    subHz: 73.42,
  },
  arashiyama: {
    scaleHz: [246.94, 261.63, 329.63, 369.99, 440, 493.88],
    tempoMs: 720,
    wave: 'sine',
    subHz: 123.47,
  },
  shogun: {
    scaleHz: [196, 220, 233.08, 293.66, 311.13, 392, 440],
    tempoMs: 600,
    wave: 'triangle',
    subHz: 98,
  },
};

export class SamuraiWebAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private htmlAudio: HTMLAudioElement | null = null;
  private stepTimer: number | null = null;
  private currentTrackId: string | null = null;
  private currentSource: TrackItem['source'] | null = null;
  private volume = 0.75;
  private isPlaying = false;
  private stepIndex = 0;

  private ensureAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 1850;
      this.filterNode.Q.value = 0.7;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume * 0.45;

      this.filterNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  setVolume(percent: number) {
    this.volume = Math.max(0, Math.min(1, percent / 100));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.45, this.ctx.currentTime, 0.04);
    }
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.volume;
    }
  }

  seek(positionMs: number) {
    if (this.htmlAudio && Number.isFinite(this.htmlAudio.duration)) {
      this.htmlAudio.currentTime = Math.max(0, positionMs / 1000);
    }
  }

  sync(track: TrackItem | null, playing: boolean, paused: boolean, volumePercent: number) {
    this.setVolume(volumePercent);
    const shouldPlay = Boolean(track && playing && !paused);

    if (!shouldPlay || !track) {
      this.stopPlayback();
      return;
    }

    if (this.currentTrackId === track.id && this.isPlaying) {
      return;
    }

    this.stopPlayback();
    this.currentTrackId = track.id;
    this.currentSource = track.source;
    this.isPlaying = true;

    if (track.source === 'upload' && track.audioUrl) {
      this.startHtmlAudio(track.audioUrl);
    } else {
      this.startSynthLoop(track.synthPreset || 'kamakura');
    }
  }

  private startHtmlAudio(url: string) {
    this.htmlAudio = new Audio(url);
    this.htmlAudio.volume = this.volume;
    void this.htmlAudio.play().catch(() => {
      // Browser autoplay policy may wait for explicit click
    });
  }

  private startSynthLoop(presetName: string) {
    try {
      this.ensureAudioContext();
    } catch {
      return;
    }
    const preset = PRESETS[presetName] || PRESETS.kamakura;
    this.stepIndex = 0;

    const triggerNote = () => {
      if (!this.isPlaying || !this.ctx || !this.filterNode) return;
      const now = this.ctx.currentTime;

      // Koto pluck note
      const pattern = [0, 2, 4, 3, 5, 4, 2, 1];
      const scaleIdx = pattern[this.stepIndex % pattern.length] % preset.scaleHz.length;
      const freq = preset.scaleHz[scaleIdx];

      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      osc.type = preset.wave;
      osc.frequency.setValueAtTime(freq, now);

      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.exponentialRampToValueAtTime(0.28, now + 0.025);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + preset.tempoMs / 1000 + 0.45);

      osc.connect(noteGain);
      noteGain.connect(this.filterNode);
      osc.start(now);
      osc.stop(now + preset.tempoMs / 1000 + 0.5);

      // Subtle deep taiko / drone pulse every 4 beats
      if (this.stepIndex % 4 === 0) {
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(preset.subHz, now);
        subOsc.frequency.exponentialRampToValueAtTime(preset.subHz * 0.72, now + 0.35);

        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

        subOsc.connect(subGain);
        subGain.connect(this.filterNode);
        subOsc.start(now);
        subOsc.stop(now + 0.7);
      }

      this.stepIndex++;
    };

    triggerNote();
    this.stepTimer = window.setInterval(triggerNote, preset.tempoMs);
  }

  stopPlayback() {
    this.isPlaying = false;
    this.currentTrackId = null;
    if (this.stepTimer !== null) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio.src = '';
      this.htmlAudio = null;
    }
  }
}

export const webAudioEngine = new SamuraiWebAudioEngine();
