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
import { getUserData, saveTasks, saveProgress, saveStreak, saveBookmarks } from "@/lib/firebase";

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
  const [todayString, setTodayString] = useState(getTodayDateString());
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [todayProgress, setTodayProgress] = useState(0);

  // Load user data when user changes
  useEffect(() => {
    const loadUserData = async () => {
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
          setTags(loadedTags);
          
          // Set bookmarks
          const loadedBookmarks = result.data.bookmarks || [];
          setBookmarks(loadedBookmarks);
          
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
      
      setTodayString(todayString);
      setTodayTasks(filteredTasks);
      setTodayCompleted(completedTasks);
      setTodayProgress(progressPercentage);
    };

    calculateTodayProgress();
  }, [tasks]);

  // Update daily progress
  useEffect(() => {
    const updateDailyProgress = async () => {
      if (!user || tasks.length === 0) return;

      try {
        console.log('Updating daily progress...');
        const today = getTodayDateString();
        
        // Use the calculated todayTasks from the main component
        if (todayTasks.length === 0) {
          return;
        }

        const completedTasks = todayTasks.filter(task => task.status === "completed");
        const completion = todayTasks.length > 0 ? completedTasks.length / todayTasks.length : 0;

        const existingProgress = progress.find(p => p.date === today);
        let updatedProgress: DailyProgress[];

        if (existingProgress) {
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
          updatedProgress = [
            ...progress,
            {
              date: today,
              tasksCompleted: completedTasks.length,
              tasksPlanned: todayTasks.length,
              completion,
              tasks: todayTasks,
            },
          ];
        }

        console.log('Setting updated progress:', updatedProgress.length);
        setProgress(updatedProgress);
        await saveProgress(user.uid, updatedProgress);

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
      } catch (error) {
        console.error('Error updating daily progress:', error);
        toast({
          title: "Error",
          description: "Failed to update your progress. Please try again.",
          variant: "destructive",
        });
      }
    };

    updateDailyProgress();
  }, [user, tasks, todayTasks]);

  const handleAddTask = async (task: Task) => {
    if (!user) return;
    
    try {
      console.log('Adding task:', task.title);
      const updatedTasks = [...tasks, task];
      console.log('New task array length:', updatedTasks.length);
      
      // Update local state first
      setTasks(updatedTasks);
      
      // Then save to Firestore
      console.log('Saving tasks to Firestore...');
      const result = await saveTasks(user.uid, updatedTasks);
      console.log('Save result:', result);
      
      if (!result.success) {
        throw new Error('Failed to save task');
      }
      
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

  const handleUpdateTask = async (updatedTask: Task) => {
    if (!user) return;
    
    try {
      console.log('Updating task:', updatedTask.id);
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
        {user && todayTasks.length > 0 && !selectedDate && (
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
              <TaskForm onAddTask={handleAddTask} availableTags={tags} />
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
