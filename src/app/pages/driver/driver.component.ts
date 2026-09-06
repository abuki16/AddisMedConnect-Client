import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DomSanitizer,
  SafeResourceUrl,
} from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import {
  apiUrl,
  hubUrl,
} from '../../core/api.config';

export interface Coordinates {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  speed?: number | null;
  isEstimatedAltitude?: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: './driver.component.html',
  styleUrl: './driver.component.scss',
})
export class DriverComponent implements OnInit, OnDestroy {
  private toast = inject(ToastService);
  data: any;
  ambulances: any[] = [];
  location: Coordinates | null = null;
  locationUpdatedAt = '';
  liveTracking = false;
  isAdmin = false;
  mapUrl: SafeResourceUrl | null = null;
  newMissionAlert = false;
  isUpdatingStatus = false;
  stationedHospitalName = '';

  private watchId: number | null = null;
  private lastSentAt = 0;
  private hubConnection?: signalR.HubConnection;

  // Addis Ababa landmark coordinates for quick positioning & testing
  readonly addisLocations = [
    {
      label: 'Tikur Anbessa Hospital (Lideta)',
      lat: 9.0182,
      lng: 38.7495,
      alt: 2355,
    },
    {
      label: 'St. Paul Hospital (Gullele)',
      lat: 9.0664,
      lng: 38.7303,
      alt: 2420,
    },
    {
      label: 'Bole Medhane Alem (Bole)',
      lat: 8.9953,
      lng: 38.7885,
      alt: 2320,
    },
    {
      label: 'Mexico Square (Kirkos)',
      lat: 9.0105,
      lng: 38.7455,
      alt: 2340,
    },
    {
      label: 'Megenagna Roundabout (Yeka)',
      lat: 9.0215,
      lng: 38.8021,
      alt: 2380,
    },
    {
      label: 'Piazza Central (Arada)',
      lat: 9.0345,
      lng: 38.7525,
      alt: 2400,
    },
  ];

  constructor(
    public auth: AuthService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {
    this.isAdmin = auth.user()?.role === 'SystemAdmin';
  }

  ngOnInit(): void {
    if (this.isAdmin) {
      this.loadFleet();
      return;
    }

    this.loadDriverData();
    this.initSignalR();
    // Auto-locate once on startup
    this.shareLocation();
  }

  ngOnDestroy(): void {
    this.stopLiveTracking();
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
  }

  loadFleet(): void {
    this.http
      .get<any[]>(`${apiUrl}/ambulances`)
      .subscribe({
        next: (rows) => {
          this.ambulances = rows || [];
          this.cdr.detectChanges();
        },
        error: () => this.toast.error('Could not load ambulance fleet.'),
      });
  }

  loadDriverData(): void {
    this.http
      .get<any>(`${apiUrl}/ambulances/mine`)
      .subscribe({
        next: (response) => {
          this.data = response;
          const ambulance = response.ambulance;
          if (
            ambulance?.currentLatitude != null &&
            ambulance?.currentLongitude != null
          ) {
            this.setLocation(
              {
                latitude: ambulance.currentLatitude,
                longitude: ambulance.currentLongitude,
                altitude: 2355,
                isEstimatedAltitude: true,
              },
              ambulance.lastLocationUpdatedAt,
            );
          }

          if (this.hubConnection && ambulance?.id) {
            this.hubConnection.invoke('JoinAmbulanceGroup', ambulance.id).catch(() => {});
          }

          this.cdr.detectChanges();
        },
        error: (error) => {
          this.toast.error(
            error.error?.message ||
              'Could not load your ambulance assignment.',
          );
          this.cdr.detectChanges();
        },
      });
  }

  private initSignalR(): void {
    const token = this.auth.token;
    if (!token) return;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${hubUrl}/emergency`, {
        accessTokenFactory: () => token,
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => {
        console.log('Driver connected to Emergency SignalR hub.');
        if (this.data?.ambulance?.id) {
          this.hubConnection?.invoke('JoinAmbulanceGroup', this.data.ambulance.id).catch(() => {});
        }

        this.hubConnection?.on(
          'ReceiveEmergencyDispatch',
          (emergencyCase: any) => {
            this.zone.run(() => {
              const myAmbulanceId = this.data?.ambulance?.id;
              const myPlate = this.data?.ambulance?.plateNumber?.toLowerCase();
              const isAssignedToMe =
                (myAmbulanceId && emergencyCase.assignedAmbulanceId === myAmbulanceId) ||
                (myPlate && emergencyCase.ambulancePlateNumber?.toLowerCase() === myPlate);

              if (isAssignedToMe) {
                this.newMissionAlert = true;
                this.playDispatchChime();
                this.showBrowserNotification(
                  '🚨 URGENT: New Emergency Mission Assigned!',
                  `Patient: ${emergencyCase.patientName || 'Unknown'} | Caller: ${emergencyCase.callerName || 'Dispatch'} (${emergencyCase.callerPhone || 'N/A'})\nPickup: ${emergencyCase.pickupAddress || 'Address in app'}`
                );
                this.toast.warning(
                  `🚨 Urgent: Incident #${emergencyCase.incidentNumber} assigned! Caller: ${emergencyCase.callerName || 'Dispatch'} (${emergencyCase.callerPhone || 'N/A'})`
                );
                this.loadDriverData();
              }
            });
          },
        );

        this.hubConnection?.on('AmbulanceReleased', (payload: any) => {
          this.zone.run(() => {
            const myAmbulanceId = this.data?.ambulance?.id;
            if (!myAmbulanceId || payload.ambulanceId === myAmbulanceId) {
              this.stationedHospitalName = payload.hospitalName || 'Receiving Hospital';
              this.toast.success(
                `✅ Mission Completed: Patient admitted at ${this.stationedHospitalName}. Your ambulance is now freed & stationed at this hospital.`
              );
              this.newMissionAlert = false;
              this.loadDriverData();
            }
          });
        });

        this.hubConnection?.on('QueueUpdated', () => {
          this.zone.run(() => {
            this.loadDriverData();
          });
        });
      })
      .catch((err) => {
        console.warn('Driver SignalR connection fallback:', err);
      });
  }

  startLiveTracking(): void {
    if (!navigator.geolocation) {
      this.toast.warning('GPS location is not supported by this browser.');
      return;
    }
    this.toast.info('Acquiring high-accuracy GPS telemetry…');
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.publishLocation(position.coords),
      (err) => {
        console.warn('GPS watch error:', err);
        this.toast.warning(
          'GPS signal lost or permission denied. Defaulting to Addis telemetry.',
        );
        this.setAddisDefaultLocation();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 20_000,
      },
    );
    this.liveTracking = true;
  }

  stopLiveTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.liveTracking = false;
    this.toast.info('Live tracking paused.');
  }

  shareLocation(): void {
    if (!navigator.geolocation) {
      this.setAddisDefaultLocation();
      return;
    }
    this.toast.info('Querying satellite GPS coordinates…');
    navigator.geolocation.getCurrentPosition(
      (position) => this.publishLocation(position.coords, true),
      (err) => {
        console.warn('GPS single position failed:', err);
        this.toast.warning(
          'GPS signal unavailable. Defaulting to Addis telemetry.',
        );
        this.setAddisDefaultLocation();
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
      },
    );
  }

  selectPresetLocation(preset: {
    label: string;
    lat: number;
    lng: number;
    alt: number;
  }): void {
    const coords: Coordinates = {
      latitude: preset.lat,
      longitude: preset.lng,
      altitude: preset.alt,
      accuracy: 5,
      isEstimatedAltitude: false,
    };
    this.setLocation(coords);
    this.sendLocationPayload(coords, `Addis Station: ${preset.label}`);
  }

  private setAddisDefaultLocation(): void {
    const defaultCoords: Coordinates = {
      latitude: 9.0182,
      longitude: 38.7495,
      altitude: 2355,
      accuracy: 15,
      isEstimatedAltitude: true,
    };
    this.setLocation(defaultCoords);
    this.sendLocationPayload(
      defaultCoords,
      'Addis Central Station (Simulated)',
    );
    this.toast.info(
      'Simulated Addis Ababa GPS coordinates active (Tikur Anbessa area).',
    );
  }

  private publishLocation(
    coords: GeolocationCoordinates,
    force = false,
  ): void {
    const now = Date.now();
    const altitude =
      coords.altitude != null ? Math.round(coords.altitude) : 2355;
    const isEstimated = coords.altitude == null;

    const loc: Coordinates = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude,
      accuracy:
        coords.accuracy != null ? Math.round(coords.accuracy) : null,
      speed:
        coords.speed != null ? Math.round(coords.speed * 3.6) : null,
      isEstimatedAltitude: isEstimated,
    };

    this.setLocation(loc);

    if (!force && now - this.lastSentAt < 15_000) return;
    this.lastSentAt = now;

    this.sendLocationPayload(loc, 'Live driver telemetry');
  }

  private sendLocationPayload(coords: Coordinates, label: string): void {
    this.http
      .post<void>(`${apiUrl}/ambulances/mine/location`, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        altitude: coords.altitude,
        addressLabel: label,
      })
      .subscribe({
        next: () => {
          this.zone.run(() => {
            if (!this.liveTracking) {
              this.toast.success(
                '✅ Position telemetry successfully transmitted to dispatch.',
              );
            }
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.zone.run(() => {
            this.toast.error('Unable to send telemetry to server.');
            this.cdr.detectChanges();
          });
        },
      });
  }

  private setLocation(location: Coordinates, updatedAt?: string): void {
    this.location = location;
    this.locationUpdatedAt = updatedAt || new Date().toISOString();
    const delta = 0.01;
    const bbox = `${location.longitude - delta},${location.latitude - delta},${location.longitude + delta},${location.latitude + delta}`;
    this.mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${location.latitude},${location.longitude}`,
    );
    this.cdr.detectChanges();
  }

  playDispatchChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Two-tone alert sound (880Hz -> 1174Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(1174, now + 0.15);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Repeat tone after 150ms delay
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174, now + 0.5);
      osc2.frequency.setValueAtTime(1480, now + 0.65);
      gain2.gain.setValueAtTime(0.3, now + 0.5);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.5);
      osc2.stop(now + 0.9);
    } catch (e) {
      console.warn('Audio chime playback omitted:', e);
    }
  }

  showBrowserNotification(title: string, body: string): void {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            new Notification(title, { body });
          }
        });
      }
    }
  }

  callCaller(phone?: string): void {
    if (!phone || phone === 'N/A' || phone.trim() === '') {
      this.toast.warning('No telephone number is available for this caller.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    window.location.href = `tel:${cleanPhone}`;
  }

  openNavigation(lat?: number, lng?: number, address?: string): void {
    if (lat != null && lng != null) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    } else if (address) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address + ', Addis Ababa, Ethiopia')}`, '_blank');
    } else {
      this.toast.warning('No GPS coordinates or street address available for route navigation.');
    }
  }

  updateMissionStatus(status: 'InTransit' | 'ArrivedAtTriage'): void {
    this.isUpdatingStatus = true;
    this.http
      .post<any>(`${apiUrl}/ambulances/mine/mission-status`, { status })
      .subscribe({
        next: () => {
          this.zone.run(() => {
            this.isUpdatingStatus = false;
            const label = status === 'InTransit' ? 'In Transit / En Route' : 'Arrived at Hospital Triage';
            this.toast.success(`Mission status updated: ${label}`);
            this.loadDriverData();
          });
        },
        error: (err) => {
          this.zone.run(() => {
            this.isUpdatingStatus = false;
            this.toast.error(err.error?.message || 'Failed to update mission status.');
          });
        },
      });
  }

  acknowledgeAlert(): void {
    this.newMissionAlert = false;
    this.toast.info('Emergency mission acknowledged. Destination route loaded.');
  }

  signOut(): void {
    this.auth.logout();
    this.toast.info('You have been signed out.');
  }
}
