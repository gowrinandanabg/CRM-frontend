import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppConfigService } from './app-config.service';
import { AuthService } from './auth';

const GRACE_SECONDS = 15;
const HEARTBEAT_MS = 15_000;

/**
 * Any 401 (admin-terminated session, inactivity-expired session, ...) routes through here
 * instead of an immediate logout. The user gets a 15s grace window to either resume the
 * session or log out; the page underneath is left exactly as it was — we never clear
 * on-screen data just because one request failed, only on an explicit or timed-out logout.
 */
@Injectable({ providedIn: 'root' })
export class SessionGuardService {
  private readonly http = inject(HttpClient);
  private readonly cfg = inject(AppConfigService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly _visible = signal(false);
  private readonly _secondsLeft = signal(GRACE_SECONDS);
  private readonly _resuming = signal(false);

  readonly visible = this._visible.asReadonly();
  readonly secondsLeft = this._secondsLeft.asReadonly();
  readonly resuming = this._resuming.asReadonly();

  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // A terminated/expired session otherwise only surfaces on the *next* API call —
    // on an idle screen that could be a long time. Poll a cheap authenticated endpoint
    // so the popup shows up promptly even with no user activity.
    setInterval(() => {
      if (!this.authService.isLoggedIn() || this._visible()) return;
      this.http.get(`${this.cfg.crmApiUrl}/api/v1/sessions/ping`).subscribe({ error: () => {} });
    }, HEARTBEAT_MS);
  }

  /** Called by the auth interceptor on a 401. A no-op if the popup is already up,
   *  so a burst of parallel failed requests only opens one prompt. */
  trigger(): void {
    if (this._visible()) return;

    this._visible.set(true);
    this._secondsLeft.set(GRACE_SECONDS);
    this.timerId = setInterval(() => {
      const remaining = this._secondsLeft() - 1;
      if (remaining <= 0) {
        this.stopTimer();
        this.logoutNow();
        return;
      }
      this._secondsLeft.set(remaining);
    }, 1000);
  }

  continueSession(): void {
    if (this._resuming()) return;
    this._resuming.set(true);

    this.http.post<{ success: boolean }>(`${this.cfg.crmApiUrl}/api/v1/sessions/resume`, {}).subscribe({
      next: () => {
        this._resuming.set(false);
        this.stopTimer();
        this._visible.set(false);
      },
      error: () => {
        this._resuming.set(false);
        this.logoutNow();
      }
    });
  }

  logoutNow(): void {
    this.stopTimer();
    this._visible.set(false);
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
