
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import TaskForm from "@/components/TaskForm";
import TaskList from "@/components/TaskList";
import Calendar from "@/components/Calendar";
import { Task, DailyProgress, StreakData, TaskTag } from "@/types/task";
import {
  loadTasks,
  saveTasks,
  loadProgress,
  saveProgress,
  loadStreak,
  saveStreak,
  loadTags,
  saveTags,
  generateId,
  getTodayDateString,
  updateStreak,
} from "@/utils/taskUtils";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  const { toast } = useToast();

  // Load data from localStorage on initial render
  useEffect(() => {
    const storedTasks = loadTasks();
    const storedProgress = loadProgress();
    const storedStreak = loadStreak();
    const storedTags = loadTags();

    setTasks(storedTasks);
    setProgress(storedProgress);
    setStreak(storedStreak);
    setTags(storedTags);

    // Resume active timers
    const now = Date.now();
    const updatedTasks = storedTasks.map(task => {
      if (task.isTimerActive && task.timerStartedAt) {
        // Calculate time elapsed since timer started
        const elapsedSeconds = Math.floor((now - task.timerStartedAt) / 1000);
        return {
          ...task,
          timeSpent: task.timeSpent + elapsedSeconds,
          timerStartedAt: now,
        };
      }
      return task;
    });

    if (JSON.stringify(updatedTasks) !== JSON.stringify(storedTasks)) {
      setTasks(updatedTasks);
      saveTasks(updatedTasks);
    }
  }, []);

  // Update daily progress
  useEffect(() => {
    updateDailyProgress();
  }, [tasks]);

  const updateDailyProgress = () => {
    const today = getTodayDateString();
    const todayTasks = tasks.filter(task => task.dueDate === today);
    
    if (todayTasks.length === 0) {
      return;
    }

    const completedTasks = todayTasks.filter(task => task.status === "completed");
    const completion = todayTasks.length > 0 ? completedTasks.length / todayTasks.length : 0;

    // Check if we already have progress for today
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
        },
      ];
    }

    setProgress(updatedProgress);
    saveProgress(updatedProgress);

    // Update streak
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

    const newStatus = task.status === "completed" ? "pending" : "completed";
    const updatedTasks = tasks.map(t =>
      t.id === taskId
        ? {
            ...t,
            status: newStatus,
            isTimerActive: newStatus === "completed" ? false : t.isTimerActive,
          }
        : t
    );

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

  const today = new Date();
  const formattedDate = format(today, "EEEE, MMMM d, yyyy");
  const todayString = getTodayDateString();
  const todayTasks = tasks.filter(task => task.dueDate === todayString);
  const todayCompleted = todayTasks.filter(task => task.status === "completed").length;
  const todayProgress = todayTasks.length > 0 ? (todayCompleted / todayTasks.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container px-4 py-8 max-w-6xl">
        <header className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2">Focus Flow</h1>
          <p className="text-muted-foreground">{formattedDate}</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Task list column */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            {todayTasks.length > 0 && (
              <Card className="animate-scale-in">
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

            <TaskForm onAddTask={handleAddTask} availableTags={tags} />
            
            <TaskList
              tasks={tasks}
              onUpdateTask={handleUpdateTask}
              onCompleteTask={handleCompleteTask}
              onDeleteTask={handleDeleteTask}
            />
          </div>

          {/* Calendar and stats column */}
          <div className="space-y-6">
            <Calendar progress={progress} streak={streak} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
