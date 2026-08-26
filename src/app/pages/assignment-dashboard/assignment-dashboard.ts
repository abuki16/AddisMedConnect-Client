import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ResourceStore, Ambulance, Bed } from '../../Store/resource.store';
import { BedSignalRService } from '../../services/bed-signalr.service';

@Component({
  selector: 'app-assignment-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './assignment-dashboard.html',
  styleUrls: ['./assignment-dashboard.scss']
})
export class AssignmentDashboardComponent implements OnInit, OnDestroy {
  readonly resourceStore = inject(ResourceStore);
  private bedSignalRService = inject(BedSignalRService);
  private cdr = inject(ChangeDetectorRef);
  private signalRSub!: Subscription;

  get availableAmbulances(): Ambulance[] {
    return (this.resourceStore.ambulances() as Ambulance[]) || [];
  }

  get availableBeds(): Bed[] {
    const rawBeds = (this.resourceStore.beds() as any[]) || [];
    return rawBeds.filter(bed => {
      const statusValue = bed.status !== undefined ? bed.status : bed.Status;
      return statusValue === 0 || statusValue === '0' || String(statusValue).toLowerCase() === 'available';
    });
  }

  incidentNumber: string | null = null;
  targetHospitalId: string | null = null;
  assignmentForm!: FormGroup;
  isAssigning = false;
  isLoadingCase = true;
  errorMessage = '';
  successMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.incidentNumber = this.route.snapshot.paramMap.get('incidentNumber');

    if (!this.incidentNumber) {
      this.errorMessage = 'No active incident number found.';
      this.isLoadingCase = false;
      return;
    }

    this.initForm();
    this.resourceStore.loadAmbulances();
    this.fetchCaseDetailsAndBeds();

    // Start SignalR connection & handle real-time updates
    this.bedSignalRService.startConnection();
    this.signalRSub = this.bedSignalRService.bedStatusUpdated$.subscribe(() => {
      if (this.targetHospitalId) {
        this.resourceStore.loadAvailableBedsForHospital(this.targetHospitalId);
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.signalRSub) {
      this.signalRSub.unsubscribe();
    }
    this.bedSignalRService.stopConnection();
  }

  initForm(): void {
    this.assignmentForm = this.fb.group({
      bedId: ['', Validators.required],
      ambulanceId: ['', Validators.required]
    });
  }

  fetchCaseDetailsAndBeds(): void {
    this.isLoadingCase = true;
    this.http.get<any>(`http://localhost:5057/api/emergency-cases/${this.incidentNumber}`).subscribe({
      next: (caseData) => {
        this.isLoadingCase = false;
        const hospitalId = caseData?.targetHospitalId || caseData?.TargetHospitalId;

        if (hospitalId) {
          this.targetHospitalId = hospitalId;
          console.log('🏥 Target Hospital ID found:', this.targetHospitalId);
          // Calls the dedicated available beds method per hospital
          this.resourceStore.loadAvailableBedsForHospital(hospitalId);
        } else {
          this.errorMessage = 'Could not determine the target hospital for this incident.';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingCase = false;
        this.errorMessage = 'Failed to load incident details from server.';
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  onConfirmAssignment(): void {
    if (this.assignmentForm.invalid || !this.incidentNumber) {
      this.assignmentForm.markAllAsTouched();
      return;
    }

    this.isAssigning = true;
    this.errorMessage = '';

    this.http.post(`http://localhost:5057/api/emergency-cases/${this.incidentNumber}/assign`, this.assignmentForm.value).subscribe({
      next: () => {
        this.isAssigning = false;
        this.successMessage = `Resources successfully dispatched to Incident #${this.incidentNumber}!`;

        if (this.targetHospitalId) {
          this.resourceStore.loadAvailableBedsForHospital(this.targetHospitalId);
        }
        this.resourceStore.loadHospitals();
        this.resourceStore.loadAmbulances();

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isAssigning = false;
        this.errorMessage = err.error?.message || 'Failed to assign resources.';
        this.cdr.detectChanges();
      }
    });
  }

  goToNewIntake(): void {
    this.router.navigate(['/create-case']);
  }
}