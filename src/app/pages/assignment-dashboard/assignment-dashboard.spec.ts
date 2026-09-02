import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssignmentDashboardComponent } from './assignment-dashboard'; // Fixed import path
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('AssignmentDashboardComponent', () => {
  let component: AssignmentDashboardComponent;
  let fixture: ComponentFixture<AssignmentDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignmentDashboardComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssignmentDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
