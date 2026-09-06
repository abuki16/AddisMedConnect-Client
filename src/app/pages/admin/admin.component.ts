import {
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { apiUrl } from '../../core/api.config';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private http = inject(HttpClient);
  public auth = inject(AuthService);
  private toast = inject(ToastService);

  cases: any[] = [];
  hospitals: any[] = [];
  ambulances: any[] = [];
  beds: any[] = [];

  ngOnInit(): void {
    this.load(false);
  }

  load(interactive = false): void {
    this.http
      .get<any[]>(`${apiUrl}/emergency-cases`)
      .subscribe({
        next: (x) => {
          this.cases = x || [];
          if (interactive) {
            this.toast.info('Control center metrics refreshed.');
          }
        },
        error: () => {
          this.cases = [];
          this.toast.error('Failed to load emergency cases.');
        },
      });

    this.http
      .get<any[]>(`${apiUrl}/hospitals`)
      .subscribe({
        next: (x) => (this.hospitals = x || []),
        error: () => {
          this.hospitals = [];
          this.toast.error('Failed to load hospital directory.');
        },
      });

    this.http
      .get<any[]>(`${apiUrl}/ambulances`)
      .subscribe({
        next: (x) => (this.ambulances = x || []),
        error: () => {
          this.ambulances = [];
          this.toast.error('Failed to load ambulance fleet.');
        },
      });

    this.http
      .get<any[]>(`${apiUrl}/beds`)
      .subscribe({
        next: (x) => (this.beds = x || []),
        error: () => {
          this.beds = [];
          this.toast.error('Failed to load bed registry.');
        },
      });
  }

  signOut(): void {
    this.auth.logout();
    this.toast.info('You have been signed out.');
  }

  get availableBedsCount(): number {
    return this.beds.filter((b) => {
      const s = String(b.status).toLowerCase();
      return s === '0' || s === 'available';
    }).length;
  }
}
