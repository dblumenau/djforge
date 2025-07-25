import { useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Artist {
  name: string;
  genres: string[];
  popularity: number;
}

interface GenreDistributionProps {
  artists: Artist[];
  timeRange: string;
}

export default function GenreDistribution({ artists, timeRange }: GenreDistributionProps) {
  const genreData = useMemo(() => {
    // Count genres weighted by artist position (higher position = more weight)
    const genreCounts: Record<string, number> = {};
    
    artists.forEach((artist, index) => {
      const weight = artists.length - index; // Top artist gets highest weight
      artist.genres.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + weight;
      });
    });

    // Sort and take top 10 genres
    const sortedGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    return {
      labels: sortedGenres.map(([genre]) => 
        genre.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
      ),
      datasets: [{
        data: sortedGenres.map(([, count]) => count),
        backgroundColor: [
          '#10b981', // green-500
          '#34d399', // green-400
          '#6ee7b7', // green-300
          '#a855f7', // purple-500
          '#c084fc', // purple-400
          '#e879f9', // fuchsia-400
          '#f97316', // orange-500
          '#fb923c', // orange-400
          '#fbbf24', // amber-400
          '#facc15', // yellow-400
        ],
        borderWidth: 0,
      }]
    };
  }, [artists]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#e4e4e7', // zinc-200
          padding: 12,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: '#18181b', // zinc-900
        titleColor: '#e4e4e7',
        bodyColor: '#e4e4e7',
        borderColor: '#3f3f46', // zinc-700
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: (context: any) => {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            return `${context.label}: ${percentage}%`;
          }
        }
      }
    }
  };

  const timeRangeLabel = {
    'short_term': 'Last 4 Weeks',
    'medium_term': 'Last 6 Months',
    'long_term': 'All Time'
  }[timeRange] || timeRange;

  return (
    <div className="bg-zinc-900 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-2">Genre Distribution</h3>
      <p className="text-sm text-zinc-400 mb-6">Based on your top artists - {timeRangeLabel}</p>
      <div className="h-[300px]">
        <Doughnut data={genreData} options={options} />
      </div>
    </div>
  );
}