import { Task, DailyProgress, StreakData, TaskTag, UserProfile, WeekDay, RecurrencePattern, Bookmark } from "@/types/task";
import { addDays, addWeeks, addMonths, format, parseISO, isAfter, isSameDay, getDay } from "date-fns";

// Save bookmarks to localStorage
export const saveBookmarks = (bookmarks: Bookmark[]) => {
  localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
};

// Load bookmarks from localStorage
export const loadBookmarks = (): Bookmark[] => {
  const bookmarks = localStorage.getItem("bookmarks");
  return bookmarks ? JSON.parse(bookmarks) : [];
};

// Extract domain from URL
export const extractDomain = (url: string): string => {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch (error) {
    return url;
  }
};

// Generate a color based on a string (for bookmarks without specified colors)
export const generateColorFromString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 55%)`;
};

// Format seconds to MM:SS display format
export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Save tasks to localStorage
export const saveTasks = (tasks: Task[]) => {
  localStorage.setItem("tasks", JSON.stringify(tasks));
};

// Load tasks from localStorage
export const loadTasks = (): Task[] => {
  const tasks = localStorage.getItem("tasks");
  return tasks ? JSON.parse(tasks) : [];
};

// Helper function to check if a task is due today
export const isTaskDueToday = (task: Task): boolean => {
  const today = getTodayDateString();
  
  // Simple case: task is due today
  if (task.dueDate === today) {
    console.log(`Task "${task.title}" is due today directly (${today})`);
    return true;
  }
  
  // No recurrence, only check direct date match
  if (!task.recurrence) {
    console.log(`Task "${task.title}" has no recurrence and is not due today`);
    return false;
  }
  
  // Check recurrence based on pattern
  const { pattern, weekDays } = task.recurrence;
  const todayDate = new Date();
  const dueDate = parseISO(task.dueDate);
  
  // First, check if we've reached the start date
  if (todayDate < dueDate) {
    console.log(`Task "${task.title}" start date hasn't been reached yet`);
    return false;
  }
  
  console.log(`Checking recurrence for task "${task.title}" with pattern: ${pattern}`);
  
  switch (pattern) {
    case 'daily':
      console.log(`Task "${task.title}" is recurring daily - due today`);
      return true; // Daily tasks are due every day
      
    case 'weekly':
      if (!weekDays || weekDays.length === 0) {
        console.log(`Task "${task.title}" is weekly but no weekdays specified`);
        return false;
      }
      
      // Check if today is one of the specified week days
      const todayWeekDayIndex = getDay(todayDate);
      // Convert day index to weekDay name (0 = Sunday, 1 = Monday, etc.)
      const dayNames: WeekDay[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayWeekDay = dayNames[todayWeekDayIndex];
      
      const isDue = weekDays.includes(todayWeekDay);
      console.log(`Task "${task.title}" is weekly on ${weekDays.join(', ')}. Today is ${todayWeekDay}. Due today: ${isDue}`);
      return isDue;
      
    case 'monthly':
      // Check if today has the same day of month as the task's due date
      const isDueToday = todayDate.getDate() === dueDate.getDate();
      console.log(`Task "${task.title}" is monthly on day ${dueDate.getDate()}. Today is day ${todayDate.getDate()}. Due today: ${isDueToday}`);
      return isDueToday;
      
    default:
      console.log(`Task "${task.title}" has unknown recurrence pattern: ${pattern}`);
      return false;
  }
};

// Get the next occurrence date for a recurring task
export const getNextOccurrence = (task: Task): string => {
  if (!task.recurrence) return task.dueDate;
  
  const currentDate = parseISO(task.dueDate);
  const { pattern } = task.recurrence;
  
  switch (pattern) {
    case 'daily':
      return format(addDays(currentDate, 1), 'yyyy-MM-dd');
    
    case 'weekly':
      return format(addWeeks(currentDate, 1), 'yyyy-MM-dd');
    
    case 'monthly':
      return format(addMonths(currentDate, 1), 'yyyy-MM-dd');
    
    default:
      return task.dueDate;
  }
};

// Update a task when it's completed, generating the next occurrence if it's recurring
export const updateRecurringTask = (task: Task, tasks: Task[]): Task[] => {
  // If this isn't a recurring task, just return the tasks array unchanged
  if (!task.recurrence || task.recurrence.pattern === 'once') {
    return tasks;
  }
  
  // Check if we should stop recurrence due to end date
  if (task.recurrence.endDate) {
    const endDate = parseISO(task.recurrence.endDate);
    const today = new Date();
    
    if (isAfter(today, endDate)) {
      // Past the end date, don't create a new occurrence
      return tasks;
    }
  }
  
  // Calculate next occurrence date
  const nextDueDate = getNextOccurrence(task);
  
  // Create a new task for the next occurrence
  const newTask: Task = {
    ...task,
    id: generateId(),
    dueDate: nextDueDate,
    status: 'pending'
  };
  
  // Add the new occurrence to the tasks array
  return [...tasks, newTask];
};

// Save daily progress to localStorage
export const saveProgress = (progress: DailyProgress[]) => {
  localStorage.setItem("progress", JSON.stringify(progress));
};

// Load daily progress from localStorage
export const loadProgress = (): DailyProgress[] => {
  const progress = localStorage.getItem("progress");
  return progress ? JSON.parse(progress) : [];
};

// Save streak data to localStorage
export const saveStreak = (streak: StreakData) => {
  localStorage.setItem("streak", JSON.stringify(streak));
};

// Load streak data from localStorage
export const loadStreak = (): StreakData => {
  const streak = localStorage.getItem("streak");
  return streak
    ? JSON.parse(streak)
    : {
        currentStreak: 0,
        longestStreak: 0,
        lastCompletionDate: null,
      };
};

// Save user profile to localStorage
export const saveUserProfile = (profile: UserProfile) => {
  localStorage.setItem("userProfile", JSON.stringify(profile));
};

// Load user profile from localStorage
export const loadUserProfile = (): UserProfile | null => {
  const profile = localStorage.getItem("userProfile");
  return profile ? JSON.parse(profile) : null;
};

// Save profiles to localStorage
export const saveProfiles = (profiles: UserProfile[]) => {
  localStorage.setItem("profiles", JSON.stringify(profiles));
};

// Load profiles from localStorage
export const loadProfiles = (): UserProfile[] => {
  const profiles = localStorage.getItem("profiles");
  return profiles ? JSON.parse(profiles) : [];
};

// Save tags to localStorage
export const saveTags = (tags: TaskTag[]) => {
  localStorage.setItem("tags", JSON.stringify(tags));
};

// Load tags from localStorage
export const loadTags = (): TaskTag[] => {
  const tags = localStorage.getItem("tags");
  if (tags) return JSON.parse(tags);
  
  // Default tags if none exist
  const defaultTags = [
    { id: "1", name: "Work", color: "#4C51BF" },
    { id: "2", name: "Personal", color: "#38A169" },
    { id: "3", name: "Health", color: "#E53E3E" },
    { id: "4", name: "Learning", color: "#D69E2E" },
    { id: "5", name: "Family", color: "#DD6B20" },
    { id: "6", name: "Home", color: "#805AD5" },
    { id: "7", name: "Finance", color: "#2F855A" },
    { id: "8", name: "Urgent", color: "#F56565" },
    { id: "9", name: "Hobby", color: "#4299E1" },
    { id: "10", name: "Social", color: "#ED64A6" },
  ];
  
  saveTags(defaultTags);
  return defaultTags;
};

// Generate a random ID
export const generateId = () => {
  return Math.random().toString(36).substring(2, 11);
};

// Get today's date in YYYY-MM-DD format
export const getTodayDateString = (): string => {
  // This should return today's actual date, not a hardcoded value
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(now.getDate()).padStart(2, '0');
  
  console.log(`Current date calculation: ${year}-${month}-${day}`);
  return `${year}-${month}-${day}`;
};

// Check if a date is today
export const isToday = (dateString: string): boolean => {
  return dateString === getTodayDateString();
};

// Get the progress cell color class based on completion percentage
export const getProgressColorClass = (completion: number): string => {
  if (completion === 0) return "day-empty";
  if (completion < 0.5) return "day-low";
  if (completion < 1) return "day-medium";
  return "day-high";
};

// Update streak information based on daily progress
export const updateStreak = (progress: DailyProgress[], prevStreak: StreakData): StreakData => {
  const today = getTodayDateString();
  const todayProgress = progress.find(p => p.date === today);
  
  // Only continue streak if ALL tasks were completed (completion === 1)
  if (!todayProgress || todayProgress.completion < 1) {
    // No completed tasks today, check if streak is broken
    if (prevStreak.lastCompletionDate) {
      const lastDate = new Date(prevStreak.lastCompletionDate);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      // If last completion was before yesterday, reset streak
      if (lastDate.getTime() < yesterday.setHours(0, 0, 0, 0)) {
        return {
          currentStreak: 0,
          longestStreak: prevStreak.longestStreak,
          lastCompletionDate: null,
        };
      }
    }
    
    // Return unchanged
    return prevStreak;
  }
  
  // We completed all tasks today
  const newCurrentStreak = prevStreak.lastCompletionDate ? prevStreak.currentStreak + 1 : 1;
  const newLongestStreak = Math.max(newCurrentStreak, prevStreak.longestStreak);
  
  return {
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastCompletionDate: today,
  };
};
