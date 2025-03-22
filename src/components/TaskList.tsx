import React, { useState } from "react";
import { Check, Edit, Trash, Tag, MoreVertical } from "lucide-react";
import { Task } from "@/types/task";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getTodayDateString, isTaskDueToday } from "@/utils/taskUtils";

interface TaskListProps {
  tasks: Task[];
  selectedDate?: string;
  onUpdateTask: (task: Task) => void;
  onCompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  selectedDate,
  onUpdateTask,
  onCompleteTask,
  onDeleteTask,
}) => {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  const today = getTodayDateString();
  
  // Filter tasks based on selected date if provided, or show only current/future tasks
  const displayTasks = selectedDate
    ? tasks.filter(task => task.dueDate === selectedDate)
    : tasks.filter(task => {
        // Show task if:
        // 1. It's due today or in the future, OR
        // 2. It's a recurring task that is due today
        return (
          task.dueDate >= today || 
          (task.recurrence && isTaskDueToday(task))
        );
      });

  const todayTasks = displayTasks.filter(
    (task) => {
      // For today tasks, show both exact matches for today and recurring tasks due today
      if (selectedDate) {
        return task.status !== "completed" && new Date(task.dueDate) <= new Date();
      } else {
        return (
          task.status !== "completed" && 
          (task.dueDate === today || (task.recurrence && isTaskDueToday(task)))
        );
      }
    }
  );
  
  const futureTasks = displayTasks.filter(
    (task) => task.status !== "completed" && task.dueDate > today
  );
  
  const completedTasks = displayTasks.filter(
    (task) => task.status === "completed"
  );

  const renderTaskList = (taskGroup: Task[], title: string) => {
    if (taskGroup.length === 0) return null;
    
    return (
      <div className="mb-6">
        <h2 className="text-lg font-medium mb-3">{title}</h2>
        <div className="space-y-2">
          {taskGroup.map(task => renderTask(task))}
        </div>
      </div>
    );
  };

  const renderTask = (task: Task) => {
    const isExpanded = expandedTaskId === task.id;
    const isCompleted = task.status === "completed";

    return (
      <Card 
        key={task.id} 
        className={cn(
          "overflow-hidden transition-all duration-300 card-hover",
          isCompleted ? "opacity-70" : ""
        )}
      >
        <div className="flex items-start p-4">
          <div className="flex items-center h-6 mr-4">
            <Checkbox 
              checked={isCompleted}
              onCheckedChange={() => onCompleteTask(task.id)}
              className="transition-all duration-300"
            />
          </div>
          
          <div 
            className="flex-1 cursor-pointer" 
            onClick={() => toggleTaskExpand(task.id)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 
                  className={cn(
                    "font-medium text-base",
                    isCompleted ? "line-through text-muted-foreground" : ""
                  )}
                >
                  {task.title}
                </h3>
                
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                    {task.description}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {task.estimatedMinutes && (
                  <span className="text-sm text-muted-foreground">
                    {task.estimatedMinutes}m
                  </span>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onCompleteTask(task.id)}>
                      <Check className="mr-2 h-4 w-4" />
                      <span>{isCompleted ? "Mark Incomplete" : "Mark Complete"}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDeleteTask(task.id)}>
                      <Trash className="mr-2 h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {task.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    className="px-2 py-0.5 text-xs"
                    style={{ backgroundColor: tag.color, color: "white" }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div>
      {selectedDate && (
        <h2 className="text-xl font-bold mb-4">
          Tasks for {format(new Date(selectedDate), "MMMM d, yyyy")}
        </h2>
      )}
      {renderTaskList(todayTasks, selectedDate ? "Incomplete" : "Today")}
      {!selectedDate && renderTaskList(futureTasks, "Upcoming")}
      {renderTaskList(completedTasks, "Completed")}
      {displayTasks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {selectedDate ? "No tasks for this date" : "No tasks available"}
        </div>
      )}
    </div>
  );
};

// Helper function to format date
function format(date: Date, formatStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

export default TaskList;
