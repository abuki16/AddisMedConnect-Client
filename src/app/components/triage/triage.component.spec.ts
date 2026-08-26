import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TriageComponent } from './triage.component';

describe('TriageComponent', () => {
  let component: TriageComponent;
  let fixture: ComponentFixture<TriageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TriageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TriageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
