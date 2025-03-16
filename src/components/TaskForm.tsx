
import React, { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X, Plus, Tag, Repeat } from "lucide-react";
import { Task, TaskTag, RecurrencePattern, WeekDay } from "@/types/task";
import { generateId } from "@/utils/taskUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

interface TaskFormProps {
  onAddTask: (task: Task) => void;
  availableTags: TaskTag[];
}

const TaskForm: React.FC<TaskFormProps> = ({ onAddTask, availableTags }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<TaskTag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  // Scheduling states
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>("once");
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [selectedWeekDays, setSelectedWeekDays] = useState<WeekDay[]>([]);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const weekdays: { name: WeekDay; label: string }[] = [
    { name: "monday", label: "Monday" },
    { name: "tuesday", label: "Tuesday" },
    { name: "wednesday", label: "Wednesday" },
    { name: "thursday", label: "Thursday" },
    { name: "friday", label: "Friday" },
    { name: "saturday", label: "Saturday" },
    { name: "sunday", label: "Sunday" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;
    
    const newTask: Task = {
      id: generateId(),
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: format(dueDate, "yyyy-MM-dd"),
      estimatedMinutes: estimatedMinutes || undefined,
      status: "pending",
      tags: [...selectedTags],
    };
    
    // Add recurrence information if not a one-time task
    if (recurrencePattern !== "once") {
      newTask.recurrence = {
        pattern: recurrencePattern,
        // Only include weekDays for weekly recurrence
        ...(recurrencePattern === "weekly" && { weekDays: selectedWeekDays }),
        // Include end date if set
        ...(endDate && { endDate: format(endDate, "yyyy-MM-dd") }),
      };
    }
    
    onAddTask(newTask);
    resetForm();
    setIsOpen(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate(new Date());
    setEstimatedMinutes(0);
    setSelectedTags([]);
    setRecurrencePattern("once");
    setShowRecurrenceOptions(false);
    setSelectedWeekDays([]);
    setEndDate(undefined);
  };

  const addTag = (tag: TaskTag) => {
    if (!selectedTags.some(t => t.id === tag.id)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const removeTag = (tagId: string) => {
    setSelectedTags(selectedTags.filter(tag => tag.id !== tagId));
  };

  const toggleWeekDay = (day: WeekDay) => {
    if (selectedWeekDays.includes(day)) {
      setSelectedWeekDays(selectedWeekDays.filter(d => d !== day));
    } else {
      setSelectedWeekDays([...selectedWeekDays, day]);
    }
  };

  return (
    <div className="mb-6">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-2 py-6 animate-fade-in"
          variant="outline"
        >
          <Plus size={18} />
          <span>Add New Task</span>
        </Button>
      ) : (
        <div className="bg-card rounded-lg p-4 shadow-sm border animate-scale-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Create New Task</h3>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsOpen(false)}
              className="h-8 w-8"
            >
              <X size={16} />
            </Button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full"
                required
              />
            </div>
            
            <div>
              <Textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-none"
                rows={2}
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(date) => setDueDate(date || new Date())}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Input
                  type="number"
                  placeholder="Estimated minutes"
                  value={estimatedMinutes || ""}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                  min={0}
                  className="w-full"
                />
              </div>
              
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex gap-2">
                      <Tag size={15} />
                      <span>Tags</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {availableTags.map(tag => (
                      <DropdownMenuItem
                        key={tag.id}
                        onClick={() => addTag(tag)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span>{tag.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex gap-2"
                  onClick={() => setShowRecurrenceOptions(!showRecurrenceOptions)}
                >
                  <Repeat size={15} />
                  <span>Schedule</span>
                </Button>
              </div>
            </div>
            
            {showRecurrenceOptions && (
              <div className="p-3 border rounded-md bg-background/50">
                <div className="mb-3">
                  <label className="text-sm font-medium mb-1 block">Recurrence</label>
                  <Select 
                    value={recurrencePattern} 
                    onValueChange={(value) => setRecurrencePattern(value as RecurrencePattern)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">One-time task</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {recurrencePattern === "weekly" && (
                  <div className="mb-3">
                    <label className="text-sm font-medium mb-2 block">Repeat on</label>
                    <div className="flex flex-wrap gap-2">
                      {weekdays.map((day) => (
                        <div key={day.name} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`day-${day.name}`}
                            checked={selectedWeekDays.includes(day.name)}
                            onCheckedChange={() => toggleWeekDay(day.name)}
                          />
                          <label 
                            htmlFor={`day-${day.name}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {day.label.slice(0, 3)}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {recurrencePattern !== "once" && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">End date (optional)</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP") : "No end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setEndDate(undefined)}
                            className="mb-2"
                          >
                            Clear end date
                          </Button>
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                            disabled={(date) => date < new Date()}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            )}
            
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map(tag => (
                  <Badge 
                    key={tag.id} 
                    className="flex items-center gap-1 px-2 py-1"
                    style={{ backgroundColor: tag.color, color: 'white' }}
                  >
                    {tag.name}
                    <X 
                      size={12} 
                      className="cursor-pointer opacity-70 hover:opacity-100" 
                      onClick={() => removeTag(tag.id)}
                    />
                  </Badge>
                ))}
              </div>
            )}
            
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add Task</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default TaskForm;
