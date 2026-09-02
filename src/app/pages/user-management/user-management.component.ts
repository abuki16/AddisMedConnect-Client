import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit {
  users: any[] = [];
  hospitals: any[] = [];
  editingId = '';
  message = '';
  readonly roles = ['Dispatcher', 'AmbulanceDriver', 'TriageNurse', 'DischargeClerk', 'SystemAdmin'];
  form;

  constructor(public auth: AuthService, private http: HttpClient, private fb: FormBuilder) {
    this.form = fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: [''],
      role: ['', Validators.required],
      hospitalId: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.load();
    this.http.get<any[]>('http://localhost:5057/api/hospitals').subscribe(x => this.hospitals = x);
  }

  load() {
    this.http.get<any[]>('http://localhost:5057/api/auth/users').subscribe(x => this.users = x);
  }

  edit(user: any) {
    const names = (user.fullName || '').trim().split(/\s+/);
    const firstName = names.shift() || '';
    const lastName = names.join(' ');
    
    this.editingId = user.id;
    this.form.patchValue({
      firstName,
      lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      hospitalId: user.hospitalId || '',
      password: '',
      confirmPassword: ''
    });

    this.form.controls.password.clearValidators();
    this.form.controls.confirmPassword.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.form.controls.confirmPassword.updateValueAndValidity();
  }

  reset() {
    this.editingId = '';
    this.message = '';
    this.form.reset({
      role: '',
      hospitalId: '',
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: ''
    });

    this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls.confirmPassword.setValidators([Validators.required]);
    this.form.controls.password.updateValueAndValidity();
    this.form.controls.confirmPassword.updateValueAndValidity();
  }

  save() {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();

    if (!this.editingId && value.password !== value.confirmPassword) {
      this.message = 'Password confirmation does not match.';
      return;
    }

    const hospitalId = value.hospitalId || null;
    const isEditing = !!this.editingId;

    const request = isEditing
      ? this.http.put(`http://localhost:5057/api/auth/users/${this.editingId}`, {
          firstName: value.firstName?.trim(),
          lastName: value.lastName?.trim(),
          email: value.email,
          phoneNumber: value.phoneNumber,
          role: value.role,
          hospitalId,
          newPassword: value.password || null
        })
      : this.http.post('http://localhost:5057/api/auth/registerusers', {
          firstName: value.firstName?.trim(),
          lastName: value.lastName?.trim(),
          email: value.email,
          password: value.password,
          confirmPassword: value.confirmPassword,
          phoneNumber: value.phoneNumber,
          role: value.role,
          hospitalId
        });

    request.subscribe({
      next: () => {
        this.message = isEditing ? 'User access saved.' : 'User successfully registered.';
        this.reset();
        this.load();
      },
      error: e => {
        const errorMsg = e.error?.message || e.error?.title || '';
        if (e.status === 401 || e.status === 400 && (errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('invalid'))) {
          this.message = 'Invalid username or password';
        } else {
          this.message = errorMsg || e.error?.errors?.[Object.keys(e.error?.errors || {})[0]]?.[0] || 'Could not save user.';
        }
      }
    });
  }

  remove(user: any) {
    if (!confirm(`Delete ${user.fullName}?`)) return;
    this.http.delete(`http://localhost:5057/api/auth/users/${user.id}`).subscribe({
      next: () => this.load(),
      error: e => this.message = e.error?.message || 'Could not delete user.'
    });
  }
}