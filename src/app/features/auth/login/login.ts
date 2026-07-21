import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { OToastService } from 'orque-ui';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(OToastService);
  // The error/loading state below is set from inside an HttpClient subscribe
  // callback; on this app's Angular/zone.js combo that doesn't reliably
  // trigger a view update on its own, so each async state change is followed
  // by an explicit detectChanges() — without it the error banner/toast were
  // silently stuck until some unrelated event (e.g. a click) forced a repaint.
  private readonly cdr = inject(ChangeDetectorRef);

  usernameOrEmail = '';
  password = '';
  loading = false;
  errorMessage = '';

  login(): void {
    this.errorMessage = '';

   const usernameOrEmail = this.usernameOrEmail.trim();

if (!usernameOrEmail || !this.password) {
  this.errorMessage = 'Username/email and password are required';
  return;
}

if (/\s/.test(usernameOrEmail)) {
 this.errorMessage = 'Username cannot contain spaces.';
this.toast.addError('Validation Error', this.errorMessage);
return;
}

    this.loading = true;
this.authService.login({
  usernameOrEmail: usernameOrEmail,
  password: this.password
}).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.resolveErrorMessage(err);
        this.toast.addError('Login failed', this.errorMessage);
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * The backend intentionally returns a generic "Invalid credentials" for a
   * bad username/password (so the login page can't be used to enumerate
   * which usernames exist) but does return a specific reason for account-
   * level problems (disabled account, suspended org, expired license) — show
   * that specific reason when present instead of a one-size-fits-all message.
   */
  private resolveErrorMessage(err: HttpErrorResponse): string {
    const backendMessage = err?.error?.message;
    if (typeof backendMessage === 'string' && backendMessage.trim()) {
      if (/invalid credentials/i.test(backendMessage)) {
        return 'Incorrect username or password. Please try again.';
      }
      return backendMessage;
    }
    if (err.status === 0) {
      return 'Unable to reach the server. Check your connection and try again.';
    }
    return 'Incorrect username or password. Please try again.';
  }
}