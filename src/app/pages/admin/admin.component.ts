import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';

@Component({ standalone: true, imports: [CommonModule, RouterLink], templateUrl: './admin.component.html', styleUrl: './admin.component.scss' })
export class AdminComponent implements OnInit {
  cases: any[] = []; hospitals: any[] = []; ambulances: any[] = [];
  constructor(public auth: AuthService, private http: HttpClient) {}
  ngOnInit() { this.load(); }
  load() {
    this.http.get<any[]>('http://localhost:5057/api/emergency-cases').subscribe(x => this.cases = x);
    this.http.get<any[]>('http://localhost:5057/api/hospitals').subscribe(x => this.hospitals = x);
    this.http.get<any[]>('http://localhost:5057/api/ambulances').subscribe(x => this.ambulances = x);
  }
}
