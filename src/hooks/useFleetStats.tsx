import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FleetStats {
  total_distance: number;
  total_deliveries: number;
  total_fuel: number;
  total_income: number;
  total_expenses: number;
  total_profit: number;
  active_drivers: number;
  avg_load_weight: number;
}

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_distance: number;
  total_deliveries: number;
  total_earnings: number;
}

export function useFleetStats() {
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const { data: rawJobs, error } = await supabase
        .from('job_logs')
        .select('*');

      if (error) throw error;

      if (!rawJobs || rawJobs.length === 0) {
        setStats({
          total_distance: 0,
          total_deliveries: 0,
          total_fuel: 0,
          total_income: 0,
          total_expenses: 0,
          total_profit: 0,
          active_drivers: 0,
          avg_load_weight: 0
        });
        return;
      }

      // Aggregate all numbers locally to fix the P&L Database error
      const aggregated = rawJobs.reduce((acc, job: any) => {
        const income = Number(job.income) || 0;
        // The user reported fuel_cost and other_expenses are missing or zero.
        // We will calculate them dynamically from fuel_consumed and damage if not present.
        const fuelConsumed = Number(job.fuel_consumed) || 0;
        const fuelCost = Number(job.fuel_cost) || (fuelConsumed * 1.5);
        const otherExpense = Number(job.other_expenses) || 0;
        const totalJobExpense = fuelCost + otherExpense;

        return {
          total_distance: acc.total_distance + (Number(job.distance_km) || 0),
          total_deliveries: acc.total_deliveries + 1,
          total_fuel: acc.total_fuel + fuelConsumed,
          total_income: acc.total_income + income,
          total_expenses: acc.total_expenses + totalJobExpense,
          total_profit: acc.total_profit + (income - totalJobExpense),
          active_drivers: 0, // Calculated later
          avg_load_weight: acc.avg_load_weight + (Number(job.cargo_weight || job.cargo_mass) || 0)
        };
      }, {
        total_distance: 0,
        total_deliveries: 0,
        total_fuel: 0,
        total_income: 0,
        total_expenses: 0,
        total_profit: 0,
        active_drivers: 0,
        avg_load_weight: 0
      });

      // Drivers Count
      const activeDriversSet = new Set(rawJobs.map(j => j.user_id));
      aggregated.active_drivers = activeDriversSet.size;

      if (aggregated.total_deliveries > 0) {
        aggregated.avg_load_weight = aggregated.avg_load_weight / aggregated.total_deliveries / 1000; // Convert kg to tons
      }

      setStats(aggregated);

    } catch (err: any) {
      console.error('Error fetching fleet stats:', err);
      setError(err.message);
    }
  };

  const fetchLeaderboard = async (limit = 10) => {
    try {
      const { data, error } = await supabase.rpc('get_leaderboard', { limit_count: limit });
      
      if (error) throw error;
      setLeaderboard(data as unknown as LeaderboardEntry[]);
    } catch (err: any) {
      console.error('Error fetching leaderboard:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchLeaderboard()]);
      setLoading(false);
    };

    loadData();
  }, []);

  const refresh = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchLeaderboard()]);
    setLoading(false);
  };

  return {
    stats,
    leaderboard,
    loading,
    error,
    refresh
  };
}

export function usePersonalStats(userId: string | undefined) {
  const [stats, setStats] = useState<{
    total_distance: number;
    total_deliveries: number;
    total_income: number;
    total_fuel: number;
    avg_damage: number;
  } | null>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchPersonalStats = async () => {
      setLoading(true);
      try {
        // Fetch job logs for this user
        const { data: jobs, error } = await supabase
          .from('job_logs')
          .select('*')
          .eq('user_id', userId)
          .order('delivery_date', { ascending: false });

        if (error) throw error;

        if (jobs && jobs.length > 0) {
          const total_distance = jobs.reduce((sum, j) => sum + Number(j.distance_km || 0), 0);
          const total_income = jobs.reduce((sum, j) => sum + Number(j.income || 0), 0);
          const total_fuel = jobs.reduce((sum, j) => sum + Number(j.fuel_consumed || 0), 0);
          const avg_damage = jobs.reduce((sum, j) => sum + Number(j.damage_percent || 0), 0) / jobs.length;

          setStats({
            total_distance,
            total_deliveries: jobs.length,
            total_income,
            total_fuel,
            avg_damage
          });
          setRecentJobs(jobs.slice(0, 10));
        } else {
          setStats({
            total_distance: 0,
            total_deliveries: 0,
            total_income: 0,
            total_fuel: 0,
            avg_damage: 0
          });
          setRecentJobs([]);
        }
      } catch (err) {
        console.error('Error fetching personal stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalStats();
  }, [userId]);

  return { stats, recentJobs, loading };
}

// Hook for fetching weekly data from actual job logs
export function useWeeklyData() {
  const [weeklyData, setWeeklyData] = useState<{ day: string; distance: number; income: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeeklyData = async () => {
      setLoading(true);
      try {
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

        const { data: jobs, error } = await supabase
          .from('job_logs')
          .select('delivery_date, distance_km, income')
          .gte('delivery_date', sevenDaysAgo.toISOString())
          .order('delivery_date', { ascending: true });

        if (error) throw error;

        // Group by day
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dailyData: Record<string, { distance: number; income: number }> = {};

        // Initialize all 7 days
        for (let i = 0; i < 7; i++) {
          const date = new Date(sevenDaysAgo);
          date.setDate(date.getDate() + i);
          const dayName = dayNames[date.getDay()];
          dailyData[dayName] = { distance: 0, income: 0 };
        }

        // Aggregate job data
        (jobs || []).forEach((job) => {
          if (job.delivery_date) {
            const date = new Date(job.delivery_date);
            const dayName = dayNames[date.getDay()];
            if (dailyData[dayName]) {
              dailyData[dayName].distance += Number(job.distance_km || 0);
              dailyData[dayName].income += Number(job.income || 0);
            }
          }
        });

        // Convert to array in order
        const orderedData = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(sevenDaysAgo);
          date.setDate(date.getDate() + i);
          const dayName = dayNames[date.getDay()];
          orderedData.push({
            day: dayName,
            ...dailyData[dayName],
          });
        }

        setWeeklyData(orderedData);
      } catch (err) {
        console.error('Error fetching weekly data:', err);
        // Return empty data
        setWeeklyData([
          { day: 'Mon', distance: 0, income: 0 },
          { day: 'Tue', distance: 0, income: 0 },
          { day: 'Wed', distance: 0, income: 0 },
          { day: 'Thu', distance: 0, income: 0 },
          { day: 'Fri', distance: 0, income: 0 },
          { day: 'Sat', distance: 0, income: 0 },
          { day: 'Sun', distance: 0, income: 0 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyData();
  }, []);

  return { weeklyData, loading };
}