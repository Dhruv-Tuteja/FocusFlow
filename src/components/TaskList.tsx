
import React, { useState } from "react";
import { Check, Clock, Edit, Trash, Tag, MoreVertical } from "lucide-react";
import { Task } from "@/types/task";
import TaskTimer from "./TaskTimer";
import { formatTimeHoursMinutes } from "@/utils/taskUtils";
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

interface TaskListProps {
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
  onCompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onUpdateTask,
  onCompleteTask,
  onDeleteTask,
}) => {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const handleTimerToggle = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    onUpdateTask({
      ...task,
      isTimerActive: !task.isTimerActive,
      timerStartedAt: !task.isTimerActive ? Date.now() : undefined,
    });
  };

  const handleTimerTick = (taskId: string, seconds: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    onUpdateTask({
      ...task,
      timeSpent: seconds,
    });
  };

  const handleTimerReset = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    onUpdateTask({
      ...task,
      timeSpent: 0,
      isTimerActive: false,
      timerStartedAt: undefined,
    });
  };

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  const todayTasks = tasks.filter(
    (task) => task.status !== "completed" && new Date(task.dueDate) <= new Date()
  );
  
  const futureTasks = tasks.filter(
    (task) => task.status !== "completed" && new Date(task.dueDate) > new Date()
  );
  
  const completedTasks = tasks.filter(
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
                  <span className="text-sm text-muted-foreground flex items-center">
                    <Clock size={14} className="mr-1" />
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
        
        {isExpanded && (
          <div className="px-4 pb-4 pt-1 animate-slide-in">
            <div className="bg-muted/50 rounded-lg p-3">
              <TaskTimer
                isActive={task.isTimerActive}
                initialSeconds={task.timeSpent}
                onToggle={() => handleTimerToggle(task.id)}
                onReset={() => handleTimerReset(task.id)}
                onTick={(seconds) => handleTimerTick(task.id, seconds)}
              />
              
              {task.timeSpent > 0 && !task.isTimerActive && (
                <div className="text-sm text-muted-foreground mt-2">
                  Time logged: {formatTimeHoursMinutes(task.timeSpent)}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div>
      {renderTaskList(todayTasks, "Today")}
      {renderTaskList(futureTasks, "Upcoming")}
      {renderTaskList(completedTasks, "Completed")}
    </div>
  );
};

export default TaskList;
