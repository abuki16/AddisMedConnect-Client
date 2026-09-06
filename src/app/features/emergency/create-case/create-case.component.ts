import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { ToastService } from '../../../core/toast.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ResourceStore,
  Hospital,
  Ambulance,
  Bed,
} from '../../../Store/resource.store';
import { apiUrl } from '../../../core/api.config';

interface CapacityResult {
  isAvailable: boolean;
  message: string;
  alternativeHospital?: Hospital;
  distanceKm?: number;
  availableBedsCount?: number;
}

interface HospitalRecommendation {
  hospitalId: string;
  hospitalName: string;
  subCity: string;
  address: string;
  distanceKm: number;
  availableBeds: number;
  hasRequestedWardCapacity: boolean;
  recommendation: string;
}

@Component({
  selector: 'app-create-case',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './create-case.component.html',
  styleUrls: ['./create-case.component.scss'],
})
export class CreateCaseComponent implements OnInit {
  readonly resourceStore = inject(ResourceStore);
  private toast = inject(ToastService);

  get hospitals(): Hospital[] {
    return this.resourceStore.hospitals();
  }

  get availableAmbulances(): Ambulance[] {
    return this.resourceStore.ambulances();
  }

  intakeForm!: FormGroup;
  assignmentForm!: FormGroup;
  filteredAvailableBeds: Bed[] = [];

  isSubmitting = false;
  isCheckingCapacity = false;
  isAssigning = false;

  pendingTriageCount: number = 0;

  createdIncidentNumber: string | null = null;
  createdCaseDetails: any = null;
  capacityWarning: CapacityResult | null = null;
  recommendations: HospitalRecommendation[] = [];

  wardTypes: string[] = ['Emergency', 'ICU', 'Trauma', 'Pediatrics', 'Maternity'];

  commonLocations: string[] = [
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
    'Bole Road (Dembel / Medhane Alem)',
    'Bole Bulbula',
    'Bole Michael',
    'Bole Atlas',
    'Mexico Square',
    'Piassa (Piazza)',
    'Churchill Avenue',
    'Kazanchis',
    'Gerji Mebrat Hail',
    'Megenagna Square',
    'Sarbet',
    'Ayat Condominium',
    'Summit Area',
    'Jemo 1',
    'Jemo 2',
    'Jemo 3',
    'Gotera',
    'Kera',
    'Saris',
    'Mekanisa',
    'Arat Kilo',
  ];
  filteredLocations: string[] = [];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.resourceStore.loadHospitals();
    this.loadPendingTriageCount();

    this.intakeForm.get('pickupAddress')?.valueChanges.subscribe((value) => {
      this.filterLocations(value);
    });

    this.intakeForm.get('targetHospitalId')?.valueChanges.subscribe((hospitalId) => {
      if (hospitalId) {
        this.verifyHospitalCapacity(hospitalId);
        // Also fetch available beds for this hospital if needed for dropdown selections
        this.resourceStore.loadAvailableBedsForHospital(hospitalId);
      } else {
        this.capacityWarning = null;
      }
    });

    this.intakeForm.get('wardType')?.valueChanges.subscribe(() => {
      const hospitalId = this.intakeForm.get('targetHospitalId')?.value;
      if (hospitalId) {
        this.verifyHospitalCapacity(hospitalId);
      }
      this.recommendNearbyHospitals();
    });
  }

  loadPendingTriageCount(): void {
    this.http
      .get<{ count: number }>(`${apiUrl}/emergency-cases/pending-triage-count`)
      .subscribe({
        next: (res) => {
          this.pendingTriageCount = res.count;
        },
        error: () => {
          this.pendingTriageCount = 0;
        },
      });
  }

  initForms(): void {
    const fullNamePattern = /^[\p{L}]{2,}(\s+[\p{L}]{2,})+$/u;
    const ethiopianPhonePattern = /^(?:\+251|0)[79]\d{8}$/;

    this.intakeForm = this.fb.group({
      callerName: [
        '',
        [Validators.required, Validators.pattern(fullNamePattern), Validators.minLength(4)],
      ],
      callerPhone: ['', [Validators.required, Validators.pattern(ethiopianPhonePattern)]],
      patientName: [
        '',
        [Validators.required, Validators.pattern(fullNamePattern), Validators.minLength(4)],
      ],
      isUnknownPatient: [false],
      incidentReason: ['', [Validators.required, Validators.minLength(8)]],
      targetHospitalId: ['', Validators.required],
      pickupAddress: ['', [Validators.required, Validators.minLength(3)]],
      pickupLatitude: [null],
      pickupLongitude: [null],
      wardType: ['Emergency', Validators.required],
    });

    this.assignmentForm = this.fb.group({
      bedId: ['', Validators.required],
      ambulanceId: ['', Validators.required],
    });
  }

  verifyHospitalCapacity(hospitalId: string): void {
    const wardType = this.intakeForm.get('wardType')?.value || 'Emergency';
    const params = new HttpParams()
      .set('hospitalId', hospitalId)
      .set('wardType', wardType)
      .set('lat', '9.0300')
      .set('lng', '38.7400');

    this.isCheckingCapacity = true;
    this.http
      .get<CapacityResult>(`${apiUrl}/emergency-cases/check-capacity`, { params })
      .subscribe({
        next: (result) => {
          this.isCheckingCapacity = false;
          this.capacityWarning = result;
        },
        error: (err) => {
          this.isCheckingCapacity = false;
          this.capacityWarning = null;
          console.error('Capacity check failed:', err);
        },
      });
  }

  useAlternativeHospital(altHospitalId: string): void {
    this.intakeForm.get('targetHospitalId')?.setValue(altHospitalId);
    this.capacityWarning = null;
  }

  toggleUnknownPatient(event: any): void {
    const isChecked = event.target.checked;
    const patientNameControl = this.intakeForm.get('patientName');

    if (isChecked) {
      patientNameControl?.setValue('John/Jane Doe (Unknown)');
      patientNameControl?.clearValidators();
      patientNameControl?.disable();
    } else {
      patientNameControl?.setValue('');
      patientNameControl?.setValidators([
        Validators.required,
        Validators.pattern(/^[\p{L}]{2,}(\s+[\p{L}]{2,})+$/u),
      ]);
      patientNameControl?.enable();
    }
    patientNameControl?.updateValueAndValidity();
  }

  filterLocations(query: string): void {
    if (!query || query.trim().length === 0) {
      this.filteredLocations = [];
      return;
    }
    const lowerQuery = query.toLowerCase();
    this.filteredLocations = this.commonLocations.filter((loc) =>
      loc.toLowerCase().includes(lowerQuery),
    );
  }

  selectLocation(location: string): void {
    this.intakeForm.get('pickupAddress')?.setValue(location);
    const point = this.locationCoordinates[location];
    if (point) {
      this.intakeForm.patchValue({ pickupLatitude: point.lat, pickupLongitude: point.lng });
      this.recommendNearbyHospitals();
    }
    this.filteredLocations = [];
  }

  selectRecommendedHospital(hospital: HospitalRecommendation): void {
    this.intakeForm.get('targetHospitalId')?.setValue(hospital.hospitalId);
  }

  private recommendNearbyHospitals(): void {
    const { pickupLatitude, pickupLongitude, wardType } = this.intakeForm.getRawValue();
    if (pickupLatitude == null || pickupLongitude == null) return;
    const params = new HttpParams()
      .set('lat', String(pickupLatitude))
      .set('lng', String(pickupLongitude))
      .set('wardType', wardType || 'Emergency');
    this.http
      .get<HospitalRecommendation[]>(
        `${apiUrl}/emergency-cases/hospital-recommendations`,
        { params },
      )
      .subscribe({
        next: (rows) => {
          this.recommendations = rows;
          const best = rows.find((row) => row.hasRequestedWardCapacity);
          if (best && !this.intakeForm.value.targetHospitalId) this.selectRecommendedHospital(best);
        },
        error: () => (this.recommendations = []),
      });
  }

  private readonly locationCoordinates: Record<string, { lat: number; lng: number }> = {
    'Addis Ketema': { lat: 9.038, lng: 38.747 },
    'Akaki Kaliti': { lat: 8.896, lng: 38.764 },
    Arada: { lat: 9.035, lng: 38.759 },
    'Bole Subcity': { lat: 8.997, lng: 38.785 },
    Gullele: { lat: 9.069, lng: 38.743 },
    Kirkos: { lat: 9.011, lng: 38.766 },
    'Kolfe Keranio': { lat: 9.003, lng: 38.698 },
    Lideta: { lat: 9.011, lng: 38.744 },
    'Nefas Silk-Lafto': { lat: 8.979, lng: 38.737 },
    Yeka: { lat: 9.055, lng: 38.803 },
    'Lemi Kura': { lat: 9.056, lng: 38.847 },
    'Mexico Square': { lat: 9.015, lng: 38.746 },
    'Piassa (Piazza)': { lat: 9.034, lng: 38.752 },
    Kazanchis: { lat: 9.014, lng: 38.769 },
    'Megenagna Square': { lat: 9.034, lng: 38.786 },
    Sarbet: { lat: 9.003, lng: 38.738 },
    Gotera: { lat: 8.995, lng: 38.765 },
    Saris: { lat: 8.978, lng: 38.779 },
    'Arat Kilo': { lat: 9.035, lng: 38.762 },
  };

  onCreateCase(): void {
    if (this.intakeForm.invalid) {
      this.intakeForm.markAllAsTouched();
      this.toast.warning(
        'Please fill out all required fields correctly.',
      );
      return;
    }

    if (this.capacityWarning && !this.capacityWarning.isAvailable) {
      this.toast.error(
        'Selected hospital ward is full. Please choose an alternative hospital.',
      );
      return;
    }

    this.isSubmitting = true;

    const formValues = this.intakeForm.getRawValue();
    delete formValues.isUnknownPatient;

    this.http.post(`${apiUrl}/emergency-cases`, formValues).subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        this.createdIncidentNumber =
          response?.incidentNumber || response?.IncidentNumber;
        this.createdCaseDetails = response;
        this.pendingTriageCount++;
        this.toast.success(
          `Emergency case registered: Incident #${this.createdIncidentNumber}`,
        );
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg =
          err.error?.message ||
          err.error?.title ||
          'Failed to register emergency case.';
        this.toast.error(msg);
      },
    });
  }

  resetIntake(): void {
    this.createdIncidentNumber = null;
    this.createdCaseDetails = null;
    this.capacityWarning = null;
    this.intakeForm.reset({
      wardType: 'Emergency',
      isUnknownPatient: false,
    });
    this.assignmentForm.reset();
  }
}
