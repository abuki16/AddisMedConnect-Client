import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiUrl } from '../../core/api.config';
import { BedSignalRService } from '../../services/bed-signalr.service';

export interface HospitalBed {
  id: string;
  bedNumber: string;
  wardType: string;
  code: string;
  hospitalId: string;
  hospitalName?: string;
  status: number | string;
  lastStatusUpdate?: string;
  currentCaseId?: string | null;
}

@Component({
  selector: 'app-bed-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './bed-management.component.html',
  styleUrl: './bed-management.component.scss',
})
export class BedManagementComponent implements OnInit {
  beds: HospitalBed[] = [];
  hospitals: any[] = [];
  loading = true;
  saving = false;
  message = '';
  isErrorMessage = false;

  // Filter state
  selectedHospitalFilter = '';
  selectedWardFilter = '';
  selectedStatusFilter = '';

  readonly wardOptions = ['Emergency', 'ICU', 'Trauma', 'Pediatrics', 'Maternity'];
  readonly statusOptions = [
    { value: 0, label: 'Available (Free)' },
    { value: 1, label: 'Reserved (En Route)' },
    { value: 2, label: 'Occupied (Admitted)' },
    { value: 3, label: 'Maintenance / Blocked' },
  ];

  bedForm: FormGroup;
  showCreateModal = false;

  constructor(
    public auth: AuthService,
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private bedSignalR: BedSignalRService,
  ) {
    this.bedForm = this.fb.group({
      bedNumber: ['', [Validators.required, Validators.minLength(2)]],
      wardType: ['Emergency', Validators.required],
      code: ['', [Validators.required, Validators.minLength(3)]],
      hospitalId: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadHospitals();
    this.loadBeds();
    this.bedSignalR.startConnection();
    this.bedSignalR.bedStatusUpdated$.subscribe(() => {
      this.loadBeds();
    });
  }

  loadHospitals(): void {
    this.http.get<any[]>(`${apiUrl}/hospitals`).subscribe({
      next: (rows) => (this.hospitals = rows || []),
      error: () => (this.hospitals = []),
    });
  }

  loadBeds(): void {
    this.loading = true;
    this.http.get<HospitalBed[]>(`${apiUrl}/beds`).subscribe({
      next: (rows) => {
        this.zone.run(() => {
          this.beds = rows || [];
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.loading = false;
          this.message = err.error?.message || 'Could not load hospital bed registry.';
          this.isErrorMessage = true;
          this.cdr.detectChanges();
        });
      },
    });
  }

  get filteredBeds(): HospitalBed[] {
    return this.beds.filter((bed) => {
      if (this.selectedHospitalFilter && bed.hospitalId !== this.selectedHospitalFilter) {
        return false;
      }
      if (this.selectedWardFilter && bed.wardType !== this.selectedWardFilter) {
        return false;
      }
      if (this.selectedStatusFilter !== '') {
        const bedStatusStr = String(bed.status);
        if (bedStatusStr !== this.selectedStatusFilter && this.getStatusLabel(bed.status) !== this.selectedStatusFilter) {
          return false;
        }
      }
      return true;
    });
  }

  getStatusLabel(status: number | string): string {
    const s = String(status).toLowerCase();
    if (s === '0' || s === 'available') return 'Available';
    if (s === '1' || s === 'reserved') return 'Reserved';
    if (s === '2' || s === 'occupied') return 'Occupied';
    if (s === '3' || s === 'maintenance') return 'Maintenance';
    return String(status);
  }

  getStatusCount(targetStatus: string): number {
    return this.beds.filter(
      (b) => this.getStatusLabel(b.status).toLowerCase() === targetStatus.toLowerCase(),
    ).length;
  }

  getStatusClass(status: number | string): string {
    const s = this.getStatusLabel(status).toLowerCase();
    if (s === 'available') return 'badge-available';
    if (s === 'reserved') return 'badge-reserved';
    if (s === 'occupied') return 'badge-occupied';
    return 'badge-maintenance';
  }

  getHospitalName(hospitalId: string, bed?: HospitalBed): string {
    if (bed && (bed as any).hospital?.name) {
      const hObj = (bed as any).hospital;
      return `${hObj.name}${hObj.subCity ? ' (' + hObj.subCity + ')' : ''}`;
    }
    const h = this.hospitals.find((x) => x.id === hospitalId);
    return h ? `${h.name} (${h.subCity})` : 'Hospital Facility';
  }

  openCreateModal(): void {
    this.bedForm.reset({
      wardType: 'Emergency',
      hospitalId: this.hospitals.length ? this.hospitals[0].id : '',
    });
    this.showCreateModal = true;
    this.message = '';
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  createBed(): void {
    if (this.bedForm.invalid) {
      this.bedForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.message = '';
    this.isErrorMessage = false;

    const payload = this.bedForm.getRawValue();

    this.http.post<HospitalBed>(`${apiUrl}/beds`, payload).subscribe({
      next: (created) => {
        this.zone.run(() => {
          this.saving = false;
          this.showCreateModal = false;
          this.message = `✅ Bed ${created.bedNumber} (${created.wardType}) successfully registered in system.`;
          this.isErrorMessage = false;
          this.loadBeds();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.saving = false;
          this.message = err.error?.message || 'Failed to register bed. Check unique bed code.';
          this.isErrorMessage = true;
          this.cdr.detectChanges();
        });
      },
    });
  }

  updateStatus(bed: HospitalBed, newStatus: number): void {
    this.http.patch(`${apiUrl}/beds/${bed.id}/status`, { status: newStatus }).subscribe({
      next: () => {
        this.message = `Bed ${bed.bedNumber} status updated to ${this.getStatusLabel(newStatus)}.`;
        this.isErrorMessage = false;
        this.loadBeds();
      },
      error: (err) => {
        this.message = err.error?.message || 'Could not update bed status.';
        this.isErrorMessage = true;
      },
    });
  }
}
