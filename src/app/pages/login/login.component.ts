import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="login-shell">
      <section>
        <p class="eyebrow">MINISTRY OF HEALTH · ADDIS ABABA</p>
        <h1>Emergency Care, Connected.</h1>
        <p class="lead-text">
          Unified Emergency Referral, Real-Time Bed Coordination &amp; Ambulance Telemetry Network for Addis Ababa Healthcare Facilities.
        </p>

        <div class="system-highlights">
          <div class="highlight-item">
            <span class="highlight-icon">🚨</span>
            <div>
              <strong>24/7 Central Dispatch</strong>
              <small>Rapid caller intake, nearest facility ranking &amp; mission coordination</small>
            </div>
          </div>
          <div class="highlight-item">
            <span class="highlight-icon">🛏️</span>
            <div>
              <strong>Real-Time Bed Registry</strong>
              <small>Live tracking of available, reserved, and occupied beds across hospitals</small>
            </div>
          </div>
          <div class="highlight-item">
            <span class="highlight-icon">🚑</span>
            <div>
              <strong>Ambulance Telemetry</strong>
              <small>High-accuracy GPS location, elevation ASL &amp; mission dispatch</small>
            </div>
          </div>
          <div class="highlight-item">
            <span class="highlight-icon">🏥</span>
            <div>
              <strong>Clinical Triage &amp; Intake</strong>
              <small>ETAT assessment, immediate admissions &amp; structured discharge</small>
            </div>
          </div>
        </div>
      </section>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="active-session" *ngIf="auth.isLoggedIn() && auth.user() as u">
          <p>Currently signed in as <strong>{{ u.fullName }}</strong> (<em>{{ u.role }}</em>)</p>
          <div class="session-actions">
            <button type="button" class="btn-continue" (click)="continueToDashboard()">
              Go to {{ u.role }} Dashboard &rarr;
            </button>
            <button type="button" class="btn-signout" (click)="auth.logout()">
              Sign out
            </button>
          </div>
        </div>

        <h2>{{ auth.isLoggedIn() ? 'Or sign in with another account' : 'Sign in to AddisMedConnect' }}</h2>
        
        <label>
          Email address or Username
          <input type="text" formControlName="email" placeholder="name@domain.et or username" autocomplete="username" />
        </label>
        
        <label>
          Password
          <div class="input-with-action">
            <input
              [type]="showPassword ? 'text' : 'password'"
              formControlName="password"
              placeholder="••••••••••••"
              autocomplete="current-password"
            />
            <button type="button" class="btn-peek" (click)="showPassword = !showPassword" tabindex="-1" title="Toggle password visibility">
              {{ showPassword ? '🙈 Hide' : '👁️ Show' }}
            </button>
          </div>
        </label>
        
        <p class="error" *ngIf="error">⚠️ {{ error }}</p>
        
        <button type="submit" [disabled]="form.invalid || loading">
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </main>
  `,
  styles: [
    `
      .login-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 3.5rem;
        align-items: center;
        padding: 6vw 8vw;
        background: linear-gradient(135deg, #071d2b 0%, #0c2d42 100%);
        color: #eef7f8;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .login-shell section {
        max-width: 560px;
      }
      .eyebrow {
        letter-spacing: 0.18em;
        color: #61d5bc;
        font-weight: 800;
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
      }
      .login-shell h1 {
        font-size: clamp(2.2rem, 4.5vw, 4rem);
        line-height: 1.08;
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
        gap: 1rem;
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
      .login-shell form {
        display: grid;
        gap: 1.1rem;
        background: #ffffff;
        color: #102a38;
        padding: 2.2rem;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      }
      .login-shell form h2 {
        font-size: 1.4rem;
        margin: 0;
        color: #0c2d42;
      }
      .active-session {
        background: #e8f5f4;
        border: 1px solid #61d5bc;
        padding: 0.9rem 1rem;
        border-radius: 10px;
        font-size: 0.9rem;
      }
      .active-session p {
        margin: 0 0 0.6rem;
      }
      .session-actions {
        display: flex;
        gap: 0.5rem;
      }
      .btn-continue {
        background: #007c75;
        color: #fff;
        border: 0;
        padding: 0.5rem 0.8rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .btn-signout {
        background: transparent;
        color: #b42318;
        border: 1px solid #b42318;
        padding: 0.5rem 0.8rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .login-shell label {
        display: grid;
        gap: 0.4rem;
        font-weight: 600;
        font-size: 0.9rem;
      }
      .login-shell input {
        padding: 0.8rem 1rem;
        border: 1px solid #c9d8df;
        border-radius: 8px;
        font-size: 1rem;
        transition: border-color 0.2s;
      }
      .login-shell input:focus {
        outline: none;
        border-color: #007c75;
        box-shadow: 0 0 0 3px rgba(0,124,117,0.15);
      }
      .login-shell button[type="submit"] {
        padding: 0.95rem;
        background: #007c75;
        color: #fff;
        border: 0;
        border-radius: 8px;
        font-weight: 700;
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.2s;
      }
      .login-shell button[type="submit"]:hover:not(:disabled) {
        background: #005f5a;
      }
      .login-shell button[type="submit"]:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .input-with-action {
        display: flex;
        position: relative;
        align-items: center;
      }
      .input-with-action input {
        width: 100%;
        padding-right: 4.8rem;
      }
      .btn-peek {
        position: absolute;
        right: 0.5rem;
        background: #eef3f5;
        border: 1px solid #c9d8df;
        border-radius: 6px;
        padding: 0.35rem 0.65rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: #0b3c49;
        cursor: pointer;
      }
      .btn-peek:hover {
        background: #dbe7ec;
      }
      .error {
        color: #b42318;
        font-weight: 600;
        font-size: 0.9rem;
        margin: 0;
      }
      .demo-hint {
        color: #627b87;
        font-size: 0.8rem;
        text-align: center;
      }
      @media (max-width: 860px) {
        .login-shell {
          grid-template-columns: 1fr;
          padding: 2rem;
          gap: 2rem;
        }
      }
    `,
  ],
})
export class LoginComponent {
  showPassword = false;
  loading = false;
  error = '';
  form;

  constructor(
    private fb: FormBuilder,
    public auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required]],
      password: ['', Validators.required],
    });
  }

  continueToDashboard() {
    this.router.navigateByUrl(this.auth.landingPath());
  }

  submit() {
    if (this.form.invalid) return;

    this.loading = true;
    this.error = '';
    const { email, password } = this.form.getRawValue();

    this.auth
      .login((email || '').trim(), password || '')
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (r) => {
          this.auth.completeLogin(r);
          this.router.navigateByUrl(this.auth.landingPath(r.user.role));
        },
        error: (err) => {
          if (err.status === 401) {
            this.error = err.error?.message || 'Invalid email/username or password.';
          } else if (err.status === 0) {
            this.error = 'Cannot connect to the AddisMedConnect backend server. Please verify the API is running on http://localhost:5057.';
          } else {
            this.error = err.error?.message || `Authentication service error (${err.status}).`;
          }
          this.cdr.markForCheck();
        },
      });
  }
}
