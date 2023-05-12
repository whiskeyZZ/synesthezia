import * as RecordRTC from 'recordrtc';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';
import { DomSanitizer } from '@angular/platform-browser';
import { InfoDialogComponent } from './info-dialog/info-dialog.component';

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

  filterLow = this.context.createBiquadFilter();
  filterHigh = this.context.createBiquadFilter();
  delay = this.context.createDelay();
  feedback = this.context.createGain();
  reverb = this.context.createConvolver();
  reverbDelay = this.context.createDelay(1);
  multitap: Array<DelayNode> = [];
  multitapGain = this.context.createGain();
  dryGain = this.context.createGain();
  wetGain = this.context.createGain();

  analyser: AnalyserNode = this.context.createAnalyser();

  canvas: HTMLCanvasElement | null = null;
  canvasMirror: HTMLCanvasElement | null = null;

  audioFiles: File[] = [];
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

  graph: CanvasRenderingContext2D | null = null;
  graphMirror: CanvasRenderingContext2D | null = null;

  isPlaying: boolean = false;
  isCutoff: boolean = false;
  isDelay: boolean = false;
  isReverb: boolean = false;
  cutoff: number = 50;
  cutoffHigh: number = 20;
  delayTime: number = 1;
  delayFeedback: number = 0.1;
  qFactor: number = 2;
  chain: string[] = [];

  animationReq: number = 0;

  record: any;
  isRecording = false;
  url: any;

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
    const soundFileNames = ['punch.wav'];

    soundFileNames.forEach((fileName) => {
      fetch(soundPath + fileName)
        .then((response) => response.blob())
        .then((blob) => {
          const file = new File([blob], fileName);
          this.impulseFiles.push(file);
        });
    });
  }

  getImpulseBuffer() {
    console.log('Test234');
    console.log(this.impulseFiles);
    const reader = new FileReader();
    reader.onload = () => {
      console.log('test333');
      const arrayBuffer = reader.result as ArrayBuffer;
      this.context.decodeAudioData(arrayBuffer, (audioBuffer) => {
        this.impulseBuffer = audioBuffer;
      });
    };
    if (this.impulseFiles[0] != null) {
      reader.readAsArrayBuffer(this.impulseFiles[0]);
    }
  }

  openMenu() {
    this.trigger.openMenu();
  }

  play() {
    if (this.isPlaying == false) {
      this.isPlaying = true;
      this.setEffects();
    } else {
      this.isPlaying = false;
      if (this.source != null) {
        this.context.suspend();
        this.chooseFile(this.currentAudio);
        this.source.stop();
        this.resetDraw();
      }
    }
  }

  setEffects() {
    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    /*this.setCutoff(this.source);
    this.setDelay(this.source);
    this.setReverb();*/
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
    }
    this.analyser.connect(this.context.destination);
    this.context.resume();
    this.source.start();
    this.draw();
  }

  setCutoff(source: AudioBufferSourceNode, position: number) {
    if (this.isCutoff) {
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
          this.reverb.connect(this.filterLow);
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
        this.reverb.connect(this.delay);
      }
    }
    /*if (this.isCutoff) {
      this.filterHigh.connect(this.delay);
    }
    if (!this.isCutoff) {
      source.connect(this.delay);
    }*/
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    if (this.chain[this.chain.length - 1] == 'delay') {
      this.delay.connect(this.analyser);
    }
    //this.delay.connect(this.analyser);
  }

  setReverb(source: AudioBufferSourceNode, position: number) {
    this.reverbDelay.delayTime.setValueAtTime(0.03, this.context.currentTime);

    for (let i = 2; i > 0; i--) {
      this.multitap.push(this.context.createDelay(1));
    }
    this.multitap.map((t, i) => {
      if (this.multitap[i + 1]) {
        t.connect(this.multitap[i + 1]);
      }
      t.delayTime.setValueAtTime(
        0.001 + i * (0.03 / 2),
        this.context.currentTime
      );
    });

    /*this.multitap[this.multitap.length - 1].connect(this.multitapGain);
    this.multitapGain.gain.value = 0.5;
    this.multitapGain.connect(this.analyser);*/

    this.dryGain.gain.value = 0.1;
    this.wetGain.gain.value = 0.9;
    if (position == 0) {
      source.connect(this.reverb);
      source.connect(this.dryGain);
    } else {
      if (this.chain[position - 1] == 'cutoff') {
        this.filterHigh.connect(this.reverb);
        this.filterHigh.connect(this.dryGain);
      }
      if (this.chain[position - 1] == 'delay') {
        this.delay.connect(this.reverb);
        this.delay.connect(this.dryGain);
      }
    }
    this.getImpulseBuffer();
    this.reverb.buffer = this.impulseBuffer;
    this.reverb.connect(this.wetGain);

    if (this.chain[this.chain.length - 1] == 'reverb') {
      this.dryGain.connect(this.analyser);
      this.wetGain.connect(this.analyser);
    }

    console.log(this.chain);
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
    let x = (c - l) / (r - l);
    /*if (x < 1) {
      x = 1;
    }*/

    this.dryGain.gain.value = 1.0 - x;
    this.wetGain.gain.value = x;
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

          this.graph.fillStyle = `rgb(255, 255, 255)`;
          this.graphMirror.fillStyle = `rgb(255, 255, 255)`;
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
    //Start Actuall Recording
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
      console.log(this.chain);
    }
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
  }
}
