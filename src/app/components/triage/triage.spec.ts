import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Triage } from './triage';

describe('Triage', () => {
  let component: Triage;
  let fixture: ComponentFixture<Triage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Triage],
    }).compileComponents();

    fixture = TestBed.createComponent(Triage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
