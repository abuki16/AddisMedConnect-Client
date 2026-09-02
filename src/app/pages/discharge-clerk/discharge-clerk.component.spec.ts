import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DischargeClerkComponent } from './discharge-clerk.component';
import { AuthService } from '../../core/auth.service';

describe('DischargeClerkComponent', () => {
  it('creates', async () => {
    await TestBed.configureTestingModule({
      imports: [DischargeClerkComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: () => null } },
      ],
    }).compileComponents();
    expect(TestBed.createComponent(DischargeClerkComponent).componentInstance).toBeTruthy();
  });
});
