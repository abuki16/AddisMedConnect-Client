import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { apiUrl } from '../../core/api.config';

interface AdmittedCase {
  incidentNumber: string;
  patientName: string;
  incidentReason: string;
  bedNumber?: string;
  createdAt: string;
  status: string;
  assignedBedId?: string;
}

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: './discharge-clerk.component.html',
  styleUrl: './discharge-clerk.component.scss',
})
export class DischargeClerkComponent implements OnInit {
  cases: AdmittedCase[] = [];
  message = '';
  errorMessage = '';
  loading = true;
  dischargingIncident = '';

  constructor(
    public auth: AuthService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const hospitalId = this.auth.user()?.hospitalId;
    if (!hospitalId) {
      this.loading = false;
      this.errorMessage = 'Your account is not assigned to a hospital.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.http
      .get<AdmittedCase[]>(`${apiUrl}/emergency-cases/hospital/${hospitalId}/active`)
      .subscribe({
        next: (rows) => {
          this.cases = rows.filter(
            (caseItem) => caseItem.status === 'Admitted' && !!caseItem.assignedBedId,
          );
          this.loading = false;
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage = error.error?.message || 'Could not load admitted cases.';
        },
      });
  }

  discharge(caseItem: AdmittedCase): void {
    if (
      !confirm(
        `Discharge or transfer ${caseItem.patientName} and release ${caseItem.bedNumber || 'the occupied bed'}?`,
      )
    )
      return;
    this.dischargingIncident = caseItem.incidentNumber;
    this.message = '';
    this.errorMessage = '';
    this.http
      .post<void>(`${apiUrl}/emergency-cases/${caseItem.incidentNumber}/discharge`, {})
      .subscribe({
        next: () => {
          this.message = `${caseItem.patientName} has been discharged and ${caseItem.bedNumber || 'the bed'} is available.`;
          this.dischargingIncident = '';
          this.load();
        },
        error: (error) => {
          this.dischargingIncident = '';
          this.errorMessage = error.error?.message || 'Could not close this admission.';
        },
      });
  }
}
