import { HttpContext } from '@angular/common/http';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';
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

  filter = this.context.createBiquadFilter();

  audioFiles: File[] = [];
  fileList: FileList | null = null;
  currentAudio: File | null = null;

  isPlaying: boolean = false;

  @ViewChild(MatMenuTrigger) trigger!: MatMenuTrigger;
  @ViewChild('cutoffCursor') cutoffCursor!: ElementRef;
  @ViewChild('cutoffField') cutoffField!: ElementRef;

  isCutoff: boolean = true;
  cutoff: number = 50;
  qFactor: number = 2;

  constructor(public dialog: MatDialog) {
    this.addAudioFiles();
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
        this.filter.type = 'bandpass';
        this.filter.frequency.value = this.cutoff;
        this.filter.Q.value = this.qFactor;
        this.source.connect(this.filter).connect(this.context.destination);
      } else {
        this.source.connect(this.context.destination);
      }
      this.source.start();
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
    this.cutoff = 14000 * x;
    if (this.cutoff < 20) {
      this.cutoff = 20;
    }

    const t = rect.top;
    const d = rect.bottom;
    const cTop = rectCursor.top;
    const y = (t - cTop) / (t - d);
    this.qFactor = 20 * y;
    if (this.qFactor < 0.5) {
      this.qFactor = 0.5;
    }

    this.filter.frequency.value = this.cutoff;
    this.filter.Q.value = this.qFactor;
    console.log(this.qFactor);
  }
}
