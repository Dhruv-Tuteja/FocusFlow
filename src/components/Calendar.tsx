
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
    return progress.find((p) => p.date === dateString);
  };

  const getProgressGradientStyle = (completion: number) => {
    if (completion === 0) {
      return { background: 'linear-gradient(135deg, hsl(var(--task-empty)) 0%, hsl(0, 84%, 95%) 100%)' };
    }
    if (completion < 0.5) {
      return { background: 'linear-gradient(135deg, hsl(var(--task-low)) 0%, hsl(0, 84%, 75%) 100%)' };
    }
    if (completion < 1) {
      return { background: 'linear-gradient(135deg, hsl(var(--task-medium)) 0%, hsl(40, 100%, 75%) 100%)' };
    }
    return { background: 'linear-gradient(135deg, hsl(var(--task-high)) 0%, hsl(142, 76%, 55%) 100%)' };
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
            const style = dayProgress 
              ? getProgressGradientStyle(dayProgress.completion) 
              : { background: 'hsl(var(--muted))' };
              
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
              <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, hsl(var(--task-empty)) 0%, hsl(0, 84%, 95%) 100%)' }} />
              <span>No tasks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, hsl(var(--task-low)) 0%, hsl(0, 84%, 75%) 100%)' }} />
              <span>&lt; 50%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, hsl(var(--task-medium)) 0%, hsl(40, 100%, 75%) 100%)' }} />
              <span>&lt; 100%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, hsl(var(--task-high)) 0%, hsl(142, 76%, 55%) 100%)' }} />
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
