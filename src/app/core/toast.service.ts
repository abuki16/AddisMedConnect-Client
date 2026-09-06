import { Injectable, signal, computed } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private nextId = 1;
  private readonly toastsSignal = signal<ToastMessage[]>([]);

  /**
   * Read-only reactive signal of all active toast notifications.
   */
  public readonly toasts = computed(() => this.toastsSignal());

  /**
   * Display a new toast notification.
   */
  public show(
    message: string,
    type: ToastType = 'info',
    duration = 4500,
  ): number {
    const id = this.nextId++;
    const item: ToastMessage = {
      id,
      message,
      type,
      duration,
    };

    this.toastsSignal.update((items) => [...items, item]);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  /**
   * Convenience method to show a success toast.
   */
  public success(message: string, duration = 4500): number {
    return this.show(message, 'success', duration);
  }

  /**
   * Convenience method to show an error toast.
   */
  public error(message: string, duration = 5500): number {
    return this.show(message, 'error', duration);
  }

  /**
   * Convenience method to show an informational toast.
   */
  public info(message: string, duration = 4500): number {
    return this.show(message, 'info', duration);
  }

  /**
   * Convenience method to show a warning toast.
   */
  public warning(message: string, duration = 5000): number {
    return this.show(message, 'warning', duration);
  }

  /**
   * Dismiss a specific toast notification by ID.
   */
  public dismiss(id: number): void {
    this.toastsSignal.update((items) =>
      items.filter((item) => item.id !== id),
    );
  }

  /**
   * Clear all active toasts immediately.
   */
  public clear(): void {
    this.toastsSignal.set([]);
  }
}
