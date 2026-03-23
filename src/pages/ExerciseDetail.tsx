import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Exercise, Training } from '../types';
import { useExerciseProgress, SessionProgress } from '../hooks/useExerciseProgress';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ChevronLeft, TrendingUp } from 'lucide-react';

type Metric = 'maxWeight' | 'volume' | 'oneRM';

const METRIC_LABELS: Record<Metric, string> = {
  maxWeight: 'Max-Gewicht',
  volume: 'Volumen',
  oneRM: '1RM',
};

const METRIC_UNIT: Record<Metric, string> = {
  maxWeight: 'kg',
  volume: 'kg',
  oneRM: 'kg',
};

function metricValue(session: SessionProgress, metric: Metric): number | null {
  switch (metric) {
    case 'maxWeight': return session.maxWeight || null;
    case 'volume': return session.volume || null;
    case 'oneRM': return session.best1RM;
  }
}

export default function ExerciseDetail() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [currentStudioId, setCurrentStudioId] = useState('');
  const [exerciseLoading, setExerciseLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<Metric>('maxWeight');

  // Load exercise from global catalog
  useEffect(() => {
    if (!exerciseId || !db) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'exercises', exerciseId));
        if (snap.exists()) {
          setExercise({ id: snap.id, ...snap.data() } as Exercise);
        }
      } catch (err) {
        console.error('ExerciseDetail: load exercise error', err);
      } finally {
        setExerciseLoading(false);
      }
    };
    load();
  }, [exerciseId]);

  // Determine current studioId from most recent training
  useEffect(() => {
    if (!user || !db) return;
    const load = async () => {
      try {
        const trainingsRef = collection(db, 'users', user.uid, 'trainings');
        const snap = await getDocs(
          query(trainingsRef, orderBy('date', 'desc'), limit(1))
        );
        if (!snap.empty) {
          setCurrentStudioId(snap.docs[0].data().studioId as string);
        }
      } catch (err) {
        console.error('ExerciseDetail: load studioId error', err);
      }
    };
    load();
  }, [user]);

  const contextDependent = exercise?.contextDependent ?? false;
  const { sessions, loading, error } = useExerciseProgress(
    exerciseId ?? '',
    contextDependent,
    currentStudioId
  );

  if (exerciseLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-on-surface-variant text-sm">
        Lade...
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex items-center justify-center py-16 text-on-surface-variant text-sm">
        Übung nicht gefunden.
      </div>
    );
  }

  const chartSessions = sessions.filter(s => metricValue(s, activeMetric) !== null);
  const chartData = chartSessions.map(s => ({
    date: format(parseISO(s.date), 'dd.MM'),
    value: metricValue(s, activeMetric),
  }));

  const allTimeSession = sessions.reduce<SessionProgress | null>((best, s) => {
    if (!best) return s;
    const bv = metricValue(best, activeMetric) ?? 0;
    const sv = metricValue(s, activeMetric) ?? 0;
    return sv > bv ? s : best;
  }, null);

  const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;

  const yValues = chartData.map(d => d.value as number);
  const yMin = yValues.length > 0 ? Math.floor(Math.min(...yValues) * 0.95) : 0;
  const yMax = yValues.length > 0 ? Math.ceil(Math.max(...yValues) * 1.05) : 100;

  const hasEnoughData = chartSessions.length >= 2;
  const hasOneRMWarning = activeMetric === 'oneRM' && sessions.some(s => s.best1RM === null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-xl font-headline font-extrabold tracking-tight text-on-surface leading-tight truncate">
            {exercise.name}
          </h2>
          <p className="text-xs text-on-surface-variant">
            {exercise.muscleGroup}
            {exercise.contextDependent && ' · studiobezogen'}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {sessions.length >= 1 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-4 shadow-sm">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
              Bestes je
            </p>
            {allTimeSession && (
              <>
                <p className="text-xl font-headline font-extrabold text-on-surface">
                  {activeMetric === 'volume'
                    ? `${Math.round(metricValue(allTimeSession, 'volume') ?? 0)} kg`
                    : activeMetric === 'oneRM'
                    ? `${Math.round(metricValue(allTimeSession, 'oneRM') ?? 0)} kg`
                    : `${metricValue(allTimeSession, 'maxWeight')} kg`}
                </p>
                <p className="text-xs text-outline mt-1">
                  {format(parseISO(allTimeSession.date), 'dd. MMM yyyy', { locale: de })}
                </p>
              </>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-4 shadow-sm">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
              Letztes Training
            </p>
            {lastSession && (
              <>
                <p className="text-xl font-headline font-extrabold text-on-surface">
                  {activeMetric === 'volume'
                    ? `${Math.round(sessionVolumeFn(lastSession))} kg`
                    : activeMetric === 'oneRM'
                    ? lastSession.best1RM != null
                      ? `${Math.round(lastSession.best1RM)} kg`
                      : '—'
                    : `${lastSession.maxWeight} kg`}
                </p>
                <p className="text-xs text-outline mt-1">
                  {format(parseISO(lastSession.date), 'dd. MMM yyyy', { locale: de })}
                </p>
                {lastSession.bestSet && (
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {lastSession.allSets.filter(s => s.weight != null).length} Sätze · {lastSession.bestSet.reps} Wdh @ {lastSession.bestSet.weight} kg
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Metric Tabs */}
      {exercise.type !== 'reps_only' && (
        <div className="flex gap-2">
          {(Object.keys(METRIC_LABELS) as Metric[]).map(metric => (
            <button
              key={metric}
              onClick={() => setActiveMetric(metric)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeMetric === metric
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {METRIC_LABELS[metric]}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-4 shadow-sm">
        <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">
          Verlauf · {exercise.type === 'reps_only' ? 'Max. Wdh' : METRIC_LABELS[activeMetric]}
        </h3>

        {loading ? (
          <div className="h-48 flex items-center justify-center text-on-surface-variant text-sm">
            Lade...
          </div>
        ) : error ? (
          <div className="h-48 flex items-center justify-center text-error text-sm px-4 text-center">
            {error}
          </div>
        ) : sessions.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-on-surface-variant text-sm text-center px-4 gap-2">
            <TrendingUp className="w-8 h-8 opacity-30" />
            <span>Noch keine Einheiten aufgezeichnet.</span>
          </div>
        ) : !hasEnoughData ? (
          <div className="h-48 flex flex-col items-center justify-center text-on-surface-variant text-sm text-center px-4 gap-2">
            <TrendingUp className="w-8 h-8 opacity-30" />
            <span>Noch zu wenig Daten — mach mindestens 2 Einheiten.</span>
          </div>
        ) : (
          <>
            <div className="h-48 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeeee" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6d7a72' }}
                    dy={10}
                  />
                  <YAxis
                    domain={[yMin, yMax]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6d7a72' }}
                    unit=" kg"
                  />
                  <Tooltip
                    formatter={(value: number) => [`${Math.round(value)} ${METRIC_UNIT[activeMetric]}`, METRIC_LABELS[activeMetric]]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ color: '#3d4a42', fontSize: '12px', marginBottom: '4px' }}
                    itemStyle={{ color: '#059669', fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#059669', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#059669', strokeWidth: 0 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {hasOneRMWarning && (
              <p className="text-xs text-on-surface-variant mt-3 text-center">
                Einige Sessions sind nicht dargestellt (Reps &gt; 15, 1RM-Schätzung unzuverlässig).
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Helper to avoid importing metrics in JSX
function sessionVolumeFn(s: SessionProgress): number {
  return s.volume;
}
