import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { WeightEntry } from '../types';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, Scale } from 'lucide-react';

export default function Weight() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWeight, setNewWeight] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (!user || !db) return;

    const fetchWeightHistory = async () => {
      try {
        const weightRef = collection(db, 'users', user.uid, 'weightHistory');
        const q = query(weightRef, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        const loadedEntries: WeightEntry[] = [];
        snapshot.forEach(doc => loadedEntries.push({ id: doc.id, ...doc.data() } as WeightEntry));
        setEntries(loadedEntries);
      } catch (error) {
        console.error("Error fetching weight history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeightHistory();
  }, [user]);

  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeight || !newDate || !user || !db) return;

    const weightNum = parseFloat(newWeight.replace(',', '.'));
    if (isNaN(weightNum)) return;

    try {
      const weightRef = collection(db, 'users', user.uid, 'weightHistory');
      const docRef = await addDoc(weightRef, { date: newDate, weight: weightNum });
      const newEntry = { id: docRef.id, date: newDate, weight: weightNum };
      setEntries([...entries, newEntry].sort((a, b) => b.date.localeCompare(a.date)));
      setNewWeight('');
    } catch (error) {
      console.error("Error adding weight:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !db) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'weightHistory', id));
      setEntries(entries.filter(e => e.id !== id));
    } catch (error) {
      console.error("Error deleting weight:", error);
    }
  };

  const chartData = [...entries].reverse().map(entry => ({
    date: format(parseISO(entry.date), 'dd.MM'),
    weight: entry.weight
  }));

  const minWeight = entries.length > 0 ? Math.floor(Math.min(...entries.map(e => e.weight)) - 2) : 0;
  const maxWeight = entries.length > 0 ? Math.ceil(Math.max(...entries.map(e => e.weight)) + 2) : 100;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">Körpergewicht</h2>

      {/* Chart */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm">
        <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Verlauf</h3>
        {entries.length < 2 ? (
          <div className="h-48 flex items-center justify-center text-on-surface-variant text-sm text-center px-4">
            Füge mindestens zwei Einträge hinzu, um den Verlauf zu sehen.
          </div>
        ) : (
          <div className="h-48 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eeeeee" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6d7a72' }} dy={10} />
                <YAxis domain={[minWeight, maxWeight]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6d7a72' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#3d4a42', fontSize: '12px', marginBottom: '4px' }}
                  itemStyle={{ color: '#059669', fontWeight: 600 }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#059669"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#059669', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#059669', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Add Entry Form */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm">
        <form onSubmit={handleAddWeight} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Datum</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full bg-surface-container-low ring-1 ring-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Gewicht (kg)</label>
            <input
              type="number"
              step="0.1"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="z.B. 80.5"
              className="w-full bg-surface-container-low ring-1 ring-outline-variant/30 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150"
              required
            />
          </div>
          <button
            type="submit"
            className="w-10 h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all duration-150 active:scale-90 flex-shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* History List */}
      <div>
        <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Historie</h3>

        {loading ? (
          <div className="text-center py-8 text-on-surface-variant text-sm">Lade Historie...</div>
        ) : entries.length === 0 ? (
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container text-center text-on-surface-variant text-sm">
            Noch keine Einträge vorhanden.
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden shadow-sm">
            <ul className="divide-y divide-surface-container">
              {entries.map((entry) => (
                <li key={entry.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-surface-container-low p-2 rounded-xl mr-4">
                      <Scale className="w-5 h-5 text-outline" />
                    </div>
                    <div>
                      <div className="font-bold text-on-surface text-lg">
                        {entry.weight} <span className="text-sm font-medium text-on-surface-variant">kg</span>
                      </div>
                      <div className="text-xs text-outline">
                        {format(parseISO(entry.date), 'EEEE, dd. MMMM yyyy', { locale: de })}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-outline hover:text-error p-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
