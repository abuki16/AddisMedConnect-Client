import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { apiUrl } from '../../core/api.config';

// Ethiopian phone validator: e.g. +251911223344 or 0911223344 or 0711223344
const ethiopianPhonePattern = /^(?:\+251|0)[79]\d{8}$/;
// Name validator: at least 2 characters, alphabetic & common punctuation
const namePattern = /^[\p{L}'-]{2,}$/u;

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (!password || !confirmPassword) return null;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss',
})
export class UserManagementComponent implements OnInit {
  users: any[] = [];
  hospitals: any[] = [];
  editingId = '';
  message = '';
  isErrorMessage = false;
  saving = false;

  readonly roles = [
    'Dispatcher',
    'AmbulanceDriver',
    'TriageNurse',
    'DischargeClerk',
    'SystemAdmin',
  ];

  readonly passwordValidators = [
    Validators.required,
    Validators.minLength(8),
    Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,}$/),
  ];

  form: FormGroup;

  constructor(
    public auth: AuthService,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {
    this.form = fb.group(
      {
        firstName: ['', [Validators.required, Validators.pattern(namePattern)]],
        lastName: ['', [Validators.required, Validators.pattern(namePattern)]],
        email: ['', [Validators.required, Validators.email]],
        phoneNumber: ['', [Validators.required, Validators.pattern(ethiopianPhonePattern)]],
        role: ['', Validators.required],
        hospitalId: [''],
        password: ['', this.passwordValidators],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordMatchValidator },
    );
  }

  ngOnInit() {
    this.load();
    this.http.get<any[]>(`${apiUrl}/hospitals`).subscribe({
      next: (x) => (this.hospitals = x || []),
      error: () => (this.hospitals = []),
    });

    // Dynamic hospital requirement based on selected role
    this.form.get('role')?.valueChanges.subscribe((role) => {
      const hospitalCtrl = this.form.get('hospitalId');
      if (role === 'TriageNurse' || role === 'DischargeClerk') {
        hospitalCtrl?.setValidators([Validators.required]);
      } else {
        hospitalCtrl?.clearValidators();
      }
      hospitalCtrl?.updateValueAndValidity();
    });
  }

  load() {
    this.http.get<any[]>(`${apiUrl}/auth/users`).subscribe({
      next: (x) => (this.users = x || []),
      error: (e) => {
        this.message = e.error?.message || 'Could not load users.';
        this.isErrorMessage = true;
      },
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const ctrl = this.form.get(fieldName);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty));
  }

  hasPasswordMismatch(): boolean {
    const passwordCtrl = this.form.get('password');
    const confirmCtrl = this.form.get('confirmPassword');
    return !!(
      this.form.hasError('passwordMismatch') &&
      confirmCtrl?.touched &&
      passwordCtrl?.value &&
      confirmCtrl?.value
    );
  }

  checkPassRule(rule: 'length' | 'upper' | 'lower' | 'number' | 'special'): boolean {
    const val = this.form.get('password')?.value || '';
    switch (rule) {
      case 'length':
        return val.length >= 8;
      case 'upper':
        return /[A-Z]/.test(val);
      case 'lower':
        return /[a-z]/.test(val);
      case 'number':
        return /\d/.test(val);
      case 'special':
        return /[^A-Za-z\d\s]/.test(val);
    }
  }

  edit(user: any) {
    const names = (user.fullName || '').trim().split(/\s+/);
    const firstName = names.shift() || '';
    const lastName = names.join(' ');

    this.editingId = user.id;
    this.message = '';
    this.isErrorMessage = false;

    this.form.patchValue({
      firstName,
      lastName,
      email: user.email,
      phoneNumber: user.phoneNumber || '',
      role: user.role,
      hospitalId: user.hospitalId || '',
      password: '',
      confirmPassword: '',
    });

    this.form.controls['password'].clearValidators();
    this.form.controls['confirmPassword'].clearValidators();
    this.form.controls['password'].updateValueAndValidity();
    this.form.controls['confirmPassword'].updateValueAndValidity();
  }

  reset(clearMessage = true) {
    this.editingId = '';
    if (clearMessage) {
      this.message = '';
      this.isErrorMessage = false;
    }
    this.form.reset({
      role: '',
      hospitalId: '',
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    });

    this.form.controls['password'].setValidators(this.passwordValidators);
    this.form.controls['confirmPassword'].setValidators([Validators.required]);
    this.form.controls['password'].updateValueAndValidity();
    this.form.controls['confirmPassword'].updateValueAndValidity();
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.message = 'Please correct all highlighted validation errors before saving.';
      this.isErrorMessage = true;
      return;
    }

    const value = this.form.getRawValue();

    if (!this.editingId && value.password !== value.confirmPassword) {
      this.message = 'Passwords do not match.';
      this.isErrorMessage = true;
      return;
    }

    const hospitalId = value.hospitalId || null;
    const isEditing = !!this.editingId;
    this.saving = true;
    this.message = '';
    this.isErrorMessage = false;

    const request = isEditing
      ? this.http.put(`${apiUrl}/auth/users/${this.editingId}`, {
          firstName: value.firstName?.trim(),
          lastName: value.lastName?.trim(),
          email: value.email?.trim(),
          phoneNumber: value.phoneNumber?.trim(),
          role: value.role,
          hospitalId,
          newPassword: value.password || null,
        })
      : this.http.post(`${apiUrl}/auth/registerusers`, {
          firstName: value.firstName?.trim(),
          lastName: value.lastName?.trim(),
          email: value.email?.trim(),
          password: value.password,
          confirmPassword: value.confirmPassword,
          phoneNumber: value.phoneNumber?.trim(),
          role: value.role,
          hospitalId,
        });

    request.subscribe({
      next: () => {
        this.message = isEditing
          ? `User "${value.firstName} ${value.lastName}" updated successfully.`
          : `User "${value.firstName} ${value.lastName}" successfully registered with role ${value.role}.`;
        this.isErrorMessage = false;
        this.saving = false;
        this.reset(false);
        this.load();
      },
      error: (e) => {
        this.saving = false;
        this.isErrorMessage = true;
        const errorMsg = e.error?.message || e.error?.title || '';
        if (
          e.status === 401 ||
          (e.status === 400 &&
            (errorMsg.toLowerCase().includes('credential') ||
              errorMsg.toLowerCase().includes('invalid')))
        ) {
          this.message = 'Unable to register user: invalid input or duplicate account.';
        } else {
          this.message =
            errorMsg ||
            e.error?.errors?.[Object.keys(e.error?.errors || {})[0]]?.[0] ||
            'Could not save user.';
        }
      },
    });
  }

  remove(user: any) {
    if (!confirm(`Are you sure you want to delete user "${user.fullName}" (${user.role})?`)) return;
    this.http.delete(`${apiUrl}/auth/users/${user.id}`).subscribe({
      next: () => {
        this.message = `User "${user.fullName}" deleted.`;
        this.isErrorMessage = false;
        this.load();
      },
      error: (e) => {
        this.message = e.error?.message || 'Could not delete user.';
        this.isErrorMessage = true;
      },
    });
  }
}
