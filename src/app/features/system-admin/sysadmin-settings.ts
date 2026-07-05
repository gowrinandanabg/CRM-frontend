import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { AppConfigService } from '../../core/services/app-config.service';

@Component({
  selector: 'app-sysadmin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <h1>Settings</h1>
        <p class="subtitle">CRM configuration and license information</p>
      </div>

      <!-- ── License Info (read-only, auto-loaded) ── -->
      <section class="settings-section">
        <div class="section-header">
          <div class="section-icon license-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <h2>License Information</h2>
            <p>Your organization's active CRM license details</p>
          </div>
          @if (licenseLoading()) {
            <span class="loading-chip">Loading…</span>
          } @else {
            <span class="status-chip" [class.chip-active]="license()?.status === 'ACTIVE' || license()?.status === 'GRACE'"
                                      [class.chip-expired]="license()?.status === 'EXPIRED'">
              {{ license()?.status ?? 'Unknown' }}
            </span>
          }
        </div>

        @if (licenseError()) {
          <div class="info-banner info-warn">{{ licenseError() }}</div>
        }

        @if (license()) {
          <div class="info-grid">
            <div class="info-field">
              <span class="info-label">Organization</span>
              <span class="info-value">{{ license()?.organizationName ?? '—' }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">License Name</span>
              <span class="info-value">{{ license()?.licenseName ?? '—' }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">Expires</span>
              <span class="info-value">{{ formatDate(license()?.endDate) }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">Days Remaining</span>
              <span class="info-value" [class.warn-text]="(license()?.daysRemaining ?? 0) < 30">
                {{ license()?.daysRemaining ?? '—' }}
              </span>
            </div>
            <div class="info-field">
              <span class="info-label">Max Users</span>
              <span class="info-value">{{ license()?.maximumUsers ?? '—' }}</span>
            </div>
            <div class="info-field">
              <span class="info-label">Concurrent Limit</span>
              <span class="info-value">{{ license()?.concurrentUsers ?? '—' }}</span>
            </div>
            @if (license()?.inGracePeriod) {
              <div class="info-field">
                <span class="info-label">Grace Days Left</span>
                <span class="info-value warn-text">{{ license()?.graceRemaining }}</span>
              </div>
            }
          </div>

          @if (license()?.features?.length) {
            <div class="features-section">
              <span class="info-label">Allowed Modules</span>
              <div class="feature-tags">
                @for (f of license()!.features; track f) {
                  <span class="feature-tag">{{ f }}</span>
                }
              </div>
            </div>
          }
        }
      </section>

      <!-- ── Company / Billing Details (printed on Quote & Invoice PDFs) ── -->
      <section class="settings-section">
        <div class="section-header">
          <div class="section-icon billing-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/>
            </svg>
          </div>
          <div>
            <h2>Company &amp; Billing Details</h2>
            <p>Shown as "Billed From" and payment details on this tenant's Quote &amp; Invoice PDFs</p>
          </div>
        </div>

        @if (billingLoading()) {
          <span class="loading-chip">Loading…</span>
        } @else {

        @if (billingError()) {
          <div class="info-banner info-warn">{{ billingError() }}</div>
        }

        <div class="settings-row">
          <div class="setting-item">
            <div class="setting-label">
              <span>Company / Legal Name</span>
              <span class="setting-desc">Printed as the billed-from company name</span>
            </div>
            <input class="setting-input" type="text" [(ngModel)]="billingForm.legalName" placeholder="e.g. Acme Solutions Pvt. Ltd." />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <span>Company Tagline</span>
              <span class="setting-desc">Short line under the company name</span>
            </div>
            <input class="setting-input" type="text" [(ngModel)]="billingForm.companyTagline" placeholder="e.g. Enterprise Solutions" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <span>Company Email</span>
              <span class="setting-desc">Contact email shown on documents</span>
            </div>
            <input class="setting-input" type="email" [(ngModel)]="billingForm.email" placeholder="e.g. contact@yourcompany.com" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <span>Company Phone</span>
              <span class="setting-desc">Optional contact number</span>
            </div>
            <input class="setting-input" type="text" [(ngModel)]="billingForm.phone" placeholder="e.g. +91 98765 43210" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <span>Company Address</span>
              <span class="setting-desc">Registered / billing address</span>
            </div>
            <input class="setting-input" type="text" [(ngModel)]="billingForm.address" placeholder="e.g. 4th Floor, Tech Park, Bengaluru" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <span>GSTIN</span>
              <span class="setting-desc">Printed on Invoice PDFs</span>
            </div>
            <input class="setting-input" type="text" [(ngModel)]="billingForm.gstin" placeholder="e.g. 27XXXXX1234X1Z5" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <span>Bank Name</span>
              <span class="setting-desc">Shown in Invoice payment details</span>
            </div>
            <input class="setting-input" type="text" [(ngModel)]="billingForm.bankName" placeholder="e.g. HDFC Bank" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <span>Bank Account Number</span>
              <span class="setting-desc">Account to receive payment</span>
            </div>
            <input class="setting-input" type="text" [(ngModel)]="billingForm.bankAccountNumber" placeholder="e.g. 5020XXXXXXXXXX" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <span>Bank IFSC</span>
              <span class="setting-desc">IFSC code for the account above</span>
            </div>
            <input class="setting-input" type="text" [(ngModel)]="billingForm.bankIfsc" placeholder="e.g. HDFC0001234" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <span>UPI ID</span>
              <span class="setting-desc">Optional UPI payment address</span>
            </div>
            <input class="setting-input" type="text" [(ngModel)]="billingForm.upiId" placeholder="e.g. pay@yourcompany" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <span>Payment Terms (days)</span>
              <span class="setting-desc">Shown as "Net X days" on documents</span>
            </div>
            <input class="setting-input" type="number" min="0" [(ngModel)]="billingForm.paymentTermsDays" placeholder="e.g. 30" />
          </div>
          <div class="setting-item">
            <div class="setting-label">
              <span>Late Fee Policy</span>
              <span class="setting-desc">Shown on Invoice PDFs</span>
            </div>
            <input class="setting-input" type="text" [(ngModel)]="billingForm.lateFeeText" placeholder="e.g. 1.5% per month overdue" />
          </div>
        </div>

        <div class="section-actions">
          <button class="btn-save" (click)="saveBillingProfile()" [disabled]="billingSaving()">
            {{ billingSaving() ? 'Saving…' : 'Save Billing Details' }}
          </button>
          @if (billingSaveSuccess()) {
            <span class="save-success">✓ Saved</span>
          }
        </div>

        }
      </section>

      <!-- ── General CRM Settings ── -->
      <section class="settings-section">
        <div class="section-header">
          <div class="section-icon general-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
          <div>
            <h2>General Settings</h2>
            <p>Application-wide preferences</p>
          </div>
        </div>

        <div class="settings-row">
          <div class="setting-item">
            <div class="setting-label">
              <span>Default Currency</span>
              <span class="setting-desc">Used across quotes, invoices and deals</span>
            </div>
            <select class="setting-select" [(ngModel)]="prefs.currency">
              <option value="INR">INR — Indian Rupee</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span>Date Format</span>
              <span class="setting-desc">How dates are displayed throughout CRM</span>
            </div>
            <select class="setting-select" [(ngModel)]="prefs.dateFormat">
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span>Timezone</span>
              <span class="setting-desc">Organization's primary timezone</span>
            </div>
            <select class="setting-select" [(ngModel)]="prefs.timezone">
              <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
            </select>
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span>Records Per Page</span>
              <span class="setting-desc">Default number of rows in list views</span>
            </div>
            <select class="setting-select" [(ngModel)]="prefs.pageSize">
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        <div class="section-actions">
          <button class="btn-save" (click)="savePrefs()" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save Settings' }}
          </button>
          @if (saveSuccess()) {
            <span class="save-success">✓ Saved</span>
          }
        </div>
      </section>

      <!-- ── Notifications ── -->
      <section class="settings-section">
        <div class="section-header">
          <div class="section-icon notif-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div>
            <h2>Notification Preferences</h2>
            <p>Control what alerts you receive</p>
          </div>
        </div>

        <div class="toggle-list">
          <div class="toggle-item">
            <div class="toggle-label">
              <span>New Lead Assigned</span>
              <span class="setting-desc">Alert when a lead is assigned to you</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" [(ngModel)]="prefs.notifLeads">
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="toggle-item">
            <div class="toggle-label">
              <span>Deal Stage Changed</span>
              <span class="setting-desc">Alert when a deal you own moves stage</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" [(ngModel)]="prefs.notifDeals">
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="toggle-item">
            <div class="toggle-label">
              <span>Task Due Reminder</span>
              <span class="setting-desc">Remind 24h before a task is due</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" [(ngModel)]="prefs.notifTasks">
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="toggle-item">
            <div class="toggle-label">
              <span>License Expiry Warning</span>
              <span class="setting-desc">Alert 30 days before license expires</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" [(ngModel)]="prefs.notifLicense">
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>
      </section>

    </div>
  `,
  styles: [`
    .settings-page { padding: 24px; max-width: 860px; margin: 0 auto; }
    .page-header { margin-bottom: 28px; }
    .page-header h1 { font-size: 22px; font-weight: 700; margin: 0; color: #111827; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 4px 0 0; }

    .settings-section {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 20px;
    }

    .section-header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 20px;
    }
    .section-header h2 { font-size: 15px; font-weight: 600; margin: 0 0 2px; color: #111827; }
    .section-header p { font-size: 13px; color: #6b7280; margin: 0; }
    .section-header > *:last-child { margin-left: auto; flex-shrink: 0; }

    .section-icon {
      width: 36px; height: 36px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .license-icon { background: #ede9fe; color: #7c3aed; }
    .general-icon { background: #e0f2fe; color: #0369a1; }
    .notif-icon   { background: #fef3c7; color: #d97706; }
    .billing-icon { background: #dcfce7; color: #16a34a; }

    .status-chip {
      font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 99px;
    }
    .chip-active  { background: #dcfce7; color: #166534; }
    .chip-expired { background: #fee2e2; color: #991b1b; }
    .loading-chip { font-size: 12px; color: #6b7280; }

    .info-banner { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
    .info-warn   { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    }
    .info-field { display: flex; flex-direction: column; gap: 4px; }
    .info-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #9ca3af; letter-spacing: .04em; }
    .info-value { font-size: 14px; font-weight: 500; color: #111827; }
    .warn-text  { color: #d97706; }

    .features-section { margin-top: 20px; border-top: 1px solid #f3f4f6; padding-top: 16px; }
    .feature-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .feature-tag {
      background: #eff6ff; color: #1d4ed8;
      font-size: 12px; font-weight: 500;
      padding: 4px 10px; border-radius: 6px;
      border: 1px solid #bfdbfe;
    }

    .settings-row { display: flex; flex-direction: column; gap: 4px; }
    .setting-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 0; border-bottom: 1px solid #f3f4f6;
    }
    .setting-item:last-child { border-bottom: none; }
    .setting-label { display: flex; flex-direction: column; gap: 2px; }
    .setting-label span:first-child { font-size: 14px; font-weight: 500; color: #111827; }
    .setting-desc { font-size: 12px; color: #9ca3af; }

    .setting-select {
      border: 1px solid #d1d5db; border-radius: 8px;
      padding: 7px 12px; font-size: 13px; color: #374151;
      background: #f9fafb; cursor: pointer; outline: none;
      min-width: 180px;
    }
    .setting-select:focus { border-color: #6366f1; background: #fff; }

    .setting-input {
      border: 1px solid #d1d5db; border-radius: 8px;
      padding: 7px 12px; font-size: 13px; color: #374151;
      background: #f9fafb; outline: none;
      min-width: 260px; box-sizing: border-box;
    }
    .setting-input:focus { border-color: #6366f1; background: #fff; }

    .section-actions { margin-top: 20px; display: flex; align-items: center; gap: 12px; }
    .btn-save {
      background: #6366f1; color: #fff; border: none;
      padding: 9px 22px; border-radius: 8px;
      font-size: 14px; font-weight: 500; cursor: pointer;
    }
    .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
    .save-success { font-size: 13px; color: #16a34a; font-weight: 500; }

    .toggle-list { display: flex; flex-direction: column; gap: 0; }
    .toggle-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 0; border-bottom: 1px solid #f3f4f6;
    }
    .toggle-item:last-child { border-bottom: none; }
    .toggle-label { display: flex; flex-direction: column; gap: 2px; }
    .toggle-label span:first-child { font-size: 14px; font-weight: 500; color: #111827; }

    .toggle-switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-track {
      position: absolute; inset: 0;
      background: #d1d5db; border-radius: 99px; cursor: pointer;
      transition: background 0.2s;
    }
    .toggle-track::after {
      content: ''; position: absolute;
      width: 16px; height: 16px;
      background: #fff; border-radius: 50%;
      left: 3px; top: 3px;
      transition: transform 0.2s;
    }
    .toggle-switch input:checked + .toggle-track { background: #6366f1; }
    .toggle-switch input:checked + .toggle-track::after { transform: translateX(18px); }
  `]
})
export class SysadminSettingsComponent implements OnInit {
  private readonly http    = inject(HttpClient);
  private readonly auth    = inject(AuthService);
  private readonly cfg     = inject(AppConfigService);

  licenseLoading = signal(true);
  licenseError   = signal<string | null>(null);
  license        = signal<any>(null);

  saving      = signal(false);
  saveSuccess = signal(false);

  billingLoading     = signal(true);
  billingError       = signal<string | null>(null);
  billingSaving      = signal(false);
  billingSaveSuccess = signal(false);

  billingForm = {
    legalName: '', email: '', phone: '', address: '', gstin: '',
    companyTagline: '', bankName: '', bankAccountNumber: '', bankIfsc: '',
    upiId: '', paymentTermsDays: 30, lateFeeText: ''
  };

  prefs = {
    currency:    localStorage.getItem('crm_currency')    ?? 'INR',
    dateFormat:  localStorage.getItem('crm_date_format') ?? 'DD/MM/YYYY',
    timezone:    localStorage.getItem('crm_timezone')    ?? 'Asia/Kolkata',
    pageSize:    localStorage.getItem('crm_page_size')   ?? '25',
    notifLeads:   localStorage.getItem('crm_notif_leads')   !== 'false',
    notifDeals:   localStorage.getItem('crm_notif_deals')   !== 'false',
    notifTasks:   localStorage.getItem('crm_notif_tasks')   !== 'false',
    notifLicense: localStorage.getItem('crm_notif_license') !== 'false',
  };

  private hdrs(): HttpHeaders {
    const token = this.auth.getAccessToken();
    const orgId = this.auth.getOrganizationId();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (orgId) headers['X-Organization-Id'] = orgId;
    return new HttpHeaders(headers);
  }

  ngOnInit(): void {
    this.http.get<any>(`${this.cfg.crmApiUrl}/api/v1/license/status/me`, { headers: this.hdrs() })
      .subscribe({
        next: res => {
          this.license.set(res);
          this.licenseLoading.set(false);
        },
        error: err => {
          this.licenseError.set(err?.error?.message || 'Could not load license information.');
          this.licenseLoading.set(false);
        }
      });

    this.http.get<any>(`${this.cfg.crmApiUrl}/api/v1/organizations/me/billing-profile`, { headers: this.hdrs() })
      .subscribe({
        next: res => {
          this.billingForm = {
            legalName: res?.legalName ?? '',
            email: res?.email ?? '',
            phone: res?.phone ?? '',
            address: res?.address ?? '',
            gstin: res?.gstin ?? '',
            companyTagline: res?.companyTagline ?? '',
            bankName: res?.bankName ?? '',
            bankAccountNumber: res?.bankAccountNumber ?? '',
            bankIfsc: res?.bankIfsc ?? '',
            upiId: res?.upiId ?? '',
            paymentTermsDays: res?.paymentTermsDays ?? 30,
            lateFeeText: res?.lateFeeText ?? ''
          };
          this.billingLoading.set(false);
        },
        error: err => {
          this.billingError.set(err?.error?.message || 'Could not load billing details.');
          this.billingLoading.set(false);
        }
      });
  }

  formatDate(d: any): string {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return String(d); }
  }

  savePrefs(): void {
    this.saving.set(true);
    localStorage.setItem('crm_currency',    this.prefs.currency);
    localStorage.setItem('crm_date_format', this.prefs.dateFormat);
    localStorage.setItem('crm_timezone',    this.prefs.timezone);
    localStorage.setItem('crm_page_size',   this.prefs.pageSize);
    localStorage.setItem('crm_notif_leads',   String(this.prefs.notifLeads));
    localStorage.setItem('crm_notif_deals',   String(this.prefs.notifDeals));
    localStorage.setItem('crm_notif_tasks',   String(this.prefs.notifTasks));
    localStorage.setItem('crm_notif_license', String(this.prefs.notifLicense));

    setTimeout(() => {
      this.saving.set(false);
      this.saveSuccess.set(true);
      setTimeout(() => this.saveSuccess.set(false), 2000);
    }, 400);
  }

  saveBillingProfile(): void {
    this.billingSaving.set(true);
    this.billingError.set(null);
    this.http.put<any>(`${this.cfg.crmApiUrl}/api/v1/organizations/me/billing-profile`, this.billingForm, { headers: this.hdrs() })
      .subscribe({
        next: () => {
          this.billingSaving.set(false);
          this.billingSaveSuccess.set(true);
          setTimeout(() => this.billingSaveSuccess.set(false), 2000);
        },
        error: err => {
          this.billingSaving.set(false);
          this.billingError.set(err?.error?.message || 'Failed to save billing details.');
        }
      });
  }
}
