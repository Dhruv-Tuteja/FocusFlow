
import { Task, DailyProgress, StreakData, TaskTag, UserProfile } from "@/types/task";

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
    { id: "3", name: "Urgent", color: "#E53E3E" },
    { id: "4", name: "Learning", color: "#D69E2E" },
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
  return new Date().toISOString().split("T")[0];
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
// Modified to only count days with 100% completion
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
