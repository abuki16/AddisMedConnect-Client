import {
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { apiUrl, hubUrl } from '../../core/api.config';

export interface EmergencyCase {
  incidentNumber: string;
  callerName: string;
  callerPhone: string;
  patientName: string;
  incidentReason: string;
  status: any;
  priority: any;
  targetHospitalId: string;
  targetHospitalName: string;
  assignedBedId?: string;
  bedNumber?: string;
  assignedBedNumber?: string;
  assignedAmbulanceId?: string;
  ambulancePlateNumber?: string;
  pickupAddress: string;
  createdAt: string;
}

export interface Bed {
  id: string;
  bedNumber: string;
  wardType: string;
  status: number;
}

@Component({
  selector: 'app-triage',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './triage.component.html',
  styleUrls: ['./triage.component.scss'],
})
export class TriageComponent implements OnInit, OnDestroy {
  public auth = inject(AuthService);
  private toast = inject(ToastService);
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);
  private changeDetector = inject(ChangeDetectorRef);

  pendingCases: EmergencyCase[] = [];
  availableBeds: Bed[] = [];
  selectedCase: EmergencyCase | null = null;

  pendingTriageCount = 0;
  assessmentPriority = 'Yellow';
  confirmedBedId = '';

  loading = false;
  isRealtimeConnected = false;

  hospitalId = '';
  isAdmin = false;
  hospitals: any[] = [];

  private apiUrl = apiUrl;
  private hubUrl = `${hubUrl}/emergency`;
  private hubConnection!: signalR.HubConnection;
  private caseRequestId = 0;

  ngOnInit(): void {
    const user = this.auth.user();
    this.isAdmin = user?.role === 'SystemAdmin';
    this.hospitalId = user?.hospitalId || '';

    if (this.isAdmin) {
      this.http.get<any[]>(`${this.apiUrl}/hospitals`).subscribe({
        next: (rows) => {
          this.hospitals = rows || [];
          if (!this.hospitalId && this.hospitals.length > 0) {
            this.hospitalId = this.hospitals[0].id;
          }
          this.startTriageStation();
        },
        error: () => this.startTriageStation(),
      });
    } else {
      if (!this.hospitalId) {
        this.toast.error(
          'Your account is not assigned to a hospital. Contact an administrator.',
        );
        return;
      }
      this.startTriageStation();
    }
  }

  onHospitalChange(newHospitalId: string): void {
    if (this.hubConnection && this.hospitalId) {
      this.hubConnection.invoke('LeaveHospitalGroup', this.hospitalId).catch(() => {});
    }
    this.hospitalId = newHospitalId;
    if (this.hubConnection && this.isRealtimeConnected) {
      this.hubConnection.invoke('JoinHospitalGroup', this.hospitalId).catch(() => {});
    }
    this.selectedCase = null;
    this.loadData();
  }

  private startTriageStation(): void {
    this.loadData();
    this.initSignalRConnection();
  }

  ngOnDestroy(): void {
    if (this.hubConnection) {
      if (this.hospitalId) {
        this.hubConnection.invoke('LeaveHospitalGroup', this.hospitalId).catch(() => {});
      }
      this.hubConnection.stop();
    }
  }

  loadData(): void {
    this.loadEmergencyCases();
    this.loadPendingCount();
  }

  initSignalRConnection(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => this.auth.token || '',
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => {
        this.ngZone.run(() => {
          this.isRealtimeConnected = true;
          console.log('SignalR Connected successfully for Triage Station.');
        });

        this.hubConnection
          .invoke('JoinHospitalGroup', this.hospitalId)
          .catch((err) => console.error('Failed to join hospital group via SignalR:', err));

        this.hubConnection.on('ReceiveEmergencyDispatch', (emergencyCase: EmergencyCase) => {
          this.ngZone.run(() => {
            console.log('SignalR Broadcast Received (ReceiveEmergencyDispatch):', emergencyCase);
            if (
              !emergencyCase.targetHospitalId ||
              emergencyCase.targetHospitalId === this.hospitalId
            ) {
              const exists = this.pendingCases.some(
                (c) => c.incidentNumber === emergencyCase.incidentNumber,
              );
              if (!exists) {
                this.pendingCases = [this.normalizeCase(emergencyCase), ...this.pendingCases];
                this.pendingTriageCount++;
              }
            }
          });
        });

        this.hubConnection.on('QueueUpdated', () => {
          this.ngZone.run(() => {
            console.log('SignalR Broadcast Received (QueueUpdated). Refreshing data...');
            this.loadData();
          });
        });
      })
      .catch((err) => {
        this.ngZone.run(() => {
          this.isRealtimeConnected = false;
          console.warn('SignalR Connection failed, falling back to manual refresh:', err);
        });
      });
  }

  loadPendingCount(): void {
    this.http
      .get<{ count: number }>(
        `${this.apiUrl}/emergency-cases/hospital/${this.hospitalId}/pending-triage-count`,
      )
      .subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            this.pendingTriageCount = res?.count ?? 0;
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.pendingTriageCount = 0;
          });
        },
      });
  }

  loadEmergencyCases(): void {
    const requestId = ++this.caseRequestId;
    this.loading = true;
    this.changeDetector.detectChanges();

    this.http
      .get<EmergencyCase[]>(
        `${this.apiUrl}/emergency-cases/hospital/${this.hospitalId}`,
      )
      .subscribe({
        next: (data) => {
          this.render(() => {
            if (requestId !== this.caseRequestId) return;
            console.log('API Response for Emergency Cases:', data);
            const list = data || [];
            this.pendingCases = list
              .map((c) => this.normalizeCase(c))
              .sort((a, b) => {
                return (
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
                );
              });
            this.loading = false;
            console.log(
              'Processed pendingCases length:',
              this.pendingCases.length,
            );
          });
        },
        error: (err) => {
          this.render(() => {
            if (requestId !== this.caseRequestId) return;
            console.error('Failed to load emergency cases for hospital:', err);
            this.toast.error(
              'Failed to load incoming cases for this facility.',
            );
            this.loading = false;
          });
        },
      });
  }

  private normalizeCase(c: EmergencyCase): EmergencyCase {
    return {
      ...c,
      assignedBedNumber: c.bedNumber || c.assignedBedNumber || 'N/A',
    };
  }

  private render(update: () => void): void {
    this.ngZone.run(() => {
      update();
      this.changeDetector.detectChanges();
    });
  }

  selectCase(emergencyCase: EmergencyCase, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedCase = emergencyCase;
    this.assessmentPriority =
      typeof emergencyCase.priority === 'string'
        ? emergencyCase.priority
        : 'Yellow';
    this.confirmedBedId = emergencyCase.assignedBedId || '';

    if (emergencyCase.targetHospitalId) {
      this.loadHospitalBeds(emergencyCase.targetHospitalId);
    }
  }

  loadHospitalBeds(hospitalId: string): void {
    this.http
      .get<Bed[]>(`${this.apiUrl}/hospitals/${hospitalId}/beds`)
      .subscribe({
        next: (beds) => {
          this.ngZone.run(() => {
            this.availableBeds = (beds || []).filter(
              (b) =>
                b.status === 0 ||
                String(b.status).toLowerCase() === 'available' ||
                b.id === this.selectedCase?.assignedBedId,
            );
          });
        },
        error: (err) => {
          console.error('Could not load hospital beds', err);
        },
      });
  }

  quickApprove(emergencyCase: EmergencyCase, event: Event): void {
    event.stopPropagation();
    this.selectCase(emergencyCase);
    this.submitTriage();
  }

  submitTriage(): void {
    if (!this.selectedCase) return;

    const incidentNum = this.selectedCase.incidentNumber;
    const payload = {
      priority: this.assessmentPriority,
      confirmedBedId: this.confirmedBedId || null,
    };

    this.http
      .post(
        `${this.apiUrl}/emergency-cases/${incidentNum}/triage`,
        payload,
      )
      .subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.toast.success(
              `Triage completed & bed confirmed for incident ${incidentNum}!`,
            );
            this.selectedCase = null;
            this.loadData();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            const msg =
              err.error?.message ||
              'Failed to submit triage assessment.';
            this.toast.error(msg);
          });
        },
      });
  }
}
