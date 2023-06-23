import * as RecordRTC from 'recordrtc';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';
import { DomSanitizer } from '@angular/platform-browser';
import { InfoDialogComponent } from './info-dialog/info-dialog.component';

//TODO: live adding of effects, adding manual, adding new sample sounds

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'synesthezia';
  context: AudioContext = new AudioContext();
  buffer: AudioBuffer | null = null;
  impulseBuffer: AudioBuffer | null = null;
  source: AudioBufferSourceNode | null = null;

  //filter nodes
  filterLow = this.context.createBiquadFilter();
  filterHigh = this.context.createBiquadFilter();
  delay = this.context.createDelay();
  feedback = this.context.createGain();
  reverbDelay = this.context.createDelay(1);

  //reverb nodes
  input = this.context.createGain();
  activateNode = this.context.createGain();
  reverb = this.context.createConvolver();
  dryGain = this.context.createGain();
  filterLowReverb = this.context.createBiquadFilter();
  filterHighReverb = this.context.createBiquadFilter();
  wetGain = this.context.createGain();
  output = this.context.createGain();

  //wahwah nodes
  modulationGain = this.context.createGain();
  filterBp = this.context.createBiquadFilter();
  filterPeaking = this.context.createBiquadFilter();
  lfo = this.context.createOscillator();

  //overdrive nodes
  overdrive = this.context.createWaveShaper();

  //bitcrush nodes
  bitcrush = this.context.createScriptProcessor(4096, 1, 1);

  analyser: AnalyserNode = this.context.createAnalyser();

  mediaStreamDestination = this.context.createMediaStreamDestination();
  audioOutputStream = this.mediaStreamDestination.stream;
  recorder = new RecordRTC(this.audioOutputStream, {
    type: 'audio',
  });

  canvas: HTMLCanvasElement | null = null;
  canvasMirror: HTMLCanvasElement | null = null;

  audioFiles: File[] = [];
  downloadableFiles: File[] = [];
  fileList: FileList | null = null;
  currentAudio: File | null = null;
  impulseFiles: File[] = [];

  @ViewChild(MatMenuTrigger) trigger!: MatMenuTrigger;
  @ViewChild('cutoffCursor') cutoffCursor!: ElementRef;
  @ViewChild('cutoffField') cutoffField!: ElementRef;
  @ViewChild('cutoffTitle') cutoffTitle!: ElementRef;
  @ViewChild('delayCursor') delayCursor!: ElementRef;
  @ViewChild('delayField') delayField!: ElementRef;
  @ViewChild('delayTitle') delayTitle!: ElementRef;
  @ViewChild('reverbCursor') reverbCursor!: ElementRef;
  @ViewChild('reverbField') reverbField!: ElementRef;
  @ViewChild('reverbTitle') reverbTitle!: ElementRef;
  @ViewChild('wahwahCursor') wahwahCursor!: ElementRef;
  @ViewChild('wahwahField') wahwahField!: ElementRef;
  @ViewChild('wahwahTitle') wahwahTitle!: ElementRef;
  @ViewChild('overdriveCursor') overdriveCursor!: ElementRef;
  @ViewChild('overdriveField') overdriveField!: ElementRef;
  @ViewChild('overdriveTitle') overdriveTitle!: ElementRef;

  graph: CanvasRenderingContext2D | null = null;
  graphMirror: CanvasRenderingContext2D | null = null;

  isPlaying: boolean = false;
  isCutoff: boolean = false;
  isDelay: boolean = false;
  isReverb: boolean = false;
  isWahWah: boolean = false;
  isOverdrive: boolean = false;
  cutoff: number = 50;
  cutoffHigh: number = 20;
  delayTime: number = 1;
  delayFeedback: number = 0.1;
  dryGainValue: number = 0.5;
  wetGainValue: number = 0.5;
  wahwahPeaking: number = 1;
  wahwahFrequencyMin: number = 200;
  wahwahFrequencyMax: number = 2000;
  qFactor: number = 2;
  chain: string[] = [];
  impulseIndex: number = 0;
  wahwahTime: number = 0;
  timeout: ReturnType<typeof setTimeout> | null = null;
  duration: number = 1;
  overdriveAmount: number = 50;
  normFreq: number = 0.01;
  soundIsRecording: boolean = false;

  animationReq: number = 0;

  record: any;
  isRecording = false;
  url: any;

  entry_one: string = '';
  entry_two: string = '';
  entry_three: string = '';
  entry_four: string = '';
  entry_five: string = '';

  constructor(public dialog: MatDialog, private domSanitizer: DomSanitizer) {
    this.addAudioFiles();
    this.loadImpulseFiles();

    this.analyser.fftSize = 2048;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
  }

  ngOnInit() {
    this.canvas = <HTMLCanvasElement>document.getElementById('graph');
    this.canvasMirror = <HTMLCanvasElement>(
      document.getElementById('graph_mirror')
    );
    this.graph = this.canvas.getContext('2d');
    this.graphMirror = this.canvasMirror.getContext('2d');
  }

  openInfo(): void {
    const dialogRef = this.dialog.open(InfoDialogComponent, {
      width: '50%',
    });
  }

  openFileManager() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp3,.wav';
    input.onchange = (event) => {
      if (event.target != null) {
        this.fileList = (event.target as HTMLInputElement).files;
      }
      if (this.fileList != null) {
        this.audioFiles.push(this.fileList[0]);
      }
    };
    input.click();
  }

  addAudioFiles() {
    const soundPath = 'assets/sounds/';
    const soundFileNames = ['bell.mp3', 'rain.mp3', 'airplane.mp3'];

    soundFileNames.forEach((fileName) => {
      fetch(soundPath + fileName)
        .then((response) => response.blob())
        .then((blob) => {
          const file = new File([blob], fileName);
          this.audioFiles.push(file);
        });
    });
  }

  chooseFile(file: File | null) {
    this.currentAudio = file;
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      this.context.decodeAudioData(arrayBuffer, (audioBuffer) => {
        this.buffer = audioBuffer;
      });
    };
    if (this.currentAudio != null) {
      reader.readAsArrayBuffer(this.currentAudio);
    }
  }

  loadImpulseFiles() {
    const soundPath = 'assets/impulses/';
    const soundFileNames = [
      '01_small.wav',
      '02_medium.wav',
      '03_large.wav',
      '04_ultralarge.wav',
    ];

    soundFileNames.forEach((fileName) => {
      fetch(soundPath + fileName)
        .then((response) => response.blob())
        .then((blob) => {
          const file = new File([blob], fileName);
          this.impulseFiles.push(file);
        });
    });
    this.impulseFiles.sort((a, b) => (a.name < b.name ? -1 : 1));
  }

  getImpulseBuffer() {
    console.log(this.impulseFiles);
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      this.context.decodeAudioData(arrayBuffer, (audioBuffer) => {
        this.impulseBuffer = audioBuffer;
      });
    };
    if (this.impulseFiles[this.impulseIndex] != null) {
      reader.readAsArrayBuffer(this.impulseFiles[this.impulseIndex]);
    }
  }

  changeImpulseBuffer() {
    this.getImpulseBuffer();
    this.reverb.buffer = this.impulseBuffer;
  }

  openMenu() {
    this.trigger.openMenu();
  }

  createNodes() {
    this.context = new AudioContext();
    this.filterLow = this.context.createBiquadFilter();
    this.filterHigh = this.context.createBiquadFilter();
    this.delay = this.context.createDelay();
    this.feedback = this.context.createGain();
    this.reverbDelay = this.context.createDelay(1);

    this.analyser = this.context.createAnalyser();

    this.input = this.context.createGain();
    this.activateNode = this.context.createGain();
    this.reverb = this.context.createConvolver();
    this.dryGain = this.context.createGain();
    this.filterLowReverb = this.context.createBiquadFilter();
    this.filterHighReverb = this.context.createBiquadFilter();
    this.wetGain = this.context.createGain();
    this.output = this.context.createGain();

    this.modulationGain = this.context.createGain();
    this.filterBp = this.context.createBiquadFilter();
    this.filterPeaking = this.context.createBiquadFilter();
    this.lfo = this.context.createOscillator();

    this.overdrive = this.context.createWaveShaper();
    this.bitcrush = this.context.createScriptProcessor(4096, 1, 1);

    this.mediaStreamDestination = this.context.createMediaStreamDestination();
    this.audioOutputStream = this.mediaStreamDestination.stream;
    this.recorder = new RecordRTC(this.audioOutputStream, {
      type: 'audio',
    });
  }

  play() {
    if (this.isPlaying == false) {
      this.isPlaying = true;
      this.createNodes();
      this.setEffects();
    } else {
      this.isPlaying = false;
      if (this.source != null) {
        this.context.suspend();
        this.chooseFile(this.currentAudio);
        if (this.timeout != null) {
          clearTimeout(this.timeout);
        }
        if (this.soundIsRecording) {
          this.recorder.stopRecording(() => {
            const audioBlob = this.recorder.getBlob();
            let dateTime = new Date();
            let dateTimeString = dateTime.toLocaleString();
            const recFile = new File(
              [audioBlob],
              'synesthezia_' + dateTimeString
            );
            this.audioFiles.push(recFile);
            this.downloadableFiles.push(recFile);
          });
        }
        this.source.stop();
        this.resetDraw();
      }
    }
  }

  setEffects() {
    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;

    if (this.chain.length > 0) {
      if (this.chain[0] == 'cutoff') {
        this.setCutoff(this.source, 0);
      }
      if (this.chain[0] == 'delay') {
        this.setDelay(this.source, 0);
      }
      if (this.chain[0] == 'reverb') {
        this.setReverb(this.source, 0);
      }
      if (this.chain[0] == 'space') {
        this.setWahWah(this.source, 0);
      }
      if (this.chain[0] == 'overdrive') {
        this.setOverdrive(this.source, 0);
      }
    } else {
      this.source.connect(this.analyser);
    }
    if (this.chain.length > 1) {
      if (this.chain[1] == 'cutoff') {
        this.setCutoff(this.source, 1);
      }
      if (this.chain[1] == 'delay') {
        this.setDelay(this.source, 1);
      }
      if (this.chain[1] == 'reverb') {
        this.setReverb(this.source, 1);
      }
      if (this.chain[1] == 'space') {
        this.setWahWah(this.source, 1);
      }
      if (this.chain[1] == 'overdrive') {
        this.setOverdrive(this.source, 1);
      }
    }
    if (this.chain.length > 2) {
      if (this.chain[2] == 'cutoff') {
        this.setCutoff(this.source, 2);
      }
      if (this.chain[2] == 'delay') {
        this.setDelay(this.source, 2);
      }
      if (this.chain[2] == 'reverb') {
        this.setReverb(this.source, 2);
      }
      if (this.chain[2] == 'space') {
        this.setWahWah(this.source, 2);
      }
      if (this.chain[2] == 'overdrive') {
        this.setOverdrive(this.source, 2);
      }
    }
    if (this.chain.length > 3) {
      if (this.chain[3] == 'cutoff') {
        this.setCutoff(this.source, 3);
      }
      if (this.chain[3] == 'delay') {
        this.setDelay(this.source, 3);
      }
      if (this.chain[3] == 'reverb') {
        this.setReverb(this.source, 3);
      }
      if (this.chain[3] == 'space') {
        this.setWahWah(this.source, 3);
      }
      if (this.chain[3] == 'overdrive') {
        this.setOverdrive(this.source, 3);
      }
    }
    if (this.chain.length > 4) {
      if (this.chain[4] == 'cutoff') {
        this.setCutoff(this.source, 4);
      }
      if (this.chain[4] == 'delay') {
        this.setDelay(this.source, 4);
      }
      if (this.chain[4] == 'reverb') {
        this.setReverb(this.source, 4);
      }
      if (this.chain[4] == 'space') {
        this.setWahWah(this.source, 4);
      }
      if (this.chain[4] == 'overdrive') {
        this.setOverdrive(this.source, 4);
      }
    }

    this.analyser.connect(this.context.destination);
    if (this.soundIsRecording) {
      this.analyser.connect(this.mediaStreamDestination);
      this.recorder.startRecording();
    }
    this.source.start();
    this.draw();
  }

  setCutoff(source: AudioBufferSourceNode, position: number) {
    this.filterLow.type = 'lowpass';
    this.filterLow.frequency.value = this.cutoff;
    this.filterLow.Q.value = this.qFactor;
    if (position == 0) {
      source.connect(this.filterLow);
    } else {
      if (this.chain[position - 1] == 'delay') {
        this.delay.connect(this.filterLow);
      }
      if (this.chain[position - 1] == 'reverb') {
        this.output.connect(this.filterLow);
      }
      if (this.chain[position - 1] == 'space') {
        this.filterBp.connect(this.filterLow);
      }
      if (this.chain[position - 1] == 'overdrive') {
        this.overdrive.connect(this.filterLow);
      }
    }
    this.filterHigh.type = 'highpass';
    this.filterHigh.frequency.value = this.cutoffHigh;
    this.filterHigh.Q.value = this.qFactor;
    this.filterLow.connect(this.filterHigh);
    if (this.chain[this.chain.length - 1] == 'cutoff') {
      this.filterHigh.connect(this.analyser);
    }
  }

  setDelay(source: AudioBufferSourceNode, position: number) {
    this.delay.delayTime.value = this.delayTime;
    this.feedback.gain.value = this.delayFeedback;
    if (position == 0) {
      source.connect(this.delay);
    } else {
      if (this.chain[position - 1] == 'cutoff') {
        this.filterHigh.connect(this.delay);
      }
      if (this.chain[position - 1] == 'reverb') {
        this.output.connect(this.delay);
      }
      if (this.chain[position - 1] == 'space') {
        this.filterBp.connect(this.delay);
      }
      if (this.chain[position - 1] == 'overdrive') {
        this.overdrive.connect(this.delay);
      }
    }

    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    if (this.chain[this.chain.length - 1] == 'delay') {
      this.delay.connect(this.analyser);
    }
  }

  setReverb(source: AudioBufferSourceNode, position: number) {
    if (position == 0) {
      source.connect(this.activateNode);
    } else {
      if (this.chain[position - 1] == 'cutoff') {
        this.filterHigh.connect(this.activateNode);
      }
      if (this.chain[position - 1] == 'delay') {
        this.delay.connect(this.activateNode);
      }
      if (this.chain[position - 1] == 'space') {
        this.filterBp.connect(this.activateNode);
      }
      if (this.chain[position - 1] == 'overdrive') {
        this.overdrive.connect(this.activateNode);
      }
    }
    this.getImpulseBuffer();
    this.reverb.buffer = this.impulseBuffer;
    this.activateNode.connect(this.filterLowReverb);
    this.activateNode.connect(this.dryGain);
    this.filterLowReverb.connect(this.filterHighReverb);
    this.filterHighReverb.connect(this.reverb);
    this.reverb.connect(this.wetGain);
    this.wetGain.connect(this.output);
    this.dryGain.connect(this.output);

    this.activateNode.gain.value = 1;
    this.dryGain.gain.value = this.dryGainValue;
    this.wetGain.gain.value = this.wetGainValue;
    this.filterLowReverb.type = 'lowpass';
    this.filterHighReverb.type = 'highpass';
    this.filterLowReverb.frequency.value = 19000;
    this.filterHighReverb.frequency.value = 20;
    this.output.gain.value = 1;

    if (this.chain[this.chain.length - 1] == 'reverb') {
      this.output.connect(this.analyser);
    }
  }

  setWahWah(source: AudioBufferSourceNode, position: number) {
    if (position == 0) {
      source.connect(this.filterBp);
    } else {
      if (this.chain[position - 1] == 'cutoff') {
        this.filterHigh.connect(this.filterBp);
      }
      if (this.chain[position - 1] == 'delay') {
        this.delay.connect(this.filterBp);
      }
      if (this.chain[position - 1] == 'reverb') {
        this.output.connect(this.filterBp);
      }
      if (this.chain[position - 1] == 'overdrive') {
        this.overdrive.connect(this.filterBp);
      }
    }

    this.filterBp.type = 'bandpass';
    this.filterBp.frequency.value = this.wahwahFrequencyMin;
    this.filterBp.Q.value = this.wahwahPeaking;

    if (this.chain[this.chain.length - 1] == 'space') {
      this.filterBp.connect(this.analyser);
    }
    this.wahwahEffect();
  }

  setOverdrive(source: AudioBufferSourceNode, position: number) {
    if (position == 0) {
      source.connect(this.bitcrush);
      this.bitcrush.connect(this.overdrive);
    } else {
      if (this.chain[position - 1] == 'cutoff') {
        this.filterHigh.connect(this.bitcrush);
        this.bitcrush.connect(this.overdrive);
      }
      if (this.chain[position - 1] == 'delay') {
        this.delay.connect(this.bitcrush);
        this.bitcrush.connect(this.overdrive);
      }
      if (this.chain[position - 1] == 'reverb') {
        this.output.connect(this.bitcrush);
        this.bitcrush.connect(this.overdrive);
      }
      if (this.chain[position - 1] == 'space') {
        this.filterBp.connect(this.bitcrush);
        this.bitcrush.connect(this.overdrive);
      }
    }

    this.overdrive.curve = this.makeDistortionCurve(this.overdriveAmount);
    this.setBitcrush();

    if (this.chain[this.chain.length - 1] == 'overdrive') {
      this.overdrive.connect(this.analyser);
    }
  }

  setBitcrush() {
    this.bitcrush.onaudioprocess = (e) => {
      var phaser = 0;
      var last = 0;
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);
      var step = Math.pow(1 / 2, 4);
      var length = input.length;
      for (let i = 0; i < length; i++) {
        phaser += this.normFreq;
        if (phaser >= 1.0) {
          phaser -= 1.0;
          last = step * Math.floor(input[i] / step + 0.5);
        }
        output[i] = last;
      }
    };
  }

  makeBitcrush(e: AudioProcessingEvent) {
    var phaser = 0;
    var last = 0;
    const input = e.inputBuffer.getChannelData(0);
    const output = e.outputBuffer.getChannelData(0);
    var step = Math.pow(1 / 2, 4);
    var length = input.length;
    for (let i = 0; i < length; i++) {
      phaser += this.normFreq;
      if (phaser >= 1.0) {
        phaser -= 1.0;
        last = step * Math.floor(input[i] / step + 0.5);
      }
      output[i] = last;
    }
  }

  makeDistortionCurve(amount: number) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < n_samples; i++) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  wahwahEffect() {
    this.wahwahTime = this.context.currentTime;

    this.filterBp.frequency.setValueAtTime(
      this.wahwahFrequencyMin,
      this.wahwahTime
    );
    this.filterBp.frequency.linearRampToValueAtTime(
      this.wahwahFrequencyMax,
      this.wahwahTime + this.duration
    );
    this.filterBp.frequency.linearRampToValueAtTime(
      this.wahwahFrequencyMin,
      this.wahwahTime + 2 * this.duration
    );

    this.timeout = setTimeout(() => {
      this.wahwahEffect();
    }, 3000 * this.duration);
  }

  calcCutoff() {
    const rect = this.cutoffField.nativeElement.getBoundingClientRect();
    const l = rect.left;
    const r = rect.right;
    const rectCursor = this.cutoffCursor.nativeElement.getBoundingClientRect();
    const c = rectCursor.left;
    const x = (c - l) / (r - l);
    this.cutoff = 17000 * Math.pow(x, 2);
    if (this.cutoff < 20) {
      this.cutoff = 20;
    }

    const t = rect.top;
    const d = rect.bottom;
    const cTop = rectCursor.top;
    const y = (t - cTop) / (t - d);

    if (y != 0) {
      this.cutoffHigh = 200 * (1 / Math.pow(y, 2));
    } else {
      this.cutoffHigh = 17000;
    }

    this.filterLow.frequency.value = this.cutoff;
    this.filterHigh.frequency.value = this.cutoffHigh;
  }

  calcDelay() {
    const rect = this.delayField.nativeElement.getBoundingClientRect();
    const l = rect.left;
    const r = rect.right;
    const rectCursor = this.delayCursor.nativeElement.getBoundingClientRect();
    const c = rectCursor.left;
    const x = ((c - l) / (r - l)) * 4;
    this.delayTime = x;

    const t = rect.top;
    const d = rect.bottom;
    const cTop = rectCursor.top;
    const y = (t - cTop) / (t - d);
    this.delayFeedback = y;

    this.delay.delayTime.value = this.delayTime;
    this.feedback.gain.value = this.delayFeedback;
  }

  calcReverb() {
    const rect = this.reverbField.nativeElement.getBoundingClientRect();
    const l = rect.left;
    const r = rect.right;
    const t = rect.top;
    const d = rect.bottom;
    const rectCursor = this.reverbCursor.nativeElement.getBoundingClientRect();
    const c = rectCursor.left;
    const tc = rectCursor.top;
    let x = (c - l) / (r - l);

    if (x <= 0.25 && this.impulseIndex != 0) {
      this.impulseIndex = 0;
      this.changeImpulseBuffer();
    }
    if (x > 0.25 && x <= 0.5 && this.impulseIndex != 1) {
      console.log(x);
      this.impulseIndex = 1;
      this.changeImpulseBuffer();
    }
    if (x > 0.5 && x <= 0.75 && this.impulseIndex != 2) {
      this.impulseIndex = 2;
      this.changeImpulseBuffer();
    }
    if (x > 0.75 && this.impulseIndex != 3) {
      this.impulseIndex = 3;
      this.changeImpulseBuffer();
    }

    let y = (tc - d) / (t - d);
    this.dryGainValue = 1.0 - y;
    this.wetGainValue = y;

    this.dryGain.gain.value = this.dryGainValue;
    this.wetGain.gain.value = this.wetGainValue;
  }

  calcWahWah() {
    const rect = this.wahwahField.nativeElement.getBoundingClientRect();
    const l = rect.left;
    const r = rect.right;
    const t = rect.top;
    const d = rect.bottom;
    const rectCursor = this.wahwahCursor.nativeElement.getBoundingClientRect();
    const c = rectCursor.left;
    const tc = rectCursor.top;
    const x = (c - l) / (r - l);

    this.wahwahFrequencyMin = (17000 * Math.pow(x, 2)) / 10;
    if (this.wahwahFrequencyMin < 20) {
      this.wahwahFrequencyMin = 20;
    }
    this.wahwahFrequencyMax = this.wahwahFrequencyMin * 10;
    let y = (tc - d) / (t - d);
    let y_freq = Math.pow(y, 2) * 1000;
    this.wahwahPeaking = y_freq;
    this.duration = 1 - y;

    this.filterBp.Q.value = this.wahwahPeaking;
  }

  calcOverdrive() {
    const rect = this.overdriveField.nativeElement.getBoundingClientRect();
    const l = rect.left;
    const r = rect.right;
    const rectCursor =
      this.overdriveCursor.nativeElement.getBoundingClientRect();
    const c = rectCursor.left;
    const x = (c - l) / (r - l);

    let amount = (x / 2) * 500;
    this.overdriveAmount = amount;

    this.overdrive.curve = this.makeDistortionCurve(this.overdriveAmount);

    this.calcBitcrush();
  }

  calcBitcrush() {
    const rect = this.overdriveField.nativeElement.getBoundingClientRect();
    const rectCursor =
      this.overdriveCursor.nativeElement.getBoundingClientRect();
    const t = rect.top;
    const d = rect.bottom;
    const tc = rectCursor.top;
    const x = (tc - d) / (t - d);

    let amount = x / 10;
    this.normFreq = amount;
  }

  draw() {
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.animationReq = requestAnimationFrame(this.draw.bind(this));

    this.analyser.getByteFrequencyData(dataArray);

    if (this.canvas != null && this.canvasMirror != null) {
      const WIDTH = this.canvas.width;
      const HEIGHT = this.canvas.height;

      if (this.graph != null && this.graphMirror != null) {
        this.graph.fillStyle = 'rgb(0, 0, 0)';
        this.graphMirror.fillStyle = 'rgb(0,0,0)';
        this.graph.fillRect(0, 0, WIDTH, HEIGHT);
        this.graphMirror.fillRect(0, 0, WIDTH, HEIGHT);
        const barWidth = (WIDTH / bufferLength) * 5;
        let barHeight;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i];

          const red = i * 2;
          const green = i * 4;
          const blue = i * 6;

          this.graph.fillStyle = 'rgb(' + red + ',' + green + ',' + blue + ')';
          this.graphMirror.fillStyle =
            'rgb(' + red + ',' + green + ',' + blue + ')';
          this.graph.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight);
          this.graphMirror.fillRect(
            x,
            HEIGHT - barHeight / 2,
            barWidth,
            barHeight
          );

          x += barWidth + 1;
        }
      }
    }
  }

  resetDraw() {
    cancelAnimationFrame(this.animationReq);
    if (
      this.graph != null &&
      this.graphMirror != null &&
      this.canvas != null &&
      this.canvasMirror != null
    ) {
      this.graph.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.graphMirror.clearRect(
        0,
        0,
        this.canvasMirror.width,
        this.canvasMirror.height
      );
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'p') {
      this.play();
    }
  }

  recording() {
    if (this.isRecording == false) {
      this.initiateRecording();
    } else {
      this.stopRecording();
    }
  }

  sanitize(url: string) {
    return this.domSanitizer.bypassSecurityTrustUrl(url);
  }

  initiateRecording() {
    this.isRecording = true;
    let mediaConstraints = {
      video: false,
      audio: true,
    };
    navigator.mediaDevices
      .getUserMedia(mediaConstraints)
      .then(this.successCallback.bind(this));
  }

  successCallback(stream: any) {
    var options = {
      mimeType: 'audio/wav',
      numberOfAudioChannels: 1,
      sampleRate: 16000,
    };

    var StereoAudioRecorder = RecordRTC.StereoAudioRecorder;
    this.record = new StereoAudioRecorder(stream, {
      sampleRate: 44100,
      bufferSize: 4096,
    });
    this.record.record();
  }

  stopRecording() {
    this.isRecording = false;
    this.record.stop(this.processRecording.bind(this));
  }

  processRecording(blob: Blob) {
    this.url = URL.createObjectURL(blob);
    console.log('blob', blob);
    console.log('url', this.url);
    let dateTime = new Date();
    let dateTimeString = dateTime.toLocaleString();
    const file = new File([blob], 'record_' + dateTimeString);
    this.audioFiles.push(file);
  }

  activateCutoff() {
    if (this.isCutoff == false) {
      this.isCutoff = true;
      this.cutoffTitle.nativeElement.style.opacity = '1.0';
      this.chain.push('cutoff');
    } else {
      this.isCutoff = false;
      this.cutoffTitle.nativeElement.style.opacity = '0.5';
      var index = this.chain.indexOf('cutoff');
      this.chain.splice(index, 1);
    }
    this.displayChain();
  }

  activateDelay() {
    if (this.isDelay == false) {
      this.isDelay = true;
      this.delayTitle.nativeElement.style.opacity = '1.0';
      this.chain.push('delay');
      console.log(this.chain);
    } else {
      this.isDelay = false;
      this.delayTitle.nativeElement.style.opacity = '0.5';
      var index = this.chain.indexOf('delay');
      this.chain.splice(index, 1);
    }
    this.displayChain();
  }

  activateReverb() {
    if (this.isReverb == false) {
      this.isReverb = true;
      this.reverbTitle.nativeElement.style.opacity = '1.0';
      this.chain.push('reverb');
    } else {
      this.isReverb = false;
      this.reverbTitle.nativeElement.style.opacity = '0.5';
      var index = this.chain.indexOf('reverb');
      this.chain.splice(index, 1);
    }
    this.displayChain();
  }

  activateWahWah() {
    if (this.isWahWah == false) {
      this.isWahWah = true;
      this.wahwahTitle.nativeElement.style.opacity = '1.0';
      this.chain.push('space');
    } else {
      this.isWahWah = false;
      this.wahwahTitle.nativeElement.style.opacity = '0.5';
      var index = this.chain.indexOf('space');
      this.chain.splice(index, 1);
    }
    this.displayChain();
  }

  activateOverdrive() {
    if (this.isOverdrive == false) {
      this.isOverdrive = true;
      this.overdriveTitle.nativeElement.style.opacity = '1.0';
      this.chain.push('overdrive');
    } else {
      this.isOverdrive = false;
      this.overdriveTitle.nativeElement.style.opacity = '0.5';
      var index = this.chain.indexOf('overdrive');
      this.chain.splice(index, 1);
    }
    this.displayChain();
  }

  displayChain() {
    this.entry_one = '';
    this.entry_two = '';
    this.entry_three = '';
    this.entry_four = '';
    this.entry_five = '';

    if (this.chain[0] != null) {
      this.entry_one = ' > ' + this.chain[0];
    }
    if (this.chain[1] != null) {
      this.entry_two = ' > ' + this.chain[1];
    }
    if (this.chain[2] != null) {
      this.entry_three = ' > ' + this.chain[2];
    }
    if (this.chain[3] != null) {
      this.entry_four = ' > ' + this.chain[3];
    }
    if (this.chain[4] != null) {
      this.entry_five = ' > ' + this.chain[4];
    }
  }

  setupRecording() {
    if (this.soundIsRecording == false && this.isPlaying == false) {
      this.soundIsRecording = true;
      console.log('test');
    } else if (this.soundIsRecording == true && this.isPlaying == false) {
      this.soundIsRecording = false;
      console.log('test2');
    }
  }

  downloadFile(file: File) {
    const blob = new Blob([file], { type: 'audio/mpeg' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

class BitCrusher extends AudioWorkletNode {}
