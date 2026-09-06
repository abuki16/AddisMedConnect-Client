import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../core/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside
      class="toast-container"
      aria-live="polite"
      aria-label="Notification Messages"
    >
      <div
        *ngFor="let toast of toastService.toasts(); trackBy: trackById"
        class="toast-card"
        [ngClass]="'toast-' + toast.type"
        role="alert"
      >
        <span class="toast-icon">
          <ng-container [ngSwitch]="toast.type">
            <span *ngSwitchCase="'success'">✓</span>
            <span *ngSwitchCase="'error'">⚠️</span>
            <span *ngSwitchCase="'warning'">⚡</span>
            <span *ngSwitchDefault>ℹ</span>
          </ng-container>
        </span>

        <div class="toast-body">
          <span class="toast-message">{{ toast.message }}</span>
        </div>

        <button
          type="button"
          class="btn-dismiss"
          (click)="toastService.dismiss(toast.id)"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </aside>
  `,
  styles: [
    `
      .toast-container {
        position: fixed;
        top: 1.25rem;
        right: 1.25rem;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-width: 420px;
        width: calc(100vw - 2.5rem);
        pointer-events: none;
      }

      .toast-card {
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.9rem 1rem;
        border-radius: 10px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25),
          0 8px 10px -6px rgba(0, 0, 0, 0.15);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 0.9rem;
        line-height: 1.45;
        color: #ffffff;
        animation: toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        backdrop-filter: blur(8px);
      }

      @keyframes toast-in {
        from {
          opacity: 0;
          transform: translateY(-12px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .toast-success {
        background: #064e3b;
        border-left: 5px solid #10b981;
        border: 1px solid rgba(16, 185, 129, 0.4);
        border-left-width: 5px;
      }

      .toast-error {
        background: #7f1d1d;
        border-left: 5px solid #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.4);
        border-left-width: 5px;
      }

      .toast-warning {
        background: #78350f;
        border-left: 5px solid #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.4);
        border-left-width: 5px;
      }

      .toast-info {
        background: #0c4a6e;
        border-left: 5px solid #0284c7;
        border: 1px solid rgba(2, 132, 199, 0.4);
        border-left-width: 5px;
      }

      .toast-icon {
        font-size: 1.15rem;
        font-weight: 700;
        line-height: 1.2;
        flex-shrink: 0;
      }

      .toast-body {
        flex: 1;
        min-width: 0;
      }

      .toast-message {
        display: block;
        word-break: break-word;
        font-weight: 500;
      }

      .btn-dismiss {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.95rem;
        cursor: pointer;
        padding: 0 0.25rem;
        line-height: 1;
        transition: color 0.15s ease;
        flex-shrink: 0;
      }

      .btn-dismiss:hover {
        color: #ffffff;
      }

      @media (max-width: 600px) {
        .toast-container {
          top: 0.75rem;
          right: 0.75rem;
          left: 0.75rem;
          width: auto;
          max-width: none;
        }
      }
    `,
  ],
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}

  trackById(_index: number, item: ToastMessage): number {
    return item.id;
  }
}
