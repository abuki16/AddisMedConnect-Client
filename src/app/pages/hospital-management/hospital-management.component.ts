import { Component, OnInit, ChangeDetectorRef, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { apiUrl } from '../../core/api.config';
import { ResourceStore } from '../../Store/resource.store';

export interface HospitalItem {
  id: string;
  code: string;
  name: string;
  subCity: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  contactPhone: string;
  totalBeds: number;
  availableBeds: number;
}

@Component({
  selector: 'app-hospital-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: './hospital-management.component.html',
  styleUrl: './hospital-management.component.scss',
})
export class HospitalManagementComponent implements OnInit {
  public auth = inject(AuthService);
  private toast = inject(ToastService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private resourceStore = inject(ResourceStore);

  hospitals: HospitalItem[] = [];
  loading = true;
  saving = false;

  // Filters
  searchQuery = '';
  subCityFilter = '';

  showModal = false;
  editingHospital: HospitalItem | null = null;

  readonly subCityOptions: string[] = [
    'Addis Ketema',
    'Akaki Kaliti',
    'Arada',
    'Bole Subcity',
    'Gullele',
    'Kirkos',
    'Kolfe Keranio',
    'Lideta',
    'Nefas Silk-Lafto',
    'Yeka',
    'Lemi Kura',
  ];

  hospitalForm: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    subCity: ['', [Validators.required]],
    address: ['', [Validators.required, Validators.minLength(3)]],
    contactPhone: ['', [Validators.required, Validators.pattern(/^(?:\+251|0)[1-9]\d{7,8}$/)]],
    latitude: [9.0300, [Validators.min(-90), Validators.max(90)]],
    longitude: [38.7400, [Validators.min(-180), Validators.max(180)]],
  });

  ngOnInit(): void {
    this.loadHospitals();
  }

  loadHospitals(): void {
    this.loading = true;
    this.http.get<HospitalItem[]>(`${apiUrl}/hospitals`).subscribe({
      next: (rows) => {
        this.zone.run(() => {
          this.hospitals = rows || [];
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.loading = false;
          const msg = err.error?.message || 'Could not load hospitals list.';
          this.toast.error(msg);
          this.cdr.detectChanges();
        });
      },
    });
  }

  get totalBedsCount(): number {
    return this.hospitals.reduce((acc, h) => acc + (h.totalBeds || 0), 0);
  }

  get availableBedsCount(): number {
    return this.hospitals.reduce((acc, h) => acc + (h.availableBeds || 0), 0);
  }

  get filteredHospitals(): HospitalItem[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.hospitals.filter((h) => {
      const matchSearch =
        !q ||
        (h.name || '').toLowerCase().includes(q) ||
        (h.code || '').toLowerCase().includes(q) ||
        (h.address || '').toLowerCase().includes(q) ||
        (h.contactPhone || '').toLowerCase().includes(q);

      const matchSubCity =
        !this.subCityFilter ||
        (h.subCity || '').toLowerCase() === this.subCityFilter.toLowerCase();

      return matchSearch && matchSubCity;
    });
  }

  openCreateModal(): void {
    this.editingHospital = null;
    this.hospitalForm.reset({
      code: '',
      name: '',
      subCity: '',
      address: '',
      contactPhone: '',
      latitude: 9.0300,
      longitude: 38.7400,
    });
    this.showModal = true;
    this.cdr.detectChanges();
  }

  openEditModal(hospital: HospitalItem): void {
    this.editingHospital = hospital;
    this.hospitalForm.patchValue({
      code: hospital.code || '',
      name: hospital.name || '',
      subCity: hospital.subCity || '',
      address: hospital.address || '',
      contactPhone: hospital.contactPhone || '',
      latitude: hospital.latitude ?? 9.0300,
      longitude: hospital.longitude ?? 38.7400,
    });
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showModal = false;
    this.editingHospital = null;
    this.saving = false;
    this.cdr.detectChanges();
  }

  saveHospital(): void {
    if (this.hospitalForm.invalid) {
      this.hospitalForm.markAllAsTouched();
      this.toast.warning('Please complete all required fields correctly.');
      return;
    }

    const formVal = this.hospitalForm.getRawValue();
    const payload = {
      code: (formVal.code || '').trim().toUpperCase(),
      name: (formVal.name || '').trim(),
      subCity: (formVal.subCity || '').trim(),
      address: (formVal.address || '').trim(),
      contactPhone: (formVal.contactPhone || '').trim(),
      latitude: formVal.latitude !== null && formVal.latitude !== '' ? Number(formVal.latitude) : 9.0300,
      longitude: formVal.longitude !== null && formVal.longitude !== '' ? Number(formVal.longitude) : 38.7400,
    };

    this.saving = true;

    if (this.editingHospital) {
      // Update
      this.http.put<HospitalItem>(`${apiUrl}/hospitals/${this.editingHospital.id}`, payload).subscribe({
        next: (updated) => {
          this.zone.run(() => {
            this.saving = false;
            this.closeModal();
            this.toast.success(`Hospital '${updated.name}' updated successfully.`);
            this.loadHospitals();
            this.resourceStore.loadHospitals();
          });
        },
        error: (err) => {
          this.zone.run(() => {
            this.saving = false;
            const msg = err.error?.message || 'Failed to update hospital details.';
            this.toast.error(msg);
            this.cdr.detectChanges();
          });
        },
      });
    } else {
      // Create
      this.http.post<HospitalItem>(`${apiUrl}/hospitals`, payload).subscribe({
        next: (created) => {
          this.zone.run(() => {
            this.saving = false;
            this.closeModal();
            this.toast.success(`Hospital '${created.name}' registered into the network.`);
            this.loadHospitals();
            this.resourceStore.loadHospitals();
          });
        },
        error: (err) => {
          this.zone.run(() => {
            this.saving = false;
            const msg = err.error?.message || 'Failed to register new hospital.';
            this.toast.error(msg);
            this.cdr.detectChanges();
          });
        },
      });
    }
  }

  deleteHospital(hospital: HospitalItem): void {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete hospital "${hospital.name}" (${hospital.code})?\n\nNote: Only facilities without active cases can be deleted.`
    );
    if (!confirmDelete) return;

    this.http.delete(`${apiUrl}/hospitals/${hospital.id}`).subscribe({
      next: () => {
        this.zone.run(() => {
          this.toast.success(`Hospital "${hospital.name}" was successfully decommissioned and removed.`);
          this.loadHospitals();
          this.resourceStore.loadHospitals();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          const msg =
            err.error?.message ||
            'Cannot delete hospital. Ensure there are no active emergency cases or occupied beds assigned to this facility.';
          this.toast.error(msg);
          this.cdr.detectChanges();
        });
      },
    });
  }

  isFieldInvalid(field: string): boolean {
    const c = this.hospitalForm.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }
}
