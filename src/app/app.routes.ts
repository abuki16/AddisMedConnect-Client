import { Routes } from '@angular/router';
import { CreateCaseComponent } from './features/emergency/create-case/create-case.component';
import { AssignmentDashboardComponent } from './pages/assignment-dashboard/assignment-dashboard';
import { TriageComponent } from './components/triage/triage.component'; // 1. Added missing import

export const routes: Routes = [
  { path: '', component: CreateCaseComponent },          // Default home / intake screen
  { path: 'triage', component: TriageComponent },        // Triage dashboard route
  { path: 'assign-resources/:incidentNumber', component: AssignmentDashboardComponent },
  { path: '**', redirectTo: '' }                         // 3. Fallback wildcard must always be last
];