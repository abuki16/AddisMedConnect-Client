import { Component, OnInit, ChangeDetectorRef, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: './bed-management.component.html',
  styleUrl: './bed-management.component.scss',
})
export class BedManagementComponent implements OnInit {
  public auth = inject(AuthService);
  private toast = inject(ToastService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private bedSignalR = inject(BedSignalRService);

  beds: HospitalBed[] = [];
  hospitals: any[] = [];
  loading = true;
  saving = false;

  // Filter state
  selectedHospitalFilter = '';
  selectedWardFilter = '';
  selectedStatusFilter = '';

  readonly wardOptions = [
    'Emergency',
    'ICU',
    'Trauma',
    'Pediatrics',
    'Maternity',
  ];

  readonly statusOptions = [
    { value: 0, label: 'Available (Free)' },
    { value: 1, label: 'Reserved (En Route)' },
    { value: 2, label: 'Occupied (Admitted)' },
    { value: 3, label: 'Maintenance / Blocked' },
  ];

  editingBed: HospitalBed | null = null;

  bedForm: FormGroup = this.fb.group({
    bedNumber: ['', [Validators.required, Validators.minLength(2)]],
    wardType: ['Emergency', Validators.required],
    code: ['', [Validators.required, Validators.minLength(3)]],
    hospitalId: ['', Validators.required],
    status: [0, Validators.required],
  });

  showCreateModal = false;

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
      next: (rows) => {
        this.hospitals = rows || [];
      },
      error: () => {
        this.hospitals = [];
      },
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
          const msg =
            err.error?.message ||
            'Could not load hospital bed registry.';
          this.toast.error(msg);
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

  parseStatusNumber(status: any): number {
    const s = String(status).toLowerCase();
    if (s === '0' || s === 'available') return 0;
    if (s === '1' || s === 'reserved') return 1;
    if (s === '2' || s === 'occupied') return 2;
    if (s === '3' || s === 'maintenance') return 3;
    const n = Number(status);
    return isNaN(n) ? 0 : n;
  }

  openCreateModal(): void {
    this.editingBed = null;
    this.bedForm.reset({
      bedNumber: '',
      wardType: 'Emergency',
      code: '',
      hospitalId: this.hospitals.length ? this.hospitals[0].id : '',
      status: 0,
    });
    this.showCreateModal = true;
  }

  openEditModal(bed: HospitalBed): void {
    this.editingBed = bed;
    const statusNum = this.parseStatusNumber(bed.status);
    this.bedForm.setValue({
      bedNumber: bed.bedNumber,
      wardType: bed.wardType,
      code: bed.code,
      hospitalId: bed.hospitalId,
      status: statusNum,
    });
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.editingBed = null;
  }

  saveBed(): void {
    if (this.bedForm.invalid) {
      this.bedForm.markAllAsTouched();
      this.toast.warning('Please fill in all required bed details correctly.');
      return;
    }

    this.saving = true;
    const payload = this.bedForm.getRawValue();

    if (this.editingBed) {
      this.http.put<HospitalBed>(`${apiUrl}/beds/${this.editingBed.id}`, payload).subscribe({
        next: (updated) => {
          this.zone.run(() => {
            this.saving = false;
            this.showCreateModal = false;
            this.editingBed = null;
            this.toast.success(
              `Bed ${updated.bedNumber} updated successfully.`,
            );
            this.loadBeds();
          });
        },
        error: (err) => {
          this.zone.run(() => {
            this.saving = false;
            const msg =
              err.error?.message ||
              'Failed to update bed. Check bed code uniqueness.';
            this.toast.error(msg);
            this.cdr.detectChanges();
          });
        },
      });
    } else {
      this.http.post<HospitalBed>(`${apiUrl}/beds`, payload).subscribe({
        next: (created) => {
          this.zone.run(() => {
            this.saving = false;
            this.showCreateModal = false;
            this.toast.success(
              `Bed ${created.bedNumber} (${created.wardType}) registered successfully.`,
            );
            this.loadBeds();
          });
        },
        error: (err) => {
          this.zone.run(() => {
            this.saving = false;
            const msg =
              err.error?.message ||
              'Failed to register bed. Check unique bed code.';
            this.toast.error(msg);
            this.cdr.detectChanges();
          });
        },
      });
    }
  }

  deleteBed(bed: HospitalBed): void {
    const statusName = this.getStatusLabel(bed.status).toLowerCase();
    if (statusName === 'occupied' || statusName === 'reserved' || bed.currentCaseId) {
      this.toast.error(
        `Cannot delete Bed ${bed.bedNumber} while it is reserved or occupied by an emergency patient.`,
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete Bed "${bed.bedNumber}" (${bed.code}) from hospital inventory? This action cannot be undone.`,
    );
    if (!confirmed) return;

    this.http.delete(`${apiUrl}/beds/${bed.id}`).subscribe({
      next: () => {
        this.toast.success(
          `Bed ${bed.bedNumber} has been permanently deleted from inventory.`,
        );
        this.loadBeds();
      },
      error: (err) => {
        const msg =
          err.error?.message || `Failed to delete Bed ${bed.bedNumber}.`;
        this.toast.error(msg);
      },
    });
  }

  updateStatus(bed: HospitalBed, newStatus: number): void {
    this.http
      .patch(`${apiUrl}/beds/${bed.id}/status`, { status: newStatus })
      .subscribe({
        next: () => {
          const statusName = this.getStatusLabel(newStatus);
          this.toast.success(
            `Bed ${bed.bedNumber} status updated to ${statusName}.`,
          );
          this.loadBeds();
        },
        error: (err) => {
          const msg =
            err.error?.message || 'Could not update bed status.';
          this.toast.error(msg);
        },
      });
  }
}
