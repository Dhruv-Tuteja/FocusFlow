
export type TaskTag = {
  id: string;
  name: string;
  color: string;
};

export type TaskStatus = 'pending' | 'in-progress' | 'completed';

export type RecurrencePattern = 'once' | 'daily' | 'weekly' | 'monthly';

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type RecurrenceRule = {
  pattern: RecurrencePattern;
  weekDays?: WeekDay[]; // For weekly recurrence
  endDate?: string;     // Optional end date for the recurrence
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  dueDate: string;      // Initial/next due date
  estimatedMinutes?: number;
  status: TaskStatus;
  tags: TaskTag[];
  recurrence?: RecurrenceRule; // Optional recurrence information
};

export type DailyProgress = {
  date: string;
  tasksCompleted: number;
  tasksPlanned: number;
  completion: number; // 0-1 value
  tasks: Task[]; // Store tasks for this day to enable viewing historical tasks
};

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string | null;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  darkMode: boolean;
};
