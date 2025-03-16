
import React, { useState, useEffect } from "react";
import TaskForm from "@/components/TaskForm";
import TaskList from "@/components/TaskList";
import Calendar from "@/components/Calendar";
import UserProfile from "@/components/UserProfile";
import BookmarkManager from "@/components/BookmarkManager";
import { Task, DailyProgress, StreakData, TaskTag, UserProfile as UserProfileType, TaskStatus, Bookmark } from "@/types/task";
import {
  loadTasks,
  saveTasks,
  loadProgress,
  saveProgress,
  loadStreak,
  saveStreak,
  loadTags,
  saveTags,
  loadProfiles,
  saveProfiles,
  loadUserProfile,
  saveUserProfile,
  loadBookmarks,
  saveBookmarks,
  generateId,
  getTodayDateString,
  updateStreak,
  updateRecurringTask,
  isTaskDueToday,
} from "@/utils/taskUtils";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<DailyProgress[]>([]);
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastCompletionDate: null,
  });
  const [tags, setTags] = useState<TaskTag[]>([]);
  const [profiles, setProfiles] = useState<UserProfileType[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfileType | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const { toast } = useToast();

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Load data from localStorage on initial render
  useEffect(() => {
    const storedTasks = loadTasks();
    const storedProgress = loadProgress();
    const storedStreak = loadStreak();
    const storedTags = loadTags();
    const storedProfiles = loadProfiles();
    const storedUser = loadUserProfile();
    const storedBookmarks = loadBookmarks();

    setTasks(storedTasks);
    setProgress(storedProgress);
    setStreak(storedStreak);
    setTags(storedTags);
    setProfiles(storedProfiles);
    setBookmarks(storedBookmarks);
    
    if (storedUser) {
      setCurrentUser(storedUser);
      setDarkMode(storedUser.darkMode);
    }
  }, []);

  // Update daily progress
  useEffect(() => {
    updateDailyProgress();
  }, [tasks]);

  const updateDailyProgress = () => {
    const today = getTodayDateString();
    const todayTasks = tasks.filter(task => 
      task.dueDate === today || 
      (task.recurrence && isTaskDueToday(task))
    );
    
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

    setProgress(updatedProgress);
    saveProgress(updatedProgress);

    const updatedStreak = updateStreak(updatedProgress, streak);
    setStreak(updatedStreak);
    saveStreak(updatedStreak);
  };

  const handleAddTask = (task: Task) => {
    const updatedTasks = [...tasks, task];
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    
    toast({
      title: "Task added",
      description: `"${task.title}" has been added to your tasks.`,
    });
  };

  const handleUpdateTask = (updatedTask: Task) => {
    const updatedTasks = tasks.map(task =>
      task.id === updatedTask.id ? updatedTask : task
    );
    setTasks(updatedTasks);
    saveTasks(updatedTasks);
  };

  const handleCompleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

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
    saveTasks(updatedTasks);

    if (newStatus === "completed") {
      toast({
        title: "Task completed",
        description: `"${task.title}" has been marked as completed.`,
      });
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTasks = tasks.filter(t => t.id !== taskId);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);

    toast({
      title: "Task deleted",
      description: `"${task.title}" has been deleted.`,
      variant: "destructive",
    });
  };

  const handleLogin = (profile: UserProfileType) => {
    setCurrentUser(profile);
    setDarkMode(profile.darkMode);
    saveUserProfile(profile);
    
    toast({
      title: "Welcome back",
      description: `Logged in as ${profile.name}`,
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("userProfile");
    
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
  };

  const handleCreateProfile = (profile: UserProfileType) => {
    const updatedProfiles = [...profiles, profile];
    setProfiles(updatedProfiles);
    saveProfiles(updatedProfiles);
    setCurrentUser(profile);
    saveUserProfile(profile);
    
    toast({
      title: "Profile created",
      description: `Welcome, ${profile.name}!`,
    });
  };

  const handleToggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (currentUser) {
      const updatedUser = { ...currentUser, darkMode: newDarkMode };
      setCurrentUser(updatedUser);
      saveUserProfile(updatedUser);
      
      const updatedProfiles = profiles.map(p => 
        p.id === currentUser.id ? updatedUser : p
      );
      setProfiles(updatedProfiles);
      saveProfiles(updatedProfiles);
    }
  };

  const handleDateSelect = (date: string, selectedTasks: Task[]) => {
    setSelectedDate(date);
  };

  const handleBackToToday = () => {
    setSelectedDate(null);
  };

  const handleAddBookmark = (bookmark: Bookmark) => {
    const updatedBookmarks = [...bookmarks, bookmark];
    setBookmarks(updatedBookmarks);
    saveBookmarks(updatedBookmarks);
  };

  const handleDeleteBookmark = (bookmarkId: string) => {
    const updatedBookmarks = bookmarks.filter(b => b.id !== bookmarkId);
    setBookmarks(updatedBookmarks);
    saveBookmarks(updatedBookmarks);
    
    toast({
      title: "Bookmark deleted",
      description: "The bookmark has been removed.",
      variant: "destructive",
    });
  };

  const todayString = getTodayDateString();
  const todayTasks = tasks.filter(task => 
    task.dueDate === todayString || 
    (task.recurrence && isTaskDueToday(task))
  );
  const todayCompleted = todayTasks.filter(task => task.status === "completed").length;
  const todayProgress = todayTasks.length > 0 ? (todayCompleted / todayTasks.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container px-4 py-8 max-w-6xl">
        <div className="flex items-start gap-8">
          <div className="w-64 hidden md:block">
            <BookmarkManager 
              bookmarks={bookmarks}
              onAddBookmark={handleAddBookmark}
              onDeleteBookmark={handleDeleteBookmark}
            />
          </div>
          
          <div className="flex-1">
            <div className="flex justify-between items-center mb-4">
              <div></div> {/* Empty div for spacing */}
              
              <div className="text-center">
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
              
              <UserProfile 
                currentUser={currentUser}
                profiles={profiles}
                darkMode={darkMode}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onCreateProfile={handleCreateProfile}
                onToggleDarkMode={handleToggleDarkMode}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Task list column */}
              <div className="col-span-1 md:col-span-3 md:order-2">
                {todayTasks.length > 0 && !selectedDate && (
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="col-span-1 md:col-span-2">
                    {!selectedDate && (
                      <TaskForm onAddTask={handleAddTask} availableTags={tags} />
                    )}
                    
                    <TaskList
                      tasks={tasks}
                      selectedDate={selectedDate || undefined}
                      onUpdateTask={handleUpdateTask}
                      onCompleteTask={handleCompleteTask}
                      onDeleteTask={handleDeleteTask}
                    />
                  </div>

                  {/* Calendar moved to right side, below bookmarks in the layout */}
                  <div className="col-span-1">
                    <Calendar 
                      progress={progress} 
                      streak={streak} 
                      onDateSelect={handleDateSelect}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile bookmarks */}
        <div className="block md:hidden mt-8">
          <BookmarkManager 
            bookmarks={bookmarks}
            onAddBookmark={handleAddBookmark}
            onDeleteBookmark={handleDeleteBookmark}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
