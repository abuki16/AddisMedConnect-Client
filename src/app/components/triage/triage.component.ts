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
  assessmentPriority: 'Red' | 'Yellow' | 'Green' = 'Yellow';
  confirmedBedId = '';
  releaseAmbulance = true;
  isSubmitting = false;

  vitals = {
    bloodPressure: '',
    heartRate: '',
    respiratoryRate: '',
    spO2: '',
    temperature: '',
    consciousness: 'Alert',
  };
  triageNotes = '';

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

            // Auto-select first case if none is selected or previous case is no longer pending
            if (this.pendingCases.length > 0) {
              const currentStillExists =
                this.selectedCase &&
                this.pendingCases.some(
                  (c) => c.incidentNumber === this.selectedCase?.incidentNumber,
                );
              if (!currentStillExists) {
                this.selectCase(this.pendingCases[0]);
              } else {
                const refreshed = this.pendingCases.find(
                  (c) => c.incidentNumber === this.selectedCase?.incidentNumber,
                );
                if (refreshed) {
                  this.selectedCase = refreshed;
                }
              }
            } else {
              this.selectedCase = null;
            }
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

  setPriority(priority: 'Red' | 'Yellow' | 'Green'): void {
    this.assessmentPriority = priority;
  }

  selectCase(emergencyCase: EmergencyCase, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedCase = emergencyCase;

    const prioStr = String(emergencyCase.priority || '').trim().toLowerCase();
    if (prioStr.includes('red') || prioStr === '2') {
      this.assessmentPriority = 'Red';
    } else if (prioStr.includes('green') || prioStr === '0') {
      this.assessmentPriority = 'Green';
    } else {
      this.assessmentPriority = 'Yellow';
    }

    this.confirmedBedId = emergencyCase.assignedBedId || '';
    this.releaseAmbulance = !!(
      emergencyCase.assignedAmbulanceId ||
      emergencyCase.ambulancePlateNumber
    );

    this.vitals = {
      bloodPressure: '',
      heartRate: '',
      respiratoryRate: '',
      spO2: '',
      temperature: '',
      consciousness: 'Alert',
    };
    this.triageNotes = '';

    if (emergencyCase.targetHospitalId) {
      this.loadHospitalBeds(emergencyCase.targetHospitalId);
    }
  }

  loadHospitalBeds(hospitalId: string): void {
    this.http
      .get<any[]>(`${this.apiUrl}/hospitals/${hospitalId}/beds`)
      .subscribe({
        next: (beds) => {
          this.ngZone.run(() => {
            this.availableBeds = (beds || []).filter(
              (b) =>
                b.status === 0 ||
                String(b.status).toLowerCase() === 'available' ||
                b.id === this.selectedCase?.assignedBedId,
            );
            if (!this.confirmedBedId && this.selectedCase?.assignedBedId) {
              this.confirmedBedId = this.selectedCase.assignedBedId;
            }
          });
        },
        error: (err) => {
          console.error('Could not load hospital beds', err);
        },
      });
  }

  startTriageFor(emergencyCase: EmergencyCase, event: Event): void {
    event.stopPropagation();
    this.selectCase(emergencyCase);
  }

  signOut(): void {
    this.auth.logout();
    this.toast.info('You have been signed out.');
  }

  submitTriage(): void {
    if (!this.selectedCase || this.isSubmitting) return;

    this.isSubmitting = true;
    const incidentNum = this.selectedCase.incidentNumber;
    const patientName = this.selectedCase.patientName;
    const bedIdToConfirm =
      this.confirmedBedId || this.selectedCase.assignedBedId || null;

    const vitalsList: string[] = [];
    if (this.vitals.bloodPressure?.trim()) {
      vitalsList.push(`BP: ${this.vitals.bloodPressure.trim()} mmHg`);
    }
    if (this.vitals.heartRate?.trim()) {
      vitalsList.push(`HR: ${this.vitals.heartRate.trim()} bpm`);
    }
    if (this.vitals.respiratoryRate?.trim()) {
      vitalsList.push(`RR: ${this.vitals.respiratoryRate.trim()} /min`);
    }
    if (this.vitals.spO2?.trim()) {
      vitalsList.push(`SpO2: ${this.vitals.spO2.trim()}%`);
    }
    if (this.vitals.temperature?.trim()) {
      vitalsList.push(`Temp: ${this.vitals.temperature.trim()}°C`);
    }
    if (this.vitals.consciousness) {
      vitalsList.push(`AVPU: ${this.vitals.consciousness}`);
    }

    const payload = {
      priority: this.assessmentPriority,
      confirmedBedId: bedIdToConfirm,
      releaseAmbulance: this.releaseAmbulance,
      vitalSigns: vitalsList.length ? vitalsList.join(' | ') : null,
      triageNotes: this.triageNotes?.trim() || null,
    };

    const bedObj = this.availableBeds.find((b) => b.id === bedIdToConfirm);
    const bedDisplay = bedObj?.bedNumber
      ? `Bed #${bedObj.bedNumber}`
      : this.selectedCase.assignedBedNumber || this.selectedCase.bedNumber
        ? `Bed #${this.selectedCase.assignedBedNumber || this.selectedCase.bedNumber}`
        : '';

    this.http
      .post(`${this.apiUrl}/emergency-cases/${incidentNum}/triage`, payload)
      .subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.isSubmitting = false;
            const ambMessage = this.releaseAmbulance
              ? ' · Ambulance returned to fleet'
              : ' · Ambulance held for transfer';
            const bedMsg = bedDisplay ? ` · ${bedDisplay} is now OCCUPIED` : '';
            this.toast.success(
              `Triage approved for ${patientName}! Priority: ${this.assessmentPriority}${bedMsg}${ambMessage}.`,
            );
            this.selectedCase = null;
            this.loadData();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.isSubmitting = false;
            const msg =
              err.error?.message ||
              'Failed to submit triage assessment.';
            this.toast.error(msg);
          });
        },
      });
  }
}
