import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Track {
  played_at: string;
  track: {
    name: string;
    popularity: number;
    duration_ms: number;
  };
}

interface ListeningTrendsProps {
  recentlyPlayed: Track[];
}

export default function ListeningTrends({ recentlyPlayed }: ListeningTrendsProps) {
  const { hourlyData, popularityData } = useMemo(() => {
    // Group by hour for the last 7 days
    const hourCounts: Record<number, number> = {};
    const dayPopularity: Record<string, { total: number; count: number }> = {};
    
    recentlyPlayed.forEach(item => {
      const date = new Date(item.played_at);
      const hour = date.getHours();
      const dayKey = date.toLocaleDateString();
      
      // Count by hour
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      
      // Average popularity by day
      if (!dayPopularity[dayKey]) {
        dayPopularity[dayKey] = { total: 0, count: 0 };
      }
      dayPopularity[dayKey].total += item.track.popularity;
      dayPopularity[dayKey].count += 1;
    });

    // Prepare hourly data
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const hourlyDataset = {
      labels: hours.map(h => {
        const period = h < 12 ? 'AM' : 'PM';
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${hour12}${period}`;
      }),
      datasets: [{
        label: 'Songs Played',
        data: hours.map(h => hourCounts[h] || 0),
        backgroundColor: 'rgba(34, 197, 94, 0.2)', // green-500 with opacity
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    };

    // Prepare popularity trend data (last 7 days)
    const sortedDays = Object.entries(dayPopularity)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .slice(-7);
    
    const popularityDataset = {
      labels: sortedDays.map(([date]) => 
        new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      ),
      datasets: [{
        label: 'Average Popularity',
        data: sortedDays.map(([, stats]) => Math.round(stats.total / stats.count)),
        backgroundColor: 'rgba(168, 85, 247, 0.5)', // purple-500 with opacity
        borderColor: 'rgb(168, 85, 247)',
        borderWidth: 2
      }]
    };

    return { hourlyData: hourlyDataset, popularityData: popularityDataset };
  }, [recentlyPlayed]);

  const hourlyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#e4e4e7',
        bodyColor: '#e4e4e7',
        borderColor: '#3f3f46',
        borderWidth: 1,
        padding: 12
      }
    },
    scales: {
      x: {
        grid: {
          color: '#3f3f46',
          display: false
        },
        ticks: {
          color: '#a1a1aa'
        }
      },
      y: {
        grid: {
          color: '#3f3f46'
        },
        ticks: {
          color: '#a1a1aa',
          stepSize: 1
        }
      }
    }
  };

  const popularityOptions = {
    ...hourlyOptions,
    scales: {
      ...hourlyOptions.scales,
      y: {
        ...hourlyOptions.scales.y,
        min: 0,
        max: 100,
        ticks: {
          ...hourlyOptions.scales.y.ticks,
          stepSize: 20
        }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Listening by Hour */}
      <div className="bg-zinc-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2">Listening Activity by Hour</h3>
        <p className="text-sm text-zinc-400 mb-6">When you listen to music most</p>
        <div className="h-[250px]">
          <Line data={hourlyData} options={hourlyOptions} />
        </div>
      </div>

      {/* Popularity Trend */}
      <div className="bg-zinc-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2">Track Popularity Trend</h3>
        <p className="text-sm text-zinc-400 mb-6">Average popularity of tracks you've played</p>
        <div className="h-[250px]">
          <Bar data={popularityData} options={popularityOptions} />
        </div>
      </div>
    </div>
  );
}