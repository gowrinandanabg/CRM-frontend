import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login/login';
import { MainLayoutComponent } from './layout/main-layout';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'leads',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'leads' }
      },
      {
        path: 'contacts',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'contacts' }
      },
      {
        path: 'accounts',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'accounts' }
      },
      {
        path: 'deals',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'deals' }
      },
      {
        path: 'leads/:id',
        loadComponent: () =>
          import('orque-ui').then(m => m.RecordDetailComponent),
        data: { resource: 'leads' }
      },
      {
        path: 'deals/:id',
        loadComponent: () =>
          import('orque-ui').then(m => m.RecordDetailComponent),
        data: { resource: 'deals' }
      },
      {
        path: 'contacts/:id',
        loadComponent: () =>
          import('orque-ui').then(m => m.RecordDetailComponent),
        data: { resource: 'contacts' }
      },
      {
        path: 'accounts/:id',
        loadComponent: () =>
          import('orque-ui').then(m => m.RecordDetailComponent),
        data: { resource: 'accounts' }
      },
      {
        path: 'activities',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'activities' }
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'tasks' }
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'calendar' }
      },
      {
        path: 'campaigns',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'campaigns' }
      },
      {
        path: 'emails',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'emails' }
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'products' }
      },
      {
        path: 'quotes',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'quotes' }
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'invoices' }
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'reports' }
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'analytics' }
      },
      {
        path: 'report-builder',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'report-builder' }
      },
      {
        path: 'customization',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'customization' }
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'inventory' }
      },
      {
        path: 'dashboard-builder',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'dashboard-builder' }
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'user-settings' }
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'users' }
      },
      {
        path: 'active-sessions',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'active-sessions' }
      }
    ]
  },

  { path: '**', redirectTo: 'dashboard' }
];
