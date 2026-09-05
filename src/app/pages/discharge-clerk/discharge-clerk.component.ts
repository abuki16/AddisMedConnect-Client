import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { apiUrl } from '../../core/api.config';

export interface AdmittedCase {
  incidentNumber: string;
  patientName: string;
  incidentReason: string;
  bedNumber?: string;
  createdAt: string;
  status: string;
  assignedBedId?: string;
  priority?: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './discharge-clerk.component.html',
  styleUrl: './discharge-clerk.component.scss',
})
export class DischargeClerkComponent implements OnInit {
  cases: AdmittedCase[] = [];
  hospitals: any[] = [];
  selectedHospitalId = '';
  message = '';
  errorMessage = '';
  loading = true;
  dischargingIncident = '';

  // Discharge modal state
  selectedCaseForDischarge: AdmittedCase | null = null;
  dischargeDisposition = 'Discharged Home (Recovered)';
  dischargeNotes = '';
  referralHospitalName = '';

  readonly dispositionOptions = [
    'Discharged Home (Recovered)',
    'Referred to Tertiary / Specialized Hospital',
    'Transferred to Inpatient General Ward',
    'Discharged with Outpatient Follow-up',
    'Deceased',
  ];

  private loadRequestId = 0;

  constructor(
    public auth: AuthService,
    private http: HttpClient,
    private ngZone: NgZone,
    private changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const user = this.auth.user();
    this.selectedHospitalId = user?.hospitalId || '';

    if (user?.role === 'SystemAdmin') {
      this.http.get<any[]>(`${apiUrl}/hospitals`).subscribe({
        next: (rows) => {
          this.hospitals = rows || [];
          if (!this.selectedHospitalId && this.hospitals.length > 0) {
            this.selectedHospitalId = this.hospitals[0].id;
          }
          this.load();
        },
        error: () => this.load(),
      });
    } else {
      this.load();
    }
  }

  load(): void {
    const hospitalId = this.selectedHospitalId || this.auth.user()?.hospitalId;
    if (!hospitalId) {
      this.render(() => {
        this.loading = false;
        this.errorMessage = 'Your account is not assigned to a hospital.';
      });
      return;
    }

    const requestId = ++this.loadRequestId;
    this.loading = true;
    this.errorMessage = '';
    this.changeDetector.detectChanges();

    this.http
      .get<AdmittedCase[]>(`${apiUrl}/emergency-cases/hospital/${hospitalId}/active`)
      .subscribe({
        next: (rows) => {
          this.render(() => {
            if (requestId !== this.loadRequestId) return;
            const data = rows || [];
            this.cases = data.filter(
              (caseItem) =>
                (caseItem.status === 'Admitted' || caseItem.status === 'Dispatched') &&
                !!caseItem.assignedBedId,
            );
            this.loading = false;
          });
        },
        error: (error) => {
          this.render(() => {
            if (requestId !== this.loadRequestId) return;
            this.loading = false;
            this.errorMessage = error.error?.message || 'Could not load admitted cases.';
          });
        },
      });
  }

  openDischargeModal(caseItem: AdmittedCase): void {
    this.selectedCaseForDischarge = caseItem;
    this.dischargeDisposition = 'Discharged Home (Recovered)';
    this.dischargeNotes = `Patient ${caseItem.patientName} evaluated; condition stabilized. Bed ${caseItem.bedNumber || 'held'} cleared for emergency intake.`;
    this.referralHospitalName = '';
  }

  closeDischargeModal(): void {
    this.selectedCaseForDischarge = null;
  }

  confirmDischarge(): void {
    if (!this.selectedCaseForDischarge) return;

    const caseItem = this.selectedCaseForDischarge;
    this.dischargingIncident = caseItem.incidentNumber;
    this.message = '';
    this.errorMessage = '';
    this.changeDetector.detectChanges();

    this.http
      .post<void>(`${apiUrl}/emergency-cases/${caseItem.incidentNumber}/discharge`, {
        disposition: this.dischargeDisposition,
        notes: this.dischargeNotes,
      })
      .subscribe({
        next: () => {
          this.render(() => {
            this.message = `✅ Patient ${caseItem.patientName} (${caseItem.incidentNumber}) discharged. Bed ${caseItem.bedNumber || 'assignment'} is now FREE & AVAILABLE for incoming emergencies!`;
            this.dischargingIncident = '';
            this.selectedCaseForDischarge = null;
            this.load();
          });
        },
        error: (error) => {
          this.render(() => {
            this.dischargingIncident = '';
            this.errorMessage = error.error?.message || 'Could not close this admission.';
          });
        },
      });
  }

  private render(update: () => void): void {
    this.ngZone.run(() => {
      update();
      this.changeDetector.detectChanges();
    });
  }
}