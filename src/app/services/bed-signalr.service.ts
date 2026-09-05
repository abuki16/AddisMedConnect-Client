import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { hubUrl } from '../core/api.config';

@Injectable({
  providedIn: 'root',
})
export class BedSignalRService {
  private auth = inject(AuthService);
  private hubConnection!: signalR.HubConnection;
  private bedStatusUpdatedSource = new Subject<{ bedId: string; status: string }>();

  public bedStatusUpdated$ = this.bedStatusUpdatedSource.asObservable();

  public startConnection(): void {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${hubUrl}/beds`, {
        accessTokenFactory: () => this.auth.token || '',
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('SignalR Connection started for Beds Hub'))
      .catch((err) => {
        console.warn('SignalR WebSocket failed, attempting fallback negotiation:', err);
        // Fallback with negotiation
        this.hubConnection = new signalR.HubConnectionBuilder()
          .withUrl(`${hubUrl}/beds`, {
            accessTokenFactory: () => this.auth.token || '',
          })
          .withAutomaticReconnect()
          .build();
        this.hubConnection.start().catch((fallbackErr) => {
          console.error('Beds Hub SignalR connection failed:', fallbackErr);
        });
      });

    this.hubConnection.on('ReceiveBedStatusUpdate', (...args: any[]) => {
      if (args.length === 1 && typeof args[0] === 'object') {
        const payload = args[0];
        this.bedStatusUpdatedSource.next({
          bedId: payload.bedId || payload.BedId,
          status: payload.status || payload.Status,
        });
      } else if (args.length >= 2) {
        this.bedStatusUpdatedSource.next({
          bedId: args[1] || args[0],
          status: args[2] || args[1],
        });
      }
    });

    this.hubConnection.on('ReceiveHospitalBedCountUpdate', () => {
      this.bedStatusUpdatedSource.next({ bedId: '', status: 'REFRESH' });
    });
  }

  public joinHospitalGroup(hospitalId: string): void {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('JoinHospitalGroup', hospitalId).catch(console.error);
    }
  }

  public leaveHospitalGroup(hospitalId: string): void {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('LeaveHospitalGroup', hospitalId).catch(console.error);
    }
  }

  public stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
  }
}
