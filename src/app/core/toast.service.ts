import { Injectable, inject } from '@angular/core';
import {
  MatSnackBar,
  MatSnackBarConfig,
  MatSnackBarRef,
  TextOnlySnackBar,
} from '@angular/material/snack-bar';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private snackBar = inject(MatSnackBar);

  /**
   * Display an Angular Material snackbar notification.
   */
  public show(
    message: string,
    type: ToastType = 'info',
    duration = 4500,
    action = '✕',
  ): MatSnackBarRef<TextOnlySnackBar> {
    const config: MatSnackBarConfig = {
      duration,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: [
        'mat-mdc-snack-bar-container',
        `snack-${type}`,
      ],
    };

    let prefix = '';
    switch (type) {
      case 'success':
        prefix = '✅ ';
        break;
      case 'error':
        prefix = '🚨 ';
        break;
      case 'warning':
        prefix = '⚠️ ';
        break;
      case 'info':
        prefix = 'ℹ️ ';
        break;
    }

    return this.snackBar.open(
      `${prefix}${message}`,
      action,
      config,
    );
  }

  /**
   * Show an Angular Material success snackbar.
   */
  public success(
    message: string,
    duration = 4500,
  ): MatSnackBarRef<TextOnlySnackBar> {
    return this.show(message, 'success', duration);
  }

  /**
   * Show an Angular Material error snackbar.
   */
  public error(
    message: string,
    duration = 5500,
  ): MatSnackBarRef<TextOnlySnackBar> {
    return this.show(message, 'error', duration);
  }

  /**
   * Show an Angular Material info snackbar.
   */
  public info(
    message: string,
    duration = 4500,
  ): MatSnackBarRef<TextOnlySnackBar> {
    return this.show(message, 'info', duration);
  }

  /**
   * Show an Angular Material warning snackbar.
   */
  public warning(
    message: string,
    duration = 5000,
  ): MatSnackBarRef<TextOnlySnackBar> {
    return this.show(message, 'warning', duration);
  }

  /**
   * Dismiss the currently open snackbar.
   */
  public dismiss(): void {
    this.snackBar.dismiss();
  }

  /**
   * Clear active snackbars.
   */
  public clear(): void {
    this.snackBar.dismiss();
  }
}
