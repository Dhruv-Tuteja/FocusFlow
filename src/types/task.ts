
export type TaskTag = {
  id: string;
  name: string;
  color: string;
};

export type TaskStatus = 'pending' | 'in-progress' | 'completed';

export type Task = {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  estimatedMinutes?: number;
  status: TaskStatus;
  tags: TaskTag[];
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
