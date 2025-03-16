import React, { useState, useEffect } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/utils/taskUtils";

interface TaskTimerProps {
  isActive: boolean;
  initialSeconds: number;
  onToggle: () => void;
  onReset: () => void;
  onTick: (seconds: number) => void;
}

const TaskTimer: React.FC<TaskTimerProps> = ({
  isActive,
  initialSeconds,
  onToggle,
  onReset,
  onTick,
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      interval = setInterval(() => {
        setSeconds((prevSeconds) => {
          const newSeconds = prevSeconds + 1;
          onTick(newSeconds);
          return newSeconds;
        });
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, onTick]);

  const handleReset = () => {
    onReset();
    setSeconds(0);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 text-xl font-mono font-medium">
        {formatTime(seconds)}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={onToggle}
      >
        {isActive ? <Pause size={16} /> : <Play size={16} />}
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handleReset}
        disabled={seconds === 0}
      >
        <RotateCcw size={16} />
      </Button>
    </div>
  );
};

export default TaskTimer;
