import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { apiUrl } from '../../core/api.config';

interface Coordinates {
  latitude: number;
  longitude: number;
}

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: './driver.component.html',
  styleUrl: './driver.component.scss',
})
export class DriverComponent implements OnInit, OnDestroy {
  data: any;
  ambulances: any[] = [];
  message = '';
  location: Coordinates | null = null;
  locationUpdatedAt = '';
  liveTracking = false;
  isAdmin = false;
  mapUrl: SafeResourceUrl | null = null;
  private watchId: number | null = null;
  private lastSentAt = 0;

  constructor(
    public auth: AuthService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
  ) {
    this.isAdmin = auth.user()?.role === 'SystemAdmin';
  }

  ngOnInit(): void {
    if (this.isAdmin) {
      this.http.get<any[]>(`${apiUrl}/ambulances`).subscribe({
        next: (rows) => (this.ambulances = rows),
        error: () => (this.message = 'Could not load the fleet.'),
      });
      return;
    }
    this.http.get<any>(`${apiUrl}/ambulances/mine`).subscribe({
      next: (response) => {
        this.data = response;
        const ambulance = response.ambulance;
        if (ambulance?.currentLatitude != null && ambulance?.currentLongitude != null)
          this.setLocation(
            { latitude: ambulance.currentLatitude, longitude: ambulance.currentLongitude },
            ambulance.lastLocationUpdatedAt,
          );
      },
      error: (error) => (this.message = error.error?.message || 'Could not load your ambulance.'),
    });
  }

  ngOnDestroy(): void {
    this.stopLiveTracking();
  }

  startLiveTracking(): void {
    if (!navigator.geolocation) {
      this.message = 'Location is not supported by this browser.';
      return;
    }
    this.message = 'Requesting permission to share your live location…';
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.publishLocation(position.coords),
      () => {
        this.message = 'Location permission was not granted.';
        this.stopLiveTracking();
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    this.liveTracking = true;
  }

  stopLiveTracking(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    this.liveTracking = false;
  }

  shareLocation(): void {
    if (!navigator.geolocation) {
      this.message = 'Location is not supported by this browser.';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => this.publishLocation(position.coords, true),
      () => (this.message = 'Location permission was not granted.'),
      { enableHighAccuracy: true },
    );
  }

  private publishLocation(coords: GeolocationCoordinates, force = false): void {
    const now = Date.now();
    this.setLocation(
      { latitude: coords.latitude, longitude: coords.longitude },
      new Date().toISOString(),
    );
    if (!force && now - this.lastSentAt < 15_000) return;
    this.lastSentAt = now;
    this.http
      .post<void>(`${apiUrl}/ambulances/mine/location`, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        addressLabel: 'Live driver location',
      })
      .subscribe({
        next: () =>
          (this.message = this.liveTracking
            ? 'Live location is sharing with dispatch.'
            : 'Location shared with dispatch.'),
        error: () => (this.message = 'Could not share your location.'),
      });
  }

  private setLocation(location: Coordinates, updatedAt?: string): void {
    this.location = location;
    this.locationUpdatedAt = updatedAt || new Date().toISOString();
    const delta = 0.012;
    const bbox = `${location.longitude - delta},${location.latitude - delta},${location.longitude + delta},${location.latitude + delta}`;
    this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${location.latitude},${location.longitude}`,
    );
  }
}
