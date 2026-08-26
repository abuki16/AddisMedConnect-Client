import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ResourceStore, Hospital, Ambulance, Bed } from '../../../Store/resource.store';

interface CapacityResult {
  isAvailable: boolean;
  message: string;
  alternativeHospital?: Hospital;
  distanceKm?: number;
  availableBedsCount?: number;
}

@Component({
  selector: 'app-create-case',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './create-case.component.html',
  styleUrls: ['./create-case.component.scss']
})
export class CreateCaseComponent implements OnInit {
  readonly resourceStore = inject(ResourceStore);

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

  errorMessage = '';
  assignmentSuccessMessage = '';

  pendingTriageCount: number = 0;

  createdIncidentNumber: string | null = null;
  createdCaseDetails: any = null;
  capacityWarning: CapacityResult | null = null;

  wardTypes: string[] = ['Emergency', 'ICU', 'Trauma'];

  commonLocations: string[] = [
    'Addis Ketema', 'Akaki Kaliti', 'Arada', 'Bole Subcity', 'Gullele', 
    'Kirkos', 'Kolfe Keranio', 'Lideta', 'Nefas Silk-Lafto', 'Yeka', 'Lemi Kura',
    'Bole Road (Dembel / Medhane Alem)', 'Bole Bulbula', 'Bole Michael', 'Bole Atlas',
    'Mexico Square', 'Piassa (Piazza)', 'Churchill Avenue', 'Kazanchis', 
    'Gerji Mebrat Hail', 'Megenagna Square', 'Sarbet', 'Ayat Condominium', 'Summit Area',
    'Jemo 1', 'Jemo 2', 'Jemo 3', 'Gotera', 'Kera', 'Saris', 'Mekanisa', 'Arat Kilo'
  ];
  filteredLocations: string[] = [];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.resourceStore.loadHospitals();
    this.loadPendingTriageCount();

    this.intakeForm.get('pickupAddress')?.valueChanges.subscribe(value => {
      this.filterLocations(value);
    });

    this.intakeForm.get('targetHospitalId')?.valueChanges.subscribe(hospitalId => {
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
    });
  }

  loadPendingTriageCount(): void {
    this.http.get<{ count: number }>('http://localhost:5057/api/emergency-cases/pending-triage-count').subscribe({
      next: (res) => {
        this.pendingTriageCount = res.count;
      },
      error: () => {
        this.pendingTriageCount = 0;
      }
    });
  }

  initForms(): void {
    const fullNamePattern = /^[\p{L}]{2,}(\s+[\p{L}]{2,})+$/u;
    const ethiopianPhonePattern = /^(?:\+251|0)[79]\d{8}$/;

    this.intakeForm = this.fb.group({
      callerName: ['', [Validators.required, Validators.pattern(fullNamePattern), Validators.minLength(4)]],
      callerPhone: ['', [Validators.required, Validators.pattern(ethiopianPhonePattern)]],
      patientName: ['', [Validators.required, Validators.pattern(fullNamePattern), Validators.minLength(4)]],
      isUnknownPatient: [false],
      incidentReason: ['', [Validators.required, Validators.minLength(8)]],
      targetHospitalId: ['', Validators.required],
      pickupAddress: ['', [Validators.required, Validators.minLength(3)]],
      wardType: ['Emergency', Validators.required]
    });

    this.assignmentForm = this.fb.group({
      bedId: ['', Validators.required],
      ambulanceId: ['', Validators.required]
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
    this.http.get<CapacityResult>('http://localhost:5057/api/emergency-cases/check-capacity', { params }).subscribe({
      next: (result) => {
        this.isCheckingCapacity = false;
        this.capacityWarning = result;
      },
      error: (err) => {
        this.isCheckingCapacity = false;
        this.capacityWarning = null;
        console.error('Capacity check failed:', err);
      }
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
        Validators.pattern(/^[\p{L}]{2,}(\s+[\p{L}]{2,})+$/u)
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
    this.filteredLocations = this.commonLocations.filter(loc => 
      loc.toLowerCase().includes(lowerQuery)
    );
  }

  selectLocation(location: string): void {
    this.intakeForm.get('pickupAddress')?.setValue(location);
    this.filteredLocations = [];
  }

  onCreateCase(): void {
    if (this.intakeForm.invalid) {
      this.intakeForm.markAllAsTouched();
      this.errorMessage = 'Please fill out all required fields correctly.';
      return;
    }

    if (this.capacityWarning && !this.capacityWarning.isAvailable) {
      this.errorMessage = 'Selected hospital ward is full. Please choose an alternative hospital.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.assignmentSuccessMessage = '';

    const formValues = this.intakeForm.getRawValue();
    delete formValues.isUnknownPatient;

    this.http.post('http://localhost:5057/api/emergency-cases', formValues).subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        this.createdIncidentNumber = response?.incidentNumber || response?.IncidentNumber;
        this.createdCaseDetails = response;
        this.pendingTriageCount++;
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || err.error?.title || 'Failed to register emergency case.';
      }
    });
  }

  resetIntake(): void {
    this.createdIncidentNumber = null;
    this.createdCaseDetails = null;
    this.capacityWarning = null;
    this.assignmentSuccessMessage = '';
    this.intakeForm.reset({ wardType: 'Emergency', isUnknownPatient: false });
    this.assignmentForm.reset();
  }
}