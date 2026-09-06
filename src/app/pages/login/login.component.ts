import {
  Component,
  ChangeDetectorRef,
  inject,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <main class="login-shell">
      <section class="brand-panel">
        <p class="eyebrow">MINISTRY OF HEALTH · ADDIS ABABA</p>
        <h1 class="brand-title">Emergency Care, Connected.</h1>
        <p class="lead-text">
          Unified Emergency Referral, Real-Time Bed Coordination &amp; Ambulance
          Telemetry Network for Addis Ababa Healthcare Facilities.
        </p>

        <div class="system-highlights">
          <div class="highlight-item">
            <span class="highlight-icon">🚨</span>
            <div>
              <strong>24/7 Central Dispatch</strong>
              <small>
                Rapid caller intake, nearest facility ranking &amp; mission coordination
              </small>
            </div>
          </div>
          <div class="highlight-item">
            <span class="highlight-icon">🛏️</span>
            <div>
              <strong>Real-Time Bed Registry</strong>
              <small>
                Live tracking of available, reserved, and occupied beds across hospitals
              </small>
            </div>
          </div>
          <div class="highlight-item">
            <span class="highlight-icon">🚑</span>
            <div>
              <strong>Ambulance Telemetry</strong>
              <small>
                High-accuracy GPS location, elevation ASL &amp; mission dispatch
              </small>
            </div>
          </div>
          <div class="highlight-item">
            <span class="highlight-icon">🏥</span>
            <div>
              <strong>Clinical Triage &amp; Intake</strong>
              <small>
                ETAT assessment, immediate admissions &amp; structured discharge
              </small>
            </div>
          </div>
        </div>
      </section>

      <section class="form-panel">
        <mat-card class="login-card" appearance="raised">
          <mat-card-header>
            <mat-card-title class="card-heading">
              {{
                auth.isLoggedIn()
                  ? 'Active Session Detected'
                  : 'Sign in to AddisMedConnect'
              }}
            </mat-card-title>
            <mat-card-subtitle class="card-subheading">
              {{
                auth.isLoggedIn()
                  ? 'Continue with your active credentials or switch accounts'
                  : 'Enter your emergency network credentials to access clinical dispatch'
              }}
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content class="card-body-content">
            <div
              class="active-session-banner"
              *ngIf="auth.isLoggedIn() && auth.user() as u"
            >
              <div class="session-info">
                <mat-icon class="session-icon">account_circle</mat-icon>
                <div>
                  <p class="session-name">
                    Signed in as <strong>{{ u.fullName }}</strong>
                  </p>
                  <span class="session-role">{{ u.role }}</span>
                </div>
              </div>
              <div class="session-actions">
                <button
                  mat-flat-button
                  color="primary"
                  type="button"
                  (click)="continueToDashboard()"
                >
                  <mat-icon>dashboard</mat-icon>
                  Go to {{ u.role }} Dashboard
                </button>
                <button
                  mat-stroked-button
                  color="warn"
                  type="button"
                  (click)="signOut()"
                >
                  <mat-icon>logout</mat-icon>
                  Sign out
                </button>
              </div>
            </div>

            <div class="lockout-alert-banner" *ngIf="lockoutMessage">
              <mat-icon class="lockout-banner-icon">lock_clock</mat-icon>
              <div class="lockout-banner-content">
                <strong>Access Temporarily Restricted</strong>
                <p>{{ lockoutMessage }}</p>
                <div *ngIf="lockoutSeconds > 0" class="lockout-timer-pill">
                  ⏱️ Try again in: <strong>{{ formatRemainingTime(lockoutSeconds) }}</strong>
                </div>
              </div>
            </div>

            <form
              [formGroup]="form"
              (ngSubmit)="submit()"
              novalidate
              class="credentials-form"
            >
              <mat-form-field
                appearance="outline"
                class="full-width"
              >
                <mat-label>Email address or Username</mat-label>
                <input
                  matInput
                  type="text"
                  formControlName="email"
                  placeholder="e.g. nurse.abebe or staff@moh.gov.et"
                  autocomplete="username"
                />
                <mat-icon matPrefix>person</mat-icon>
                <mat-error *ngIf="form.get('email')?.hasError('required')">
                  Email or username is required.
                </mat-error>
              </mat-form-field>

              <mat-form-field
                appearance="outline"
                class="full-width"
              >
                <mat-label>Password</mat-label>
                <input
                  matInput
                  [type]="showPassword ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="••••••••••••"
                  autocomplete="current-password"
                />
                <mat-icon matPrefix>lock</mat-icon>
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="showPassword = !showPassword"
                  [attr.aria-label]="'Toggle password visibility'"
                  tabindex="-1"
                >
                  <mat-icon>
                    {{ showPassword ? 'visibility_off' : 'visibility' }}
                  </mat-icon>
                </button>
                <mat-error *ngIf="form.get('password')?.hasError('required')">
                  Password is required.
                </mat-error>
              </mat-form-field>

              <button
                mat-flat-button
                color="primary"
                type="submit"
                class="submit-button"
                [disabled]="form.invalid || loading"
              >
                <mat-spinner
                  diameter="20"
                  *ngIf="loading"
                  class="button-spinner"
                ></mat-spinner>
                <mat-icon *ngIf="!loading">login</mat-icon>
                <span>{{ loading ? 'Authenticating…' : 'Sign in to AddisMedConnect' }}</span>
              </button>
            </form>
          </mat-card-content>
        </mat-card>
      </section>
    </main>
  `,
  styles: [
    `
      .login-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 3.5rem;
        align-items: center;
        padding: 4vw 7vw;
        background: linear-gradient(135deg, #071d2b 0%, #0c2d42 100%);
        color: #eef7f8;
      }
      .brand-panel {
        max-width: 580px;
      }
      .eyebrow {
        letter-spacing: 0.18em;
        color: #61d5bc;
        font-weight: 800;
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
      }
      .brand-title {
        font-size: clamp(2.2rem, 4.2vw, 3.8rem);
        line-height: 1.1;
        margin: 0.5rem 0 1rem;
        font-weight: 800;
      }
      .lead-text {
        font-size: 1.05rem;
        line-height: 1.6;
        color: #b0c9d7;
        margin-bottom: 2rem;
      }
      .system-highlights {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }
      .highlight-item {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 0.85rem 1.1rem;
        transition: background 0.2s ease;
      }
      .highlight-item:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .highlight-icon {
        font-size: 1.4rem;
        line-height: 1;
        padding-top: 2px;
      }
      .highlight-item div {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .highlight-item strong {
        font-size: 0.95rem;
        color: #ffffff;
      }
      .highlight-item small {
        font-size: 0.82rem;
        color: #92b1c4;
        line-height: 1.35;
      }
      .form-panel {
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
      }
      .login-card {
        border-radius: 20px !important;
        padding: 1.5rem !important;
        box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35) !important;
        background: #ffffff !important;
        color: #102a38;
      }
      .card-heading {
        font-size: 1.5rem !important;
        font-weight: 700 !important;
        color: #0c2d42 !important;
        margin-bottom: 0.35rem;
      }
      .card-subheading {
        font-size: 0.9rem !important;
        color: #627b87 !important;
        line-height: 1.4;
      }
      .card-body-content {
        padding-top: 1.5rem !important;
      }
      .active-session-banner {
        background: #e8f5f4;
        border: 1px solid #61d5bc;
        padding: 1rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
      }
      .lockout-alert-banner {
        background: #fef3f2;
        border: 1px solid #fecdca;
        padding: 1rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        display: flex;
        gap: 0.85rem;
        align-items: flex-start;
        color: #b42318;
      }
      .lockout-banner-icon {
        font-size: 2rem;
        width: 2rem;
        height: 2rem;
        color: #d92d20;
        flex-shrink: 0;
      }
      .lockout-banner-content {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .lockout-banner-content strong {
        font-size: 0.95rem;
        color: #912018;
      }
      .lockout-banner-content p {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.4;
        color: #b42318;
      }
      .lockout-timer-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: #fee4e2;
        border: 1px solid #fecdca;
        padding: 0.25rem 0.6rem;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
        color: #b42318;
        margin-top: 0.25rem;
        width: fit-content;
      }
      .session-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.85rem;
      }
      .session-icon {
        font-size: 2rem;
        width: 2rem;
        height: 2rem;
        color: #007c75;
      }
      .session-name {
        margin: 0;
        font-size: 0.95rem;
      }
      .session-role {
        display: inline-block;
        font-size: 0.75rem;
        background: #007c75;
        color: #fff;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .session-actions {
        display: flex;
        gap: 0.6rem;
      }
      .credentials-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .full-width {
        width: 100%;
      }
      .submit-button {
        width: 100%;
        padding: 0.85rem !important;
        font-size: 1.05rem !important;
        font-weight: 600 !important;
        border-radius: 10px !important;
        display: flex !important;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
      .button-spinner {
        display: inline-block;
      }
      @media (max-width: 900px) {
        .login-shell {
          grid-template-columns: 1fr;
          padding: 2.5rem 1.5rem;
          gap: 2.5rem;
        }
        .brand-panel {
          max-width: 100%;
        }
      }
    `,
  ],
})
export class LoginComponent implements OnDestroy {
  showPassword = false;
  loading = false;
  lockoutMessage: string | null = null;
  lockoutSeconds = 0;
  private lockoutTimer: any = null;
  form;

  constructor(
    private fb: FormBuilder,
    public auth: AuthService,
    private toast: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({
      email: [
        '',
        [Validators.required],
      ],
      password: [
        '',
        Validators.required,
      ],
    });
  }

  ngOnDestroy(): void {
    if (this.lockoutTimer) {
      clearInterval(this.lockoutTimer);
      this.lockoutTimer = null;
    }
  }

  formatRemainingTime(seconds: number): string {
    if (seconds >= 86400) {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      return `${days} day(s) ${hours} hr(s)`;
    }
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours}h ${mins}m ${secs}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }

  startLockoutCountdown(): void {
    if (this.lockoutTimer) clearInterval(this.lockoutTimer);
    if (this.lockoutSeconds <= 0) return;

    this.lockoutTimer = setInterval(() => {
      this.lockoutSeconds--;
      if (this.lockoutSeconds <= 0) {
        clearInterval(this.lockoutTimer);
        this.lockoutTimer = null;
        this.lockoutMessage = null;
        this.toast.info('Lockout duration has expired. You may now attempt to sign in again.');
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  continueToDashboard(): void {
    this.router.navigateByUrl(this.auth.landingPath());
  }

  signOut(): void {
    this.auth.logout();
    this.toast.info('You have been signed out.');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Please fill in your credentials to sign in.');
      return;
    }

    this.loading = true;
    const { email, password } = this.form.getRawValue();

    this.auth
      .login(
        (email || '').trim(),
        password || '',
      )
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (r) => {
          this.toast.success(
            `Welcome back, ${r.user.fullName || r.user.email}!`,
          );
          this.auth.completeLogin(r);
          this.router.navigateByUrl(this.auth.landingPath(r.user.role));
        },
        error: (err) => {
          let errorMsg = '';
          if (err.status === 423) {
            errorMsg =
              err.error?.message ||
              'Security Alert: Account has been locked due to repeated failed login attempts.';
            this.lockoutMessage = errorMsg;
            this.lockoutSeconds = err.error?.retryAfterSeconds || 300;
            this.startLockoutCountdown();
            this.toast.error(errorMsg, 8000);
          } else if (err.status === 401) {
            errorMsg =
              err.error?.message ||
              'Invalid email/username or password.';
            this.lockoutMessage = null;
            if (errorMsg.includes('remaining') || errorMsg.includes('trial')) {
              this.toast.warning(errorMsg, 7000);
            } else {
              this.toast.error(errorMsg);
            }
          } else if (err.status === 0) {
            errorMsg =
              'Cannot connect to the AddisMedConnect backend service. Please verify the API server is running.';
            this.toast.error(errorMsg);
          } else {
            errorMsg =
              err.error?.message ||
              `Authentication service error (${err.status}).`;
            this.toast.error(errorMsg);
          }
          this.cdr.markForCheck();
        },
      });
  }
}
