import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface UserSettings {
  id?: number;
  username?: string;
  mailHost?: string;
  mailPort?: number;
  mailUsername?: string;
  mailFromName?: string;
  mailFromAddress?: string;
  mailSslEnabled?: boolean;
  mailSignature?: string;

  notifyTaskDue?: boolean;
  notifyDealStageChange?: boolean;
  notifyLeadAssigned?: boolean;
  notifyQuoteApproved?: boolean;
  notifyInvoicePaid?: boolean;
  notifyFollowupReminder?: boolean;

  calendarSyncEnabled?: boolean;
  calendarProvider?: string;
  followupReminderDays?: number;

  campaignUpdatesEnabled?: boolean;
  dailyDigestEnabled?: boolean;
  digestTime?: string;
  quoteSeriesPrefix?: string;
  quoteNextNumber?: number;
  invoiceSeriesPrefix?: string;
  invoiceNextNumber?: number;
}

export interface EmailLog {
  id: number;
  contactId: number;
  leadId: number;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  direction: string;
  status: string;
  sentAt: string;
}

@Component({
  selector: 'app-user-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-settings.html',
  styleUrl: './user-settings.scss'
})
export class UserSettingsComponent implements OnInit {
  settings = signal<UserSettings>({});
  emailLogs = signal<EmailLog[]>([]);
  
  loadingSettings = true;
  loadingLogs = true;
  submitting = false;
  
  successMessage: string | null = null;
  errorMessage: string | null = null;
  activeSection = signal<'mail' | 'notifications' | 'calendar' | 'campaigns' | 'series' | 'logs'>('mail');

  private readonly base = `http://${globalThis.location.hostname}:8085`;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadSettings();
    this.loadLogs();
  }

  private hdrs(): HttpHeaders {
    const token = localStorage.getItem('accessToken') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadSettings() {
    this.loadingSettings = true;
    this.cdr.markForCheck();

    this.http.get<UserSettings>(`${this.base}/api/v1/user-settings`, { headers: this.hdrs() })
      .subscribe({
        next: data => {
          this.settings.set(data);
          this.loadingSettings = false;
          this.cdr.markForCheck();
        },
        error: err => {
          this.errorMessage = 'Failed to load settings.';
          this.loadingSettings = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadLogs() {
    this.loadingLogs = true;
    this.cdr.markForCheck();

    this.http.get<EmailLog[]>(`${this.base}/api/v1/emails/logs`, { headers: this.hdrs() })
      .pipe(catchError(() => of([])))
      .subscribe(data => {
        this.emailLogs.set(data);
        this.loadingLogs = false;
        this.cdr.markForCheck();
      });
  }

  saveSettings() {
    this.submitting = true;
    this.successMessage = null;
    this.errorMessage = null;
    this.cdr.markForCheck();

    this.http.put<UserSettings>(`${this.base}/api/v1/user-settings`, this.settings(), { headers: this.hdrs() })
      .subscribe({
        next: data => {
          this.settings.set(data);
          this.submitting = false;
          this.successMessage = 'Settings saved successfully!';
          this.cdr.markForCheck();
          setTimeout(() => {
            this.successMessage = null;
            this.cdr.markForCheck();
          }, 3000);
        },
        error: err => {
          this.errorMessage = 'Failed to save settings.';
          this.submitting = false;
          this.cdr.markForCheck();
        }
      });
  }

  setSection(section: 'mail' | 'notifications' | 'calendar' | 'campaigns' | 'series' | 'logs') {
    this.activeSection.set(section);
    this.successMessage = null;
    this.errorMessage = null;
    this.cdr.markForCheck();
  }
}
