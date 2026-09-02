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
        <p class="eyebrow">ADDIS MED CONNECT</p>
        <h1>Emergency operations, connected.</h1>
        <p>Sign in with your role-specific account to open your secure workspace.</p>
      </section>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <h2>Sign in</h2>
        <label>Email<input type="email" formControlName="email" autocomplete="email"></label>
        <label>Password<input type="password" formControlName="password" autocomplete="current-password"></label>
        <p class="error" *ngIf="error">{{ error }}</p>
        <button [disabled]="form.invalid || loading">{{ loading ? 'Signing in…' : 'Sign in' }}</button>
        <small>Demo: dispatcher@addismedconnect.et / ChangeMe123!</small>
      </form>
    </main>
  `, 
  styles: [`.login-shell{min-height:100vh;display:grid;grid-template-columns:1.2fr .8fr;gap:4rem;align-items:center;padding:10vw;background:#071d2b;color:#eef7f8}.login-shell section{max-width:540px}.eyebrow{letter-spacing:.16em;color:#61d5bc;font-weight:700}.login-shell h1{font-size:clamp(2.4rem,5vw,4.8rem);line-height:1.05}.login-shell form{display:grid;gap:1rem;background:#fff;color:#102a38;padding:2rem;border-radius:18px}.login-shell label{display:grid;gap:.4rem;font-weight:600}.login-shell input{padding:.8rem;border:1px solid #bed0d7;border-radius:8px}.login-shell button{padding:.9rem;background:#007c75;color:#fff;border:0;border-radius:8px;font-weight:700}.error{color:#b42318;font-weight:600;font-size:0.9rem;margin:0}@media(max-width:700px){.login-shell{grid-template-columns:1fr;padding:2rem;gap:2rem}}`] 
})
export class LoginComponent { 
  loading = false; 
  error = ''; 
  form; 

  constructor(
    private fb: FormBuilder, 
    private auth: AuthService, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { 
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    }); 
  } 

  submit() { 
    if (this.form.invalid) return;
    
    this.loading = true;
    this.error = ''; 
    const { email, password } = this.form.getRawValue(); 

    this.auth.login(email!, password!)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck(); // Ensures button unlocks instantly
        })
      )
      .subscribe({
        next: r => {
          this.auth.completeLogin(r);
          this.router.navigateByUrl(this.auth.landingPath(r.user.role));
        },
        error: () => {
          this.error = 'Invalid username or password';
          this.cdr.markForCheck(); // Forces the UI to render the error message immediately
        }
      });
  }
}