import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError, tap, catchError } from 'rxjs';

interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: number;
  username: string;
  email: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `http://${window.location.hostname}:8085/api/v1/auth`;
  private readonly accessTokenKey = 'accessToken';
  private readonly refreshTokenKey = 'refreshToken';
  private readonly userKey = 'crmUser';

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(r => this.storeSession(r))
    );
  }

  private storeSession(r: AuthResponse): void {
    localStorage.setItem(this.accessTokenKey, r.accessToken);
    localStorage.setItem(this.refreshTokenKey, r.refreshToken);
    localStorage.setItem(this.userKey, JSON.stringify({ name: r.username, email: r.email, role: r.role }));
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  logout(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
  }
}
