import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['../login/login.scss']
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  email = '';
  loading = false;
  errorMessage = '';
  submitted = false;

  submit(): void {
    this.errorMessage = '';

    if (!this.email) {
      this.errorMessage = 'Email is required';
      return;
    }

    this.loading = true;
    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.loading = false;
        this.submitted = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        // Same generic message on error as on success — don't reveal whether the email exists.
        this.submitted = true;
        this.cdr.detectChanges();
      }
    });
  }

  backToLogin(): void {
    this.router.navigate(['/login']);
  }
}
