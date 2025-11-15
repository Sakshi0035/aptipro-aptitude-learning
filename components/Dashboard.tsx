import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AppContexts';
import { supabase } from '../services/supabase';
import { TestResult } from '../types';
import { BrainCircuitIcon, BarChartIcon, AwardIcon } from './Icons';
import DatabaseSetupInstructions from './DatabaseSetupInstructions';

interface WeeklyProgress {
    name: string;
    score: number;
}

interface TopicPerformance {
    topic: string;
    score: number;
    fullMark: number;
}

interface MonthlyActivity {
    day: string;
    xp: number;
}

const Dashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const [weeklyData, setWeeklyData] = useState<WeeklyProgress[]>([]);
  const [suggestedTopic, setSuggestedTopic] = useState<{ name: string; key: string } | null>(null);
  const [topicPerformance, setTopicPerformance] = useState<TopicPerformance[]>([]);
  const [monthlyActivity, setMonthlyActivity] = useState<MonthlyActivity[]>([]);
  const [totalMonthlyXp, setTotalMonthlyXp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
        if (!user) return;

        setLoading(true);
        setFetchError(null);
        
        try {
            // Fetch all test results for the user
            const { data: results, error } = await supabase
                .from('test_results')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
    
            if (error) throw error;
            
            if (results) {
                processWeeklyData(results);
                processSuggestions(results);
                processTopicPerformance(results);
                processMonthlyActivity(results);
            }
        } catch (err: unknown) {
            let message: string;
            if (err && typeof err === 'object' && 'message' in err) {
                message = String((err as { message: unknown }).message);
            } else if (err instanceof Error) {
                message = err.message;
            } else if (typeof err === 'string') {
                message = err;
            } else {
                message = "An unexpected error occurred while loading dashboard data.";
            }
            console.error("Error fetching dashboard data:", err);
            setFetchError(message);
        } finally {
            setLoading(false);
        }
    };

    const processWeeklyData = (results: TestResult[]) => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const weeklyResults = results.filter(r => new Date(r.created_at) > sevenDaysAgo);

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dailyScores: { [key: string]: number } = {};
        
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dailyScores[days[d.getDay()]] = 0;
        }

        weeklyResults.forEach(result => {
            const dayName = days[new Date(result.created_at).getDay()];
            dailyScores[dayName] += result.score * 100;
        });

        const chartData = Object.keys(dailyScores).map(day => ({ name: day, score: dailyScores[day] })).reverse();
        
        const todayIndex = new Date().getDay();
        const orderedDays = [...days.slice(todayIndex + 1), ...days.slice(0, todayIndex + 1)];
        chartData.sort((a, b) => orderedDays.indexOf(a.name) - orderedDays.indexOf(b.name));

        setWeeklyData(chartData);
    };
    
    const processSuggestions = (results: TestResult[]) => {
        if (results.length === 0) {
            setSuggestedTopic({ name: "Let's get started!", key: ''});
            return;
        }

        const topicPerformanceMap: { [key: string]: { correct: number; total: number } } = {};
        results.forEach(r => {
            if (!topicPerformanceMap[r.topic]) topicPerformanceMap[r.topic] = { correct: 0, total: 0 };
            topicPerformanceMap[r.topic].correct += r.score;
            topicPerformanceMap[r.topic].total += r.total_questions;
        });

        let worstTopic: string | null = null;
        let lowestAccuracy = 101;

        for (const topic in topicPerformanceMap) {
            const accuracy = (topicPerformanceMap[topic].correct / topicPerformanceMap[topic].total) * 100;
            if (accuracy < lowestAccuracy) {
                lowestAccuracy = accuracy;
                worstTopic = topic;
            }
        }
        
        if (worstTopic) {
            setSuggestedTopic({ name: worstTopic, key: worstTopic.toLowerCase().replace(/\s+/g, '-') });
        }
    };

    const processTopicPerformance = (results: TestResult[]) => {
        const performance: { [key: string]: { correct: number; total: number } } = {};
        results.forEach(r => {
            if (!performance[r.topic]) {
                performance[r.topic] = { correct: 0, total: 0 };
            }
            performance[r.topic].correct += r.score;
            performance[r.topic].total += r.total_questions;
        });

        const chartData = Object.keys(performance).map(topic => ({
            topic: topic,
            score: (performance[topic].correct / performance[topic].total) * 100,
            fullMark: 100
        }));
        setTopicPerformance(chartData);
    };

    const processMonthlyActivity = (results: TestResult[]) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const monthlyResults = results.filter(r => {
            const resultDate = new Date(r.created_at);
            return resultDate.getFullYear() === year && resultDate.getMonth() === month;
        });

        const dailyXP = Array.from({ length: daysInMonth }, (_, i) => ({
            day: (i + 1).toString(),
            xp: 0
        }));

        let totalXp = 0;
        monthlyResults.forEach(r => {
            const dayOfMonth = new Date(r.created_at).getDate();
            const xpGained = r.score * 100;
            dailyXP[dayOfMonth - 1].xp += xpGained;
            totalXp += xpGained;
        });
        
        setMonthlyActivity(dailyXP);
        setTotalMonthlyXp(totalXp);
    };

    fetchData();
  }, [user]);

  const renderSuggestion = () => {
    if (loading) return <p className="mt-2 opacity-90">Analyzing your performance...</p>;
    if (!suggestedTopic) return <p className="mt-2 opacity-90">Complete tests to get suggestions!</p>;
    if (suggestedTopic.key === '') {
        return (
            <>
              <p className="mt-2 opacity-90">Ready to test your skills? Pick a topic.</p>
              <p className="text-2xl font-bold mt-4">{suggestedTopic.name}</p>
            </>
        )
    }
    return (
        <>
            <p className="mt-2 opacity-90">Based on your recent performance, we recommend focusing on:</p>
            <p className="text-2xl font-bold mt-4">{suggestedTopic.name}</p>
        </>
    )
  }

  const SimpleBarChart = ({ data }: { data: WeeklyProgress[] }) => {
    const maxValue = Math.max(...data.map(d => d.score), 1); // Avoid division by zero
    const todayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
    return (
        <div className="flex justify-around items-end h-full w-full gap-2 pt-4">
            {data.map(item => (
                <div key={item.name} className="flex-1 flex flex-col items-center gap-2">
                    <div className="relative group flex-1 flex items-end w-full">
                        <div
                            className={`w-full rounded-t-md transition-all ${item.name === todayName ? 'bg-fire-orange-start' : 'bg-orange-300 dark:bg-orange-800'}`}
                            style={{ height: `${(item.score / maxValue) * 100}%` }}
                        >
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 p-1.5 px-2 text-xs bg-gray-800 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                {item.score} XP
                            </span>
                        </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.name}</span>
                </div>
            ))}
        </div>
    );
  };

  const TopicPerformanceList = ({ data }: { data: TopicPerformance[] }) => (
    <div className="space-y-3 h-full overflow-y-auto pr-2">
        {data.map(item => (
            <div key={item.topic}>
                <div className="flex justify-between mb-1 text-sm font-medium">
                    <span>{item.topic}</span>
                    <span className="text-gray-600 dark:text-gray-300">{Math.round(item.score)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                        className="bg-gradient-to-r from-orange-400 to-red-500 h-2.5 rounded-full"
                        style={{ width: `${item.score}%` }}
                    ></div>
                </div>
            </div>
        ))}
    </div>
  );
  
  const MonthlyActivityGrid = ({ data }: { data: MonthlyActivity[] }) => {
    const maxValue = Math.max(...data.map(d => d.xp), 1);
    return (
        <div className="grid grid-cols-7 gap-1.5 h-full content-start">
            {data.map(item => {
                const opacity = item.xp > 0 ? (item.xp / maxValue) * 0.8 + 0.2 : 0.05;
                return (
                    <div
                        key={item.day}
                        title={`${item.xp} XP on Day ${item.day}`}
                        className="aspect-square rounded-md bg-fire-orange-start"
                        style={{ opacity }}
                    ></div>
                )
            })}
        </div>
    )
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{height: '60vh'}}>
          <div className="w-12 h-12 border-4 border-t-transparent border-fire-orange-start rounded-full animate-spin"></div>
      </div>
    );
  }

  if (fetchError) {
      return <DatabaseSetupInstructions feature="dashboard" error={fetchError} />
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
        Welcome back, {profile?.username || 'AptiPro User'}!
      </h1>
      <p className="text-gray-600 dark:text-gray-400">Let's sharpen your skills today. Your next big opportunity is just a test away.</p>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly Progress */}
        <div className="lg:col-span-2 p-6 bg-white rounded-2xl shadow-lg dark:bg-gray-800">
          <h2 className="text-xl font-bold mb-4">Weekly Progress (XP)</h2>
          <div style={{ width: '100%', height: 300 }}>
             {weeklyData.reduce((acc, day) => acc + day.score, 0) === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <BrainCircuitIcon size={48} className="text-gray-400 mb-4" />
                    <h3 className="font-semibold">No activity this week</h3>
                    <p className="text-sm text-gray-500">Complete practice tests to see your progress here.</p>
                </div>
             ) : (
                <SimpleBarChart data={weeklyData} />
             )}
          </div>
        </div>

        {/* AI Suggestion */}
        <div className="p-6 bg-gradient-to-br from-fire-orange-start to-fire-red-end rounded-2xl shadow-lg text-white flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold">Personalized Suggestion</h2>
            {renderSuggestion()}
          </div>
          <Link to={`/practice/${suggestedTopic?.key || ''}`} className="mt-6 w-full text-center px-4 py-2 font-semibold bg-white text-fire-orange-start rounded-lg hover:bg-orange-50 transition">
            {suggestedTopic?.key === '' ? 'Choose a Topic' : 'Start Practicing'}
          </Link>
        </div>
      </div>
      
      {/* New Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Performance by Topic */}
        <div className="p-6 bg-white rounded-2xl shadow-lg dark:bg-gray-800">
            <h2 className="text-xl font-bold mb-4">Performance by Topic (%)</h2>
            <div style={{ width: '100%', height: 300 }}>
                 {topicPerformance.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <AwardIcon size={48} className="text-gray-400 mb-4" />
                        <h3 className="font-semibold">No Topic Data Yet</h3>
                        <p className="text-sm text-gray-500">Complete a few tests to see your strengths.</p>
                    </div>
                 ) : (
                    <TopicPerformanceList data={topicPerformance} />
                 )}
            </div>
        </div>

        {/* Monthly Activity */}
        <div className="p-6 bg-white rounded-2xl shadow-lg dark:bg-gray-800">
            <h2 className="text-xl font-bold mb-4">Monthly Activity (XP)</h2>
            <div style={{ width: '100%', height: 300 }}>
                 {totalMonthlyXp === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <BarChartIcon size={48} className="text-gray-400 mb-4" />
                        <h3 className="font-semibold">No activity this month</h3>
                        <p className="text-sm text-gray-500">Let's get practicing and fill up this chart!</p>
                    </div>
                 ) : (
                    <MonthlyActivityGrid data={monthlyActivity} />
                 )}
            </div>
            {totalMonthlyXp > 0 && totalMonthlyXp < 1000 && (
                 <p className="text-xs text-center mt-2 text-gray-500 dark:text-gray-400">
                    Your activity this month has been low. Try to practice consistently!
                 </p>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;