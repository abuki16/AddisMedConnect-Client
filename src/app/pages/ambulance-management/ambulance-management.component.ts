import { Component, OnInit, ChangeDetectorRef, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { apiUrl } from '../../core/api.config';

export interface AmbulanceFleetItem {
  id: string;
  plateNumber: string;
  driverName?: string | null;
  driverUserId?: string | null;
  driverUser?: { id: string; fullName?: string; email?: string; phoneNumber?: string } | null;
  phoneNumber?: string | null;
  isAvailable: boolean;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  lastLocationUpdatedAt?: string | null;
}

@Component({
  selector: 'app-ambulance-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: './ambulance-management.component.html',
  styleUrl: './ambulance-management.component.scss',
})
export class AmbulanceManagementComponent implements OnInit {
  public auth = inject(AuthService);
  private toast = inject(ToastService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  ambulances: AmbulanceFleetItem[] = [];
  driverUsers: any[] = [];
  loading = true;
  saving = false;

  // Filters
  searchQuery = '';
  statusFilter = '';

  showModal = false;
  editingAmbulance: AmbulanceFleetItem | null = null;

  ambulanceForm: FormGroup = this.fb.group({
    plateNumber: ['', [Validators.required, Validators.minLength(3)]],
    driverName: [''],
    phoneNumber: [''],
    driverUserId: [''],
    isAvailable: [true, Validators.required],
    currentLatitude: [9.0300],
    currentLongitude: [38.7400],
  });

  ngOnInit(): void {
    this.loadAmbulances();
    this.loadDriverAccounts();
  }

  loadAmbulances(): void {
    this.loading = true;
    this.http.get<AmbulanceFleetItem[]>(`${apiUrl}/ambulances`).subscribe({
      next: (rows) => {
        this.zone.run(() => {
          this.ambulances = rows || [];
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.loading = false;
          const msg = err.error?.message || 'Could not load ambulance fleet registry.';
          this.toast.error(msg);
          this.cdr.detectChanges();
        });
      },
    });
  }

  loadDriverAccounts(): void {
    this.http.get<any[]>(`${apiUrl}/auth/users`).subscribe({
      next: (users) => {
        this.driverUsers = (users || []).filter(
          (u) => (u.role || '').toLowerCase() === 'ambulancedriver',
        );
      },
      error: () => {
        this.driverUsers = [];
      },
    });
  }

  get filteredAmbulances(): AmbulanceFleetItem[] {
    return this.ambulances.filter((a) => {
      // Search text filter
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.trim().toLowerCase();
        const matchesPlate = (a.plateNumber || '').toLowerCase().includes(q);
        const matchesDriver = (a.driverName || '').toLowerCase().includes(q);
        const matchesPhone = (a.phoneNumber || '').toLowerCase().includes(q);
        if (!matchesPlate && !matchesDriver && !matchesPhone) return false;
      }

      // Status filter
      if (this.statusFilter === 'available') {
        if (!a.isAvailable) return false;
      } else if (this.statusFilter === 'unavailable') {
        if (a.isAvailable) return false;
      }

      return true;
    });
  }

  get availableCount(): number {
    return this.ambulances.filter((a) => a.isAvailable).length;
  }

  get unavailableCount(): number {
    return this.ambulances.filter((a) => !a.isAvailable).length;
  }

  openCreateModal(): void {
    this.editingAmbulance = null;
    this.ambulanceForm.reset({
      plateNumber: '',
      driverName: '',
      phoneNumber: '',
      driverUserId: '',
      isAvailable: true,
      currentLatitude: 9.0300,
      currentLongitude: 38.7400,
    });
    this.showModal = true;
  }

  openEditModal(item: AmbulanceFleetItem): void {
    this.editingAmbulance = item;
    this.ambulanceForm.setValue({
      plateNumber: item.plateNumber || '',
      driverName: item.driverName || '',
      phoneNumber: item.phoneNumber || '',
      driverUserId: item.driverUserId || '',
      isAvailable: !!item.isAvailable,
      currentLatitude: item.currentLatitude ?? 9.0300,
      currentLongitude: item.currentLongitude ?? 38.7400,
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingAmbulance = null;
  }

  onDriverUserSelected(driverUserId: string): void {
    if (!driverUserId) return;
    const selected = this.driverUsers.find((u) => u.id === driverUserId);
    if (selected) {
      if (!this.ambulanceForm.get('driverName')?.value) {
        this.ambulanceForm.patchValue({ driverName: selected.fullName });
      }
      if (!this.ambulanceForm.get('phoneNumber')?.value && selected.phoneNumber) {
        this.ambulanceForm.patchValue({ phoneNumber: selected.phoneNumber });
      }
    }
  }

  saveAmbulance(): void {
    if (this.ambulanceForm.invalid) {
      this.ambulanceForm.markAllAsTouched();
      this.toast.warning('Please provide a valid plate number.');
      return;
    }

    this.saving = true;
    const raw = this.ambulanceForm.getRawValue();
    const payload = {
      plateNumber: raw.plateNumber.trim(),
      driverName: raw.driverName?.trim() || null,
      phoneNumber: raw.phoneNumber?.trim() || null,
      driverUserId: raw.driverUserId || null,
      isAvailable: raw.isAvailable === true || raw.isAvailable === 'true',
      currentLatitude: raw.currentLatitude ? Number(raw.currentLatitude) : 9.0300,
      currentLongitude: raw.currentLongitude ? Number(raw.currentLongitude) : 38.7400,
    };

    if (this.editingAmbulance) {
      this.http.put<AmbulanceFleetItem>(`${apiUrl}/ambulances/${this.editingAmbulance.id}`, payload).subscribe({
        next: (updated) => {
          this.zone.run(() => {
            this.saving = false;
            this.showModal = false;
            this.editingAmbulance = null;
            this.toast.success(`Ambulance ${updated.plateNumber} updated successfully.`);
            this.loadAmbulances();
          });
        },
        error: (err) => {
          this.zone.run(() => {
            this.saving = false;
            const msg = err.error?.message || 'Failed to update ambulance.';
            this.toast.error(msg);
            this.cdr.detectChanges();
          });
        },
      });
    } else {
      this.http.post<AmbulanceFleetItem>(`${apiUrl}/ambulances`, payload).subscribe({
        next: (created) => {
          this.zone.run(() => {
            this.saving = false;
            this.showModal = false;
            this.toast.success(`Ambulance ${created.plateNumber} registered into active fleet.`);
            this.loadAmbulances();
          });
        },
        error: (err) => {
          this.zone.run(() => {
            this.saving = false;
            const msg = err.error?.message || 'Failed to register ambulance.';
            this.toast.error(msg);
            this.cdr.detectChanges();
          });
        },
      });
    }
  }

  toggleStatus(item: AmbulanceFleetItem): void {
    const nextStatus = !item.isAvailable;
    this.http.patch(`${apiUrl}/ambulances/${item.id}/status`, { isAvailable: nextStatus }).subscribe({
      next: () => {
        const label = nextStatus ? 'Available (Ready for Dispatch)' : 'Out of Service / In Maintenance';
        this.toast.success(`Ambulance ${item.plateNumber} status set to: ${label}.`);
        this.loadAmbulances();
      },
      error: (err) => {
        const msg = err.error?.message || 'Could not update ambulance status.';
        this.toast.error(msg);
      },
    });
  }

  deleteAmbulance(item: AmbulanceFleetItem): void {
    const confirmed = window.confirm(
      `Are you sure you want to permanently decommission and delete Ambulance "${item.plateNumber}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    this.http.delete(`${apiUrl}/ambulances/${item.id}`).subscribe({
      next: () => {
        this.toast.success(`Ambulance ${item.plateNumber} successfully deleted from fleet.`);
        this.loadAmbulances();
      },
      error: (err) => {
        const msg = err.error?.message || `Failed to delete Ambulance ${item.plateNumber}.`;
        this.toast.error(msg);
      },
    });
  }
}
