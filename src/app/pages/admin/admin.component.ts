import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { apiUrl } from '../../core/api.config';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  cases: any[] = [];
  hospitals: any[] = [];
  ambulances: any[] = [];
  beds: any[] = [];

  constructor(
    public auth: AuthService,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.http.get<any[]>(`${apiUrl}/emergency-cases`).subscribe({
      next: (x) => (this.cases = x || []),
      error: () => (this.cases = []),
    });
    this.http.get<any[]>(`${apiUrl}/hospitals`).subscribe({
      next: (x) => (this.hospitals = x || []),
      error: () => (this.hospitals = []),
    });
    this.http.get<any[]>(`${apiUrl}/ambulances`).subscribe({
      next: (x) => (this.ambulances = x || []),
      error: () => (this.ambulances = []),
    });
    this.http.get<any[]>(`${apiUrl}/beds`).subscribe({
      next: (x) => (this.beds = x || []),
      error: () => (this.beds = []),
    });
  }

  get availableBedsCount(): number {
    return this.beds.filter((b) => {
      const s = String(b.status).toLowerCase();
      return s === '0' || s === 'available';
    }).length;
  }
}
