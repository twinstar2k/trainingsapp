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
        snapshot.forEach(doc => {
          loadedEntries.push({ id: doc.id, ...doc.data() } as WeightEntry);
        });
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
      const docRef = await addDoc(weightRef, {
        date: newDate,
        weight: weightNum
      });
      
      const newEntry = { id: docRef.id, date: newDate, weight: weightNum };
      const updatedEntries = [...entries, newEntry].sort((a, b) => b.date.localeCompare(a.date));
      setEntries(updatedEntries);
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

  // Prepare chart data (needs to be ascending order)
  const chartData = [...entries].reverse().map(entry => ({
    date: format(parseISO(entry.date), 'dd.MM'),
    weight: entry.weight
  }));

  // Calculate min/max for Y-axis
  const minWeight = entries.length > 0 ? Math.floor(Math.min(...entries.map(e => e.weight)) - 2) : 0;
  const maxWeight = entries.length > 0 ? Math.ceil(Math.max(...entries.map(e => e.weight)) + 2) : 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900">Körpergewicht</h2>
      </div>

      {/* Chart */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4">Verlauf</h3>
        {entries.length < 2 ? (
          <div className="h-48 flex items-center justify-center text-zinc-400 text-sm text-center px-4">
            Füge mindestens zwei Einträge hinzu, um den Verlauf zu sehen.
          </div>
        ) : (
          <div className="h-48 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#a1a1aa' }} 
                  dy={10}
                />
                <YAxis 
                  domain={[minWeight, maxWeight]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#a1a1aa' }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#71717a', fontSize: '12px', marginBottom: '4px' }}
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
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <form onSubmit={handleAddWeight} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wider">Datum</label>
            <input 
              type="date" 
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wider">Gewicht (kg)</label>
            <input 
              type="number" 
              step="0.1"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="z.B. 80.5"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
              required
            />
          </div>
          <button 
            type="submit"
            className="bg-emerald-600 text-white p-2.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* History List */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-3">Historie</h3>
        
        {loading ? (
          <div className="text-center py-8 text-zinc-500 text-sm">Lade Historie...</div>
        ) : entries.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 text-center text-zinc-500 text-sm">
            Noch keine Einträge vorhanden.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <ul className="divide-y divide-zinc-100">
              {entries.map((entry) => (
                <li key={entry.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-zinc-50 p-2 rounded-lg mr-4">
                      <Scale className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <div className="font-bold text-zinc-900 text-lg">{entry.weight} <span className="text-sm font-medium text-zinc-500">kg</span></div>
                      <div className="text-xs text-zinc-500">
                        {format(parseISO(entry.date), 'EEEE, dd. MMMM yyyy', { locale: de })}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(entry.id)}
                    className="text-zinc-400 hover:text-red-500 p-2 transition-colors"
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
