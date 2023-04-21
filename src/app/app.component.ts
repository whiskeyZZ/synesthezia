import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { InfoDialogComponent } from './info-dialog/info-dialog.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'synesthezia';
  context: AudioContext;
  audioFiles: File[] = [];
  fileList: FileList | null = null;

  constructor(public dialog: MatDialog) {
    this.context = new AudioContext();
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

  showAudioFiles() {
    this.audioFiles.forEach((element) => {
      console.log(element.name);
    });
  }
}
