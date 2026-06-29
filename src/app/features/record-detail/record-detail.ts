import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy,
  ChangeDetectorRef, signal
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface RdFieldDef  { name: string; label: string; }
export interface RdFieldGroup { label: string; fields: RdFieldDef[]; }
export interface RdColumn    { name: string; label: string; }
export interface RdAddField  { name: string; label: string; type: string; options?: { label: string; value: string }[]; }
export interface RdTab {
  key: string;
  label: string;
  type: 'overview' | 'related-list';
  fieldGroups?: RdFieldGroup[];
  relatedApi?: string;
  columns?: RdColumn[];
  addLabel?: string;
  addApi?: string;
  addMethod?: string;
  addDefaults?: Record<string, unknown>;
  addFields?: RdAddField[];
}
export interface RdAction { label: string; action: string; style: string; showWhen?: string[]; }
export interface DetailConfig {
  resource: string;
  api: string;
  titleField: string;
  subtitleField?: string;
  statusField?: string;
  headerActions: RdAction[];
  tabs: RdTab[];
}

@Component({
  selector: 'app-record-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './record-detail.html',
  styleUrl: './record-detail.scss'
})
export class RecordDetailComponent implements OnInit, OnDestroy {
  config: DetailConfig | null = null;
  record: Record<string, unknown> | null = null;
  loading = true;
  pageError: string | null = null;

  activeTab  = signal<string>('');
  tabData    = signal<Record<string, unknown[]>>({});
  tabLoading = signal<Record<string, boolean>>({});

  addPanelOpen  = false;
  addPanelTab: RdTab | null = null;
  addForm: Record<string, unknown> = {};
  addSubmitting = false;
  addError: string | null = null;



  private readonly _subs = new Subscription();
  private readonly base  = `http://${globalThis.location.hostname}:8085`;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this._subs.add(this.route.params.subscribe(params => {
      const resource = this.route.snapshot.data['resource'] as string;
      this.loadPage(resource, params['id'] as string);
    }));
  }

  ngOnDestroy() { this._subs.unsubscribe(); }

  private hdrs(): HttpHeaders {
    const token = localStorage.getItem('accessToken') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private loadPage(resource: string, id: string) {
    this.loading = true;
    this.pageError = null;
    this.config = null;
    this.record = null;
    this.tabData.set({});
    this.cdr.markForCheck();

    this._subs.add(forkJoin({
      cfg: this.http.get<DetailConfig>(`/page-configs/${resource}-detail.json`),
      rec: this.http.get<Record<string, unknown>>(
        `${this.base}/api/v1/${resource}/${id}`, { headers: this.hdrs() })
    }).subscribe({
      next: ({ cfg, rec }) => {
        this.config = cfg;
        this.record = rec;
        this.loading = false;
        const first = cfg.tabs[0];
        this.activeTab.set(first?.key ?? '');
        if (first?.type === 'related-list') this.fetchTab(first, id);
        this.cdr.markForCheck();
      },
      error: err => {
        this.pageError = (err?.error?.message as string | undefined) ?? 'Failed to load record.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    }));
  }

  selectTab(tab: RdTab) {
    const id = this.route.snapshot.params['id'] as string;
    this.activeTab.set(tab.key);
    this.closeAddPanel();
    if (tab.type === 'related-list' && !this.tabData()[tab.key]) {
      this.fetchTab(tab, id);
    }
    this.cdr.markForCheck();
  }

  private fetchTab(tab: RdTab, id: string) {
    if (!tab.relatedApi) return;
    this.tabLoading.update(v => ({ ...v, [tab.key]: true }));
    const url = this.base + tab.relatedApi.replace('{id}', id);
    this._subs.add(this.http.get<unknown[]>(url, { headers: this.hdrs() })
      .pipe(catchError(() => of([])))
      .subscribe(data => {
        this.tabData.update(v => ({ ...v, [tab.key]: data }));
        this.tabLoading.update(v => ({ ...v, [tab.key]: false }));
        this.cdr.markForCheck();
      }));
  }

  private reloadTab(tabKey: string) {
    const id = this.route.snapshot.params['id'] as string;
    const tab = this.config?.tabs.find(t => t.key === tabKey);
    if (!tab) return;
    this.tabData.update(v => { const c = { ...v }; delete c[tabKey]; return c; });
    this.fetchTab(tab, id);
  }

  goBack() {
    const resource = this.route.snapshot.data['resource'] as string;
    this.router.navigate(['/', resource]);
  }

  executeAction(action: string) {
    const id = this.record?.['id'] as string | number;

    if (action === 'create-quote') {
      this._subs.add(
        this.http.post<unknown>(`${this.base}/api/v1/deals/${id}/quotes`, null, { headers: this.hdrs() })
          .subscribe({
            next: () => { this.showSuccess('Quote created from this deal.'); this.reloadTab('quotes'); },
            error: err => this.showErr((err?.error?.message as string | undefined) ?? 'Failed to create quote.')
          })
      );
      return;
    }

    const url = `${this.base}${this.config!.api}/${action}/${id}`;
    this._subs.add(this.http.post<Record<string, unknown>>(url, null, { headers: this.hdrs() }).subscribe({
      next: updated => {
        this.record = updated;
        this.showSuccess('Done.');
        this.cdr.markForCheck();
      },
      error: err => this.showErr((err?.error?.message as string | undefined) ?? 'Action failed.')
    }));
  }

  // ── Add Panel ─────────────────────────────────────────────────────────────

  openAddPanel(tab: RdTab) {
    this.addPanelTab = tab;
    this.addForm = { ...tab.addDefaults };
    this.addError = null;
    this.addPanelOpen = true;
    this.cdr.markForCheck();
  }

  closeAddPanel() {
    this.addPanelOpen = false;
    this.addPanelTab = null;
    this.addForm = {};
    this.addError = null;
    this.cdr.markForCheck();
  }

  submitAddForm() {
    if (!this.addPanelTab || this.addSubmitting) return;
    const id = this.route.snapshot.params['id'] as string;
    const tab = this.addPanelTab;

    let api = (tab.addApi ?? '').replace('{id}', id);
    if (!api.startsWith('http')) api = this.base + api;

    const payload: Record<string, unknown> = {
      ...this.addForm,
      relatedId: +id,
      relatedType: tab.addDefaults?.['relatedType'] ?? ''
    };

    this.addSubmitting = true;
    this.addError = null;
    this.cdr.markForCheck();

    this._subs.add(this.http.post<unknown>(api, payload, { headers: this.hdrs() }).subscribe({
      next: () => {
        this.addSubmitting = false;
        this.showSuccess('Record added.');
        this.reloadTab(tab.key);
        this.closeAddPanel();
      },
      error: err => {
        this.addError = (err?.error?.message as string | undefined) ?? 'Failed to add record.';
        this.addSubmitting = false;
        this.cdr.markForCheck();
      }
    }));
  }

  // ── Row actions ──────────────────────────────────────────────────────────

  rowAction(action: string, row: Record<string, unknown>, tabKey: string) {
    const rowId = row['id'] as number;
    let url = '';
    let method: 'post' | 'put' = 'post';

    switch (action) {
      case 'complete-activity': url = `${this.base}/api/v1/activities/approve/${rowId}`; break;
      case 'complete-task':     url = `${this.base}/api/v1/tasks/${rowId}/complete`; method = 'put'; break;
      case 'send-quote':        url = `${this.base}/api/v1/quotes/submit/${rowId}`; break;
      case 'accept-quote':      url = `${this.base}/api/v1/quotes/approve/${rowId}`; break;
      case 'generate-invoice':  url = `${this.base}/api/v1/quotes/${rowId}/invoice`; break;
      default: return;
    }

    const req = method === 'put'
      ? this.http.put<unknown>(url, null, { headers: this.hdrs() })
      : this.http.post<unknown>(url, null, { headers: this.hdrs() });

    this._subs.add(req.subscribe({
      next: () => { this.showSuccess('Done.'); this.reloadTab(tabKey); },
      error: err => this.showErr((err?.error?.message as string | undefined) ?? 'Action failed.')
    }));
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  get currentTab(): RdTab | undefined {
    return this.config?.tabs.find(t => t.key === this.activeTab());
  }

  get visibleActions(): RdAction[] {
    if (!this.config || !this.record) return [];
    const statusVal = (this.record[this.config.statusField ?? 'status'] as string | undefined) ?? '';
    return this.config.headerActions.filter(a =>
      !a.showWhen?.length || a.showWhen.includes(statusVal)
    );
  }

  get recordTitle(): string    { return this.primitiveStr(this.record?.[this.config?.titleField ?? '']) || 'Detail'; }
  get recordSubtitle(): string { return this.primitiveStr(this.record?.[this.config?.subtitleField ?? '']); }
  get recordStatus(): string   { return this.primitiveStr(this.record?.[this.config?.statusField ?? 'status']); }

  fieldValue(field: RdFieldDef): string {
    return this.primitiveStr(this.record?.[field.name]) || '—';
  }

  cellValue(row: Record<string, unknown>, col: RdColumn): string {
    return this.primitiveStr(row?.[col.name]) || '—';
  }

  isTabLoading(key: string)  { return !!this.tabLoading()[key]; }
  tabRows(key: string)        { return (this.tabData()[key] ?? []) as Record<string, unknown>[]; }
  tabCount(key: string)       { return this.tabData()[key]?.length ?? 0; }



  /** Safe primitive → string. Objects are skipped (returns ''). */
  private primitiveStr(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'object') return '';
    return String(v);
  }

  private showSuccess(msg: string) {
    console.info('[CRM]', msg);
  }

  private showErr(msg: string) {
    console.error('[CRM]', msg);
    alert(msg);
  }
}
