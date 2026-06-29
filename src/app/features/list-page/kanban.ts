import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageAction } from 'orque-ui';

interface KanbanColumn {
  name: string;
  label: string;
  color: string;
}

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kb-container">
      <div class="kb-board">
        @for (col of columns; track col.name) {
          <div class="kb-column"
               [class.drag-over]="draggedOverColumn === col.name"
               (dragover)="onDragOver($event, col.name)"
               (dragleave)="onDragLeave()"
               (drop)="onDrop($event, col.name)">
            <div class="kb-column-header" [style.border-top-color]="col.color">
              <div class="kb-column-title-group">
                <span class="kb-column-title">{{ col.label }}</span>
                <span class="kb-column-badge">{{ getCardsForColumn(col.name).length }}</span>
              </div>
            </div>
            
            <div class="kb-cards-container">
              @for (item of getCardsForColumn(col.name); track item.id) {
                <div class="kb-card" 
                     draggable="true" 
                     (dragstart)="onDragStart($event, item)">
                  <div class="kb-card-header">
                    <h4 class="kb-card-title">{{ getTitle(item) }}</h4>
                  </div>
                  
                  <div class="kb-card-body">
                    @if (item.company || item.account) {
                      <div class="kb-card-detail">
                        <strong>Company:</strong> {{ item.company || item.account }}
                      </div>
                    }
                    @if (item.contact || item.email) {
                      <div class="kb-card-detail">
                        <strong>Contact:</strong> {{ item.contact || item.email || item.fullName }}
                      </div>
                    }
                    @if (item.amount || item.estimatedValue) {
                      <div class="kb-card-detail kb-amount">
                        <strong>Value:</strong> ₹{{ item.amount || item.estimatedValue | number:'1.0-0' }}
                      </div>
                    }
                    @if (item.dueDate || item.expectedCloseDate) {
                      <div class="kb-card-detail">
                        <strong>Date:</strong> {{ item.dueDate || item.expectedCloseDate | date:'mediumDate' }}
                      </div>
                    }
                    @if (item.assignedTo || item.assignedOwner) {
                      <div class="kb-card-owner">
                        <span class="kb-owner-avatar">{{ getInitials(item.assignedTo || item.assignedOwner) }}</span>
                        <span class="kb-owner-name">{{ item.assignedTo || item.assignedOwner }}</span>
                      </div>
                    }
                  </div>
                  
                  <div class="kb-card-actions">
                    <button class="kb-btn kb-btn-edit" (click)="triggerAction('edit', item)">Edit</button>
                    <button class="kb-btn kb-btn-delete" (click)="triggerAction('delete', item)">Delete</button>
                    
                    @if (resource === 'deals' && col.name !== 'Closed Won' && col.name !== 'Closed Lost') {
                      <button class="kb-btn kb-btn-primary" (click)="triggerAction('approve', item)">Won</button>
                      <button class="kb-btn kb-btn-danger" (click)="triggerAction('reject', item)">Lost</button>
                    }
                    @if (resource === 'tasks' && col.name !== 'COMPLETED') {
                      <button class="kb-btn kb-btn-primary" (click)="triggerAction('approve', item)">Done</button>
                    }
                  </div>
                </div>
              } @empty {
                <div class="kb-empty">No records</div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .kb-container {
      padding: 20px 24px;
      overflow-x: auto;
      height: calc(100vh - 160px);
      background: var(--crm-bg);
    }
    .kb-board {
      display: flex;
      gap: 20px;
      align-items: flex-start;
      min-width: max-content;
      height: 100%;
    }
    .kb-column {
      width: 300px;
      background: var(--crm-hover);
      border: 2px solid transparent;
      border-radius: 12px;
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      max-height: 100%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      transition: all 0.2s ease;
    }
    .kb-column.drag-over {
      background: var(--crm-primary-soft) !important;
      border-color: var(--crm-primary);
      transform: scale(1.01);
    }
    .kb-column-header {
      border-top: 4px solid var(--crm-border);
      padding-top: 8px;
      margin-bottom: 16px;
    }
    .kb-column-title-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .kb-column-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--crm-text-2);
    }
    .kb-column-badge {
      background: var(--crm-border);
      color: var(--crm-text-3);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .kb-cards-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
      flex: 1;
      padding-right: 4px;
    }
    .kb-card {
      background: var(--crm-card);
      border: 1px solid var(--crm-border);
      border-radius: 10px;
      padding: 14px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      transition: all 0.2s ease;
      cursor: grab;
    }
    .kb-card:active {
      cursor: grabbing;
    }
    .kb-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--crm-shadow-md);
      border-color: var(--crm-border-dark);
    }
    .kb-card-title {
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--crm-text-1);
      margin: 0 0 10px;
      line-height: 1.3;
    }
    .kb-card-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    .kb-card-detail {
      font-size: 0.78rem;
      color: var(--crm-text-3);
    }
    .kb-amount {
      color: var(--crm-success);
      font-weight: 600;
    }
    .kb-card-owner {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
    }
    .kb-owner-avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--crm-primary);
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      font-weight: 700;
    }
    .kb-owner-name {
      font-size: 0.75rem;
      color: var(--crm-text-2);
    }
    .kb-card-actions {
      display: flex;
      gap: 6px;
      border-top: 1px dashed var(--crm-border);
      padding-top: 10px;
      flex-wrap: wrap;
    }
    .kb-btn {
      padding: 4px 8px;
      font-size: 0.72rem;
      border-radius: 6px;
      border: 1px solid var(--crm-border);
      background: var(--crm-card);
      color: var(--crm-text-2);
      cursor: pointer;
      font-weight: 500;
      transition: all 0.15s ease;
    }
    .kb-btn:hover {
      background: var(--crm-hover);
      border-color: var(--crm-border-dark);
    }
    .kb-btn-primary {
      background: var(--crm-primary-soft);
      color: var(--crm-primary);
      border-color: var(--crm-primary-soft);
    }
    .kb-btn-primary:hover {
      background: var(--crm-primary);
      color: #fff;
    }
    .kb-btn-danger {
      background: var(--crm-danger-soft);
      color: var(--crm-danger);
      border-color: var(--crm-danger-soft);
    }
    .kb-btn-danger:hover {
      background: var(--crm-danger);
      color: #fff;
    }
    .kb-btn-delete:hover {
      background: var(--crm-danger-soft);
      color: var(--crm-danger);
      border-color: var(--crm-danger);
    }
    .kb-empty {
      text-align: center;
      color: var(--crm-text-4);
      font-size: 0.75rem;
      padding: 20px 0;
      border: 2px dashed var(--crm-border);
      border-radius: 8px;
    }
  `]
})
export class KanbanComponent implements OnInit, OnChanges {
  @Input() resource = '';
  @Input() data: any[] = [];
  @Output() action = new EventEmitter<PageAction>();

  columns: KanbanColumn[] = [];
  draggedOverColumn: string | null = null;

  ngOnInit(): void {
    this.setupColumns();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resource']) {
      this.setupColumns();
    }
  }

  setupColumns(): void {
    if (this.resource === 'deals') {
      this.columns = [
        { name: 'Prospecting', label: 'Prospecting', color: '#9CA3AF' },
        { name: 'Qualification', label: 'Qualification', color: '#3B82F6' },
        { name: 'Proposal', label: 'Proposal', color: '#F59E0B' },
        { name: 'Negotiation', label: 'Negotiation', color: '#F97316' },
        { name: 'Closed Won', label: 'Closed Won', color: '#10B981' },
        { name: 'Closed Lost', label: 'Closed Lost', color: '#EF4444' }
      ];
    } else if (this.resource === 'leads') {
      this.columns = [
        { name: 'NEW', label: 'New', color: '#3B82F6' },
        { name: 'QUALIFIED', label: 'Qualified', color: '#10B981' },
        { name: 'DISQUALIFIED', label: 'Disqualified', color: '#EF4444' }
      ];
    } else if (this.resource === 'tasks') {
      this.columns = [
        { name: 'PENDING', label: 'Pending', color: '#F59E0B' },
        { name: 'IN_PROGRESS', label: 'In Progress', color: '#3B82F6' },
        { name: 'COMPLETED', label: 'Completed', color: '#10B981' },
        { name: 'CANCELLED', label: 'Cancelled', color: '#9CA3AF' }
      ];
    } else {
      this.columns = [];
    }
  }

  getCardsForColumn(colName: string): any[] {
    return this.data.filter(item => {
      const val = item.stage || item.status;
      return val && val.toString().toUpperCase() === colName.toUpperCase();
    });
  }

  getTitle(item: any): string {
    return item.dealName || item.fullName || item.title || item.companyName || 'Record';
  }

  getInitials(name?: string): string {
    if (!name) return 'U';
    return name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  triggerAction(actionName: string, item: any): void {
    this.action.emit({
      action: actionName,
      row: item,
      payload: item
    });
  }

  // HTML5 Drag and Drop events
  onDragStart(event: DragEvent, item: any): void {
    event.dataTransfer?.setData('text/plain', item.id.toString());
  }

  onDragOver(event: DragEvent, colName: string): void {
    event.preventDefault();
    this.draggedOverColumn = colName;
  }

  onDragLeave(): void {
    this.draggedOverColumn = null;
  }

  onDrop(event: DragEvent, targetColName: string): void {
    event.preventDefault();
    this.draggedOverColumn = null;
    const itemIdStr = event.dataTransfer?.getData('text/plain');
    if (!itemIdStr) return;
    const itemId = parseInt(itemIdStr, 10);
    const item = this.data.find(d => d.id === itemId);
    if (item) {
      const updatedItem = { ...item };
      if (this.resource === 'deals') {
        updatedItem.stage = targetColName;
      } else {
        updatedItem.status = targetColName;
      }
      this.triggerAction('save', updatedItem);
    }
  }
}
