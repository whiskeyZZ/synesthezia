import * as RecordRTC from 'recordrtc';
import { Component, ElementRef, ViewChild } from '@angular/core';
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
  source: AudioBufferSourceNode | null = null;

  filterLow = this.context.createBiquadFilter();
  filterHigh = this.context.createBiquadFilter();

  analyser: AnalyserNode = this.context.createAnalyser();

  canvas: HTMLCanvasElement | null = null;

  audioFiles: File[] = [];
  fileList: FileList | null = null;
  currentAudio: File | null = null;

  @ViewChild(MatMenuTrigger) trigger!: MatMenuTrigger;
  @ViewChild('cutoffCursor') cutoffCursor!: ElementRef;
  @ViewChild('cutoffField') cutoffField!: ElementRef;
  @ViewChild('cutoffTitle') cutoffTitle!: ElementRef;

  isPlaying: boolean = false;
  isCutoff: boolean = false;
  cutoff: number = 50;
  cutoffHigh: number = 20;
  qFactor: number = 2;

  record: any;
  isRecording = false;
  url: any;

  constructor(public dialog: MatDialog, private domSanitizer: DomSanitizer) {
    this.addAudioFiles();

    this.analyser.fftSize = 2048;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
  }

  ngOnInit() {
    this.canvas = <HTMLCanvasElement>document.getElementById('graph');
  }

  openInfo(): void {
    const dialogRef = this.dialog.open(InfoDialogComponent, {
      width: '50%',
    });
  }

  openFileManager() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp3';
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

  chooseFile(file: File) {
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

  openMenu() {
    this.trigger.openMenu();
  }

  play() {
    if (this.isPlaying == false) {
      this.isPlaying = true;
      this.source = this.context.createBufferSource();
      this.source.buffer = this.buffer;
      if (this.isCutoff) {
        this.filterLow.type = 'lowpass';
        this.filterLow.frequency.value = this.cutoff;
        this.filterLow.Q.value = this.qFactor;
        this.source.connect(this.filterLow);
        this.filterHigh.type = 'highpass';
        this.filterHigh.frequency.value = this.cutoffHigh;
        this.filterHigh.Q.value = this.qFactor;
        this.filterLow.connect(this.filterHigh);
        this.filterHigh.connect(this.analyser);
      } else {
        this.source.connect(this.analyser);
      }

      this.analyser.connect(this.context.destination);
      this.source.start();
      this.draw();
    } else {
      this.isPlaying = false;
      if (this.source != null) {
        this.source.stop();
      }
    }
  }

  calcCutoff() {
    const rect = this.cutoffField.nativeElement.getBoundingClientRect();
    const l = rect.left;
    const r = rect.right;
    const rectCursor = this.cutoffCursor.nativeElement.getBoundingClientRect();
    const c = rectCursor.left;
    const x = (c - l) / (r - l);
    this.cutoff = 17000 * x;
    if (this.cutoff < 20) {
      this.cutoff = 20;
    }

    const t = rect.top;
    const d = rect.bottom;
    const cTop = rectCursor.top;
    const y = (t - cTop) / (t - d);

    if (y != 0) {
      this.cutoffHigh = 200 * (1 / y);
    } else {
      this.cutoffHigh = 17000;
    }

    this.filterLow.frequency.value = this.cutoff;
    this.filterHigh.frequency.value = this.cutoffHigh;
  }

  draw() {
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    requestAnimationFrame(this.draw.bind(this));

    this.analyser.getByteFrequencyData(dataArray);

    if (this.canvas != null) {
      const WIDTH = this.canvas.width;
      const HEIGHT = this.canvas.height;

      var graph = this.canvas.getContext('2d');

      if (graph != null) {
        graph.fillStyle = 'rgb(0, 0, 0)';
        graph.fillRect(0, 0, WIDTH, HEIGHT);
        const barWidth = (WIDTH / bufferLength) * 5;
        let barHeight;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i];

          graph.fillStyle = `rgb(255, 255, 255)`; //`rgb(${barHeight + 100}, 50, 50)`;
          graph.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight);

          x += barWidth + 1;
        }
      }
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
    } else {
      this.isCutoff = false;
      this.cutoffTitle.nativeElement.style.opacity = '0.5';
    }
  }
}
