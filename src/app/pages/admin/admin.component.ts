import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { apiUrl, hubUrl } from '../../core/api.config';

export interface AdminMetrics {
  totalIncidents: number;
  activeIncidents: number;
  dispatchedIncidents: number;
  admittedIncidents: number;
  resolvedIncidents: number;
  partnerHospitals: number;
  fleetUnits: number;
  availableAmbulances: number;
  dispatchedAmbulances: number;
  maintenanceAmbulances: number;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  cleaningBeds: number;
  recentCases: any[];
}

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  public auth = inject(AuthService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  metrics: AdminMetrics = {
    totalIncidents: 0,
    activeIncidents: 0,
    dispatchedIncidents: 0,
    admittedIncidents: 0,
    resolvedIncidents: 0,
    partnerHospitals: 0,
    fleetUnits: 0,
    availableAmbulances: 0,
    dispatchedAmbulances: 0,
    maintenanceAmbulances: 0,
    totalBeds: 0,
    availableBeds: 0,
    occupiedBeds: 0,
    cleaningBeds: 0,
    recentCases: [],
  };

  isLoading = true;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' = 'connecting';
  lastLiveEventText = '';

  private emergencyHubConnection?: signalR.HubConnection;
  private bedsHubConnection?: signalR.HubConnection;

  ngOnInit(): void {
    this.loadMetrics(false);
    this.initSignalRConnections();
  }

  ngOnDestroy(): void {
    this.stopSignalRConnections();
  }

  loadMetrics(interactive = false): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.http.get<AdminMetrics>(`${apiUrl}/admin/metrics`).subscribe({
      next: (data) => {
        this.zone.run(() => {
          this.metrics = {
            ...data,
            recentCases: data.recentCases || [],
          };
          this.isLoading = false;
          this.cdr.detectChanges();
          if (interactive) {
            this.toast.info('Control center telemetry refreshed.');
          }
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
          if (err.status === 401 || err.status === 403) {
            this.toast.error('Session expired or unauthorized. Please sign in as SystemAdmin.');
          } else {
            this.toast.error('Failed to load control center metrics.');
          }
        });
      },
    });
  }

  private initSignalRConnections(): void {
    const token = this.auth.token || '';
    if (!token) {
      this.connectionStatus = 'disconnected';
      return;
    }

    // 1. Emergency Hub (Incidents, Dispatches, Triage, Fleet)
    this.emergencyHubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${hubUrl}/emergency`, {
        accessTokenFactory: () => this.auth.token || '',
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    this.emergencyHubConnection.onreconnecting(() => {
      this.zone.run(() => {
        this.connectionStatus = 'connecting';
        this.cdr.detectChanges();
      });
    });

    this.emergencyHubConnection.onreconnected(() => {
      this.zone.run(() => {
        this.connectionStatus = 'connected';
        this.loadMetrics(false);
        this.cdr.detectChanges();
      });
    });

    this.emergencyHubConnection.onclose(() => {
      this.zone.run(() => {
        this.connectionStatus = 'disconnected';
        this.cdr.detectChanges();
      });
    });

    // Real-time Event Handlers
    this.emergencyHubConnection.on('MetricsUpdated', () => {
      this.zone.run(() => {
        this.lastLiveEventText = 'Metrics synchronized via WebSocket';
        this.loadMetrics(false);
      });
    });

    this.emergencyHubConnection.on('QueueUpdated', () => {
      this.zone.run(() => {
        this.lastLiveEventText = 'Case queue synchronized';
        this.loadMetrics(false);
      });
    });

    this.emergencyHubConnection.on('AmbulanceFleetUpdated', () => {
      this.zone.run(() => {
        this.lastLiveEventText = 'Fleet telemetry updated';
        this.loadMetrics(false);
      });
    });

    this.emergencyHubConnection.on('ReceiveEmergencyDispatch', (newCase: any) => {
      this.zone.run(() => {
        this.playAlertChime();
        this.toast.info(`🚨 New Emergency: ${newCase.incidentNumber} - ${newCase.patientName || 'Patient'}`);
        this.lastLiveEventText = `New incident ${newCase.incidentNumber} dispatched`;
        // Prepend to recentCases if not already present
        const exists = this.metrics.recentCases.some(
          (c) => c.incidentNumber === newCase.incidentNumber
        );
        if (!exists) {
          this.metrics.recentCases = [newCase, ...this.metrics.recentCases];
          this.metrics.totalIncidents++;
          this.metrics.activeIncidents++;
        }
        this.cdr.detectChanges();
      });
    });

    this.emergencyHubConnection
      .start()
      .then(() => {
        this.zone.run(() => {
          this.connectionStatus = 'connected';
          this.cdr.detectChanges();
        });
      })
      .catch((err) => {
        console.warn('Direct WebSocket for emergency hub failed, attempting negotiation fallback:', err);
        this.emergencyHubConnection = new signalR.HubConnectionBuilder()
          .withUrl(`${hubUrl}/emergency`, {
            accessTokenFactory: () => this.auth.token || '',
          })
          .withAutomaticReconnect()
          .build();

        this.emergencyHubConnection
          .start()
          .then(() => {
            this.zone.run(() => {
              this.connectionStatus = 'connected';
              this.cdr.detectChanges();
            });
          })
          .catch((fallbackErr) => {
            console.error('Emergency Hub connection failed:', fallbackErr);
            this.zone.run(() => {
              this.connectionStatus = 'disconnected';
              this.cdr.detectChanges();
            });
          });
      });

    // 2. Beds Hub (Live bed capacity updates)
    this.bedsHubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${hubUrl}/beds`, {
        accessTokenFactory: () => this.auth.token || '',
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    this.bedsHubConnection.on('ReceiveHospitalBedCountUpdate', () => {
      this.zone.run(() => {
        this.lastLiveEventText = 'Hospital bed capacity updated';
        this.loadMetrics(false);
      });
    });

    this.bedsHubConnection.on('ReceiveBedStatusUpdate', () => {
      this.zone.run(() => {
        this.lastLiveEventText = 'Bed status updated';
        this.loadMetrics(false);
      });
    });

    this.bedsHubConnection.start().catch((err) => {
      console.warn('Beds Hub connection fallback:', err);
      this.bedsHubConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${hubUrl}/beds`, {
          accessTokenFactory: () => this.auth.token || '',
        })
        .withAutomaticReconnect()
        .build();
      this.bedsHubConnection.start().catch(() => {});
    });
  }

  private stopSignalRConnections(): void {
    if (this.emergencyHubConnection) {
      this.emergencyHubConnection.stop();
    }
    if (this.bedsHubConnection) {
      this.bedsHubConnection.stop();
    }
  }

  playAlertChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Audio playback omitted if browser restricts auto-audio
    }
  }

  signOut(): void {
    this.auth.logout();
    this.toast.info('You have been signed out.');
  }
}
