import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { apiUrl } from './api.config';

export type AppRole =
  | 'Dispatcher'
  | 'AmbulanceDriver'
  | 'TriageNurse'
  | 'DischargeClerk'
  | 'SystemAdmin';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  hospitalId?: string;
  hospitalName?: string;
  ambulanceId?: string;
  plateNumber?: string;
}

interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = `${apiUrl}/auth`;
  private readonly userState = signal<AuthUser | null>(this.readUser());
  readonly user = computed(() => this.userState());
  readonly isLoggedIn = computed(() => {
    const u = this.userState();
    const t = this.token;
    return !!u && !!t && !this.isTokenExpired(t);
  });

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    // Purge any legacy localStorage sessions so clean sessionStorage is enforced
    if (localStorage.getItem('amc_access_token')) {
      localStorage.removeItem('amc_access_token');
      localStorage.removeItem('amc_user');
    }
  }

  get token(): string | null {
    const t = sessionStorage.getItem('amc_access_token');
    if (!t) return null;
    if (this.isTokenExpired(t)) {
      this.clearSession();
      return null;
    }
    return t;
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${this.api}/login`, { email, password }).pipe(
      timeout(8000),
      catchError((err) => throwError(() => err)),
    );
  }

  completeLogin(response: LoginResponse): void {
    sessionStorage.setItem('amc_access_token', response.accessToken);
    sessionStorage.setItem('amc_user', JSON.stringify(response.user));
    if (response.expiresAt) {
      sessionStorage.setItem('amc_expires_at', response.expiresAt);
    }
    this.userState.set(response.user);
  }

  logout(): void {
    this.clearSession();
    this.router.navigateByUrl('/login');
  }

  private clearSession(): void {
    sessionStorage.removeItem('amc_access_token');
    sessionStorage.removeItem('amc_user');
    sessionStorage.removeItem('amc_expires_at');
    this.userState.set(null);
  }

  landingPath(role = this.userState()?.role): string {
    const r = (role || '').trim().toLowerCase();
    if (r === 'dispatcher' || r === 'dispatch') return '/dispatch';
    if (r === 'ambulancedriver' || r === 'driver') return '/driver';
    if (r === 'triagenurse' || r === 'triage') return '/triage';
    if (r === 'dischargeclerk' || r === 'discharge') return '/discharge';
    if (r === 'systemadmin' || r === 'admin') return '/admin';
    return '/login';
  }

  private readUser(): AuthUser | null {
    try {
      const token = sessionStorage.getItem('amc_access_token');
      if (!token || this.isTokenExpired(token)) {
        this.clearSession();
        return null;
      }
      return JSON.parse(sessionStorage.getItem('amc_user') || 'null');
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false;
      const expiry = payload.exp * 1000;
      return Date.now() >= expiry;
    } catch {
      return true;
    }
  }
}
