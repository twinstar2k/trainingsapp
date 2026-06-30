import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Sparkles } from 'lucide-react';
import type { TrainingRating } from '../../types';
import { RATING_LABELS, averageRating } from '../../lib/rating';
import { TrainingRatingBadge } from './TrainingRating';

export interface QualityEntry {
  date: string; // YYYY-MM-DD
  rating: TrainingRating;
}

interface TrainingQualityCardProps {
  // Aufsteigend nach Datum (älteste → neueste), bereits auf die anzuzeigende Spanne begrenzt.
  entries: QualityEntry[];
}

// Bewusst kräftiges Amber für den Balken (wie die Sterne); leere Achsen, kompakt fürs Dashboard.
const BAR_COLOR = '#fbbf24'; // amber-400

/** Dashboard-Karte: Verlauf der subjektiven Trainingsqualität (Sterne-Bewertung) über die Zeit. */
export function TrainingQualityCard({ entries }: TrainingQualityCardProps) {
  const avg = useMemo(() => averageRating(entries.map((e) => e.rating)), [entries]);
  const chartData = useMemo(
    () => entries.map((e) => ({ date: format(parseISO(e.date), 'dd.MM'), value: e.rating })),
    [entries],
  );

  return (
    <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center text-outline">
          <Sparkles className="w-4 h-4 mr-2" />
          <span className="text-xs font-medium uppercase tracking-wider">Trainingsqualität</span>
        </div>
        {avg != null && (
          <div className="flex items-center gap-2 text-sm">
            <TrainingRatingBadge value={Math.round(avg) as TrainingRating} />
            <span className="text-on-surface-variant">
              Ø {avg.toFixed(1).replace('.', ',')} · {entries.length}
            </span>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-on-surface-variant py-4 text-center">
          Noch keine Bewertungen — bewerte ein Training beim Abschließen.
        </p>
      ) : (
        <div className="h-28 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6d7a72' }}
                dy={6}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 4]}
                ticks={[1, 2, 3, 4]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#6d7a72' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                formatter={(value: number) => [RATING_LABELS[value as TrainingRating], 'Bewertung']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ color: '#3d4a42', fontSize: '12px', marginBottom: '4px' }}
                itemStyle={{ color: '#d97706', fontWeight: 600 }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
