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

  // Notes, Attachments, Timeline
  notes = signal<any[]>([]);
  newNoteContent = '';
  editingNoteId: number | null = null;
  editingNoteContent = '';
  notesLoading = false;

  attachments = signal<any[]>([]);
  selectedUploadFile: File | null = null;
  attachmentsLoading = false;

  timeline = signal<any[]>([]);
  timelineLoading = false;



  salesUsers = signal<{ username: string; fullName: string }[]>([]);

  private readonly _subs = new Subscription();
  private readonly base  = `http://${globalThis.location.hostname}:8085`;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadSalesUsers();
    this._subs.add(this.route.params.subscribe(params => {
      const resource = this.route.snapshot.data['resource'] as string;
      this.loadPage(resource, params['id'] as string);
    }));
  }

  ngOnDestroy() { this._subs.unsubscribe(); }

  currentCrmUser(): { username: string; role: string } | null {
    try {
      const raw = globalThis.localStorage?.getItem('crm_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  isAdminUser(): boolean {
    const user = this.currentCrmUser();
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    return role === 'ADMIN' || role === 'SALES_ADMIN';
  }

  loadSalesUsers() {
    if (this.isAdminUser()) {
      this._subs.add(this.http.get<any[]>(`${this.base}/api/v1/users/sales`, { headers: this.hdrs() })
        .pipe(catchError(() => of([])))
        .subscribe(data => {
          this.salesUsers.set(data.map(u => ({ username: u.username, fullName: u.fullName })));
          this.cdr.markForCheck();
        }));
    }
  }

  isOwnershipField(fieldName: string): boolean {
    return ['assignedTo', 'assignedOwner', 'owner'].includes(fieldName);
  }

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
        `${this.base}/api/v1/${resource}/${id}`,
        { headers: this.hdrs() }
      )
    }).subscribe({
      next: ({ cfg, rec }) => {
        if (cfg && cfg.tabs) {
          const hasNotes = cfg.tabs.some(t => t.key === 'notes');
          if (!hasNotes) {
            cfg.tabs.push({ key: 'notes', label: 'Notes', type: 'related-list' });
          }
          const hasAttachments = cfg.tabs.some(t => t.key === 'attachments');
          if (!hasAttachments) {
            cfg.tabs.push({ key: 'attachments', label: 'Attachments', type: 'related-list' });
          }
          const hasTimeline = cfg.tabs.some(t => t.key === 'timeline');
          if (!hasTimeline) {
            cfg.tabs.push({ key: 'timeline', label: 'Timeline', type: 'related-list' });
          }
        }
        this.config = cfg;
        this.record = rec;
        this.loading = false;
        
        // Auto-select first tab
        if (cfg?.tabs?.length) {
          this.selectTab(cfg.tabs[0]);
        }
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
    if (tab.key === 'notes') {
      this.loadNotes();
    } else if (tab.key === 'attachments') {
      this.loadAttachments();
    } else if (tab.key === 'timeline') {
      this.loadTimeline();
    } else if (tab.type === 'related-list' && !this.tabData()[tab.key]) {
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

    const currentUser = this.currentCrmUser();
    if (currentUser?.username) {
      const ownershipFields = ['assignedTo', 'assignedOwner', 'owner'];
      tab.addFields?.forEach(f => {
        if (ownershipFields.includes(f.name) && !this.addForm[f.name]) {
          this.addForm[f.name] = currentUser.username;
        }
      });
    }

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

  isTabLoading(key: string) {
    if (key === 'notes') return this.notesLoading;
    if (key === 'attachments') return this.attachmentsLoading;
    if (key === 'timeline') return this.timelineLoading;
    return !!this.tabLoading()[key];
  }

  tabRows(key: string) {
    return (this.tabData()[key] ?? []) as Record<string, unknown>[];
  }

  tabCount(key: string) {
    if (key === 'notes') return this.notes().length;
    if (key === 'attachments') return this.attachments().length;
    if (key === 'timeline') return this.timeline().length;
    return this.tabData()[key]?.length ?? 0;
  }

  // ── Notes Operations ──
  loadNotes() {
    const id = this.route.snapshot.params['id'] as string;
    const resource = this.route.snapshot.data['resource'] as string;
    this.notesLoading = true;
    this.cdr.markForCheck();
    this.http.get<any[]>(`${this.base}/api/v1/notes/${resource}/${id}`, { headers: this.hdrs() })
      .pipe(catchError(() => of([])))
      .subscribe(data => {
        this.notes.set(data);
        this.notesLoading = false;
        this.cdr.markForCheck();
      });
  }

  saveNote() {
    if (!this.newNoteContent.trim()) return;
    const id = this.route.snapshot.params['id'] as string;
    const resource = this.route.snapshot.data['resource'] as string;
    this.http.post<any>(`${this.base}/api/v1/notes/${resource}/${id}`, this.newNoteContent, { headers: this.hdrs() })
      .subscribe({
        next: () => {
          this.newNoteContent = '';
          this.loadNotes();
          this.loadTimeline();
        },
        error: () => this.showErr('Failed to save note')
      });
  }

  startEditNote(note: any) {
    this.editingNoteId = note.id;
    this.editingNoteContent = note.content;
  }

  cancelEditNote() {
    this.editingNoteId = null;
    this.editingNoteContent = '';
  }

  updateNote(id: number) {
    this.http.put<any>(`${this.base}/api/v1/notes/${id}`, this.editingNoteContent, { headers: this.hdrs() })
      .subscribe({
        next: () => {
          this.cancelEditNote();
          this.loadNotes();
          this.loadTimeline();
        },
        error: () => this.showErr('Failed to update note')
      });
  }

  deleteNote(id: number) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    this.http.delete(`${this.base}/api/v1/notes/${id}`, { headers: this.hdrs() })
      .subscribe({
        next: () => {
          this.loadNotes();
          this.loadTimeline();
        },
        error: () => this.showErr('Failed to delete note')
      });
  }

  // ── Attachments Operations ──
  loadAttachments() {
    const id = this.route.snapshot.params['id'] as string;
    const resource = this.route.snapshot.data['resource'] as string;
    this.attachmentsLoading = true;
    this.cdr.markForCheck();
    this.http.get<any[]>(`${this.base}/api/v1/attachments/${resource}/${id}`, { headers: this.hdrs() })
      .pipe(catchError(() => of([])))
      .subscribe(data => {
        this.attachments.set(data);
        this.attachmentsLoading = false;
        this.cdr.markForCheck();
      });
  }

  triggerFileInput() {
    const el = document.getElementById('fileUploadInput') as HTMLInputElement | null;
    if (el) el.click();
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.selectedUploadFile = files[0];
      this.cdr.markForCheck();
    }
  }

  uploadAttachment() {
    if (!this.selectedUploadFile) return;
    const id = this.route.snapshot.params['id'] as string;
    const resource = this.route.snapshot.data['resource'] as string;
    const formData = new FormData();
    formData.append('file', this.selectedUploadFile);

    this.http.post<any>(`${this.base}/api/v1/attachments/${resource}/${id}`, formData, { headers: this.hdrs() })
      .subscribe({
        next: () => {
          this.selectedUploadFile = null;
          this.loadAttachments();
          this.loadTimeline();
        },
        error: () => this.showErr('Failed to upload file')
      });
  }

  deleteAttachment(id: number) {
    if (!confirm('Are you sure you want to delete this attachment?')) return;
    this.http.delete(`${this.base}/api/v1/attachments/${id}`, { headers: this.hdrs() })
      .subscribe({
        next: () => {
          this.loadAttachments();
          this.loadTimeline();
        },
        error: () => this.showErr('Failed to delete attachment')
      });
  }

  getDownloadUrl(att: any): string {
    return `${this.base}${att.fileUrl}`;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // ── Timeline Operations ──
  loadTimeline() {
    const id = this.route.snapshot.params['id'] as string;
    const resource = this.route.snapshot.data['resource'] as string;
    this.timelineLoading = true;
    this.cdr.markForCheck();
    this.http.get<any[]>(`${this.base}/api/v1/timeline/${resource}/${id}`, { headers: this.hdrs() })
      .pipe(catchError(() => of([])))
      .subscribe(data => {
        this.timeline.set(data);
        this.timelineLoading = false;
        this.cdr.markForCheck();
      });
  }

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
