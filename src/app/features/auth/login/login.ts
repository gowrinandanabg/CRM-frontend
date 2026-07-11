import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  usernameOrEmail = '';
  password = '';
  loading = false;
  errorMessage = '';

  login(): void {
    this.errorMessage = '';

    if (!this.usernameOrEmail || !this.password) {
      this.errorMessage = 'Username/email and password are required';
      return;
    }

    this.loading = true;

    this.authService.login({
      usernameOrEmail: this.usernameOrEmail,
      password: this.password
    }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Invalid username/email or password';
      }
    });
  }
}