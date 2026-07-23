import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { AppConfigService } from '../../core/services/app-config.service';

interface GoogleCalendarStatus {
  connected: boolean;
  googleEmail?: string;
  syncEnabled?: boolean;
  lastSyncedAt?: string;
}

interface TaxCountry {
  countryCode: string;
  countryName: string;
  taxSystem: string;
  registrationLabel: string;
  requiresBusinessState: boolean;
  sameStateComponents: { name: string; rate: number }[] | null;
  differentStateComponents: { name: string; rate: number }[] | null;
  flatComponents: { name: string; rate: number }[] | null;
}

@Component({
  selector: 'app-sysadmin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <div class="settings-header">
        <h1>Settings</h1>
        <p>CRM configuration, license, billing and tax information for your organization</p>
      </div>

      <div class="settings-layout">
        <!-- Sidebar Navigation -->
        <aside class="settings-sidebar">
          <button class="settings-nav-btn" [class.settings-nav-btn--active]="activeSection() === 'license'" (click)="setSection('license')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            License Information
          </button>
          <button class="settings-nav-btn" [class.settings-nav-btn--active]="activeSection() === 'billing'" (click)="setSection('billing')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/>
            </svg>
            Company &amp; Billing
          </button>
          <button class="settings-nav-btn" [class.settings-nav-btn--active]="activeSection() === 'tax'" (click)="setSection('tax')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Tax Configuration
          </button>
          <button class="settings-nav-btn" [class.settings-nav-btn--active]="activeSection() === 'numbering'" (click)="setSection('numbering')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="15" y2="17"></line>
            </svg>
            Document Numbering
          </button>
          <button class="settings-nav-btn" [class.settings-nav-btn--active]="activeSection() === 'general'" (click)="setSection('general')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            General Settings
          </button>
          <button class="settings-nav-btn" [class.settings-nav-btn--active]="activeSection() === 'notifications'" (click)="setSection('notifications')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Notifications
          </button>
          <button class="settings-nav-btn" [class.settings-nav-btn--active]="activeSection() === 'calendar'" (click)="setSection('calendar')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Calendar Sync
          </button>
        </aside>

        <!-- Content Panel -->
        <main class="settings-content">

          <!-- ── License Info (read-only, auto-loaded) ── -->
          @if (activeSection() === 'license') {
          <div class="settings-card">
            <h2 class="settings-section-title">License Information</h2>
            <p class="settings-section-desc">Your organization's active CRM license details</p>

            @if (licenseLoading()) {
              <span class="loading-chip">Loading…</span>
            } @else {
              <span class="status-chip" [class.chip-active]="license()?.status === 'ACTIVE' || license()?.status === 'GRACE'"
                                        [class.chip-expired]="license()?.status === 'EXPIRED'">
                {{ license()?.status ?? 'Unknown' }}
              </span>
            }

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
          </div>
          }

          <!-- ── Company / Billing Details (printed on Quote & Invoice PDFs) ── -->
          @if (activeSection() === 'billing') {
          <div class="settings-card">
            <h2 class="settings-section-title">Company &amp; Billing Details</h2>
            <p class="settings-section-desc">Shown as "Billed From" and payment details on this tenant's Quote &amp; Invoice PDFs</p>

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
          </div>
          }

          <!-- ── Tax Configuration ── -->
          @if (activeSection() === 'tax') {
          <div class="settings-card">
            <h2 class="settings-section-title">Tax Configuration</h2>
            <p class="settings-section-desc">Sets the country/tax system this tenant uses — every Quote, Invoice, Sales Order and report switches automatically</p>

            @if (taxLoading()) {
              <span class="loading-chip">Loading…</span>
            } @else {

            @if (taxError()) {
              <div class="info-banner info-warn">{{ taxError() }}</div>
            }

            <div class="settings-row">
              <div class="setting-item">
                <div class="setting-label">
                  <span>Country</span>
                  <span class="setting-desc">Determines the tax system (GST, VAT, ...) and its rules</span>
                </div>
                <select class="setting-select" [ngModel]="taxForm.countryCode" (ngModelChange)="onCountryChange($event)">
                  <option value="" disabled>Select a country…</option>
                  @for (c of taxCountries(); track c.countryCode) {
                    <option [value]="c.countryCode">{{ c.countryName }} ({{ c.taxSystem }})</option>
                  }
                </select>
              </div>

              @if (selectedCountry()?.requiresBusinessState) {
              <div class="setting-item">
                <div class="setting-label">
                  <span>Business State</span>
                  <span class="setting-desc">Your own registered state — compared against each customer's state to decide CGST/SGST vs IGST</span>
                </div>
                <select class="setting-input" [(ngModel)]="taxForm.businessState">
                  <option value="">-- Select State --</option>
                  @for (s of indianStates; track s) {
                    <option [value]="s">{{ s }}</option>
                  }
                </select>
              </div>
              }

              @if (selectedCountry()) {
              <div class="setting-item">
                <div class="setting-label">
                  <span>Tax Percentage</span>
                  <span class="setting-desc">Configured rate(s) for {{ selectedCountry()?.countryName }} — sourced from the tax master, read-only</span>
                </div>
                <input class="setting-input" type="text" [value]="taxRateSummary" readonly disabled />
              </div>
              }
            </div>

            <div class="section-actions">
              <button class="btn-save" (click)="saveTaxSettings()" [disabled]="taxSaving() || !taxForm.countryCode">
                {{ taxSaving() ? 'Saving…' : 'Save Tax Settings' }}
              </button>
              @if (taxSaveSuccess()) {
                <span class="save-success">✓ Saved — entire CRM now uses {{ selectedCountry()?.taxSystem }}</span>
              }
            </div>

            }
          </div>
          }

          <!-- ── Document Numbering (Quotes/Invoices) ── -->
          @if (activeSection() === 'numbering') {
          <div class="settings-card">
            <h2 class="settings-section-title">Document Numbering</h2>
            <p class="settings-section-desc">One continuous series per tenant — every quote/invoice across all your users draws from this same counter. The next number is never directly editable (by anyone, including you) to prevent gaps or collisions; use "Starting Number" only to seed or reset the series.</p>

            @if (numberingLoading()) {
              <span class="loading-chip">Loading…</span>
            } @else {

            @if (numberingError()) {
              <div class="info-banner info-warn">{{ numberingError() }}</div>
            }

            <div class="settings-row">
              <div class="setting-item">
                <div class="setting-label">
                  <span>Quotation Series Prefix</span>
                  <span class="setting-desc">Shown before the number, e.g. "Q-"</span>
                </div>
                <input class="setting-input" type="text" [(ngModel)]="numberingForm.quoteSeriesPrefix" placeholder="e.g. Q-" />
              </div>
              <div class="setting-item">
                <div class="setting-label">
                  <span>Starting Quotation Number</span>
                  <span class="setting-desc">Seeds/resets the series — leave alone unless you're initializing or restarting numbering</span>
                </div>
                <input class="setting-input" type="number" min="1" [(ngModel)]="numberingForm.quoteStartingNumber" />
              </div>
              <div class="setting-item">
                <div class="setting-label">
                  <span>Next Quotation Number</span>
                  <span class="setting-desc">Read-only — current live counter</span>
                </div>
                <input class="setting-input" type="text" [value]="numberingForm.quoteSeriesPrefix + numberingCurrent.quoteNextNumber" disabled />
              </div>

              <div class="setting-item">
                <div class="setting-label">
                  <span>Invoice Series Prefix</span>
                  <span class="setting-desc">Shown before the number, e.g. "INV-"</span>
                </div>
                <input class="setting-input" type="text" [(ngModel)]="numberingForm.invoiceSeriesPrefix" placeholder="e.g. INV-" />
              </div>
              <div class="setting-item">
                <div class="setting-label">
                  <span>Starting Invoice Number</span>
                  <span class="setting-desc">Seeds/resets the series — leave alone unless you're initializing or restarting numbering</span>
                </div>
                <input class="setting-input" type="number" min="1" [(ngModel)]="numberingForm.invoiceStartingNumber" />
              </div>
              <div class="setting-item">
                <div class="setting-label">
                  <span>Next Invoice Number</span>
                  <span class="setting-desc">Read-only — current live counter</span>
                </div>
                <input class="setting-input" type="text" [value]="numberingForm.invoiceSeriesPrefix + numberingCurrent.invoiceNextNumber" disabled />
              </div>
            </div>

            <div class="section-actions">
              <button class="btn-save" (click)="saveNumbering()" [disabled]="numberingSaving()">
                {{ numberingSaving() ? 'Saving…' : 'Save Numbering Settings' }}
              </button>
              @if (numberingSaveSuccess()) {
                <span class="save-success">✓ Saved</span>
              }
            </div>

            }
          </div>
          }

          <!-- ── General CRM Settings ── -->
          @if (activeSection() === 'general') {
          <div class="settings-card">
            <h2 class="settings-section-title">General Settings</h2>
            <p class="settings-section-desc">Application-wide preferences</p>

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
          </div>
          }

          <!-- ── Calendar Sync ── -->
          @if (activeSection() === 'calendar') {
          <div class="settings-card">
            <h2 class="settings-section-title">Calendar Sync Integration</h2>
            <p class="settings-section-desc">Connect your own Google account to sync your CRM meetings and tasks both ways with Google Calendar.</p>

            <div class="google-cal-card">
              <div class="google-cal-info">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <div>
                  @if (!loadingGoogleStatus()) {
                    @if (googleCalendarStatus().connected) {
                      <strong>Connected</strong> — {{ googleCalendarStatus().googleEmail }}
                      @if (googleCalendarStatus().lastSyncedAt) {
                        <div class="google-cal-sub">Last synced {{ formatDate(googleCalendarStatus().lastSyncedAt) }}</div>
                      }
                    } @else {
                      <strong>Not connected</strong>
                      <div class="google-cal-sub">Connect your own Google account to sync events both ways.</div>
                    }
                  } @else {
                    <span>Checking connection status…</span>
                  }
                </div>
              </div>
              <div class="google-cal-actions">
                @if (!googleCalendarStatus().connected) {
                  <button class="btn-save" [disabled]="connectingGoogle()" (click)="connectGoogleCalendar()">
                    {{ connectingGoogle() ? 'Redirecting…' : 'Connect Google Calendar' }}
                  </button>
                } @else {
                  <button class="btn-save" [disabled]="syncingGoogle()" (click)="syncGoogleCalendarNow()">
                    {{ syncingGoogle() ? 'Syncing…' : 'Sync Now' }}
                  </button>
                  <button class="btn-secondary" (click)="disconnectGoogleCalendar()">Disconnect</button>
                }
              </div>
            </div>
          </div>
          }

          <!-- ── Notifications ── -->
          @if (activeSection() === 'notifications') {
          <div class="settings-card">
            <h2 class="settings-section-title">Notification Preferences</h2>
            <p class="settings-section-desc">Control what alerts you receive</p>

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
          </div>
          }

        </main>
      </div>
    </div>
  `,
  styles: [`
    .settings-page {
      padding: 24px;
      background: var(--crm-bg, #f8fafc);
      min-height: calc(100vh - 60px);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .settings-header h1 { margin: 0; font-size: 1.5rem; font-weight: 700; color: #111827; }
    .settings-header p { margin: 4px 0 0; font-size: 0.88rem; color: #6b7280; }

    .settings-layout { display: flex; gap: 24px; flex: 1; }
    @media (max-width: 768px) { .settings-layout { flex-direction: column; } }

    .settings-sidebar { width: 260px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
    @media (max-width: 768px) {
      .settings-sidebar { width: 100%; flex-direction: row; overflow-x: auto; padding-bottom: 8px; }
    }

    .settings-nav-btn {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px;
      background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
      color: #4b5563; font-size: 0.85rem; font-weight: 600;
      cursor: pointer; transition: all 0.15s ease; text-align: left;
    }
    .settings-nav-btn svg { stroke: currentColor; flex-shrink: 0; }
    .settings-nav-btn:hover { background: #f3f4f6; color: #111827; }
    .settings-nav-btn--active { background: #0F3460; border-color: #0F3460; color: #fff; }
    .settings-nav-btn--active:hover { background: #163E7A; color: #fff; }
    @media (max-width: 768px) { .settings-nav-btn { white-space: nowrap; } }

    .settings-content { flex: 1; min-width: 0; }

    .settings-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .settings-section-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #111827; }
    .settings-section-desc { margin: 4px 0 20px; font-size: 0.82rem; color: #6b7280; line-height: 1.5; }

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
    .setting-select:focus { border-color: #0F3460; background: #fff; }

    .setting-input {
      border: 1px solid #d1d5db; border-radius: 8px;
      padding: 7px 12px; font-size: 13px; color: #374151;
      background: #f9fafb; outline: none;
      min-width: 260px; box-sizing: border-box;
    }
    .setting-input:focus { border-color: #0F3460; background: #fff; }

    .section-actions { margin-top: 20px; display: flex; align-items: center; gap: 12px; }
    .btn-save {
      background: #0F3460; color: #fff; border: none;
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
    .toggle-switch input:checked + .toggle-track { background: #0F3460; }
    .toggle-switch input:checked + .toggle-track::after { transform: translateX(18px); }

    .google-cal-card {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; padding: 16px 18px;
      border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;
      flex-wrap: wrap;
    }
    .google-cal-info { display: flex; align-items: center; gap: 12px; color: #374151; font-size: 0.85rem; }
    .google-cal-info svg { color: #0F3460; flex-shrink: 0; }
    .google-cal-sub { font-size: 0.75rem; color: #9ca3af; margin-top: 2px; }
    .google-cal-actions { display: flex; gap: 8px; }
    .btn-secondary {
      padding: 9px 18px; border: 1px solid #d1d5db; border-radius: 8px;
      background: #fff; color: #4b5563; font-size: 14px; font-weight: 500; cursor: pointer;
    }
    .btn-secondary:hover { background: #f3f4f6; }
  `]
})
export class SysadminSettingsComponent implements OnInit {
  private readonly http    = inject(HttpClient);
  private readonly auth    = inject(AuthService);
  private readonly cfg     = inject(AppConfigService);

  activeSection = signal<'license' | 'billing' | 'tax' | 'numbering' | 'general' | 'notifications' | 'calendar'>('license');

  setSection(section: 'license' | 'billing' | 'tax' | 'numbering' | 'general' | 'notifications' | 'calendar'): void {
    this.activeSection.set(section);
  }

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

  taxLoading     = signal(true);
  taxError       = signal<string | null>(null);
  taxSaving      = signal(false);
  taxSaveSuccess = signal(false);
  taxCountries   = signal<TaxCountry[]>([]);

  taxForm = {
    countryCode: '', countryName: '', taxSystem: '', registrationLabel: '',
    registrationNumber: '', businessState: '', requiresBusinessState: false, configJson: ''
  };

  /** Canonical Indian states/UTs — kept identical to the customerState options in
   * quotes.json/invoices.json so businessState and customerState can only ever match
   * on an exact, typo-free value, instead of two independently free-typed text fields. */
  readonly indianStates: string[] = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
    'Ladakh', 'Lakshadweep', 'Puducherry'
  ];

  selectedCountry = signal<TaxCountry | null>(null);

  /** Read-only display of the selected country's configured rate(s) — sourced entirely
   * from tax-countries.json, never hardcoded here. Flat-rate regimes (e.g. VAT) show a
   * single rate; state-based regimes (e.g. GST) show both the same-state and
   * different-state components since either can apply depending on the customer. */
  get taxRateSummary(): string {
    const country = this.selectedCountry();
    if (!country) return '';

    const format = (components: { name: string; rate: number }[] | null) =>
      (components ?? []).map(c => `${c.name} ${c.rate}%`).join(' + ');

    if (country.flatComponents?.length) {
      return format(country.flatComponents);
    }

    const sameState = format(country.sameStateComponents);
    const diffState = format(country.differentStateComponents);
    if (!sameState && !diffState) return '';
    return `Same state: ${sameState || '—'}  |  Different state: ${diffState || '—'}`;
  }

  numberingLoading     = signal(true);
  numberingError       = signal<string | null>(null);
  numberingSaving      = signal(false);
  numberingSaveSuccess = signal(false);

  numberingForm = {
    quoteSeriesPrefix: 'Q-', quoteStartingNumber: 1001,
    invoiceSeriesPrefix: 'INV-', invoiceStartingNumber: 1001
  };
  /** Live read-only counter values, as currently stored — distinct from the editable "starting number" above. */
  numberingCurrent = { quoteNextNumber: 1001, invoiceNextNumber: 1001 };

  googleCalendarStatus = signal<GoogleCalendarStatus>({ connected: false });
  loadingGoogleStatus  = signal(true);
  connectingGoogle     = signal(false);
  syncingGoogle        = signal(false);

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

    this.http.get<TaxCountry[]>('/tax-countries.json').subscribe({
      next: countries => {
        this.taxCountries.set(countries || []);
        this.loadTaxSettings();
      },
      error: () => {
        this.taxError.set('Could not load the supported countries list.');
        this.taxLoading.set(false);
      }
    });

    this.loadNumbering();
    this.loadGoogleCalendarStatus();
    this.handleGoogleCalendarRedirect();
  }

  private handleGoogleCalendarRedirect(): void {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('googleCalendar');
    if (!status) return;
    if (status === 'connected') {
      this.loadGoogleCalendarStatus();
    }
    window.history.replaceState({}, '', window.location.pathname);
  }

  loadGoogleCalendarStatus(): void {
    this.loadingGoogleStatus.set(true);
    this.http.get<GoogleCalendarStatus>(`${this.cfg.crmApiUrl}/api/v1/calendar/google/oauth/status`, { headers: this.hdrs() })
      .subscribe({
        next: status => {
          this.googleCalendarStatus.set(status);
          this.loadingGoogleStatus.set(false);
        },
        error: () => {
          this.googleCalendarStatus.set({ connected: false });
          this.loadingGoogleStatus.set(false);
        }
      });
  }

  connectGoogleCalendar(): void {
    this.connectingGoogle.set(true);
    this.http.get<{ url: string }>(`${this.cfg.crmApiUrl}/api/v1/calendar/google/oauth/url`, { headers: this.hdrs() })
      .subscribe({
        next: res => { window.location.href = res.url; },
        error: () => this.connectingGoogle.set(false)
      });
  }

  disconnectGoogleCalendar(): void {
    this.http.post(`${this.cfg.crmApiUrl}/api/v1/calendar/google/oauth/disconnect`, {}, { headers: this.hdrs() })
      .subscribe({
        next: () => this.googleCalendarStatus.set({ connected: false }),
        error: () => {}
      });
  }

  syncGoogleCalendarNow(): void {
    this.syncingGoogle.set(true);
    this.http.post<any>(`${this.cfg.crmApiUrl}/api/v1/calendar-events/sync/google`, {}, { headers: this.hdrs() })
      .subscribe({
        next: () => {
          this.syncingGoogle.set(false);
          this.loadGoogleCalendarStatus();
        },
        error: () => this.syncingGoogle.set(false)
      });
  }

  private loadNumbering(): void {
    this.http.get<any>(`${this.cfg.crmApiUrl}/api/v1/user-settings`, { headers: this.hdrs() })
      .subscribe({
        next: res => {
          const quoteNext = res?.quoteNextNumber ?? 1001;
          const invoiceNext = res?.invoiceNextNumber ?? 1001;
          this.numberingForm = {
            quoteSeriesPrefix: res?.quoteSeriesPrefix ?? 'Q-',
            quoteStartingNumber: quoteNext,
            invoiceSeriesPrefix: res?.invoiceSeriesPrefix ?? 'INV-',
            invoiceStartingNumber: invoiceNext
          };
          this.numberingCurrent = { quoteNextNumber: quoteNext, invoiceNextNumber: invoiceNext };
          this.numberingLoading.set(false);
        },
        error: err => {
          this.numberingError.set(err?.error?.message || 'Could not load document numbering settings.');
          this.numberingLoading.set(false);
        }
      });
  }

  saveNumbering(): void {
    this.numberingSaving.set(true);
    this.numberingError.set(null);
    const payload = {
      quoteSeriesPrefix: this.numberingForm.quoteSeriesPrefix,
      quoteNextNumber: this.numberingForm.quoteStartingNumber,
      invoiceSeriesPrefix: this.numberingForm.invoiceSeriesPrefix,
      invoiceNextNumber: this.numberingForm.invoiceStartingNumber
    };
    this.http.put<any>(`${this.cfg.crmApiUrl}/api/v1/user-settings`, payload, { headers: this.hdrs() })
      .subscribe({
        next: res => {
          this.numberingCurrent = {
            quoteNextNumber: res?.quoteNextNumber ?? this.numberingForm.quoteStartingNumber,
            invoiceNextNumber: res?.invoiceNextNumber ?? this.numberingForm.invoiceStartingNumber
          };
          this.numberingSaving.set(false);
          this.numberingSaveSuccess.set(true);
          setTimeout(() => this.numberingSaveSuccess.set(false), 3000);
        },
        error: err => {
          this.numberingSaving.set(false);
          this.numberingError.set(err?.error?.message || 'Failed to save document numbering settings.');
        }
      });
  }

  private loadTaxSettings(): void {
    this.http.get<any>(`${this.cfg.crmApiUrl}/api/v1/tax-settings/me`, { headers: this.hdrs() })
      .subscribe({
        next: res => {
          if (res?.countryCode) {
            this.taxForm = {
              countryCode: res.countryCode,
              countryName: res.countryName ?? '',
              taxSystem: res.taxSystem ?? '',
              registrationLabel: res.registrationLabel ?? '',
              registrationNumber: res.registrationNumber ?? '',
              businessState: res.businessState ?? '',
              requiresBusinessState: !!res.requiresBusinessState,
              configJson: res.configJson ?? ''
            };
            this.selectedCountry.set(this.taxCountries().find(c => c.countryCode === res.countryCode) ?? null);
          }
          this.taxLoading.set(false);
        },
        error: err => {
          this.taxError.set(err?.error?.message || 'Could not load tax settings.');
          this.taxLoading.set(false);
        }
      });
  }

  onCountryChange(countryCode: string): void {
    const country = this.taxCountries().find(c => c.countryCode === countryCode) ?? null;
    this.selectedCountry.set(country);
    if (!country) return;
    this.taxForm.countryCode = country.countryCode;
    this.taxForm.countryName = country.countryName;
    this.taxForm.taxSystem = country.taxSystem;
    this.taxForm.registrationLabel = country.registrationLabel;
    this.taxForm.requiresBusinessState = country.requiresBusinessState;
    this.taxForm.configJson = JSON.stringify(country);
  }

  saveTaxSettings(): void {
    this.taxSaving.set(true);
    this.taxError.set(null);
    this.http.put<any>(`${this.cfg.crmApiUrl}/api/v1/tax-settings/me`, this.taxForm, { headers: this.hdrs() })
      .subscribe({
        next: () => {
          this.taxSaving.set(false);
          this.taxSaveSuccess.set(true);
          setTimeout(() => this.taxSaveSuccess.set(false), 3000);
        },
        error: err => {
          this.taxSaving.set(false);
          this.taxError.set(err?.error?.message || 'Failed to save tax settings.');
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
