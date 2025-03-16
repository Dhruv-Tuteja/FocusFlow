import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { getUserData } from '@/lib/firebase';
import { Task, DailyProgress, StreakData, TaskTag } from '@/types/task';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart, 
  Calendar, 
  CheckCircle2, 
  Target, 
  Home, 
  PieChart, 
  TrendingUp, 
  Clock, 
  Tag,
  Activity,
  CheckCheck,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<{
    tasks: Task[];
    progress: DailyProgress[];
    streak: StreakData;
    tags: TaskTag[];
  } | null>(null);

  // Current month for the monthly view
  const [currentMonth] = useState(new Date());

  useEffect(() => {
    const loadUserData = async () => {
      if (!user) {
        navigate('/');
        return;
      }

      try {
        setIsLoading(true);
        const result = await getUserData(user.uid);
        if (result.success && result.data) {
          setUserData({
            tasks: result.data.tasks || [],
            progress: result.data.progress || [],
            streak: result.data.streak || {
              currentStreak: 0,
              longestStreak: 0,
              lastCompletionDate: null,
            },
            tags: result.data.tags || [],
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to load profile data",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [user, navigate, toast]);

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="text-center">Loading profile data...</div>
      </div>
    );
  }

  // Calculate basic statistics
  const totalTasks = userData?.tasks.length || 0;
  const completedTasks = userData?.tasks.filter(task => task.status === 'completed').length || 0;
  const pendingTasks = userData?.tasks.filter(task => task.status === 'pending').length || 0;
  const inProgressTasks = userData?.tasks.filter(task => task.status === 'in-progress').length || 0;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Last 7 days progress
  const last7Days = [...Array(7)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  const dailyProgress = last7Days.map(date => {
    const dayProgress = userData?.progress.find(p => p.date === date);
    return {
      date,
      completion: dayProgress?.completion || 0,
      tasksCompleted: dayProgress?.tasksCompleted || 0,
      tasksPlanned: dayProgress?.tasksPlanned || 0,
    };
  });

  // Calculate category distribution
  const tasksByTag = userData?.tasks.reduce((acc: Record<string, number>, task) => {
    task.tags.forEach(tag => {
      acc[tag.name] = (acc[tag.name] || 0) + 1;
    });
    return acc;
  }, {}) || {};

  // Most productive day of the week
  const dayProductivity = userData?.progress.reduce((acc: Record<string, { completed: number, total: number }>, day) => {
    if (day.date && day.tasksCompleted > 0) {
      const dayOfWeek = format(parseISO(day.date), 'EEEE');
      if (!acc[dayOfWeek]) {
        acc[dayOfWeek] = { completed: 0, total: 0 };
      }
      acc[dayOfWeek].completed += day.tasksCompleted;
      acc[dayOfWeek].total += day.tasksPlanned;
    }
    return acc;
  }, {}) || {};

  const mostProductiveDay = Object.entries(dayProductivity).sort((a, b) => {
    return b[1].completed - a[1].completed;
  })[0]?.[0] || 'No data yet';

  // Monthly calendar data
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Weekly activity heatmap data (0-6, Sunday to Saturday)
  const weekdayDistribution = [0, 0, 0, 0, 0, 0, 0]; // Initialize counts for each day
  
  userData?.progress.forEach(day => {
    if (day.date && day.completion > 0) {
      const date = parseISO(day.date);
      const dayOfWeek = getDay(date); // 0 is Sunday, 6 is Saturday
      weekdayDistribution[dayOfWeek] += 1;
    }
  });
  
  // Total weekly activity
  const totalWeeklyActivity = weekdayDistribution.reduce((sum, count) => sum + count, 0);
  
  // Most active day of the week
  const mostActiveDayIndex = weekdayDistribution.indexOf(Math.max(...weekdayDistribution));
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mostActiveDay = totalWeeklyActivity > 0 ? dayNames[mostActiveDayIndex] : 'No data yet';

  // Estimated time saved (assuming each task takes 30 minutes on average)
  const timeInMinutes = completedTasks * 30;
  const hours = Math.floor(timeInMinutes / 60);
  const minutes = timeInMinutes % 60;
  const timeSaved = `${hours}h ${minutes}m`;

  // Calculate completion trend over time
  const last30Days = [...Array(30)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  // Calculate moving average of completion rate
  const completionTrend = last30Days.map(date => {
    const dayProgress = userData?.progress.find(p => p.date === date);
    return {
      date,
      value: dayProgress?.completion || 0
    };
  });

  // Trend direction (improving or declining)
  const recentCompletionAvg = completionTrend.slice(-7).reduce((sum, day) => sum + day.value, 0) / 7;
  const previousCompletionAvg = completionTrend.slice(-14, -7).reduce((sum, day) => sum + day.value, 0) / 7;
  const improvementRate = previousCompletionAvg > 0 
    ? ((recentCompletionAvg - previousCompletionAvg) / previousCompletionAvg) * 100 
    : 0;
  const trendDirection = improvementRate >= 0 ? 'improving' : 'declining';

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Profile Statistics</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Return to Home
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Total Tasks Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedTasks} completed ({Math.round(completionRate)}%)
            </p>
            <div className="mt-3 grid grid-cols-3 gap-1 text-xs">
              <div className="flex flex-col items-center p-1 rounded-md bg-muted/50">
                <span className="text-primary font-semibold">{completedTasks}</span>
                <span className="text-muted-foreground">Done</span>
              </div>
              <div className="flex flex-col items-center p-1 rounded-md bg-muted/50">
                <span className="text-amber-500 font-semibold">{inProgressTasks}</span>
                <span className="text-muted-foreground">Active</span>
              </div>
              <div className="flex flex-col items-center p-1 rounded-md bg-muted/50">
                <span className="text-gray-500 font-semibold">{pendingTasks}</span>
                <span className="text-muted-foreground">Pending</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streak Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userData?.streak.currentStreak || 0} days</div>
            <p className="text-xs text-muted-foreground mt-1">
              Longest: {userData?.streak.longestStreak || 0} days
            </p>
            <div className="mt-3 text-sm">
              <div className="flex items-center">
                <Activity className="h-3.5 w-3.5 text-primary mr-1" />
                <span className="text-xs">
                  Most active on <span className="font-medium">{mostActiveDay}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time Saved Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timeSaved}</div>
            <p className="text-xs text-muted-foreground mt-1">
              By completing {completedTasks} tasks
            </p>
            <div className="mt-3 text-sm">
              <div className="flex items-center">
                <CheckCheck className="h-3.5 w-3.5 text-green-500 mr-1" />
                <span className="text-xs">
                  Most productive: <span className="font-medium">{mostProductiveDay}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Productivity Trend Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Productivity Trend</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.abs(Math.round(improvementRate))}% 
              <span className={improvementRate >= 0 ? "text-green-500" : "text-red-500"}>
                {improvementRate >= 0 ? " ↑" : " ↓"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your productivity is {trendDirection}
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs">
              <CalendarIcon className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Based on last 14 days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Weekly Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Progress</CardTitle>
            <CardDescription>Your task completion over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dailyProgress.map((day) => (
                <div key={day.date} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      {format(parseISO(day.date), 'EEE, MMM d')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {Math.round(day.completion * 100)}% ({day.tasksCompleted}/{day.tasksPlanned})
                    </div>
                  </div>
                  <div className="bg-muted/50 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        day.completion === 1 ? 'bg-green-500' :
                        day.completion > 0.5 ? 'bg-amber-500' :
                        day.completion > 0 ? 'bg-red-500' : 'bg-muted'
                      }`}
                      style={{ width: `${Math.max(day.completion * 100, 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Task Categories Card */}
        <Card>
          <CardHeader>
            <CardTitle>Task Categories</CardTitle>
            <CardDescription>Distribution of tasks by category</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(tasksByTag).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(tasksByTag)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tag, count]) => {
                    const tagObj = userData?.tags.find(t => t.name === tag);
                    const percentage = Math.round((count / totalTasks) * 100);
                    return (
                      <div key={tag} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div 
                              className="w-3 h-3 rounded-full mr-2" 
                              style={{ backgroundColor: tagObj?.color || '#888' }}
                            />
                            <span className="text-sm font-medium">{tag}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {count} tasks ({percentage}%)
                          </div>
                        </div>
                        <div className="bg-muted/50 h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-2 rounded-full transition-all"
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: tagObj?.color || '#888'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                <Tag className="h-8 w-8 mb-2" />
                <p>No category data available</p>
                <p className="text-xs mt-1">Add tags to your tasks to see statistics</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Activity Calendar */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Activity Calendar</CardTitle>
          <CardDescription>
            {format(currentMonth, 'MMMM yyyy')} - Task completion by day
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-sm mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="font-medium text-xs text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {/* Add empty cells for start of month */}
            {Array(getDay(monthStart)).fill(null).map((_, index) => (
              <div key={`empty-start-${index}`} className="aspect-square" />
            ))}
            
            {/* Calendar days */}
            {monthDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayProgress = userData?.progress.find(p => p.date === dateStr);
              const completion = dayProgress?.completion || 0;
              
              // Determine cell background color based on completion
              let cellStyle = "bg-muted";
              if (completion > 0) {
                if (completion < 0.5) cellStyle = "bg-red-200 dark:bg-red-900";
                else if (completion < 1) cellStyle = "bg-amber-200 dark:bg-amber-900";
                else cellStyle = "bg-green-200 dark:bg-green-900";
              }
              
              return (
                <div 
                  key={dateStr} 
                  className={`aspect-square rounded-md flex items-center justify-center text-xs ${cellStyle}`}
                  title={`${format(day, 'MMM d')}: ${Math.round(completion * 100)}% complete`}
                >
                  {format(day, 'd')}
                </div>
              );
            })}
          </div>

          <div className="flex justify-center items-center gap-4 mt-4 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-sm bg-muted mr-1" />
              <span>None</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900 mr-1" />
              <span>&lt;50%</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-sm bg-amber-200 dark:bg-amber-900 mr-1" />
              <span>&lt;100%</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900 mr-1" />
              <span>Complete</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile; 