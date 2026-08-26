import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './triage.component.html',
  styleUrls: ['./triage.component.scss']
})
export class TriageComponent implements OnInit, OnDestroy {
  pendingCases: EmergencyCase[] = [];
  availableBeds: Bed[] = [];
  selectedCase: EmergencyCase | null = null;
  
  pendingTriageCount: number = 0;
  assessmentPriority: string = 'Yellow';
  confirmedBedId: string = '';
  
  loading: boolean = false;
  isRealtimeConnected: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  // Hospital ID configuration (Tikur Anbessa Hospital GUID)
  hospitalId: string = '11111111-1111-1111-1111-111111111111'; 
  
  private apiUrl = 'http://localhost:5057/api';
  private hubUrl = 'http://localhost:5057/hubs/emergency';
  private hubConnection!: signalR.HubConnection;

  constructor(private http: HttpClient, private ngZone: NgZone) {}

  ngOnInit(): void {
    console.log('TriageComponent initialized. Loading data and connecting to SignalR...');
    this.loadData();
    this.initSignalRConnection();
  }

  ngOnDestroy(): void {
    if (this.hubConnection) {
      this.hubConnection.invoke('LeaveHospitalGroup', this.hospitalId).catch(() => {});
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
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
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

        this.hubConnection.invoke('JoinHospitalGroup', this.hospitalId)
          .catch(err => console.error('Failed to join hospital group via SignalR:', err));

        this.hubConnection.on('ReceiveEmergencyDispatch', (emergencyCase: EmergencyCase) => {
          this.ngZone.run(() => {
            console.log('SignalR Broadcast Received (ReceiveEmergencyDispatch):', emergencyCase);
            if (!emergencyCase.targetHospitalId || emergencyCase.targetHospitalId === this.hospitalId) {
              const exists = this.pendingCases.some(c => c.incidentNumber === emergencyCase.incidentNumber);
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
    this.http.get<{ count: number }>(`${this.apiUrl}/emergency-cases/hospital/${this.hospitalId}/pending-triage-count`).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.pendingTriageCount = res?.count ?? 0;
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.pendingTriageCount = 0;
        });
      }
    });
  }

  loadEmergencyCases(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<EmergencyCase[]>(`${this.apiUrl}/emergency-cases/hospital/${this.hospitalId}`)
      .subscribe({
        next: (data) => {
          this.ngZone.run(() => {
            console.log('API Response for Emergency Cases:', data);
            const list = data || [];
            this.pendingCases = list.map(c => this.normalizeCase(c)).sort((a, b) => {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            this.loading = false;
            console.log('Processed pendingCases length:', this.pendingCases.length);
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            console.error('Failed to load emergency cases for hospital:', err);
            this.errorMessage = 'Failed to load incoming cases for this facility.';
            this.loading = false;
          });
        }
      });
  }

  private normalizeCase(c: EmergencyCase): EmergencyCase {
    return {
      ...c,
      assignedBedNumber: c.bedNumber || c.assignedBedNumber || 'N/A'
    };
  }

  selectCase(emergencyCase: EmergencyCase, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedCase = emergencyCase;
    this.assessmentPriority = typeof emergencyCase.priority === 'string' ? emergencyCase.priority : 'Yellow';
    this.confirmedBedId = emergencyCase.assignedBedId || '';
    this.successMessage = '';
    this.errorMessage = '';
    
    if (emergencyCase.targetHospitalId) {
      this.loadHospitalBeds(emergencyCase.targetHospitalId);
    }
  }

  loadHospitalBeds(hospitalId: string): void {
    this.http.get<Bed[]>(`${this.apiUrl}/hospitals/${hospitalId}/beds`)
      .subscribe({
        next: (beds) => {
          this.ngZone.run(() => {
            this.availableBeds = (beds || []).filter(b => b.status === 0 || b.id === this.selectedCase?.assignedBedId);
          });
        },
        error: (err) => {
          console.error('Could not load hospital beds', err);
        }
      });
  }

  quickApprove(emergencyCase: EmergencyCase, event: Event): void {
    event.stopPropagation();
    this.selectCase(emergencyCase);
    this.submitTriage();
  }

  submitTriage(): void {
    if (!this.selectedCase) return;

    const payload = {
      priority: this.assessmentPriority,
      confirmedBedId: this.confirmedBedId || null
    };

    this.http.post(`${this.apiUrl}/emergency-cases/${this.selectedCase.incidentNumber}/triage`, payload)
      .subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.successMessage = `Triage successfully completed & bed occupied for incident ${this.selectedCase?.incidentNumber}!`;
            this.selectedCase = null;
            this.loadData();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.errorMessage = err.error?.message || 'Failed to submit triage assessment.';
          });
        }
      });
  }
}