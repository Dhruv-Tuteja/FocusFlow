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
import { getUserData, saveTasks, saveProgress, saveStreak, saveBookmarks, saveTags } from "@/lib/firebase";
import { format } from "date-fns";

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

  // Load user data when user changes
  useEffect(() => {
    const loadUserData = async () => {
      // Log the current date at initialization
      const currentDate = getTodayDateString();
      console.log('Current date at app initialization:', currentDate);
      
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
        console.log('Loading user data from Firestore...');
        const result = await getUserData(user.uid);
        if (result.success && result.data) {
          console.log('User data loaded successfully:', result.data);

          // Set tasks
          const loadedTasks = result.data.tasks || [];
          console.log('Setting tasks:', loadedTasks.length);
          setTasks(loadedTasks);
          
          // Set progress
          const loadedProgress = result.data.progress || [];
          console.log('Setting progress:', loadedProgress.length);
          setProgress(loadedProgress);
          
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
          
          // Set bookmarks
          const loadedBookmarks = result.data.bookmarks || [];
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
    
    // If this is a new day, or no last date found, check for recurring tasks
    if (!lastUsedDate || lastUsedDate < today) {
      console.log('New day detected. Checking for recurring tasks...');
      
      // Filter tasks that recur today
      const recurringTasksDueToday = tasks.filter(task => 
        task.recurrence && 
        isTaskDueToday(task) && 
        task.dueDate !== today
      );
      
      console.log('Found recurring tasks due today:', recurringTasksDueToday.length);
      
      if (recurringTasksDueToday.length > 0) {
        // Create updated tasks with reset statuses for today
        const updatedTasks = [...tasks];
        
        recurringTasksDueToday.forEach(task => {
          // Create a new version of this task for today
          const resetTask: Task = {
            ...task,
            id: task.id, // Keep same ID to avoid duplicates
            dueDate: today,
            status: 'pending' // Reset status to pending
          };
          
          // Find task's index and update it
          const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
          if (taskIndex !== -1) {
            updatedTasks[taskIndex] = resetTask;
          }
        });
        
        // Update tasks in state and Firestore
        setTasks(updatedTasks);
        saveTasks(user.uid, updatedTasks);
        
        toast({
          title: "Tasks reset",
          description: `${recurringTasksDueToday.length} recurring tasks reset for today.`,
        });
      }
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
        console.log('Today\'s tasks:', todayTasks);
        
        // Create a progress entry even if there are no tasks
        // This ensures the activity graph shows data for every day the user logs in
        let completedTasks = todayTasks.filter(task => task.status === "completed");
        let completion = todayTasks.length > 0 ? completedTasks.length / todayTasks.length : 0;
        
        console.log('Completion calculation:', {
          completed: completedTasks.length,
          total: todayTasks.length,
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
                  tasksPlanned: todayTasks.length,
                  completion,
                  tasks: todayTasks,
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
              tasksPlanned: todayTasks.length || 0,
              completion,
              tasks: todayTasks,
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

  const handleAddTask = async (task: Task) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to add tasks.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log('Adding task:', task);
      const updatedTasks = [...tasks, task];
      
      // Update local state first
      setTasks(updatedTasks);
      
      // Then save to Firestore
      console.log('Saving tasks to Firestore...');
      const result = await saveTasks(user.uid, updatedTasks);
      console.log('Save result:', result);
      
      if (!result.success) {
        throw new Error('Failed to save task');
      }
      
      // Immediately update progress data for today after adding a task
      const today = getTodayDateString();
      const todayTasksAfterAdd = updatedTasks.filter(t => 
        t.dueDate === today || 
        (t.recurrence && isTaskDueToday(t))
      );
      const completedTasksAfterAdd = todayTasksAfterAdd.filter(t => t.status === "completed");
      const completionAfterAdd = todayTasksAfterAdd.length > 0 
        ? completedTasksAfterAdd.length / todayTasksAfterAdd.length 
        : 0;
      
      // Update today's progress in the progress array
      const existingProgressEntry = progress.find(p => p.date === today);
      let updatedProgress: DailyProgress[];
      
      if (existingProgressEntry) {
        updatedProgress = progress.map(p =>
          p.date === today
            ? {
                ...p,
                tasksCompleted: completedTasksAfterAdd.length,
                tasksPlanned: todayTasksAfterAdd.length,
                completion: completionAfterAdd,
                tasks: todayTasksAfterAdd,
              }
            : p
        );
      } else {
        updatedProgress = [
          ...progress,
          {
            date: today,
            tasksCompleted: completedTasksAfterAdd.length,
            tasksPlanned: todayTasksAfterAdd.length,
            completion: completionAfterAdd,
            tasks: todayTasksAfterAdd,
          },
        ];
      }
      
      // Update state and save to Firebase
      setProgress(updatedProgress);
      await saveProgress(user.uid, updatedProgress);
      
      // Update UI state variables directly
      setTodayTasks(todayTasksAfterAdd);
      setTodayCompleted(completedTasksAfterAdd.length);
      setTodayProgress(completionAfterAdd * 100);
      
      toast({
        title: "Task added",
        description: `"${task.title}" has been added to your tasks.`,
      });
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to save your task. Please try again.",
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

  const handleUpdateTask = async (updatedTask: Task) => {
    if (!user) return;
    
    try {
      console.log('Updating task:', updatedTask.id);
      
      // Check if the task is from a past date and not due today
      const taskToUpdate = tasks.find(t => t.id === updatedTask.id);
      const today = getTodayDateString();
      
      if (taskToUpdate && 
          taskToUpdate.dueDate < today && 
          !(taskToUpdate.recurrence && isTaskDueToday(taskToUpdate))) {
        console.log('Cannot edit tasks from past dates');
        toast({
          title: "Cannot edit",
          description: "Tasks from previous days cannot be edited.",
          variant: "destructive",
        });
        return;
      }
      
      const updatedTasks = tasks.map(task =>
        task.id === updatedTask.id ? updatedTask : task
      );
      
      setTasks(updatedTasks);
      const result = await saveTasks(user.uid, updatedTasks);
      if (!result.success) {
        throw new Error('Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update your task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!user) return;
    
    try {
      console.log('Completing task:', taskId);
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        console.error('Task not found:', taskId);
        return;
      }

      const today = getTodayDateString();
      
      // Check if the task is from a past date and not due today
      if (task.dueDate < today && !(task.recurrence && isTaskDueToday(task))) {
        console.log('Cannot update tasks from past dates');
        toast({
          title: "Cannot update",
          description: "Tasks from previous days cannot be modified.",
          variant: "destructive",
        });
        return;
      }

      const newStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";
      
      let updatedTasks = tasks.map(t =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
            }
          : t
      );
      
      if (newStatus === "completed" && task.recurrence && task.recurrence.pattern !== "once") {
        updatedTasks = updateRecurringTask(task, updatedTasks);
      }

      setTasks(updatedTasks);
      const result = await saveTasks(user.uid, updatedTasks);
      if (!result.success) {
        throw new Error('Failed to update task status');
      }

      // Immediately update progress data for today after completing a task
      const todayTasksAfterComplete = updatedTasks.filter(t => 
        t.dueDate === today || 
        (t.recurrence && isTaskDueToday(t))
      );
      const completedTasksAfterComplete = todayTasksAfterComplete.filter(t => t.status === "completed");
      const completionAfterComplete = todayTasksAfterComplete.length > 0 
        ? completedTasksAfterComplete.length / todayTasksAfterComplete.length 
        : 0;
      
      // Update today's progress in the progress array
      const existingProgressEntry = progress.find(p => p.date === today);
      let updatedProgress: DailyProgress[];
      
      if (existingProgressEntry) {
        updatedProgress = progress.map(p =>
          p.date === today
            ? {
                ...p,
                tasksCompleted: completedTasksAfterComplete.length,
                tasksPlanned: todayTasksAfterComplete.length,
                completion: completionAfterComplete,
                tasks: todayTasksAfterComplete,
              }
            : p
        );
      } else {
        updatedProgress = [
          ...progress,
          {
            date: today,
            tasksCompleted: completedTasksAfterComplete.length,
            tasksPlanned: todayTasksAfterComplete.length,
            completion: completionAfterComplete,
            tasks: todayTasksAfterComplete,
          },
        ];
      }
      
      // Update state and save to Firebase
      setProgress(updatedProgress);
      await saveProgress(user.uid, updatedProgress);
      
      // Update UI state variables directly
      setTodayTasks(todayTasksAfterComplete);
      setTodayCompleted(completedTasksAfterComplete.length);
      setTodayProgress(completionAfterComplete * 100);
      
      if (newStatus === "completed") {
        toast({
          title: "Task completed",
          description: `"${task.title}" has been marked as completed.`,
        });
      }
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: "Error",
        description: "Failed to update task status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    
    try {
      console.log('Deleting task:', taskId);
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        console.error('Task not found:', taskId);
        return;
      }

      const updatedTasks = tasks.filter(t => t.id !== taskId);
      
      setTasks(updatedTasks);
      const result = await saveTasks(user.uid, updatedTasks);
      if (!result.success) {
        throw new Error('Failed to delete task');
      }

      toast({
        title: "Task deleted",
        description: `"${task.title}" has been deleted.`,
        variant: "destructive",
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleBackToToday = () => {
    setSelectedDate(null);
  };

  const handleAddBookmark = async (bookmark: Bookmark) => {
    if (!user) return;
    
    try {
      console.log('Adding bookmark:', bookmark.title);
      const updatedBookmarks = [...bookmarks, bookmark];
      setBookmarks(updatedBookmarks);
      
      const result = await saveBookmarks(user.uid, updatedBookmarks);
      if (!result.success) {
        throw new Error('Failed to save bookmark');
      }
      
      toast({
        title: "Bookmark added",
        description: `"${bookmark.title}" has been added to your bookmarks.`,
      });
    } catch (error) {
      console.error('Error adding bookmark:', error);
      toast({
        title: "Error",
        description: "Failed to save your bookmark. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBookmark = async (bookmarkId: string) => {
    if (!user) return;
    
    try {
      console.log('Deleting bookmark:', bookmarkId);
      const bookmark = bookmarks.find(b => b.id === bookmarkId);
      if (!bookmark) {
        console.error('Bookmark not found:', bookmarkId);
        return;
      }
      
      const updatedBookmarks = bookmarks.filter(b => b.id !== bookmarkId);
      setBookmarks(updatedBookmarks);
      
      const result = await saveBookmarks(user.uid, updatedBookmarks);
      if (!result.success) {
        throw new Error('Failed to delete bookmark');
      }
      
      toast({
        title: "Bookmark deleted",
        description: "The bookmark has been removed.",
        variant: "destructive",
      });
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      toast({
        title: "Error",
        description: "Failed to delete bookmark. Please try again.",
        variant: "destructive",
      });
    }
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

        {/* Progress Card */}
        {user && (
          <Card className="animate-scale-in mb-6">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-medium">Today's Progress</CardTitle>
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{Math.round(todayProgress)}%</span>
                  <span className="text-sm text-muted-foreground">complete</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-full h-2 mb-1">
                <div 
                  className="bg-primary rounded-full h-2 transition-all duration-700 ease-out"
                  style={{ width: `${todayProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <div>
                  {todayCompleted} of {todayTasks.length} tasks completed
                </div>
                {todayCompleted === todayTasks.length && todayTasks.length > 0 && (
                  <div className="flex items-center gap-1 text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>All done for today!</span>
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
                onAddTask={handleAddTask} 
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
              onUpdateTask={handleUpdateTask}
              onCompleteTask={handleCompleteTask}
              onDeleteTask={handleDeleteTask}
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
