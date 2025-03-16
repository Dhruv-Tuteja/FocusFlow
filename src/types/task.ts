
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
  timeSpent: number;
  status: TaskStatus;
  tags: TaskTag[];
  isTimerActive: boolean;
  timerStartedAt?: number;
};

export type DailyProgress = {
  date: string;
  tasksCompleted: number;
  tasksPlanned: number;
  completion: number; // 0-1 value
};

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string | null;
};
