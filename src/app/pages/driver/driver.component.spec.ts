import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { DriverComponent } from './driver.component';
import { AuthService } from '../../core/auth.service';

describe('DriverComponent', () => {
  it('creates', async () => {
    await TestBed.configureTestingModule({
      imports: [DriverComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: () => null } },
        DomSanitizer,
      ],
    }).compileComponents();
    expect(TestBed.createComponent(DriverComponent).componentInstance).toBeTruthy();
  });
});
