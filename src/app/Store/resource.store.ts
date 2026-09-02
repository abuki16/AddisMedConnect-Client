import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface Hospital {
  id?: string;
  Id?: string;
  code?: string;
  Code?: string;
  name?: string;
  Name?: string;
  subCity?: string;
  SubCity?: string;
  address?: string;
  Address?: string;
  contactPhone?: string;
  ContactPhone?: string;
  totalBeds?: number;
  TotalBeds?: number;
  availableBeds?: number;
  AvailableBeds?: number;
}

export interface Ambulance {
  id?: string;
  Id?: string;
  plateNumber?: string;
  PlateNumber?: string;
  driverName?: string;
  DriverName?: string;
  phoneNumber?: string;
  PhoneNumber?: string;
}

export interface Bed {
  id?: string;
  Id?: string;
  code?: string;
  Code?: string;
  bedNumber?: string;
  BedNumber?: string;
  wardType?: string;
  WardType?: string;
  status?: any;
  Status?: any;
  hospitalId?: string;
  HospitalId?: string;
  hospital?: Hospital;
  Hospital?: Hospital;
  currentCaseId?: string | null;
  CurrentCaseId?: string | null;
  lastStatusUpdate?: string;
  LastStatusUpdate?: string;
}

export interface CreateBedDto {
  bedNumber: string;
  wardType: string;
  code: string;
  hospitalId: string;
}

interface ResourceState {
  hospitals: Hospital[];
  ambulances: Ambulance[];
  beds: Bed[];
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
}

const initialState: ResourceState = {
  hospitals: [],
  ambulances: [],
  beds: [],
  isLoading: false,
  error: null,
  successMessage: null,
};

const API_BASE = 'http://localhost:5057/api';

export const ResourceStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, http = inject(HttpClient)) => ({
    // Load Hospitals
    loadHospitals(): void {
      patchState(store, { isLoading: true, error: null });
      http.get<Hospital[]>(`${API_BASE}/hospitals`).subscribe({
        next: (hospitals) => {
          patchState(store, { hospitals: hospitals || [], isLoading: false });
        },
        error: (err) => {
          console.error('🔥 Failed to load hospitals:', err);
          patchState(store, { error: 'Failed to load hospitals', isLoading: false });
        },
      });
    },

    // Load Available Ambulances
    loadAmbulances(): void {
      patchState(store, { isLoading: true, error: null });
      http.get<Ambulance[]>(`${API_BASE}/emergency-cases/available-ambulances`).subscribe({
        next: (ambulances) => {
          patchState(store, { ambulances: ambulances || [], isLoading: false });
        },
        error: (err) => {
          console.error('🔥 Failed to load available ambulances:', err);
          patchState(store, { error: 'Failed to load available ambulances', isLoading: false });
        },
      });
    },

    // Load All Beds for a Specific Hospital
    loadBedsForHospital(hospitalId: string): void {
      if (!hospitalId) return;
      patchState(store, { isLoading: true, error: null });

      http.get<Bed[]>(`${API_BASE}/beds/hospital/${hospitalId}`).subscribe({
        next: (beds) => {
          console.log('✅ Beds loaded successfully from API:', beds);
          patchState(store, { beds: beds || [], isLoading: false });
        },
        error: (err) => {
          console.error('🔥 Failed to load beds for hospital:', err);
          patchState(store, { error: 'Failed to load hospital beds', isLoading: false });
        },
      });
    },

    // Load Only Available Beds for a Specific Hospital (Mirrors loadAmbulances pattern)
    loadAvailableBedsForHospital(hospitalId: string): void {
      if (!hospitalId) return;
      patchState(store, { isLoading: true, error: null });

      http.get<Bed[]>(`${API_BASE}/beds/hospital/${hospitalId}/available`).subscribe({
        next: (beds) => {
          console.log('✅ Available beds loaded successfully from API:', beds);
          patchState(store, { beds: beds || [], isLoading: false });
        },
        error: (err) => {
          console.error('🔥 Failed to load available beds for hospital:', err);
          patchState(store, { error: 'Failed to load available hospital beds', isLoading: false });
        },
      });
    },

    // Create a New Bed
    createBed(dto: CreateBedDto): Observable<Bed> {
      patchState(store, { isLoading: true, error: null, successMessage: null });
      return http.post<Bed>(`${API_BASE}/beds`, dto).pipe(
        tap({
          next: (newBed) => {
            const currentBeds = store.beds();
            patchState(store, {
              isLoading: false,
              beds: [...currentBeds, newBed],
              successMessage: 'Bed created successfully!',
            });
          },
          error: (err) => {
            console.error('🔥 Failed to create bed:', err);
            patchState(store, {
              isLoading: false,
              error: err?.error?.message || 'Failed to create bed',
            });
          },
        }),
      );
    },

    // Update Bed Status
    updateBedStatus(bedId: string, status: number): Observable<void> {
      return http.patch<void>(`${API_BASE}/beds/${bedId}/status`, { status }).pipe(
        tap({
          next: () => {
            const updatedBeds = store.beds().map((b) => {
              const id = b.id || b.Id;
              if (id === bedId) {
                return { ...b, status, Status: status, lastStatusUpdate: new Date().toISOString() };
              }
              return b;
            });
            patchState(store, { beds: updatedBeds });
          },
          error: (err) => {
            console.error('🔥 Failed to update bed status:', err);
            patchState(store, { error: 'Failed to update bed status' });
          },
        }),
      );
    },
  })),
);
