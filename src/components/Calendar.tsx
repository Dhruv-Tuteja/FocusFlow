import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { DailyProgress, StreakData, Task } from "@/types/task";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

interface CalendarProps {
  progress: DailyProgress[];
  streak: StreakData;
  onDateSelect: (date: string, tasks: Task[]) => void;
}

const Calendar: React.FC<CalendarProps> = ({ progress, streak, onDateSelect }) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const nextMonth = () => {
    setCurrentMonth((prevMonth) => {
      const next = new Date(prevMonth);
      next.setMonth(next.getMonth() + 1);
      return next;
    });
  };

  const prevMonth = () => {
    setCurrentMonth((prevMonth) => {
      const prev = new Date(prevMonth);
      prev.setMonth(prev.getMonth() - 1);
      return prev;
    });
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Add empty cells for the start of the month
  const firstDayOfMonth = monthStart.getDay();
  const emptyStartCells = Array(firstDayOfMonth).fill(null);

  const findProgressForDay = (day: Date): DailyProgress | undefined => {
    const dateString = format(day, "yyyy-MM-dd");
    const foundProgress = progress.find((p) => p.date === dateString);
    
    // Log all progress items to help debug
    if (foundProgress) {
      console.log(`Calendar found progress for ${dateString}:`, {
        completion: foundProgress.completion,
        tasksCompleted: foundProgress.tasksCompleted,
        tasksPlanned: foundProgress.tasksPlanned,
        completionPercent: Math.round(foundProgress.completion * 100)
      });
    }
    
    return foundProgress;
  };

  // Enhanced gradient style function with better color support
  const getProgressGradientStyle = (completion: number) => {
    console.log(`Getting gradient style for completion value: ${completion}`);
    
    // Ensure completion is a number between 0 and 1
    if (typeof completion !== 'number' || isNaN(completion)) {
      console.warn('Invalid completion value:', completion);
      completion = 0;
    }
    
    completion = Math.max(0, Math.min(1, completion));
    
    // Log specific color stops for debugging
    if (completion === 0) {
      console.log('Using empty task color style');
      return { background: 'hsl(var(--task-empty))' };
    }
    if (completion < 0.5) {
      console.log('Using low completion color style');
      return { background: 'hsl(var(--task-low))' };
    }
    if (completion < 1) {
      console.log('Using medium completion color style');
      return { background: 'hsl(var(--task-medium))' };
    }
    
    console.log('Using high (full) completion color style');
    return { background: 'hsl(var(--task-high))' };
  };

  const handleDateClick = (dateString: string, dayProgress?: DailyProgress) => {
    if (dayProgress) {
      onDateSelect(dateString, dayProgress.tasks || []);
    } else {
      onDateSelect(dateString, []);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium">Activity Graph</CardTitle>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Flame className="h-5 w-5 text-amber-500" />
              <span className="font-semibold text-lg">{streak.currentStreak}</span>
              <span className="text-xs text-muted-foreground">day streak</span>
            </div>
            
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={prevMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={nextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground mt-1">
          {format(currentMonth, "MMMM yyyy")}
        </p>
      </CardHeader>
      
      <CardContent className="pt-2">
        <div className="grid grid-cols-7 gap-1 text-center text-sm mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="font-medium text-xs text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {emptyStartCells.map((_, index) => (
            <div key={`empty-start-${index}`} className="aspect-square" />
          ))}

          {monthDays.map((day) => {
            const dayProgress = findProgressForDay(day);
            const dateString = format(day, "yyyy-MM-dd");
            
            // Default style for days with no progress data
            let style = { background: 'hsl(var(--muted))' };
            
            // If we have progress data, use it to determine the color
            if (dayProgress) {
              // Check if the completion value is present and valid
              if (dayProgress.completion !== undefined && !isNaN(dayProgress.completion)) {
                style = getProgressGradientStyle(dayProgress.completion);
                console.log(`Applied style for ${dateString} with completion ${dayProgress.completion}:`, style);
              } else {
                console.warn(`Invalid completion value for ${dateString}:`, dayProgress.completion);
              }
            }
            
            return (
              <TooltipProvider key={dateString}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className={cn(
                        "aspect-square rounded-md flex items-center justify-center text-xs day-cell cursor-pointer",
                      )}
                      style={style}
                      onClick={() => handleDateClick(dateString, dayProgress)}
                    >
                      {format(day, "d")}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-medium">{format(day, "MMMM d, yyyy")}</div>
                      {dayProgress ? (
                        <div className="mt-1">
                          <div>
                            Completed {dayProgress.tasksCompleted} of {dayProgress.tasksPlanned} tasks
                          </div>
                          <div>
                            {Math.round(dayProgress.completion * 100)}% completion
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1">No activity recorded</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
        
        <div className="flex justify-between mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(var(--task-empty))' }} />
              <span>No tasks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(var(--task-low))' }} />
              <span>&lt; 50%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(var(--task-medium))' }} />
              <span>&lt; 100%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(var(--task-high))' }} />
              <span>All tasks</span>
            </div>
          </div>
          
          {streak.longestStreak > 0 && (
            <div className="text-xs">
              Longest streak: <span className="font-medium">{streak.longestStreak}</span> days
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Calendar;
