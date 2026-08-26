import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BedSignalRService {
  private hubConnection!: signalR.HubConnection;
  private bedStatusUpdatedSource = new Subject<{ bedId: string; status: string }>();

  public bedStatusUpdated$ = this.bedStatusUpdatedSource.asObservable();

  public startConnection(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5057/hubs/beds', {
        withCredentials: true
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('SignalR Connection started for Beds Hub'))
      .catch(err => console.error('Error while starting SignalR connection: ', err));

    this.hubConnection.on('ReceiveBedStatusUpdate', (hospitalId: string, bedId: string, status: string) => {
      this.bedStatusUpdatedSource.next({ bedId, status });
    });
  }

  public stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
  }
}