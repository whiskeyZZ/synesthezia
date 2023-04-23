import { Component, ViewChild } from '@angular/core';
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
  context: AudioContext;
  buffer: AudioBuffer | null = null;

  audioFiles: File[] = [];
  fileList: FileList | null = null;
  currentAudio: File | null = null;

  @ViewChild(MatMenuTrigger) trigger!: MatMenuTrigger;

  constructor(public dialog: MatDialog) {
    this.context = new AudioContext();

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
    const soundFileNames = ['bell.mp3'];

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
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.context.destination);
    source.start(0);
  }
}
