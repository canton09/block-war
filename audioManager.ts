export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private currentTrackIndex: number = 0;
  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private nextNoteTime: number = 0;
  private currentNoteIndex: number = 0;
  private schedulerTimer: number | null = null;
  private tempo: number = 120;

  // 8-Bit Note Frequencies
  private notes: { [key: string]: number } = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00,
    'xx': 0 // Rest
  };

  // 5 Tracks of 8-bit Melodies
  private tracks = [
    // Track 1: Tactical March
    {
       name: "Cube March",
       tempo: 140,
       melody: ['C3','C3','G3','G3','A3','A3','G3','xx','F3','F3','E3','E3','D3','D3','C3','xx']
    },
    // Track 2: Neon Arpeggio
    {
       name: "Neon Horizon",
       tempo: 160,
       melody: ['A3','C4','E4','A4','G3','B3','D4','G4','F3','A3','C4','F4','E3','G3','B3','E4']
    },
    // Track 3: Deep Tension
    {
       name: "Digital Siege",
       tempo: 100,
       melody: ['C3','xx','C3','xx','Eb3','xx','G3','xx','C3','xx','C3','xx','Bb2','xx','G2','xx']
    },
    // Track 4: High Speed Data
    {
       name: "8-Bit Rush",
       tempo: 180,
       melody: ['E4','G4','A4','B4','A4','G4','E4','D4','E4','G4','A4','B4','D5','B4','A4','G4']
    },
    // Track 5: Royal Entrance
    {
       name: "Pixel Glory",
       tempo: 120,
       melody: ['G3','xx','G3','xx','G3','A3','B3','C4','D4','xx','D4','xx','C4','B3','A3','G3']
    }
  ];

  constructor() {
    // Lazy init via user interaction
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.10; // Lower volume for BGM
    this.bgmGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.20;
    this.sfxGain.connect(this.masterGain);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime, 0.1);
    }
    return this.isMuted;
  }

  async startMusic() {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
    
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.nextNoteTime = this.ctx!.currentTime;
    this.scheduler();
  }

  stopMusic() {
    this.isPlaying = false;
    if (this.schedulerTimer) window.clearTimeout(this.schedulerTimer);
  }

  nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.currentNoteIndex = 0;
  }

  private scheduler = () => {
    if (!this.ctx || !this.isPlaying) return;

    // Schedule ahead
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.playNote();
      this.advanceNote();
    }
    
    this.schedulerTimer = window.setTimeout(this.scheduler, 25);
  }

  private playNote() {
    const track = this.tracks[this.currentTrackIndex];
    const noteName = track.melody[this.currentNoteIndex];
    const freq = this.notes[noteName];

    if (freq > 0) {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'square'; // Classic 8-bit sound
      osc.frequency.value = freq;
      
      osc.connect(gain);
      gain.connect(this.bgmGain!);

      // Envelope (Short blip sound)
      const duration = 60 / track.tempo / 2; // Staccato
      gain.gain.setValueAtTime(0.1, this.nextNoteTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.nextNoteTime + duration - 0.05);

      osc.start(this.nextNoteTime);
      osc.stop(this.nextNoteTime + duration);
    }
  }

  private advanceNote() {
    const track = this.tracks[this.currentTrackIndex];
    const secondsPerBeat = 60.0 / track.tempo;
    this.nextNoteTime += secondsPerBeat;
    
    this.currentNoteIndex++;
    if (this.currentNoteIndex === track.melody.length) {
      this.currentNoteIndex = 0;
    }
  }

  // --- SFX ---

  playShoot() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.1);
    
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playExplosion() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    
    // Create Noise Buffer
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 sec
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    
    noise.start(t);
  }

  playCapture() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(554, t + 0.1); // C#
    osc.frequency.setValueAtTime(659, t + 0.2); // E
    
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.6);
    
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    
    osc.start(t);
    osc.stop(t + 0.6);
  }
  
  getCurrentTrackName() {
      return this.tracks[this.currentTrackIndex].name;
  }
}

export const audioManager = new AudioManager();