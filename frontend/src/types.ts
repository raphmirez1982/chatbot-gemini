import type { Timestamp } from 'firebase/firestore';

export type TaskStatus = 'pending' | 'in-progress' | 'completed';

export interface Subtask {
  text: string;
  completed: boolean;
}

export interface Project {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  color?: string;
  imageUrl?: string;
  icon?: string;
  status: 'active' | 'archived' | 'completed';
  priority?: number;
  createdAt: Timestamp;
}

export interface Task {
  id?: string;
  userId: string;
  projectId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  category?: string;
  dueDate?: Timestamp;
  subtasks?: Subtask[];
}

export interface Note {
  id?: string;
  userId: string;
  projectId?: string;
  title: string;
  content?: string;
  category?: string;
  details?: string[];
  images?: string[];
  imagePosition?: 'before' | 'after';
  createdAt: Timestamp;
}

export interface Reminder {
  id?: string;
  userId: string;
  projectId?: string;
  title: string;
  description?: string;
  category?: string;
  dueDate: Timestamp;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  details?: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface Expense {
  id: string;
  concept: string;
  amount: number;
  date: Timestamp;
}

export interface BudgetConcept {
  id: string;
  title: string;
  limit: number;
  spent: number;
  expenses: Expense[];
}

export interface Budget {
  id?: string;
  userId: string;
  ownerEmail?: string;
  sharedWith?: string[]; // Array of user emails
  period: string; // YYYY-MM
  title: string; // Category Title
  limit: number; // Sum of concept limits
  spent: number; // Sum of concept spent
  currency: string;
  color?: string;
  concepts: BudgetConcept[];
  isClosed?: boolean;
  closedBy?: string;
  createdAt: Timestamp;
}

export interface AppNotification {
  id?: string;
  userId: string;
  message: string;
  date: Timestamp;
  read: boolean;
  type: 'payment' | 'budget' | 'system';
  budgetId?: string;
}
