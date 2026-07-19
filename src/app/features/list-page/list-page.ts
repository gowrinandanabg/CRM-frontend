import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import {
  PageRendererComponent,
  PageAction,
  PageConfig,
  OToastService,
  CalendarWorkspaceComponent,
  CustomizationComponent,
  EmailWorkspaceComponent,
  InventoryComponent,
  ReportBuilderComponent,
  ReportsComponent,
  UserSettingsComponent,
  PageStoreService,
  FormDrawerComponent
} from 'orque-ui';
import { KanbanComponent } from './kanban';
import { SysadminSettingsComponent } from '../system-admin/sysadmin-settings';
import { CrmDashboardBuilderComponent } from '../crm-dashboard-builder/crm-dashboard-builder';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AppConfigService } from '../../core/services/app-config.service';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageRendererComponent,
    FormDrawerComponent,
    KanbanComponent,
    CalendarWorkspaceComponent,
    CustomizationComponent,
    CrmDashboardBuilderComponent,
    EmailWorkspaceComponent,
    InventoryComponent,
    ReportBuilderComponent,
    ReportsComponent,
    UserSettingsComponent,
    SysadminSettingsComponent
  ],
  template: `
    <div class="lp-container">
      @if (page && canShowKanban()) {
        <div class="lp-toolbar">
          <div class="lp-view-toggle">
            <button [class.active]="viewMode === 'table'" (click)="viewMode = 'table'" class="lp-toggle-btn">Table View</button>
            <button [class.active]="viewMode === 'kanban'" (click)="viewMode = 'kanban'" class="lp-toggle-btn">Kanban Board</button>
          </div>
        </div>
      }

      @if (loading && !page && !isCustomResource()) {
        <div class="lp-loader">
          <div class="lp-spinner"></div>
          <p>Loading...</p>
        </div>
      }

      @if (error && !isCustomResource()) {
        <div class="lp-error">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
          <span>{{ error }}</span>
        </div>
      }

      <!-- Dynamic Custom Modules -->
      @if (resource === 'calendar') {
        <app-calendar-workspace></app-calendar-workspace>
      }
      @else if (resource === 'reports') {
        <app-reports></app-reports>
      }
      @else if (resource === 'report-builder') {
        <app-report-builder></app-report-builder>
      }
      @else if (resource === 'customization') {
        <app-customization></app-customization>
      }
      @else if (resource === 'emails') {
        <app-email-workspace></app-email-workspace>
      }
      @else if (resource === 'inventory') {
        <app-inventory></app-inventory>
      }
      @else if (resource === 'dashboard-builder') {
        <app-crm-dashboard-builder></app-crm-dashboard-builder>
      }
      @else if (resource === 'user-settings') {
        @if (showLicenseSettings()) {
          <app-sysadmin-settings></app-sysadmin-settings>
        } @else {
          <app-user-settings></app-user-settings>
        }
      }

      @else if (page && !error) {
        <div class="lp-workspace-wrapper" style="position: relative; padding-bottom: 80px;">
          @if (viewMode === 'table') {
              <o-page-renderer [page]="page" [data]="data" [userRole]="auth.getRole() || ''" (actionTriggered)="handleAction($event)" (selectionChange)="onSelectionChanged($event)"></o-page-renderer>
          } @else {
            <app-kanban [resource]="resource" [data]="data" (action)="handleAction($event)"></app-kanban>
            <o-form-drawer
              [open]="editDrawerOpen"
              [title]="editDrawerTitle"
              [steps]="page?.steps || []"
              [rowData]="editDrawerRowData"
              [showSubmit]="false"
              [readOnly]="false"
              [actionType]="'edit'"
              (closeDrawer)="editDrawerOpen = false"
              (save)="onEditDrawerSave($event)">
            </o-form-drawer>
          }

          <!-- Floating Bottom Bar for PDF operations (quotes & invoices) -->
          <div class="pdf-floating-bar" [style.left]="sidebarOffset"
               *ngIf="(selectedBulkRows.length > 0 || selectedRow) && (resource === 'quotes' || resource === 'invoices')">
            <div class="pdf-bar-left">
              <button class="pdf-bar-close-btn" (click)="clearPdfSelection()">Close</button>
              <span class="pdf-bar-row-info">
                @if (selectedBulkRows.length > 1) {
                  <strong>{{ selectedBulkRows.length }} {{ resource === 'invoices' ? 'Invoices' : 'Quotes' }} selected</strong>
                } @else {
                  <strong>Selected {{ resource === 'invoices' ? 'Invoice' : 'Quote' }}:</strong>
                  {{ pdfActiveRow?.invoiceNumber || pdfActiveRow?.quoteNumber }}
                  @if (pdfActiveRow?.amount) {
                    <span style="margin-left:6px;color:var(--crm-text-3);">(₹{{ pdfActiveRow.amount }})</span>
                  }
                }
              </span>
            </div>
            <div class="pdf-bar-right">
              @if (resource === 'quotes') {
                <button class="pdf-bar-action-btn pdf-btn-secondary"
                        (click)="generateInvoiceFromQuote()"
                        [disabled]="pdfDownloading || selectedBulkRows.length > 1 || pdfActiveRow?.status !== 'Accepted'"
                        [title]="selectedBulkRows.length > 1 ? 'Select a single Accepted quote to convert' : ''">
                  Convert to Invoice
                </button>
                <button class="pdf-bar-action-btn pdf-btn-primary"
                        (click)="downloadSelectedPdfs('quotes')"
                        [disabled]="pdfDownloading">
                  {{ pdfDownloading ? 'Generating...' : (selectedBulkRows.length > 1 ? 'Download All PDFs (' + selectedBulkRows.length + ')' : 'Generate Quotation PDF') }}
                </button>
              }
              @if (resource === 'invoices') {
                <button class="pdf-bar-action-btn pdf-btn-primary"
                        (click)="downloadSelectedPdfs('invoices')"
                        [disabled]="pdfDownloading">
                  {{ pdfDownloading ? 'Generating...' : (selectedBulkRows.length > 1 ? 'Download All PDFs (' + selectedBulkRows.length + ')' : 'Generate Invoice PDF') }}
                </button>
              }
            </div>
          </div>

          <!-- Floating Bottom Bar for Bulk operations — only meaningful for actual
               multi-record bulk actions, so it stays hidden entirely for a single
               selection (use the row's own context menu / Edit for that). -->
          <div class="pdf-floating-bar" [style.left]="sidebarOffset" *ngIf="selectedBulkRows.length > 1 && resource !== 'quotes' && resource !== 'invoices'">
            <div class="pdf-bar-left">
              <button class="pdf-bar-close-btn" (click)="clearBulkSelection()">Cancel</button>
              <span class="pdf-bar-row-info">
                <strong>Selected {{ selectedBulkRows.length }} {{ resource }}:</strong>
              </span>
            </div>
            <div class="pdf-bar-right">
              <button class="pdf-bar-action-btn pdf-btn-secondary" (click)="openBulkEditDrawer()" style="background: rgba(15, 52, 96, 0.1); border: 1px solid rgba(15, 52, 96, 0.3); color: var(--crm-primary);">
                Bulk Edit
              </button>
              <button class="pdf-bar-action-btn pdf-btn-secondary" (click)="openBulkAssignDrawer()" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #D97706;" *ngIf="auth.getRole() === 'SYSTEM_ADMIN'">
                Bulk Assign
              </button>
              <button class="pdf-bar-action-btn pdf-btn-secondary" (click)="openBulkStatusDrawer()" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #059669;" *ngIf="resource === 'leads' || resource === 'deals' || resource === 'accounts'">
                Bulk Status
              </button>
              <button class="pdf-bar-action-btn pdf-btn-secondary" (click)="bulkDeleteSelected()" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--crm-danger);">
                Bulk Delete
              </button>
            </div>
          </div>

          <!-- Bulk Action Modals -->
          <div *ngIf="bulkActionDrawerOpen" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 24px;">
            <div style="background: var(--crm-card); border: 1px solid var(--crm-border); border-radius: 12px; width: 400px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
              <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--crm-text-1); margin: 0 0 16px;">{{ bulkActionTitle }}</h3>
              
              <div *ngIf="bulkActionType === 'edit'" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
                <div>
                  <label style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--crm-text-2); margin-bottom: 4px;">Select Field</label>
                  <select [(ngModel)]="bulkEditField" style="width: 100%; border: 1px solid var(--crm-border); border-radius: 8px; padding: 8px 12px; font-size: 0.82rem; background: var(--crm-bg); color: var(--crm-text-1); outline: none;">
                    <option value="">-- Choose Field --</option>
                    <option *ngFor="let opt of getBulkEditFields()" [value]="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div>
                  <label style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--crm-text-2); margin-bottom: 4px;">New Value</label>
                  <input type="text" [(ngModel)]="bulkEditValue" placeholder="Enter new value..." style="width: 100%; border: 1px solid var(--crm-border); border-radius: 8px; padding: 8px 12px; font-size: 0.82rem; background: var(--crm-bg); color: var(--crm-text-1); outline: none;" />
                </div>
              </div>

              <div *ngIf="bulkActionType === 'assign'" style="margin-bottom: 20px;">
                <label style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--crm-text-2); margin-bottom: 4px;">Select New Owner</label>
                <select [(ngModel)]="bulkAssignOwner" style="width: 100%; border: 1px solid var(--crm-border); border-radius: 8px; padding: 8px 12px; font-size: 0.82rem; background: var(--crm-bg); color: var(--crm-text-1); outline: none;">
                  <option value="">-- Select Owner --</option>
                  <option *ngFor="let u of salesUsers" [value]="u.username">{{ u.fullName }} ({{ u.username }})</option>
                </select>
              </div>

              <div *ngIf="bulkActionType === 'status'" style="margin-bottom: 20px;">
                <label style="display: block; font-size: 0.78rem; font-weight: 600; color: var(--crm-text-2); margin-bottom: 4px;">Select Status / Stage</label>
                <select [(ngModel)]="bulkStatusValue" style="width: 100%; border: 1px solid var(--crm-border); border-radius: 8px; padding: 8px 12px; font-size: 0.82rem; background: var(--crm-bg); color: var(--crm-text-1); outline: none;">
                  <option value="">-- Select Status --</option>
                  <option *ngFor="let st of getBulkStatuses()" [value]="st.value">{{ st.label }}</option>
                </select>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button (click)="bulkActionDrawerOpen = false" style="padding: 6px 14px; background: none; border: 1px solid var(--crm-border); border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: var(--crm-text-2); cursor: pointer;">Cancel</button>
                <button (click)="submitBulkAction()" style="padding: 6px 16px; background: var(--crm-primary); border: none; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #fff; cursor: pointer;">Save Changes</button>
              </div>
            </div>
          </div>

        </div>
      }
    </div>

    <!-- Quote / Invoice detail preview modal -->
    @if (previewRecord && (resource === 'quotes' || resource === 'invoices')) {
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:3000;padding:24px;"
           (click)="previewRecord=null">
        <div style="background:var(--crm-card);border:1px solid var(--crm-border);border-radius:16px;width:100%;max-width:520px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;"
             (click)="$event.stopPropagation()">
          <!-- header -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;border-bottom:1px solid var(--crm-border);">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:0.68rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:3px 9px;border-radius:20px;"
                    [style.background]="resource==='invoices'?'rgba(16,185,129,0.1)':'rgba(15,52,96,0.1)'"
                    [style.color]="resource==='invoices'?'#10B981':'#0F3460'">
                {{ resource === 'invoices' ? 'Invoice' : 'Quote' }}
              </span>
              <h2 style="font-size:1.05rem;font-weight:700;color:var(--crm-text-1);margin:0;">
                {{ previewRecord.quoteNumber || previewRecord.invoiceNumber || '—' }}
              </h2>
            </div>
            <button (click)="previewRecord=null" aria-label="Close preview"
                    style="width:30px;height:30px;border-radius:8px;border:none;background:none;color:var(--crm-text-3);cursor:pointer;display:flex;align-items:center;justify-content:center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <!-- body -->
          <div style="padding:20px 24px;display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow-y:auto;">
            @for (f of (resource==='invoices' ? invoicePreviewFields : quotePreviewFields); track f.key) {
              <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 14px;border-radius:8px;background:var(--crm-bg);border:1px solid var(--crm-border);">
                <span style="font-size:0.78rem;font-weight:600;color:var(--crm-text-3);white-space:nowrap;">{{ f.label }}</span>
                <span style="font-size:0.85rem;font-weight:500;color:var(--crm-text-1);text-align:right;">
                  @if (f.type === 'currency') {
                    ₹{{ previewRecord[f.key] | number:'1.2-2' }}
                  } @else if (f.type === 'date') {
                    {{ previewRecord[f.key] ? (previewRecord[f.key] | date:'d MMM y') : '—' }}
                  } @else if (f.type === 'status') {
                    <span [attr.style]="previewStatusClass(previewRecord[f.key])">{{ previewRecord[f.key] || '—' }}</span>
                  } @else {
                    {{ previewRecord[f.key] || '—' }}
                  }
                </span>
              </div>
            }
          </div>
          <!-- footer -->
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid var(--crm-border);">
            <button (click)="previewRecord=null"
                    style="padding:7px 16px;border:1px solid var(--crm-border);border-radius:8px;background:none;font-size:0.8rem;font-weight:600;color:var(--crm-text-2);cursor:pointer;">
              Close
            </button>
            <button (click)="selectedRow=previewRecord;downloadPdfForSelected(resource==='invoices'?'invoices':'quotes');previewRecord=null"
                    [disabled]="pdfDownloading"
                    style="display:flex;align-items:center;gap:6px;padding:7px 16px;border:none;border-radius:8px;background:#0F3460;color:#fff;font-size:0.8rem;font-weight:600;cursor:pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {{ pdfDownloading ? 'Generating...' : 'Download PDF' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Admin reset-password modal -->
    @if (resetPasswordTarget(); as target) {
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:3000;padding:24px;"
           (click)="cancelResetPassword()">
        <div style="background:var(--crm-card);border:1px solid var(--crm-border);border-radius:16px;width:100%;max-width:400px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;"
             (click)="$event.stopPropagation()">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;border-bottom:1px solid var(--crm-border);">
            <h2 style="font-size:1.05rem;font-weight:700;color:var(--crm-text-1);margin:0;">Reset Password</h2>
            <button (click)="cancelResetPassword()" aria-label="Close"
                    style="width:30px;height:30px;border-radius:8px;border:none;background:none;color:var(--crm-text-3);cursor:pointer;display:flex;align-items:center;justify-content:center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div style="padding:20px 24px;display:flex;flex-direction:column;gap:12px;">
            <p style="font-size:0.85rem;color:var(--crm-text-2);margin:0;">Set a new password for <strong>{{ target.label }}</strong>.</p>
            <input type="password" [(ngModel)]="resetPasswordValueModel" placeholder="New password"
                   style="padding:9px 12px;border:1px solid var(--crm-border);border-radius:8px;font-size:0.85rem;background:var(--crm-bg);color:var(--crm-text-1);"
                   (keydown.enter)="submitResetPassword()" />
            @if (resetPasswordError()) {
              <span style="font-size:0.78rem;color:#DC2626;">{{ resetPasswordError() }}</span>
            }
          </div>
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid var(--crm-border);">
            <button (click)="cancelResetPassword()"
                    style="padding:7px 16px;border:1px solid var(--crm-border);border-radius:8px;background:none;font-size:0.8rem;font-weight:600;color:var(--crm-text-2);cursor:pointer;">
              Cancel
            </button>
            <button (click)="submitResetPassword()" [disabled]="resetPasswordSubmitting()"
                    style="padding:7px 16px;border:none;border-radius:8px;background:#0F3460;color:#fff;font-size:0.8rem;font-weight:600;cursor:pointer;">
              {{ resetPasswordSubmitting() ? 'Resetting...' : 'Reset Password' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .lp-container { display: flex; flex-direction: column; height: 100%; }
    .lp-workspace-wrapper { padding: 24px 28px; flex: 1; display: flex; flex-direction: column; background: var(--crm-bg); }
    .lp-toolbar { padding: 12px 24px; background: var(--crm-card); border-bottom: 1px solid var(--crm-border); display: flex; justify-content: flex-end; }
    .lp-view-toggle { display: flex; background: var(--crm-hover); padding: 4px; border-radius: 8px; }
    .lp-toggle-btn { padding: 6px 14px; font-size: 0.8rem; font-weight: 600; color: var(--crm-text-3); background: transparent; border: none; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; }
    .lp-toggle-btn:hover { color: var(--crm-text-1); }
    .lp-toggle-btn.active { background: var(--crm-card); color: var(--crm-text-1); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .lp-loader { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 80px 24px; color: var(--crm-text-4); font-size: 0.85rem; }
    .lp-spinner { width: 36px; height: 36px; border: 3px solid var(--crm-border); border-top-color: var(--crm-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .lp-error { display: flex; align-items: center; gap: 10px; margin: 24px; padding: 14px 18px; background: var(--crm-danger-soft); color: var(--crm-danger); border-radius: 8px; font-size: 0.85rem; font-weight: 500; }

    /* Calendar styles */
    .cal-container { padding: 40px 28px; display: flex; flex-direction: column; gap: 24px; background: var(--crm-bg); min-height: calc(100vh - 80px); }
    .cal-title { font-size: 1.4rem; font-weight: 700; color: var(--crm-text-1); margin: 0; }
    .cal-subtitle { color: var(--crm-text-3); font-size: 0.85rem; margin: 6px 0 0; }
    .cal-card { background: var(--crm-card); border: 1px solid var(--crm-border); border-radius: 18px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
    .cal-loading { text-align: center; padding: 40px; color: var(--crm-text-3); font-size: 0.9rem; }
    .cal-details { background: var(--crm-card); border: 1px solid var(--crm-border); border-radius: 18px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
    .cal-details-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 40px; }
    .cal-details-left { display: flex; flex-direction: column; }
    .cal-details-right { display: flex; flex-direction: column; border-left: 1px dashed var(--crm-border); padding-left: 40px; }
    .details-title { font-size: 1rem; font-weight: 600; color: var(--crm-text-2); margin: 0 0 16px; }
    .details-list { display: flex; flex-direction: column; gap: 10px; }
    .details-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--crm-border); background: var(--crm-bg); }
    .details-badge { font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; text-transform: uppercase; }
    .details-item[data-status="COMPLETED"] .details-badge { background: var(--crm-success-soft); color: var(--crm-success); }
    .details-item[data-status="PENDING"] .details-badge { background: var(--crm-warning-soft); color: #92400E; }
    .details-item[data-status="IN_PROGRESS"] .details-badge { background: var(--crm-primary-soft); color: var(--crm-primary); }
    .details-label { font-size: 0.85rem; color: var(--crm-text-2); font-weight: 500; }
    .details-empty { font-size: 0.82rem; color: var(--crm-text-4); margin: 0; }

    /* Reports & Analytics styles */
    .rep-container, .an-container { padding: 40px 28px; display: flex; flex-direction: column; gap: 24px; background: var(--crm-bg); min-height: calc(100vh - 80px); }
    .rep-title, .an-title { font-size: 1.4rem; font-weight: 700; color: var(--crm-text-1); margin: 0; }
    .rep-subtitle, .an-subtitle { color: var(--crm-text-3); font-size: 0.85rem; margin: 6px 0 0; }
    .rep-loading, .an-loading { text-align: center; padding: 60px; color: var(--crm-text-3); font-size: 0.9rem; }
    .rep-grid, .an-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .rep-card, .an-card { background: var(--crm-card); border: 1px solid var(--crm-border); border-radius: 18px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
    .an-card { display: flex; flex-direction: column; height: 380px; }
    .scroll-card { overflow: hidden; }
    .rep-summary { grid-column: span 2; }
    .card-title { font-size: 1rem; font-weight: 600; color: var(--crm-text-2); margin: 0 0 20px; }
    .kpi-group { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .kpi-box { border: 1px solid var(--crm-border); border-radius: 12px; padding: 18px; background: var(--crm-bg); text-align: center; }
    .kpi-label { display: block; font-size: 0.78rem; color: var(--crm-text-3); font-weight: 500; margin-bottom: 6px; }
    .kpi-value { font-size: 1.5rem; font-weight: 700; color: var(--crm-text-1); }
    .bar-chart { display: flex; flex-direction: column; gap: 16px; }
    .bar-row { display: flex; align-items: center; gap: 14px; }
    .bar-label { width: 100px; font-size: 0.8rem; color: var(--crm-text-2); font-weight: 500; }
    .bar-fill-container { flex: 1; height: 10px; background: var(--crm-hover); border-radius: 5px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 5px; transition: width 0.8s ease-in-out; }
    .bar-value { font-size: 0.82rem; font-weight: 600; color: var(--crm-text-2); width: 100px; text-align: right; }
    .funnel-chart { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 10px; }
    .funnel-stage { height: 38px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-size: 0.82rem; font-weight: 600; transition: width 0.8s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .delivery-bar { margin-bottom: 20px; }
    .d-info { display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 600; color: var(--crm-text-2); margin-bottom: 8px; }
    .d-val { color: var(--crm-text-1); }
    .d-track { height: 8px; background: var(--crm-hover); border-radius: 4px; overflow: hidden; }
    .d-fill { height: 100%; border-radius: 4px; }
    .c-list { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; flex: 1; padding-right: 4px; }
    .c-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid var(--crm-border); border-radius: 10px; background: var(--crm-bg); }
    .c-name-col { display: flex; flex-direction: column; gap: 4px; }
    .c-name { font-size: 0.85rem; font-weight: 600; color: var(--crm-text-1); }
    .c-subj { font-size: 0.75rem; color: var(--crm-text-3); }
    .c-metrics-col { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .c-badge { font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; }
    .c-badge[data-status="RUNNING"] { background: var(--crm-primary-soft); color: var(--crm-primary); }
    .c-badge[data-status="DRAFT"] { background: var(--crm-hover); color: var(--crm-text-2); }
    .c-badge[data-status="COMPLETED"] { background: var(--crm-success-soft); color: var(--crm-success); }
    .c-date { font-size: 0.7rem; color: var(--crm-text-4); }
    .an-empty { text-align: center; color: var(--crm-text-4); font-size: 0.8rem; padding: 40px 0; }

    /* Settings styles */
    .set-container { padding: 40px 28px; display: flex; flex-direction: column; gap: 24px; background: var(--crm-bg); min-height: calc(100vh - 80px); }
    .set-title { font-size: 1.4rem; font-weight: 700; color: var(--crm-text-1); margin: 0; }
    .set-subtitle { color: var(--crm-text-3); font-size: 0.85rem; margin: 6px 0 0; }
    .set-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .set-card { background: var(--crm-card); border: 1px solid var(--crm-border); border-radius: 18px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
    .profile-summary { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
    .prof-avatar { width: 48px; height: 48px; background: var(--crm-primary); color: #FFFFFF; font-size: 1.25rem; font-weight: 700; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .prof-info { display: flex; flex-direction: column; gap: 4px; }
    .prof-name { font-size: 0.95rem; font-weight: 600; color: var(--crm-text-1); }
    .prof-role { font-size: 0.78rem; color: var(--crm-text-3); }
    .form-group { margin-bottom: 18px; }
    .form-label { display: block; font-size: 0.78rem; font-weight: 600; color: var(--crm-text-2); margin-bottom: 6px; }
    .form-input { width: 100%; border: 1px solid var(--crm-border); border-radius: 8px; padding: 10px 14px; font-size: 0.85rem; color: var(--crm-text-1); background: var(--crm-bg); outline: none; }
    .form-input:disabled { color: var(--crm-text-3); cursor: not-allowed; }
    .read-only-field { background: var(--crm-hover); border-color: var(--crm-border); color: var(--crm-text-2); cursor: default; }
    .license-note { font-size: 0.78rem; color: var(--crm-text-4); line-height: 1.4; margin: 0 0 20px; }
    .license-loading { font-size: 0.82rem; color: var(--crm-text-4); text-align: center; padding: 20px 0; }

    /* Emails styles */
    .em-container { padding: 40px 28px; display: flex; flex-direction: column; gap: 24px; background: var(--crm-bg); min-height: calc(100vh - 80px); }
    .em-title { font-size: 1.4rem; font-weight: 700; color: var(--crm-text-1); margin: 0; }
    .em-subtitle { color: var(--crm-text-3); font-size: 0.85rem; margin: 6px 0 0; }
    .em-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 24px; height: 500px; }
    .em-card { background: var(--crm-card); border: 1px solid var(--crm-border); border-radius: 18px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); display: flex; flex-direction: column; overflow: hidden; }
    .em-list-card { max-height: 100%; }
    .em-list-header { padding: 20px; border-bottom: 1px solid var(--crm-border); display: flex; justify-content: space-between; align-items: center; }
    .em-list-container { overflow-y: auto; flex: 1; }
    .em-item { padding: 16px 20px; border-bottom: 1px solid var(--crm-border); cursor: pointer; transition: background 0.15s ease; }
    .em-item:hover { background: var(--crm-hover); }
    .em-item.selected { background: var(--crm-primary-soft); border-left: 4px solid var(--crm-primary); padding-left: 16px; }
    .em-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .em-from { font-size: 0.85rem; font-weight: 600; color: var(--crm-text-1); }
    .em-date { font-size: 0.72rem; color: var(--crm-text-4); }
    .em-subj { font-size: 0.8rem; font-weight: 500; color: var(--crm-text-2); display: block; margin-bottom: 4px; }
    .em-snippet { font-size: 0.76rem; color: var(--crm-text-3); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .em-detail-card { padding: 24px; overflow-y: auto; }
    .em-detail-header { border-bottom: 1px solid var(--crm-border); padding-bottom: 20px; margin-bottom: 20px; }
    .em-detail-subject { font-size: 1.15rem; font-weight: 700; color: var(--crm-text-1); margin: 0 0 16px; }
    .em-detail-meta { display: flex; justify-content: space-between; align-items: center; }
    .em-sender-row { display: flex; align-items: center; gap: 10px; }
    .em-sender-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--crm-primary); color: #FFFFFF; font-size: 0.9rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .em-sender-info { display: flex; flex-direction: column; }
    .em-detail-from { font-size: 0.85rem; font-weight: 600; color: var(--crm-text-2); }
    .em-detail-to { font-size: 0.72rem; color: var(--crm-text-4); }
    .em-detail-date { font-size: 0.75rem; color: var(--crm-text-3); }
    .em-detail-body { font-size: 0.88rem; color: var(--crm-text-2); line-height: 1.6; white-space: pre-line; }
    .em-detail-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--crm-text-4); font-size: 0.85rem; }
    .em-btn { padding: 6px 12px; font-size: 0.78rem; font-weight: 600; border-radius: 8px; border: 1px solid var(--crm-border); background: var(--crm-card); color: var(--crm-text-2); cursor: pointer; transition: all 0.15s ease; }
    .em-btn-primary { background: var(--crm-primary); color: #FFFFFF; border: none; }
    .em-btn-primary:hover { background: var(--crm-primary-dark); }
    .em-empty { text-align: center; color: var(--crm-text-4); font-size: 0.8rem; padding: 40px 0; }

    /* Custom Table Styles for Quotes & Invoices */
    .custom-table-container { width: 100%; overflow-x: auto; background: var(--crm-card); border: 1px solid var(--crm-border); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
    .custom-data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: var(--crm-table-font-size, 13.5px); }
    .custom-data-table th, .custom-data-table td { padding: 12px 16px; border-bottom: 1px solid var(--crm-border); color: var(--crm-text-2); }
    .custom-data-table th { background: var(--crm-hover); font-weight: 600; color: var(--crm-text-1); font-size: calc(var(--crm-table-font-size, 13.5px) - 1.5px); }
    .custom-data-table tr:hover td { background: var(--crm-hover); }
    .custom-data-table tr.selected td { background: var(--crm-primary-soft); }
    .chk-col { width: 40px; text-align: center; }
    .row-chk { width: 16px; height: 16px; accent-color: var(--crm-primary); cursor: pointer; }
    .actions-col { width: 100px; text-align: center; }
    .row-action-btn { padding: 4px 10px; font-size: 0.75rem; font-weight: 600; border-radius: 6px; border: 1px solid var(--crm-border); background: var(--crm-card); color: var(--crm-primary); cursor: pointer; transition: all 0.15s; }
    .row-action-btn:hover { background: var(--crm-primary); color: #fff; border-color: var(--crm-primary); }
    .empty-row { text-align: center; color: var(--crm-text-4); padding: 32px 0; }
    .th-filter-btn { background: none; border: none; padding: 4px; color: var(--crm-text-3); cursor: pointer; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.12s; }
    .th-filter-btn:hover { background: rgba(0,0,0,0.06); color: var(--crm-text-1); }
    .th-filter-btn.active { color: var(--crm-primary) !important; background: var(--crm-primary-soft) !important; }
    .th-filter-popup { position: absolute; top: 100%; right: 0; margin-top: 8px; width: 220px; background: var(--crm-card); border: 1px solid var(--crm-border); border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); padding: 12px; z-index: 50; text-align: left; white-space: normal; display: flex; flex-direction: column; gap: 8px; }
    
    .status-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; }
    .status-badge[data-status="Draft"] { background: var(--crm-hover); color: var(--crm-text-3); }
    .status-badge[data-status="Sent"] { background: var(--crm-primary-soft); color: var(--crm-primary); }
    .status-badge[data-status="Accepted"] { background: var(--crm-success-soft); color: var(--crm-success); }
    .status-badge[data-status="Paid"] { background: var(--crm-success-soft); color: var(--crm-success); }
    .status-badge[data-status="Rejected"] { background: var(--crm-danger-soft); color: var(--crm-danger); }
    
    /* PDF Floating Bottom Bar */
    .pdf-floating-bar { position: fixed; bottom: 0; right: 0; height: 64px; background: var(--crm-card); border-top: 1px solid var(--crm-border); box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08); z-index: 1000; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; transition: left 0.2s ease; }
    .pdf-bar-left { display: flex; align-items: center; gap: 16px; }
    .pdf-bar-close-btn { padding: 6px 14px; background: none; border: 1px solid var(--crm-border); border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: var(--crm-text-2); cursor: pointer; transition: all 0.15s; }
    .pdf-bar-close-btn:hover { background: var(--crm-hover); color: var(--crm-text-1); }
    .pdf-bar-row-info { font-size: 0.85rem; color: var(--crm-text-1); }
    .pdf-bar-right { display: flex; align-items: center; gap: 12px; }
    .pdf-bar-action-btn { padding: 8px 18px; font-size: 0.8rem; font-weight: 600; border-radius: 8px; border: none; cursor: pointer; transition: all 0.15s; }
    .pdf-btn-primary { background: var(--crm-primary); color: #fff; }
    .pdf-btn-primary:hover:not(:disabled) { background: var(--crm-primary-dark); }
    .pdf-btn-secondary { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #059669; }
    .pdf-btn-secondary:hover:not(:disabled) { background: #059669; color: #fff; }
    .pdf-bar-action-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListPageComponent implements OnInit, OnChanges, OnDestroy {
  @Input() resource = '';

  showLicenseSettings(): boolean {
    const raw = localStorage.getItem('crmUser');
    if (!raw) return false;
    try {
      const user = JSON.parse(raw);
      const role = (user?.role || user?.roleName || '').toUpperCase();
      return role === 'SYSTEM_ADMIN' || role === 'ADMIN';
    } catch {
      return false;
    }
  }

  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  selectedRow: any = null;
  previewRecord: any = null;

  resetPasswordTarget = signal<{ uuid: string; label: string } | null>(null);
  resetPasswordValue = signal('');
  resetPasswordSubmitting = signal(false);
  resetPasswordError = signal('');

  get resetPasswordValueModel(): string { return this.resetPasswordValue(); }
  set resetPasswordValueModel(v: string) { this.resetPasswordValue.set(v); }

  cancelResetPassword(): void {
    this.resetPasswordTarget.set(null);
    this.resetPasswordValue.set('');
    this.resetPasswordError.set('');
  }

  submitResetPassword(): void {
    const target = this.resetPasswordTarget();
    if (!target) return;
    const newPwd = this.resetPasswordValue().trim();
    if (!newPwd) {
      this.resetPasswordError.set('Please enter a new password.');
      return;
    }

    this.resetPasswordSubmitting.set(true);
    this.resetPasswordError.set('');
    const base = this.page!.api;
    const sub = this.store.post(`${base}/${target.uuid}/reset-password`, { newPassword: newPwd }).subscribe({
      next: () => {
        this.resetPasswordSubmitting.set(false);
        this.toast.addSuccess('Password Reset', `Password updated for ${target.label}.`);
        this.cancelResetPassword();
      },
      error: (err) => {
        this.resetPasswordSubmitting.set(false);
        this.resetPasswordError.set(err?.error?.message || err.message || 'Reset failed.');
      }
    });
    this._subs.add(sub);
  }

  readonly quotePreviewFields = [
    { label: 'Quote Number', key: 'quoteNumber',  type: 'text' },
    { label: 'Contact',      key: 'contact',      type: 'text' },
    { label: 'Account',      key: 'account',      type: 'text' },
    { label: 'Amount',       key: 'amount',       type: 'currency' },
    { label: 'Valid Until',  key: 'validUntil',   type: 'date' },
    { label: 'Status',       key: 'status',       type: 'status' },
    { label: 'Created By',   key: 'createdBy',    type: 'text' },
  ];

  readonly invoicePreviewFields = [
    { label: 'Invoice Number', key: 'invoiceNumber', type: 'text' },
    { label: 'Contact',        key: 'contact',       type: 'text' },
    { label: 'Account',        key: 'account',       type: 'text' },
    { label: 'Amount',         key: 'amount',        type: 'currency' },
    { label: 'Due Date',       key: 'dueDate',       type: 'date' },
    { label: 'Paid Date',      key: 'paidDate',      type: 'date' },
    { label: 'Status',         key: 'status',        type: 'status' },
    { label: 'Created By',     key: 'createdBy',     type: 'text' },
  ];

  previewStatusClass(status: string): string {
    if (!status) return '';
    const s = status.toLowerCase();
    const base = 'font-size:0.72rem;font-weight:700;letter-spacing:0.03em;padding:2px 9px;border-radius:20px;text-transform:capitalize;';
    if (['active','accepted','paid'].includes(s))  return `${base}background:rgba(16,185,129,0.1);color:#059669`;
    if (['draft','inactive'].includes(s))          return `${base}background:rgba(148,163,184,0.1);color:#64748b`;
    if (['pending','sent','overdue'].includes(s))  return `${base}background:rgba(245,158,11,0.1);color:#d97706`;
    if (['rejected','cancelled'].includes(s))      return `${base}background:rgba(239,68,68,0.1);color:#dc2626`;
    return base;
  }

  pdfDownloading = false;
  private readonly http = inject(HttpClient);
  private readonly cfg = inject(AppConfigService);
  readonly auth = inject(AuthService);
  private get base(): string { return this.cfg.crmApiUrl; }

  // Kanban board edit drawer (mirrors o-page-renderer's own form-drawer wiring,
  // since the Kanban view is a plain component, not o-page-renderer)
  editDrawerOpen = false;
  editDrawerTitle = '';
  editDrawerRowData: any = null;

  onEditDrawerSave(payload: any): void {
    this.editDrawerOpen = false;
    this.handleAction({ action: 'save', row: this.editDrawerRowData, payload } as PageAction);
  }

  // Bulk operations states
  selectedBulkRows: any[] = [];
  bulkActionDrawerOpen = false;
  bulkActionType: 'edit' | 'assign' | 'status' | '' = '';
  bulkActionTitle = '';
  bulkEditField = '';
  bulkEditValue = '';
  bulkAssignOwner = '';
  bulkStatusValue = '';
  salesUsers: any[] = [];

  columnFilters: Record<string, string> = {};
  tempFilters: Record<string, string> = {};
  activeFilterField: string | null = null;

  page: PageConfig | null = null;
  data: any[] = [];
  loading = false;
  error: string | null = null;
  viewMode: 'table' | 'kanban' = 'table';

  // Custom resource states
  activeStatusTab = signal('ALL');
  loadingCustom = false;

  private _loadedResource: string | null = null;
  private _subs = new Subscription();

  private readonly store = inject(PageStoreService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly toast = inject(OToastService);

  constructor() {}

  private resetState(): void {
    this.activeStatusTab.set('ALL');
    this.selectedRow = null;
    this.columnFilters = {};
    this.tempFilters = {};
    this.selectedBulkRows = [];
  }

  ngOnInit(): void {
    const routeResource = this.route.snapshot.data['resource'];
    if (routeResource) {
      this.resource = routeResource;
    }
    if (this.resource && this._loadedResource !== this.resource) {
      this._loadedResource = this.resource;
      this.viewMode = 'table';
      this.resetState();
      this.loadPage();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resource'] && this.resource && this._loadedResource !== this.resource) {
      this._loadedResource = this.resource;
      this.viewMode = 'table';
      this.resetState();
      this.loadPage();
    }
  }

  ngOnDestroy(): void {
    this._subs.unsubscribe();
  }

  canShowKanban(): boolean {
    return ['deals', 'leads', 'tasks'].includes(this.resource);
  }

  isCustomResource(): boolean {
    return [
      'calendar', 'reports', 'report-builder', 'customization',
      'emails', 'inventory', 'dashboard-builder', 'user-settings'
    ].includes(this.resource);
  }

  getCurrentUser(): any {
    try {
      const raw = localStorage.getItem('crmUser');
      return raw ? JSON.parse(raw) : { name: 'Admin User', role: 'ADMIN', email: 'admin@orque.io' };
    } catch {
      return { name: 'Admin User', role: 'ADMIN', email: 'admin@orque.io' };
    }
  }

  private loadPage(): void {
    this.selectedRow = null;
    this.selectedBulkRows = [];
    this.loading = true;
    this.error = null;
    this.page = null;
    this.data = [];
    this.cdr.markForCheck();

    const sub = this.store.getPageConfig(this.resource).subscribe({
      next: (config: PageConfig) => {
        this.page = config;
        // Initialise the status tab to the JSON-defined default (the element with isDefault:true, or first element)
        if (config.toggleButton?.elements?.length) {
          const def = config.toggleButton.elements.find((e: any) => e.isDefault) ?? config.toggleButton.elements[0];
          this.activeStatusTab.set(def.value ?? 'All');
        }
        this.cdr.markForCheck();
        if (this.isCustomResource()) {
          this.loadCustomResource();
        } else {
          this.loadData(config.api);
        }
      },
      error: (err) => {
        this.error = `Failed to load page config: ${err.message}`;
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
    this._subs.add(sub);
  }

  private loadData(api: string): void {
    this.loading = true;
    this.selectedBulkRows = [];
    this.cdr.markForCheck();

    const sub = this.store.getList(api).subscribe({
      next: (rows) => {
        this.data = rows ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = `Failed to load data: ${err.message}`;
        this.data = [];
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
    this._subs.add(sub);
  }

  private loadCustomResource(): void {
    this.loading = false;
    this.loadingCustom = false;
    this.cdr.markForCheck();
  }

  handleAction(event: PageAction): void {
    if (!this.page) return;
    const uuid = event.row?.[this.page.tableUniqueFieldName || 'id'];
    const base = this.page.workflowApiBase || this.page.api;
    const label = event.row?.fullName || event.row?.name || event.row?.dealName ||
                  event.row?.title || event.row?.companyName || event.row?.quoteNumber ||
                  event.row?.invoiceNumber || uuid || 'Record';

    switch (event.action) {
      case 'view':
      case 'rowClick': {
        if ((this.resource === 'quotes' || this.resource === 'invoices') && event.row) {
          this.previewRecord = event.row;
        }
        break;
      }

      case 'navigate': {
        if (uuid) this.router.navigate(['/', this.resource, uuid]);
        break;
      }

      case 'edit': {
        this.editDrawerTitle = `Edit ${label}`;
        this.editDrawerRowData = { ...event.row };
        this.editDrawerOpen = true;
        break;
      }

      case 'save': {
        if (this.page && !this.validateEmailFields(event.payload)) {
          break;
        }
        const payloadId = event.payload?.id ?? event.row?.id
          ?? event.row?.[this.page?.tableUniqueFieldName || 'id'];
        const obs = payloadId
          ? this.store.put(`${base}/${payloadId}`, event.payload)
          : this.store.post(base, event.payload);
        const sub = obs.subscribe({
          next: () => {
            this.toast.addSuccess('Saved', `${label} saved successfully.`);
            this.loadData(this.page!.api);
          },
          error: (err) => this.showError(`Save failed: ${err?.error?.message || err.message}`)
        });
        this._subs.add(sub);
        break;
      }

      case 'qualify': {
        const sub = this.store.post(`${base}/qualify/${uuid}`, {}).subscribe({
          next: () => {
            this.toast.addSuccess('Qualified', `${label} moved to Qualified.`);
            this.loadData(this.page!.api);
          },
          error: (err) => this.showError(`Action failed: ${err?.error?.message || err.message}`)
        });
        this._subs.add(sub);
        break;
      }

      case 'disqualify': {
        const sub = this.store.post(`${base}/disqualify/${uuid}`, {}).subscribe({
          next: () => {
            this.toast.addSuccess('Disqualified', `${label} moved to Disqualified.`);
            this.loadData(this.page!.api);
          },
          error: (err) => this.showError(`Action failed: ${err?.error?.message || err.message}`)
        });
        this._subs.add(sub);
        break;
      }

      case 'submit': {
        const targetApi = uuid ? `${base}/submit/${uuid}` : base;
        const sub = this.store.post(targetApi, event.payload ?? {}).subscribe({
          next: () => {
            this.toast.addSuccess('Submitted', `${label} submitted successfully.`);
            this.loadData(this.page!.api);
          },
          error: (err) => this.showError(`Submit failed: ${err?.error?.message || err.message}`)
        });
        this._subs.add(sub);
        break;
      }

      case 'approve': {
        const sub = this.store.post(`${base}/approve/${uuid}`, {}).subscribe({
          next: () => {
            this.toast.addSuccess('Approved', `${label} approved.`);
            this.loadData(this.page!.api);
          },
          error: (err) => this.showError(`Approve failed: ${err?.error?.message || err.message}`)
        });
        this._subs.add(sub);
        break;
      }

      case 'reject': {
        const sub = this.store.post(`${base}/reject/${uuid}`, {}).subscribe({
          next: () => {
            this.toast.addWarning('Rejected', `${label} rejected.`);
            this.loadData(this.page!.api);
          },
          error: (err) => this.showError(`Reject failed: ${err?.error?.message || err.message}`)
        });
        this._subs.add(sub);
        break;
      }

      case 'gen-invoice': {
        const quoteId = uuid;
        const sub = this.store.post(`/api/v1/quotes/${quoteId}/invoice`, {}).subscribe({
          next: () => {
            this.toast.addSuccess('Invoice Created', `Invoice generated from ${label}.`);
            this.loadData(this.page!.api);
          },
          error: (err) => this.showError(`Invoice failed: ${err?.error?.message || err.message}`)
        });
        this._subs.add(sub);
        break;
      }

      case 'terminate': {
        const sub = this.store.delete(`${base}/${uuid}`).subscribe({
          next: () => {
            this.toast.addSuccess('Session Terminated', `Session for ${label} has been terminated.`);
            this.loadData(this.page!.api);
          },
          error: (err) => this.showError(`Terminate failed: ${err?.error?.message || err.message}`)
        });
        this._subs.add(sub);
        break;
      }

      case 'terminate-all': {
        if (!confirm('Terminate all other active sessions?')) return;
        const sub = this.store.delete(`${base}/terminate-all`).subscribe({
          next: () => {
            this.toast.addSuccess('Done', 'All other sessions terminated.');
            this.loadData(this.page!.api);
          },
          error: (err) => this.showError(`Terminate all failed: ${err?.error?.message || err.message}`)
        });
        this._subs.add(sub);
        break;
      }

      case 'reset-password': {
        this.resetPasswordTarget.set({ uuid, label });
        this.resetPasswordValue.set('');
        this.resetPasswordError.set('');
        break;
      }

      case 'activate':
      case 'deactivate':
      case 'launch': {
        const sub = this.store.post(`${base}/${uuid}/${event.action}`, {}).subscribe({
          next: () => {
            this.toast.addSuccess('Done', `${label}: ${event.action} completed.`);
            this.loadData(this.page!.api);
          },
          error: (err) => this.showError(`Action failed: ${err?.error?.message || err.message}`)
        });
        this._subs.add(sub);
        break;
      }

      case 'delete': {
        if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
        const sub = this.store.delete(`${base}/${uuid}`).subscribe({
          next: () => {
            this.toast.addSuccess('Deleted', `${label} deleted.`);
            this.loadData(this.page!.api);
          },
          error: (err) => this.showError(`Delete failed: ${err?.error?.message || err.message}`)
        });
        this._subs.add(sub);
        break;
      }

      case 'refresh':
        this.loadData(this.page.api);
        break;

      case 'export':
        this.exportExcel(event.payload);
        break;
    }
  }

  private exportExcel(rows?: any[]): void {
    const toExport = rows?.length ? rows : this.data;
    if (!toExport.length) { this.showError('No records to export.'); return; }
    const headers = Object.keys(toExport[0]);

    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const cell = (val: any) => {
      const s = val == null ? '' : String(val);
      const isNum = typeof val === 'number' && !isNaN(val);
      return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${esc(s)}</Data></Cell>`;
    };

    const headerRow = `<Row>${headers.map(h => cell(h)).join('')}</Row>`;
    const dataRows = toExport.map(r => `<Row>${headers.map(h => cell(r[h])).join('')}</Row>`).join('');

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#4338CA" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF" ss:Bold="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${esc(this.resource)}">
    <Table>${headerRow}${dataRows}</Table>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.resource}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  toggleSelectRow(row: any): void {
    if (this.selectedRow?.id === row.id) {
      this.selectedRow = null;
    } else {
      this.selectedRow = row;
    }
    this.cdr.markForCheck();
  }

  get sidebarOffset(): string {
    const collapsed = localStorage.getItem('crm_sidebar_collapsed') === 'true';
    return collapsed ? '64px' : '240px';
  }

  private hdrs(): HttpHeaders {
    const token = localStorage.getItem('accessToken') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  downloadPdfForSelected(type: 'quotes' | 'invoices'): void {
    if (!this.selectedRow || this.pdfDownloading) return;
    const rowId = this.selectedRow.id;
    const filename = String(this.selectedRow[type === 'invoices' ? 'invoiceNumber' : 'quoteNumber'] ?? `${type}-${rowId}`);

    this.pdfDownloading = true;
    this.cdr.markForCheck();

    this._subs.add(
      this.http.get(`${this.base}/api/v1/${type}/${rowId}/pdf`, {
        headers: this.hdrs(),
        responseType: 'blob'
      }).subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const a   = document.createElement('a');
          a.href     = url;
          a.download = `${filename}.pdf`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          this.pdfDownloading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.pdfDownloading = false;
          this.toast.addError('Error', 'Failed to generate PDF. Please try again.');
          this.cdr.markForCheck();
        }
      })
    );
  }

  generateInvoiceFromQuote(): void {
    const active = this.pdfActiveRow;
    if (!active || this.pdfDownloading) return;

    if (active.status !== 'Accepted') {
      this.toast.addError('Error', 'Invoice can only be generated from an Accepted quote.');
      return;
    }

    // Ensure selectedRow is set so post-generation cleanup works correctly
    this.selectedRow = active;

    const quoteId = this.selectedRow.id;
    this.pdfDownloading = true;
    this.cdr.markForCheck();

    this._subs.add(
      this.http.post<any>(`${this.base}/api/v1/quotes/${quoteId}/invoice`, {}, {
        headers: this.hdrs()
      }).subscribe({
        next: (invoice) => {
          this.toast.addSuccess('Success', `Invoice ${invoice.invoiceNumber} generated successfully!`);
          this.pdfDownloading = false;

          this.selectedRow = null;
          this.loadPage();

          const filename = invoice.invoiceNumber || `invoice-${invoice.id}`;
          this.http.get(`${this.base}/api/v1/invoices/${invoice.id}/pdf`, {
            headers: this.hdrs(),
            responseType: 'blob'
          }).subscribe({
            next: blob => {
              const url = URL.createObjectURL(blob);
              const a   = document.createElement('a');
              a.href     = url;
              a.download = `${filename}.pdf`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 5000);
            },
            error: () => {
              this.toast.addError('Error', 'Invoice created, but failed to download PDF.');
            }
          });
        },
        error: (err) => {
          this.pdfDownloading = false;
          const msg = err?.error?.message || 'Failed to generate invoice from quote.';
          this.toast.addError('Error', msg);
          this.cdr.markForCheck();
        }
      })
    );
  }

  private showError(msg: string): void {
    this.toast.addError('Error', msg);
  }

  private validateEmailFields(payload: any): boolean {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    for (const step of this.page?.steps || []) {
      for (const field of step.fields || []) {
        if (field.inputType === 'email' && payload[field.name] != null && payload[field.name] !== '') {
          if (!emailPattern.test(payload[field.name])) {
            this.toast.addError('Invalid field', `${field.label} must be a valid email address.`);
            return false;
          }
        }
      }
    }
    return true;
  }

  toggleFilterPopup(field: string): void {
    if (this.activeFilterField === field) {
      this.activeFilterField = null;
    } else {
      this.activeFilterField = field;
      this.tempFilters[field] = this.columnFilters[field] || '';
    }
  }

  closeFilterPopup(): void {
    this.activeFilterField = null;
  }

  onFilterInput(event: Event, field: string): void {
    const val = (event.target as HTMLInputElement).value;
    this.tempFilters[field] = val;
  }

  hasFilter(field: string): boolean {
    return !!this.columnFilters[field];
  }

  applyFilter(field: string): void {
    this.columnFilters[field] = this.tempFilters[field] || '';
    this.selectedRow = null;
    this.activeFilterField = null;
    this.cdr.markForCheck();
  }

  clearFilter(field: string): void {
    this.tempFilters[field] = '';
    this.columnFilters[field] = '';
    this.selectedRow = null;
    this.activeFilterField = null;
    this.cdr.markForCheck();
  }

  onCustomTableToolAction(action: string): void {
    if (action === 'add') {
      this.handleAction({ action: 'create', row: null });
    } else if (action === 'edit') {
      const single = this.selectedBulkRows.length === 1 ? this.selectedBulkRows[0] : this.selectedRow;
      if (single) {
        this.handleAction({ action: 'edit', row: single });
      } else {
        this.toast.addError('Selection Required', 'Please select exactly one row to edit.');
      }
    } else if (action === 'refresh') {
      this.loadPage();
    } else if (action === 'clear') {
      this.selectedRow = null;
      this.selectedBulkRows = [];
      this.cdr.markForCheck();
    } else if (action === 'export') {
      this.exportExcel();
    } else if (action === 'print') {
      if (this.selectedBulkRows.length > 0) {
        this.printQuoteInvoiceRows(
          this.page?.title || this.resource,
          this.page?.tableList || [],
          this.selectedBulkRows
        );
      }
    }
  }

  get filteredTableData(): any[] {
    let rows = [...(this.data || [])];
    
    if (this.resource === 'quotes' || this.resource === 'invoices') {
      const activeTab = this.activeStatusTab();
      // 'All' / 'ALL' / '' all mean show everything
      if (activeTab && activeTab.toLowerCase() !== 'all') {
        rows = rows.filter(r =>
          (r.status ?? '').toLowerCase() === activeTab.toLowerCase()
        );
      }
    }
    
    for (const field of Object.keys(this.columnFilters)) {
      const query = this.columnFilters[field]?.trim().toLowerCase();
      if (query) {
        rows = rows.filter(r => {
          const val = String(r[field] ?? '').toLowerCase();
          return val.includes(query);
        });
      }
    }
    
    return rows;
  }

  onSelectionChanged(rows: any[]) {
    this.selectedBulkRows = rows;
    // For quotes/invoices the PDF bar derives from selectedBulkRows;
    // clear the single-click selectedRow if user switches to checkbox selection.
    if ((this.resource === 'quotes' || this.resource === 'invoices') && rows.length > 0) {
      this.selectedRow = null;
    }
    this.cdr.detectChanges();
  }

  /** The row that drives the single-record labels/status checks in the PDF bar. */
  get pdfActiveRow(): any {
    return this.selectedBulkRows.length > 0 ? this.selectedBulkRows[0] : this.selectedRow;
  }

  clearPdfSelection() {
    this.selectedRow = null;
    this.selectedBulkRows = [];
    this.cdr.detectChanges();
  }

  clearBulkSelection() {
    this.selectedBulkRows = [];
    this.cdr.detectChanges();
  }

  /**
   * Download PDFs for all currently checked rows (quotes or invoices).
   * Falls back to selectedRow for backwards compatibility with row-click selection.
   */
  downloadSelectedPdfs(type: 'quotes' | 'invoices'): void {
    const rows = this.selectedBulkRows.length > 0 ? this.selectedBulkRows : (this.selectedRow ? [this.selectedRow] : []);
    if (rows.length === 0 || this.pdfDownloading) return;
    this.pdfDownloading = true;
    const downloadNext = (index: number) => {
      if (index >= rows.length) {
        this.pdfDownloading = false;
        this.clearPdfSelection();
        this.cdr.detectChanges();
        return;
      }
      const row = rows[index];
      const rowId = row.id;
      const filename = String(row[type === 'invoices' ? 'invoiceNumber' : 'quoteNumber'] ?? `${type}-${rowId}`);
      this.http.get(`${this.base}/api/v1/${type}/${rowId}/pdf`, {
        headers: this.hdrs(), responseType: 'blob'
      }).subscribe({
        next: (blob: Blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          downloadNext(index + 1);
        },
        error: (err: any) => {
          this.toast.addError('PDF Error', `Failed to generate PDF for ${filename}`);
          this.pdfDownloading = false;
          this.cdr.detectChanges();
        }
      });
    };

    downloadNext(0);
  }

  getBulkEditFields() {
    if (this.resource === 'leads' || this.resource === 'contacts') {
      return [
        { label: 'Industry', value: 'industry' },
        { label: 'City', value: 'city' },
        { label: 'Country', value: 'country' },
        { label: 'Address', value: 'address' },
        { label: 'Job Title', value: 'jobtitle' },
        { label: 'Website', value: 'website' }
      ];
    }
    if (this.resource === 'accounts') {
      return [
        { label: 'Industry', value: 'industry' },
        { label: 'Phone', value: 'phone' },
        { label: 'Country', value: 'country' },
        { label: 'Website', value: 'website' }
      ];
    }
    if (this.resource === 'deals') {
      return [
        { label: 'Stage', value: 'stage' },
        { label: 'Amount', value: 'amount' }
      ];
    }
    return [];
  }

  getBulkStatuses() {
    if (this.resource === 'leads') {
      // Must match com.orque.crm.enums.LeadStatus exactly — bulk-status posts this value
      // straight to LeadStatus.valueOf(), so anything else 400s.
      return [
        { label: 'New',          value: 'NEW' },
        { label: 'Qualified',    value: 'QUALIFIED' },
        { label: 'Converted',    value: 'CONVERTED' },
        { label: 'Disqualified', value: 'DISQUALIFIED' }
      ];
    }
    if (this.resource === 'deals') {
      return [
        { label: 'Prospecting', value: 'Prospecting' },
        { label: 'Qualification', value: 'Qualification' },
        { label: 'Proposal', value: 'Proposal' },
        { label: 'Negotiation', value: 'Negotiation' },
        { label: 'Closed Won', value: 'Closed Won' },
        { label: 'Closed Lost', value: 'Closed Lost' }
      ];
    }
    if (this.resource === 'accounts') {
      return [
        { label: 'Active',   value: 'Active' },
        { label: 'Prospect', value: 'Prospect' },
        { label: 'Inactive', value: 'Inactive' }
      ];
    }
    return [];
  }

  openBulkEditDrawer() {
    this.bulkActionType = 'edit';
    this.bulkActionTitle = 'Bulk Edit Fields';
    this.bulkEditField = '';
    this.bulkEditValue = '';
    this.bulkActionDrawerOpen = true;
    this.cdr.detectChanges();
  }

  openBulkAssignDrawer() {
    this.bulkActionType = 'assign';
    this.bulkActionTitle = 'Bulk Assign Owner';
    this.bulkAssignOwner = '';
    this.bulkActionDrawerOpen = true;
    this.loadSalesUsersForBulk();
  }

  openBulkStatusDrawer() {
    this.bulkActionType = 'status';
    this.bulkActionTitle = 'Bulk Update Status';
    this.bulkStatusValue = '';
    this.bulkActionDrawerOpen = true;
    this.cdr.detectChanges();
  }

  loadSalesUsersForBulk() {
    this.http.get<any[]>(`${this.base}/api/v1/users/sales`, { headers: this.hdrs() })
      .subscribe({
        next: data => {
          this.salesUsers = data.map(u => ({ username: u.username, fullName: u.fullName }));
          this.cdr.detectChanges();
        },
        error: () => {
          this.salesUsers = [
            { username: 'admin', fullName: 'System Admin' },
            { username: 'sales_rep', fullName: 'Sales Representative' }
          ];
          this.cdr.detectChanges();
        }
      });
  }

  bulkDeleteSelected() {
    if (!confirm(`Are you sure you want to delete these ${this.selectedBulkRows.length} records?`)) return;
    const ids = this.selectedBulkRows.map(r => r.id);
    this.http.post<any>(`${this.base}/api/v1/bulk/delete?module=${this.resource}`, ids, { headers: this.hdrs() })
      .subscribe({
        next: () => {
          alert('Bulk delete completed.');
          this.selectedBulkRows = [];
          if (this.page) {
            this.loadData(this.page.api);
          }
          this.cdr.detectChanges();
        },
        error: err => alert(err?.error?.message || 'Bulk delete failed.')
      });
  }

  submitBulkAction() {
    const ids = this.selectedBulkRows.map(r => r.id);

    let url = `${this.base}/api/v1/bulk/`;
    if (this.bulkActionType === 'edit') {
      if (!this.bulkEditField) return alert('Choose field.');
      url += `edit?module=${this.resource}&fieldName=${this.bulkEditField}&fieldValue=${encodeURIComponent(this.bulkEditValue)}`;
    } else if (this.bulkActionType === 'assign') {
      if (!this.bulkAssignOwner) return alert('Choose owner.');
      url += `assign?module=${this.resource}&owner=${this.bulkAssignOwner}`;
    } else if (this.bulkActionType === 'status') {
      if (!this.bulkStatusValue) return alert('Choose status.');
      url += `status?module=${this.resource}&status=${this.bulkStatusValue}`;
    } else {
      return;
    }

    this.http.post<any>(url, ids, { headers: this.hdrs() }).subscribe({
      next: () => {
        alert('Bulk operation completed successfully.');
        this.bulkActionDrawerOpen = false;
        this.selectedBulkRows = [];
        if (this.page) {
          this.loadData(this.page.api);
        }
        this.cdr.detectChanges();
      },
      error: err => alert(err?.error?.message || 'Bulk action failed.')
    });
  }

  // ── Quotes / Invoices row-selection helpers ──────────────────────────────

  isQuoteInvoiceRowSelected(row: any): boolean {
    return this.selectedBulkRows.some(r => r.id === row.id);
  }

  toggleSelectQuoteInvoiceRow(row: any): void {
    const idx = this.selectedBulkRows.findIndex(r => r.id === row.id);
    if (idx >= 0) {
      this.selectedBulkRows = this.selectedBulkRows.filter((_, i) => i !== idx);
    } else {
      this.selectedBulkRows = [...this.selectedBulkRows, row];
    }
    this.cdr.markForCheck();
  }

  toggleSelectAllQuotesInvoices(): void {
    const all = this.filteredTableData;
    if (this.selectedBulkRows.length === all.length && all.length > 0) {
      this.selectedBulkRows = [];
    } else {
      this.selectedBulkRows = [...all];
    }
    this.cdr.markForCheck();
  }

  printQuoteInvoiceRows(pageTitle: string, columns: any[], rows: any[]): void {
    const pw = window.open('', '_blank');
    if (!pw) { this.toast.addError('Blocked', 'Pop-up blocker is preventing the print view.'); return; }

    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const thead = '<tr>' + columns.map(c => `<th>${esc(c.label)}</th>`).join('') + '</tr>';
    const tbody = rows.map(row =>
      '<tr>' + columns.map(col => {
        let val = row[col.name] ?? '—';
        if (col.pipe === 'date' && val !== '—') val = new Date(val).toLocaleDateString();
        return `<td>${esc(val)}</td>`;
      }).join('') + '</tr>'
    ).join('');

    pw.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Print — ${esc(pageTitle)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; color: #1e293b; }
    h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 4px; }
    p.meta { font-size: 0.78rem; color: #64748b; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #1e293b; color: #fff; padding: 10px 12px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #374151; }
    tr:nth-child(even) td { background: #f8fafc; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>${esc(pageTitle)}</h1>
  <p class="meta">${rows.length} record${rows.length !== 1 ? 's' : ''} selected &nbsp;·&nbsp; Printed on ${new Date().toLocaleString()}</p>
  <table>
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
      setTimeout(function() { window.close(); }, 1000);
    };
  </script>
</body>
</html>`);
    pw.document.close();
  }
}
