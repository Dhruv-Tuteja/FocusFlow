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
    const loadUserData = async (userId: string) => {
      console.log(`[${new Date().toLocaleTimeString()}] Loading user data for user:`, userId);
      
      try {
        // Use the updated getUserData function to get data from the new structure
        const response = await getUserData(userId);
        
        if (response.success) {
          // Add type assertion to resolve TypeScript errors
          const userData = response.data as {
            tasks?: Task[],
            bookmarks?: Bookmark[],
            progress?: DailyProgress[],
            streak?: StreakData,
            tags?: TaskTag[]
          };
          
          console.log(`[${new Date().toLocaleTimeString()}] Successfully loaded user data:`, 
            {
              tasksCount: userData.tasks?.length || 0,
              bookmarksCount: userData.bookmarks?.length || 0,
              progressCount: userData.progress?.length || 0
            }
          );
          
          // Update state with the loaded data
          setTasks(userData.tasks || []);
          setBookmarks(userData.bookmarks || []);
          setProgress(userData.progress || []);
          setStreak(userData.streak || { currentStreak: 0, longestStreak: 0, lastCompletionDate: null });
          setTags(userData.tags || []);
          
          // After loading data, check if we need to rebuild progress
          if (userData.tasks && userData.tasks.length > 0 && userData.progress) {
            const updatedProgress = rebuildProgressData(userData.tasks, userData.progress);
            
            // If progress was updated, save it back to the database
            if (updatedProgress.length !== userData.progress.length) {
              console.log(`Progress data was updated: ${userData.progress.length} -> ${updatedProgress.length} entries`);
              setProgress(updatedProgress);
              
              // Save the updated progress
              await saveProgress(userId, updatedProgress);
            }
          }
          
          return true;
        } else {
          console.error("Error loading user data:", response.error);
          toast({
            title: "Error",
            description: `Error loading data: ${response.error}`,
            variant: "destructive",
          });
          return false;
        }
      } catch (error) {
        console.error("Exception while loading user data:", error);
        toast({
          title: "Error",
          description: "Failed to load your data. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    };

    if (user) {
      loadUserData(user.uid);
    } else {
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
    }
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

    console.log('Creating new task:', task);
    
    const newTasks = [...tasks, task];
    setTasks(newTasks);
    
    try {
      const result = await saveTasks(user.uid, newTasks);
      if (result.success) {
        toast({
          title: "Success",
          description: "Task created successfully",
        });
      } else {
        console.error('Failed to save task:', result.error);
        toast({
          title: "Error",
          description: "Failed to save task. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving task:', error);
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
    
    console.log('Updating task:', updatedTask);
    
    // Find the task to update
    const updatedTasks = tasks.map((task) =>
      task.id === updatedTask.id ? updatedTask : task
    );
    
    setTasks(updatedTasks);
    
    try {
      const result = await saveTasks(user.uid, updatedTasks);
      if (result.success) {
        // Only show toast for status changes
        if (updatedTask.status === "completed") {
          toast({
            title: "Success",
            description: "Task completed! Great job! 🎉",
          });
        }
      } else {
        console.error('Failed to update task:', result.error);
        toast({
          title: "Error",
          description: "Failed to update task. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
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
    
    console.log('Adding bookmark:', bookmark);
    
    const newBookmarks = [...bookmarks, bookmark];
    setBookmarks(newBookmarks);
    
    try {
      const result = await saveBookmarks(user.uid, newBookmarks);
      if (result.success) {
        toast({
          title: "Success",
          description: "Bookmark added successfully",
        });
      } else {
        console.error('Failed to save bookmark:', result.error);
        toast({
          title: "Error",
          description: "Failed to save bookmark. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving bookmark:', error);
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
