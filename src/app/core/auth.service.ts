import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export type AppRole = 'Dispatcher' | 'AmbulanceDriver' | 'TriageNurse' | 'DischargeClerk' | 'SystemAdmin';
export interface AuthUser { id: string; fullName: string; email: string; role: AppRole; hospitalId?: string; hospitalName?: string; ambulanceId?: string; plateNumber?: string; }
interface LoginResponse { accessToken: string; expiresAt: string; user: AuthUser; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = 'http://localhost:5057/api/auth';
  private readonly userState = signal<AuthUser | null>(this.readUser());
  readonly user = computed(() => this.userState());
  readonly isLoggedIn = computed(() => !!this.userState() && !!this.token);

  constructor(private http: HttpClient, private router: Router) {}

  get token(): string | null { return localStorage.getItem('amc_access_token'); }

  login(email: string, password: string) { 
    return this.http.post<LoginResponse>(`${this.api}/login`, { email, password }).pipe(
      timeout(6000), // Automatically fails after 6 seconds if the backend doesn't respond
      catchError(err => throwError(() => err))
    ); 
  }

  completeLogin(response: LoginResponse): void { 
    localStorage.setItem('amc_access_token', response.accessToken); 
    localStorage.setItem('amc_user', JSON.stringify(response.user)); 
    this.userState.set(response.user); 
  }

  logout(): void { 
    localStorage.removeItem('amc_access_token'); 
    localStorage.removeItem('amc_user'); 
    this.userState.set(null); 
    this.router.navigateByUrl('/login'); 
  }

  landingPath(role = this.userState()?.role): string { 
    return ({ Dispatcher: '/dispatch', AmbulanceDriver: '/driver', TriageNurse: '/triage', DischargeClerk: '/discharge', SystemAdmin: '/admin' } as Record<string, string>)[role ?? ''] ?? '/login'; 
  }

  private readUser(): AuthUser | null { 
    try { return JSON.parse(localStorage.getItem('amc_user') || 'null'); } catch { return null; } 
  }
}