import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PageStoreService } from '../../core/services/page-store.service';

interface ReportCard {
  title: string;
  value: string | number;
  sub: string;
  color: string;
  iconPath: string;
}

interface LeaderRow {
  name: string;
  deals: number;
  value: string;
  won: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './reports.html',
  styleUrls: ['./reports.scss']
})
export class ReportsComponent implements OnInit {
  private readonly store = inject(PageStoreService);

  loading    = signal(true);
  kpis       = signal<ReportCard[]>([]);
  leaderboard = signal<LeaderRow[]>([]);
  stageBreakdown = signal<{ label: string; count: number; pct: number; color: string }[]>([]);

  ngOnInit(): void {
    forkJoin({
      deals:    this.store.getList('/api/v1/deals').pipe(catchError(() => of([]))),
      leads:    this.store.getList('/api/v1/leads').pipe(catchError(() => of([]))),
      contacts: this.store.getList('/api/v1/contacts').pipe(catchError(() => of([]))),
      quotes:   this.store.getList('/api/v1/quotes').pipe(catchError(() => of([]))),
      invoices: this.store.getList('/api/v1/invoices').pipe(catchError(() => of([]))),
      sessions: this.store.get('/api/v1/sessions/stats').pipe(catchError(() => of(null))),
    }).subscribe(({ deals, leads, contacts, quotes, invoices, sessions }) => {
      this.buildReports(deals, leads, contacts, quotes, invoices, sessions);
    });
  }

  private buildReports(deals: any[], leads: any[], contacts: any[], quotes: any[], invoices: any[], sessions: any): void {
    const won     = deals.filter(d => (d.stage || '').toLowerCase().includes('won'));
    const revenue = won.reduce((s: number, d: any) => s + (d.amount || 0), 0);
    const pipe    = deals.reduce((s: number, d: any) => s + (d.amount || 0), 0);
    const winRate = deals.length > 0 ? Math.round((won.length / deals.length) * 100) : 0;
    const qualifiedLeads = leads.filter((l: any) => (l.status || '').toUpperCase() === 'QUALIFIED').length;
    const convRate = leads.length > 0 ? Math.round((qualifiedLeads / leads.length) * 100) : 0;

    const acceptedQuotes  = quotes.filter((q: any) => (q.status || '').toUpperCase() === 'ACCEPTED').length;
    const totalInvoiceAmt = invoices.reduce((s: number, i: any) => s + (i.totalAmount || i.amount || 0), 0);

    this.kpis.set([
      {
        title: 'Total Revenue',     value: this.fmt(revenue),
        sub: `${won.length} Closed Won deals`,
        color: '#0F3460',           iconPath: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'
      },
      {
        title: 'Pipeline Value',    value: this.fmt(pipe),
        sub: `${deals.length} total deals`,
        color: '#16A34A',           iconPath: 'M22 12h-6l-2 3h-4l-2-3H2'
      },
      {
        title: 'Win Rate',          value: `${winRate}%`,
        sub: `${won.length} won of ${deals.length}`,
        color: '#0EA5E9',           iconPath: 'M9 11l3 3L22 4'
      },
      {
        title: 'Lead Conversion',   value: `${convRate}%`,
        sub: `${qualifiedLeads} qualified of ${leads.length}`,
        color: '#F59E0B',           iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 0'
      },
      {
        title: 'Quotes Accepted',   value: acceptedQuotes,
        sub: `of ${quotes.length} total quotes`,
        color: '#7C3AED',           iconPath: 'M14 2H6a2 2 0 0 0-2 2v16h14V8zM14 2v6h6'
      },
      {
        title: 'Invoice Value',     value: this.fmt(totalInvoiceAmt),
        sub: `${invoices.length} invoices`,
        color: '#EF4444',           iconPath: 'M2 5h20v14H2zM2 10h20'
      },
      {
        title: 'Total Contacts',    value: contacts.length,
        sub: 'Across all accounts',
        color: '#0EA5E9',           iconPath: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
      },
      {
        title: 'Active Sessions',   value: sessions?.activeSessions ?? 0,
        sub: `${sessions?.todayLogins ?? 0} logins today`,
        color: '#0F3460',           iconPath: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2'
      },
    ]);

    // Stage breakdown
    const stages = [
      { label: 'Prospecting',   kw: ['prospecting'],   count: 0, color: '#CBD5E1' },
      { label: 'Qualification', kw: ['qualification'], count: 0, color: '#93C5FD' },
      { label: 'Proposal',      kw: ['proposal'],      count: 0, color: '#60A5FA' },
      { label: 'Negotiation',   kw: ['negotiation'],   count: 0, color: '#0F3460' },
      { label: 'Closed Won',    kw: ['won'],           count: 0, color: '#16A34A' },
      { label: 'Closed Lost',   kw: ['lost'],          count: 0, color: '#EF4444' },
    ];
    deals.forEach((d: any) => {
      const s = (d.stage || '').toLowerCase();
      const match = stages.find(st => st.kw.some(k => s.includes(k)));
      if (match) match.count++;
    });
    const total = deals.length || 1;
    this.stageBreakdown.set(stages.map(s => ({
      label: s.label, count: s.count,
      pct: Math.round((s.count / total) * 100),
      color: s.color
    })));

    // Leaderboard — group won deals by owner/assignedTo
    const ownerMap = new Map<string, { deals: number; value: number; won: number }>();
    deals.forEach((d: any) => {
      const owner = d.owner || d.assignedTo || d.createdBy || 'Unassigned';
      const entry = ownerMap.get(owner) ?? { deals: 0, value: 0, won: 0 };
      entry.deals++;
      entry.value += d.amount || 0;
      if ((d.stage || '').toLowerCase().includes('won')) entry.won++;
      ownerMap.set(owner, entry);
    });
    const rows: LeaderRow[] = Array.from(ownerMap.entries())
      .sort((a, b) => b[1].won - a[1].won)
      .slice(0, 8)
      .map(([name, v]) => ({ name, deals: v.deals, value: this.fmt(v.value), won: v.won }));
    this.leaderboard.set(rows);

    this.loading.set(false);
  }

  private fmt(v: number): string {
    if (!v) return '₹0';
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)} Cr`;
    if (v >= 100000)   return `₹${(v / 100000).toFixed(1)} L`;
    return `₹${v.toLocaleString()}`;
  }
}
