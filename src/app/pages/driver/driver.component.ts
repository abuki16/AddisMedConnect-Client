import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';

@Component({ standalone: true, imports: [CommonModule], templateUrl: './driver.component.html', styleUrl: './driver.component.scss' })
export class DriverComponent implements OnInit {
  data: any; ambulances: any[] = []; message = ''; user; isAdmin = false;
  constructor(public auth: AuthService, private http: HttpClient) { this.user = auth.user(); this.isAdmin = this.user?.role === 'SystemAdmin'; }
  ngOnInit() {
    if (this.isAdmin) { this.http.get<any[]>('http://localhost:5057/api/ambulances').subscribe({ next: x => this.ambulances = x, error: () => this.message = 'Could not load the fleet.' }); return; }
    this.http.get('http://localhost:5057/api/ambulances/mine').subscribe({ next: x => this.data = x, error: e => this.message = e.error?.message || 'Could not load your ambulance.' });
  }
  shareLocation() {
    if (!navigator.geolocation) { this.message = 'Location is not supported by this browser.'; return; }
    navigator.geolocation.getCurrentPosition(p => this.http.post('http://localhost:5057/api/ambulances/mine/location', { latitude: p.coords.latitude, longitude: p.coords.longitude, addressLabel: 'Driver shared location' }).subscribe({ next: () => this.message = 'Location shared with dispatch.', error: () => this.message = 'Could not share your location.' }), () => this.message = 'Location permission was not granted.');
  }
}
