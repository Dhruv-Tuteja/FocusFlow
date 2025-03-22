import { useState, useEffect } from "react";
import TaskForm from "@/components/TaskForm";
import TaskList from "@/components/TaskList";
import Calendar from "@/components/Calendar";
import BookmarkManager from "@/components/BookmarkManager";
import { Task, DailyProgress, StreakData, TaskTag, TaskStatus, Bookmark } from "@/types/task";
import { useNavigate } from "react-router-dom";
import {
  getTodayDateString,
  updateStreak,
  updateRecurringTask,
  isTaskDueToday,
  generateId,
} from "@/utils/taskUtils";
import { CheckCircle2, BarChart, Sun, Moon, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from '@/contexts/ThemeContext';
import { 
  getUserData, 
  saveTasks, 
  saveProgress, 
  saveStreak, 
  saveBookmarks, 
  saveTags,
  forceSaveAllUserData
} from "@/lib/firebase";
import { format } from "date-fns";

// Function to rebuild progress data for all dates with tasks
const rebuildProgressData = (tasks: Task[], existingProgress: DailyProgress[]): DailyProgress[] => {
  console.log('Rebuilding progress data from task history...');
  
  // Create a copy of existing progress
  const updatedProgress = [...existingProgress];
  
  // Get all unique dates from tasks
  const taskDates = new Set<string>();
  tasks.forEach(task => {
    if (task.dueDate) {
      taskDates.add(task.dueDate);
    }
  });
  
  console.log(`Found ${taskDates.size} unique dates with tasks`);
  
  // Process each date with tasks
  taskDates.forEach(date => {
    // Skip if we already have a progress entry for this date
    const existingEntry = updatedProgress.find(p => p.date === date);
    if (existingEntry) {
      console.log(`Progress entry already exists for ${date}. Updating...`);
      
      // Get all tasks for this date
      const tasksForDate = tasks.filter(task => 
        task.dueDate === date || 
        (task.recurrence && task.dueDate <= date && isTaskDueToday(task))
      );
      
      const completedTasks = tasksForDate.filter(task => task.status === "completed");
      const completion = tasksForDate.length > 0 ? completedTasks.length / tasksForDate.length : 0;
      
      // Update existing entry
      existingEntry.tasksCompleted = completedTasks.length;
      existingEntry.tasksPlanned = tasksForDate.length;
      existingEntry.completion = completion;
      existingEntry.tasks = tasksForDate;
      
      console.log(`Updated progress for ${date}: ${completedTasks.length}/${tasksForDate.length} (${Math.round(completion * 100)}%)`);
    } else {
      console.log(`Creating new progress entry for ${date}`);
      
      // Get all tasks for this date
      const tasksForDate = tasks.filter(task => 
        task.dueDate === date || 
        (task.recurrence && task.dueDate <= date && isTaskDueToday(task))
      );
      
      const completedTasks = tasksForDate.filter(task => task.status === "completed");
      const completion = tasksForDate.length > 0 ? completedTasks.length / tasksForDate.length : 0;
      
      // Create new progress entry
      const newEntry: DailyProgress = {
        date,
        tasksCompleted: completedTasks.length,
        tasksPlanned: tasksForDate.length,
        completion,
        tasks: tasksForDate
      };
      
      updatedProgress.push(newEntry);
      console.log(`Added progress for ${date}: ${completedTasks.length}/${tasksForDate.length} (${Math.round(completion * 100)}%)`);
    }
  });
  
  console.log(`Progress data rebuild complete. Total entries: ${updatedProgress.length}`);
  return updatedProgress;
};

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<DailyProgress[]>([]);
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastCompletionDate: null,
  });
  const [tags, setTags] = useState<TaskTag[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, signOut, setShowLoginDialog } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [todayProgress, setTodayProgress] = useState(0);
  const [selectedDateProgress, setSelectedDateProgress] = useState(0);
  const [selectedDateTasks, setSelectedDateTasks] = useState<Task[]>([]);
  const [selectedDateCompleted, setSelectedDateCompleted] = useState(0);

  // Load user data when user changes
  useEffect(() => {
    const loadUserData = async () => {
      // Log the current date at initialization
      const currentDate = getTodayDateString();
      console.log('[CRITICAL] Current date at app initialization:', currentDate);
      
      if (!user) {
        // Reset all data if no user is logged in
        setTasks([]);
        setProgress([]);
        setStreak({
          currentStreak: 0,
          longestStreak: 0,
          lastCompletionDate: null,
        });
        setTags([]);
        setBookmarks([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        console.log('[CRITICAL] Loading user data from Firestore...');
        const result = await getUserData(user.uid);
        if (result.success && result.data) {
          console.log('[CRITICAL] User data loaded successfully');

          // Set tasks - CRITICALLY IMPORTANT: Keep original task data from Firestore
          const loadedTasks = result.data.tasks || [];
          console.log('Setting tasks:', loadedTasks.length);
          setTasks(loadedTasks);
          
          // Set progress
          const loadedProgress = result.data.progress || [];
          console.log('Setting progress:', loadedProgress.length);
          
          // Rebuild missing progress entries
          const updatedProgress = rebuildProgressData(loadedTasks, loadedProgress);
          
          // Only update if there are changes to avoid unnecessary saves
          if (updatedProgress.length !== loadedProgress.length) {
            console.log('Progress data was updated. New length:', updatedProgress.length);
            console.log('Saving updated progress data...');
            setProgress(updatedProgress);
            await saveProgress(user.uid, updatedProgress);
          } else {
            setProgress(loadedProgress);
          }
          
          // Set streak
          const loadedStreak = result.data.streak || {
            currentStreak: 0,
            longestStreak: 0,
            lastCompletionDate: null,
          };
          console.log('Setting streak:', loadedStreak);
          setStreak(loadedStreak);
          
          // Set tags
          const loadedTags = result.data.tags || [];
          
          // If user has no tags, create default tags
          if (loadedTags.length === 0) {
            console.log('No tags found, creating default tags');
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
            
            setTags(defaultTags);
            await saveTags(user.uid, defaultTags);
            console.log('Default tags created and saved');
          } else {
            console.log('Setting tags:', loadedTags.length);
            setTags(loadedTags);
          }
          
          // Set bookmarks - CRITICALLY IMPORTANT: Keep original bookmark data from Firestore
          const loadedBookmarks = result.data.bookmarks || [];
          console.log('Setting bookmarks:', loadedBookmarks.length);
          setBookmarks(loadedBookmarks);
          
          // Initialize today's progress data if we have tasks but no progress for today
          const today = getTodayDateString();
          const todaysTasksFromLoaded = loadedTasks.filter((task: Task) => 
            task.dueDate === today || 
            (task.recurrence && isTaskDueToday(task))
          );
          
          // If we have tasks for today but no progress entry, create one immediately
          if (todaysTasksFromLoaded.length > 0 && !loadedProgress.some((p: DailyProgress) => p.date === today)) {
            console.log('We have tasks for today but no progress entry. Creating one now.');
            
            const todayCompleted = todaysTasksFromLoaded.filter((t: Task) => t.status === "completed").length;
            const todayCompletion = todayCompleted / todaysTasksFromLoaded.length;
            
            const newProgressEntry: DailyProgress = {
              date: today,
              tasksCompleted: todayCompleted,
              tasksPlanned: todaysTasksFromLoaded.length,
              completion: todayCompletion,
              tasks: todaysTasksFromLoaded
            };
            
            const updatedProgress = [...loadedProgress, newProgressEntry];
            console.log('Immediately saving new progress entry:', newProgressEntry);
            setProgress(updatedProgress);
            
            // Save the new progress entry to Firestore
            await saveProgress(user.uid, updatedProgress);
          }
          
          console.log('User data set successfully');
        } else {
          console.error('Failed to load user data:', result);
          toast({
            title: "Error",
            description: "Failed to load your data. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        toast({
          title: "Error",
          description: "Failed to load your data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [user, toast]);

  // Check for day change and handle recurring tasks
  useEffect(() => {
    if (!user || tasks.length === 0) return;
    
    console.log('Checking for tasks that should reset for today...');
    
    const today = getTodayDateString();
    
    // Get the last date the app was used (check progress)
    let lastUsedDate: string | null = null;
    if (progress.length > 0) {
      // Sort progress entries by date in descending order
      const sortedProgress = [...progress].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      lastUsedDate = sortedProgress[0].date;
    }
    
    console.log('Last used date:', lastUsedDate);
    console.log('Current date:', today);
    
    // IMPORTANT: Use regular tasks array without deep copying, to avoid losing past tasks
    const existingTasks = [...tasks];
    
    // Process all recurring tasks regardless of when the app was last used
    // This ensures we handle cases where the app hasn't been opened for multiple days
    console.log('Checking for recurring tasks due today...');
    
    // Filter tasks that should recur today but have past dates
    const recurringTasksDueToday = existingTasks.filter((task: Task) => 
      task.recurrence && 
      isTaskDueToday(task) && 
      task.dueDate < today // Task is from a past date
    );
    
    console.log('Found recurring tasks due today:', recurringTasksDueToday.length);
    
    if (recurringTasksDueToday.length > 0) {
      // Create updated tasks with reset statuses for today
      const updatedTasks = [...existingTasks];
      let newTasksCreated = 0;
      
      recurringTasksDueToday.forEach((task: Task) => {
        // Create a new version of this task for today
        const resetTask: Task = {
          ...task,
          id: generateId(), // Generate a new ID for the task
          dueDate: today,
          status: 'pending' // Reset status to pending
        };
        
        // Add new task for today
        updatedTasks.push(resetTask);
        newTasksCreated++;
      });
      
      // Update tasks in state and Firestore - use regular saveTasks
      setTasks(updatedTasks);
      saveTasks(user.uid, updatedTasks)
        .then(result => {
          if (!result.success) {
            console.error('Failed to save recurring tasks');
          } else {
            console.log('Successfully saved recurring tasks');
          }
        });
      
      toast({
        title: "Tasks updated for today",
        description: `${newTasksCreated} recurring tasks added for today.`,
      });
    }
  }, [user, tasks, progress]);

  // Calculate today's tasks and progress
  useEffect(() => {
    const calculateTodayProgress = () => {
      const todayString = getTodayDateString();
      const filteredTasks = tasks.filter(task => 
        task.dueDate === todayString || 
        (task.recurrence && isTaskDueToday(task))
      );
      const completedTasks = filteredTasks.filter(task => task.status === "completed").length;
      const progressPercentage = filteredTasks.length > 0 ? (completedTasks / filteredTasks.length) * 100 : 0;
      
      console.log('Today\'s progress calculated:', {
        date: todayString,
        totalTasks: filteredTasks.length,
        completedTasks: completedTasks,
        progressPercentage: progressPercentage
      });
      
      setTodayTasks(filteredTasks);
      setTodayCompleted(completedTasks);
      setTodayProgress(progressPercentage);
    };

    calculateTodayProgress();
  }, [tasks]);

  // Update daily progress
  useEffect(() => {
    const updateDailyProgress = async () => {
      if (!user) return;

      try {
        console.log('Updating daily progress...');
        const today = getTodayDateString();
        
        // Debug logging
        console.log('Current progress array:', progress);
        
        // For the activity graph, we need to consider ALL tasks scheduled for today
        // not just the filtered ones based on visibility
        const allTodayTasks = tasks.filter(task => 
          task.dueDate === today || 
          (task.recurrence && isTaskDueToday(task))
        );
        
        console.log('All tasks for today (for progress calculation):', allTodayTasks);
        
        // Calculate completion based on ALL tasks for today, not just visible ones
        let completedTasks = allTodayTasks.filter(task => task.status === "completed");
        let completion = allTodayTasks.length > 0 ? completedTasks.length / allTodayTasks.length : 0;
        
        console.log('Completion calculation:', {
          completed: completedTasks.length,
          total: allTodayTasks.length,
          completion: completion
        });

        const existingProgress = progress.find(p => p.date === today);
        console.log('Existing progress for today:', existingProgress);
        
        let updatedProgress: DailyProgress[];

        if (existingProgress) {
          console.log('Updating existing progress entry');
          updatedProgress = progress.map(p =>
            p.date === today
              ? {
                  ...p,
                  tasksCompleted: completedTasks.length,
                  tasksPlanned: allTodayTasks.length,
                  completion,
                  tasks: allTodayTasks,
                }
              : p
          );
        } else {
          console.log('Creating new progress entry for today');
          // Always create an entry for today, even with zero tasks
          updatedProgress = [
            ...progress,
            {
              date: today,
              tasksCompleted: completedTasks.length,
              tasksPlanned: allTodayTasks.length || 0,
              completion,
              tasks: allTodayTasks,
            },
          ];
        }

        console.log('Setting updated progress:', updatedProgress);
        console.log('Progress count before update:', progress.length);
        console.log('Progress count after update:', updatedProgress.length);
        
        // Make sure to update state before saving to Firebase
    setProgress(updatedProgress);
        
        // Save to Firebase and capture result
        const saveResult = await saveProgress(user.uid, updatedProgress);
        console.log('Progress save result:', saveResult);

        // Verify the progress was saved with color data
        if (saveResult.success) {
          // Now update streak based on the updated progress
    const updatedStreak = updateStreak(updatedProgress, streak);
          if (
            updatedStreak.currentStreak !== streak.currentStreak ||
            updatedStreak.longestStreak !== streak.longestStreak ||
            updatedStreak.lastCompletionDate !== streak.lastCompletionDate
          ) {
            console.log('Setting updated streak:', updatedStreak);
    setStreak(updatedStreak);
            await saveStreak(user.uid, updatedStreak);
          }
        } else {
          console.error('Failed to save progress:', saveResult.error);
        }
      } catch (error) {
        console.error('Error updating daily progress:', error);
        toast({
          title: "Error",
          description: "Failed to update your progress. Please try again.",
          variant: "destructive",
        });
      }
    };

    // Call the function
    updateDailyProgress();
  }, [user, tasks, todayTasks, progress, streak]);

  const handleTaskCreate = async (task: Task) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create tasks",
        variant: "destructive",
      });
      return;
    }

    console.log('[CRITICAL ACTION] Creating new task:', task);
    
    // Create new array with the task added
    const newTasks = [...tasks, task];
    
    // First update local state for faster UI response
    setTasks(newTasks);
    
    try {
      // Then save to Firestore
      console.log('[CRITICAL ACTION] Saving tasks to Firebase, count:', newTasks.length);
      const result = await saveTasks(user.uid, newTasks);
      
      if (result.success) {
        console.log('[CRITICAL ACTION] Task saved successfully');
        toast({
          title: "Success",
          description: "Task created successfully",
        });
      } else {
        console.error('[CRITICAL ERROR] Failed to save task:', result.error);
        // Revert the local state change since the server update failed
        setTasks(tasks);
        toast({
          title: "Error",
          description: "Failed to save task. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[CRITICAL ERROR] Exception while saving task:', error);
      // Revert the local state change
      setTasks(tasks);
      toast({
        title: "Error",
        description: "An error occurred while saving the task",
        variant: "destructive",
      });
    }
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to update tasks",
        variant: "destructive",
      });
      return;
    }
    
    console.log('[CRITICAL ACTION] Updating task:', updatedTask);
    
    // Find the task to update and create a new array with the update applied
    const updatedTasks = tasks.map((task) =>
      task.id === updatedTask.id ? updatedTask : task
    );
    
    // First update local state for faster UI response
    setTasks(updatedTasks);
    
    try {
      // Then save to Firestore
      console.log('[CRITICAL ACTION] Saving updated tasks to Firebase, count:', updatedTasks.length);
      const result = await saveTasks(user.uid, updatedTasks);
      
      if (result.success) {
        console.log('[CRITICAL ACTION] Task updated successfully');
        // Only show toast for status changes to completed
        if (updatedTask.status === "completed") {
          toast({
            title: "Success",
            description: "Task completed! Great job! 🎉",
          });
        }
      } else {
        console.error('[CRITICAL ERROR] Failed to update task:', result.error);
        // Revert the local state change since the server update failed
        setTasks(tasks);
        toast({
          title: "Error",
          description: "Failed to update task. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[CRITICAL ERROR] Exception while updating task:', error);
      // Revert the local state change
      setTasks(tasks);
      toast({
        title: "Error",
        description: "An error occurred while updating the task",
        variant: "destructive",
      });
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to delete tasks",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Deleting task:', taskId);
    
    const updatedTasks = tasks.filter((task) => task.id !== taskId);
    setTasks(updatedTasks);
    
    try {
      const result = await saveTasks(user.uid, updatedTasks);
      if (result.success) {
        toast({
          title: "Success",
          description: "Task deleted successfully",
        });
      } else {
        console.error('Failed to delete task:', result.error);
        toast({
          title: "Error",
          description: "Failed to delete task. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "An error occurred while deleting the task",
        variant: "destructive",
      });
    }
  };

  // Add a function to handle creating new tags
  const handleAddTag = async (tag: TaskTag) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to add tags.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log('Adding tag:', tag);
      const updatedTags = [...tags, tag];
      
      // Update local state first
      setTags(updatedTags);
      
      // Then save to Firestore
      console.log('Saving tags to Firestore...');
      const result = await saveTags(user.uid, updatedTags);
      console.log('Save tags result:', result);
      
      if (!result.success) {
        throw new Error('Failed to save tag');
      }
      
      toast({
        title: "Tag created",
        description: `"${tag.name}" tag has been created.`,
      });
      
      return tag;
    } catch (error) {
      console.error('Error adding tag:', error);
      toast({
        title: "Error",
        description: "Failed to save your tag. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    
    // Find progress entry for the selected date
    const dateProgress = progress.find(p => p.date === date);
    
    if (dateProgress) {
      // Set selected date tasks and progress
      setSelectedDateTasks(dateProgress.tasks || []);
      setSelectedDateCompleted(dateProgress.tasksCompleted || 0);
      setSelectedDateProgress(dateProgress.completion * 100 || 0);
    } else {
      // If no progress entry found, check if we have tasks for this date
      const tasksForDate = tasks.filter(task => 
        task.dueDate === date || 
        (task.recurrence && task.dueDate <= date && isTaskDueToday(task))
      );
      
      const completedTasks = tasksForDate.filter(task => task.status === "completed").length;
      const completionPercentage = tasksForDate.length > 0 
        ? (completedTasks / tasksForDate.length) * 100 
        : 0;
      
      setSelectedDateTasks(tasksForDate);
      setSelectedDateCompleted(completedTasks);
      setSelectedDateProgress(completionPercentage);
    }
  };

  const handleBackToToday = () => {
    setSelectedDate(null);
    setSelectedDateTasks([]);
    setSelectedDateCompleted(0);
    setSelectedDateProgress(0);
  };

  const handleAddBookmark = async (bookmark: Bookmark) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add bookmarks",
        variant: "destructive",
      });
      return;
    }
    
    console.log('[CRITICAL ACTION] Adding bookmark:', bookmark);
    
    // Create new array with the bookmark added
    const newBookmarks = [...bookmarks, bookmark];
    
    // First update local state for faster UI response
    setBookmarks(newBookmarks);
    
    try {
      // Then save to Firestore
      console.log('[CRITICAL ACTION] Saving bookmarks to Firebase, count:', newBookmarks.length);
      const result = await saveBookmarks(user.uid, newBookmarks);
      
      if (result.success) {
        console.log('[CRITICAL ACTION] Bookmark saved successfully');
        toast({
          title: "Success",
          description: "Bookmark added successfully",
        });
      } else {
        console.error('[CRITICAL ERROR] Failed to save bookmark:', result.error);
        // Revert the local state change since the server update failed
        setBookmarks(bookmarks);
        toast({
          title: "Error",
          description: "Failed to save bookmark. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[CRITICAL ERROR] Exception while saving bookmark:', error);
      // Revert the local state change
      setBookmarks(bookmarks);
      toast({
        title: "Error",
        description: "An error occurred while saving the bookmark",
        variant: "destructive",
      });
    }
  };

  const handleEditBookmark = async (updatedBookmark: Bookmark) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to edit bookmarks",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Editing bookmark:', updatedBookmark);
    
    // Find and update the bookmark
    const updatedBookmarks = bookmarks.map((bookmark) =>
      bookmark.id === updatedBookmark.id ? updatedBookmark : bookmark
    );
    
    setBookmarks(updatedBookmarks);
    
    try {
      const result = await saveBookmarks(user.uid, updatedBookmarks);
      if (result.success) {
        toast({
          title: "Success",
          description: "Bookmark updated successfully",
        });
      } else {
        console.error('Failed to update bookmark:', result.error);
        toast({
          title: "Error",
          description: "Failed to update bookmark. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating bookmark:', error);
      toast({
        title: "Error",
        description: "An error occurred while updating the bookmark",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBookmark = async (bookmarkId: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to delete bookmarks",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Deleting bookmark:', bookmarkId);
    
    const updatedBookmarks = bookmarks.filter((bookmark) => bookmark.id !== bookmarkId);
    setBookmarks(updatedBookmarks);
    
    try {
      const result = await saveBookmarks(user.uid, updatedBookmarks);
      if (result.success) {
        toast({
          title: "Success",
          description: "Bookmark deleted successfully",
        });
      } else {
        console.error('Failed to delete bookmark:', result.error);
        toast({
          title: "Error",
          description: "Failed to delete bookmark. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      toast({
        title: "Error",
        description: "An error occurred while deleting the bookmark",
        variant: "destructive",
      });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to complete tasks",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Completing task:', taskId);
    
    // Find the task to update
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      console.error('Task not found:', taskId);
      return;
    }
    
    // Toggle the status
    const newStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";
    
    // Create updated task
    const updatedTask = {
      ...task,
      status: newStatus
    };
    
    // Use the existing task update function
    handleTaskUpdate(updatedTask);
  };

  // Update the account dropdown menu
  const accountDropdownContent = (
    <DropdownMenuContent align="end">
      {user ? (
        <>
          <DropdownMenuItem onClick={() => navigate("/profile")}>
            <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            View Statistics
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOut} className="text-red-600">
            <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </DropdownMenuItem>
        </>
      ) : (
        <DropdownMenuItem onClick={() => setShowLoginDialog(true)}>
          <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          Login
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container px-4 py-3 max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Left side - Home button */}
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
              className="font-semibold text-lg"
            >
              Focus Flow
            </Button>

            {/* Right side - Controls */}
            <div className="flex items-center gap-2">
              {/* Dark/Light Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>

              {/* Account/Profile Button with Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    {user?.displayName || "Account"}
                  </Button>
                </DropdownMenuTrigger>
                {accountDropdownContent}
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="container px-4 py-8 max-w-6xl mx-auto">
        {/* Centered Title Section */}
        <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Focus Flow</h1>
                {selectedDate ? (
                  <div>
                    <p className="text-muted-foreground">
                      Viewing tasks for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <button 
                      className="text-primary text-sm mt-1"
                      onClick={handleBackToToday}
                    >
                      Back to today
                    </button>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                )}
              </div>
              
        {/* Progress Card - updated to show selected date or today's progress */}
        {user && (
          <Card className="animate-scale-in mb-6">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-medium">
                  {selectedDate 
                    ? `Progress for ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` 
                    : "Today's Progress"}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <span className="font-semibold">
                    {Math.round(selectedDate ? selectedDateProgress : todayProgress)}%
                  </span>
                  <span className="text-sm text-muted-foreground">complete</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-full h-2 mb-1">
                <div 
                  className="bg-primary rounded-full h-2 transition-all duration-700 ease-out"
                  style={{ width: `${selectedDate ? selectedDateProgress : todayProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <div>
                  {selectedDate 
                    ? `${selectedDateCompleted} of ${selectedDateTasks.length} tasks completed` 
                    : `${todayCompleted} of ${todayTasks.length} tasks completed`}
                </div>
                {(selectedDate 
                  ? (selectedDateCompleted === selectedDateTasks.length && selectedDateTasks.length > 0)
                  : (todayCompleted === todayTasks.length && todayTasks.length > 0)
                ) && (
                  <div className="flex items-center gap-1 text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>All done{selectedDate ? " for this day" : " for today"}!</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Three Column Layout */}
        <div className="grid grid-cols-10 gap-6">
          {/* Calendar Column - 30% */}
          <div className="col-span-10 md:col-span-3">
            {user ? (
                    <Calendar 
                      progress={progress} 
                      streak={streak} 
                      onDateSelect={handleDateSelect}
                    />
            ) : (
              <Card>
                <CardContent className="py-6">
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <BarChart className="h-8 w-8 text-muted-foreground" />
                    <div className="space-y-1">
                      <h3 className="font-medium">Activity Tracking</h3>
                      <p className="text-sm text-muted-foreground">Login to view your activity and progress.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
                </div>

          {/* Tasks Column - 50% */}
          <div className="col-span-10 md:col-span-5">
            {!selectedDate && user ? (
              <TaskForm 
                onAddTask={handleTaskCreate} 
                availableTags={tags} 
                onAddTag={handleAddTag}
              />
            ) : !selectedDate && !user ? (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <User className="h-8 w-8 text-muted-foreground" />
                    <div className="space-y-1">
                      <h3 className="font-medium">Login Required</h3>
                      <p className="text-sm text-muted-foreground">Please login to create and manage tasks.</p>
              </div>
                    <Button
                      variant="outline"
                      onClick={() => setShowLoginDialog(true)}
                      className="mt-2"
                    >
                      Login to Continue
                    </Button>
            </div>
                </CardContent>
              </Card>
            ) : null}
            <TaskList
              tasks={user ? tasks : []}
              selectedDate={selectedDate || undefined}
              onUpdateTask={handleTaskUpdate}
              onCompleteTask={handleCompleteTask}
              onDeleteTask={handleTaskDelete}
            />
            {!user && (
              <Card className="mt-4">
                <CardContent className="py-4">
                  <p className="text-center text-sm text-muted-foreground">
                    Login to view and manage your tasks
                  </p>
                </CardContent>
              </Card>
            )}
        </div>
        
          {/* Bookmarks Column - 20% */}
          <div className="col-span-10 md:col-span-2">
            {user ? (
          <BookmarkManager 
            bookmarks={bookmarks}
            onAddBookmark={handleAddBookmark}
            onDeleteBookmark={handleDeleteBookmark}
            onEditBookmark={handleEditBookmark}
          />
            ) : (
              <Card>
                <CardContent className="py-6">
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <svg 
                      className="h-8 w-8 text-muted-foreground"
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                    </svg>
                    <div className="space-y-1">
                      <h3 className="font-medium">Bookmarks</h3>
                      <p className="text-sm text-muted-foreground">Login to manage your bookmarks.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
