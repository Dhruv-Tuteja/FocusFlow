import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { getUserData } from '@/lib/firebase';
import { Task, DailyProgress, StreakData } from '@/types/task';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Calendar, CheckCircle2, Target } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<{
    tasks: Task[];
    progress: DailyProgress[];
    streak: StreakData;
  } | null>(null);

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

  const totalTasks = userData?.tasks.length || 0;
  const completedTasks = userData?.tasks.filter(task => task.status === 'completed').length || 0;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

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

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Profile Statistics</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Total Tasks Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              {completedTasks} completed ({Math.round(completionRate)}%)
            </p>
          </CardContent>
        </Card>

        {/* Current Streak Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userData?.streak.currentStreak || 0}</div>
            <p className="text-xs text-muted-foreground">
              Longest: {userData?.streak.longestStreak || 0} days
            </p>
          </CardContent>
        </Card>

        {/* Weekly Progress Card */}
        <Card className="col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Weekly Progress</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dailyProgress.map((day) => (
                <div key={day.date} className="flex items-center gap-2">
                  <div className="w-12 text-xs text-muted-foreground">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="flex-1">
                    <div className="bg-muted/50 h-2 rounded-full">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${day.completion * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-xs text-muted-foreground text-right">
                    {day.tasksCompleted}/{day.tasksPlanned}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <Calendar className="h-8 w-8" />
            <span className="ml-2">Calendar view coming soon</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile; 