import { Routes } from '@angular/router';
import { CreateCaseComponent } from './features/emergency/create-case/create-case.component';
import { AssignmentDashboardComponent } from './pages/assignment-dashboard/assignment-dashboard';
import { TriageComponent } from './components/triage/triage.component'; // 1. Added missing import
import { LoginComponent } from './pages/login/login.component';
import { DriverComponent } from './pages/driver/driver.component';
import { DischargeClerkComponent } from './pages/discharge-clerk/discharge-clerk.component';
import { AdminComponent } from './pages/admin/admin.component';
import { UserManagementComponent } from './pages/user-management/user-management.component';
import { BedManagementComponent } from './pages/bed-management/bed-management.component';
import { AmbulanceManagementComponent } from './pages/ambulance-management/ambulance-management.component';
import { HospitalManagementComponent } from './pages/hospital-management/hospital-management.component';
import { loginRedirectGuard, roleGuard } from './core/role.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [loginRedirectGuard] },
  {
    path: 'dispatch',
    component: CreateCaseComponent,
    canActivate: [roleGuard('Dispatcher', 'SystemAdmin')],
  },
  {
    path: 'assign-resources/:incidentNumber',
    component: AssignmentDashboardComponent,
    canActivate: [roleGuard('Dispatcher', 'SystemAdmin')],
  },
  {
    path: 'triage',
    component: TriageComponent,
    canActivate: [roleGuard('TriageNurse', 'SystemAdmin')],
  },
  {
    path: 'driver',
    component: DriverComponent,
    canActivate: [roleGuard('AmbulanceDriver', 'SystemAdmin')],
  },
  {
    path: 'discharge',
    component: DischargeClerkComponent,
    canActivate: [roleGuard('DischargeClerk', 'SystemAdmin')],
  },
  { path: 'beds', redirectTo: 'admin/beds' },
  { path: 'ambulances', redirectTo: 'admin/ambulances' },
  { path: 'hospitals', redirectTo: 'admin/hospitals' },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [roleGuard('SystemAdmin')],
  },
  {
    path: 'admin/hospitals',
    component: HospitalManagementComponent,
    canActivate: [roleGuard('SystemAdmin')],
  },
  {
    path: 'admin/beds',
    component: BedManagementComponent,
    canActivate: [roleGuard('SystemAdmin')],
  },
  {
    path: 'admin/ambulances',
    component: AmbulanceManagementComponent,
    canActivate: [roleGuard('SystemAdmin')],
  },
  {
    path: 'admin/users',
    component: UserManagementComponent,
    canActivate: [roleGuard('SystemAdmin')],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
