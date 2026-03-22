import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Training, TrainingExercise, TrainingSet, Exercise } from '../types';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Check, Plus, Trash2, X, Search, ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export default function TrainingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [training, setTraining] = useState<Training | null>(null);
  const [studioName, setStudioName] = useState('');
  const [exercises, setExercises] = useState<(TrainingExercise & { details: Exercise, sets: TrainingSet[] })[]>([]);
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showCatalog, setShowCatalog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showDeleteTraining, setShowDeleteTraining] = useState(false);

  useEffect(() => {
    if (!user || !db || !id) return;

    const fetchTrainingData = async () => {
      try {
        // Fetch training
        const trainingRef = doc(db, 'users', user.uid, 'trainings', id);
        const trainingSnap = await getDoc(trainingRef);
        
        if (!trainingSnap.exists()) {
          navigate('/trainings');
          return;
        }
        
        const tData = { id: trainingSnap.id, ...trainingSnap.data() } as Training;
        setTraining(tData);

        // Fetch studio name
        if (tData.studioId) {
          const studioSnap = await getDoc(doc(db, 'users', user.uid, 'studios', tData.studioId));
          if (studioSnap.exists()) {
            setStudioName(studioSnap.data().name);
          }
        }

        // Fetch global catalog
        const catalogRef = collection(db, 'exercises');
        const catalogSnap = await getDocs(catalogRef);
        const catalogData: Exercise[] = [];
        catalogSnap.forEach(doc => catalogData.push({ id: doc.id, ...doc.data() } as Exercise));
        setCatalog(catalogData);

        // Fetch training exercises
        const exercisesRef = collection(db, 'users', user.uid, 'trainings', id, 'exercises');
        const qExercises = query(exercisesRef, orderBy('order', 'asc'));
        const exercisesSnap = await getDocs(qExercises);
        
        const loadedExercises: (TrainingExercise & { details: Exercise, sets: TrainingSet[] })[] = [];
        
        for (const exDoc of exercisesSnap.docs) {
          const exData = { id: exDoc.id, ...exDoc.data() } as TrainingExercise;
          const details = catalogData.find(e => e.id === exData.exerciseId);
          
          if (details) {
            // Fetch sets for this exercise
            const setsRef = collection(db, 'users', user.uid, 'trainings', id, 'exercises', exDoc.id, 'sets');
            const qSets = query(setsRef, orderBy('order', 'asc'));
            const setsSnap = await getDocs(qSets);
            
            const sets: TrainingSet[] = [];
            setsSnap.forEach(sDoc => sets.push({ id: sDoc.id, ...sDoc.data() } as TrainingSet));
            
            loadedExercises.push({ ...exData, details, sets });
          }
        }
        
        setExercises(loadedExercises);
      } catch (error) {
        console.error("Error fetching training details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrainingData();
  }, [user, id, navigate]);

  const handleAddExercise = async (exerciseId: string) => {
    if (!user || !db || !id) return;
    
    try {
      const exercisesRef = collection(db, 'users', user.uid, 'trainings', id, 'exercises');
      const newOrder = exercises.length > 0 ? Math.max(...exercises.map(e => e.order)) + 1 : 0;
      
      const docRef = await addDoc(exercisesRef, {
        exerciseId,
        order: newOrder,
        status: 'open'
      });
      
      const details = catalog.find(e => e.id === exerciseId);
      if (details) {
        setExercises([...exercises, {
          id: docRef.id,
          exerciseId,
          order: newOrder,
          status: 'open',
          details,
          sets: []
        }]);
      }
      
      setShowCatalog(false);
      setSearchQuery('');
    } catch (error) {
      console.error("Error adding exercise:", error);
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!user || !db || !id) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'trainings', id, 'exercises', exerciseId));
      setExercises(exercises.filter(e => e.id !== exerciseId));
    } catch (error) {
      console.error("Error deleting exercise:", error);
    }
  };

  const handleAddSet = async (exerciseId: string, exIndex: number) => {
    if (!user || !db || !id) return;
    
    const exercise = exercises[exIndex];
    const setsRef = collection(db, 'users', user.uid, 'trainings', id, 'exercises', exerciseId, 'sets');
    const newOrder = exercise.sets.length > 0 ? Math.max(...exercise.sets.map(s => s.order)) + 1 : 0;
    
    // Copy values from previous set if exists
    let newSetData: Partial<TrainingSet> = {
      order: newOrder,
      status: 'open'
    };
    
    if (exercise.sets.length > 0) {
      const lastSet = exercise.sets[exercise.sets.length - 1];
      if (lastSet.reps !== undefined) newSetData.reps = lastSet.reps;
      if (lastSet.weight !== undefined) newSetData.weight = lastSet.weight;
      if (lastSet.duration !== undefined) newSetData.duration = lastSet.duration;
      if (lastSet.distance !== undefined) newSetData.distance = lastSet.distance;
    } else {
      // Default values based on type
      if (exercise.details.type === 'weighted') {
        newSetData.reps = 10;
        newSetData.weight = 0;
      } else if (exercise.details.type === 'reps_only') {
        newSetData.reps = 10;
      } else if (exercise.details.type === 'cardio_basic') {
        newSetData.duration = 15;
        newSetData.distance = 0;
      }
    }

    try {
      const docRef = await addDoc(setsRef, newSetData);
      
      const updatedExercises = [...exercises];
      updatedExercises[exIndex] = {
        ...updatedExercises[exIndex],
        sets: [...updatedExercises[exIndex].sets, { id: docRef.id, ...newSetData } as TrainingSet]
      };
      setExercises(updatedExercises);
    } catch (error) {
      console.error("Error adding set:", error);
    }
  };

  const handleUpdateSet = async (exerciseId: string, exIndex: number, setId: string, setIndex: number, field: keyof TrainingSet, value: any) => {
    if (!user || !db || !id) return;
    
    // Optimistic update
    const updatedExercises = [...exercises];
    const updatedSets = [...updatedExercises[exIndex].sets];
    updatedSets[setIndex] = {
      ...updatedSets[setIndex],
      [field]: value
    };
    updatedExercises[exIndex] = {
      ...updatedExercises[exIndex],
      sets: updatedSets
    };
    setExercises(updatedExercises);

    try {
      const setRef = doc(db, 'users', user.uid, 'trainings', id, 'exercises', exerciseId, 'sets', setId);
      await updateDoc(setRef, { [field]: value });
    } catch (error) {
      console.error("Error updating set:", error);
      // Revert would go here in a robust app
    }
  };

  const handleDeleteSet = async (exerciseId: string, exIndex: number, setId: string) => {
    if (!user || !db || !id) return;
    
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'trainings', id, 'exercises', exerciseId, 'sets', setId));
      
      const updatedExercises = [...exercises];
      updatedExercises[exIndex] = {
        ...updatedExercises[exIndex],
        sets: updatedExercises[exIndex].sets.filter(s => s.id !== setId)
      };
      setExercises(updatedExercises);
    } catch (error) {
      console.error("Error deleting set:", error);
    }
  };

  const toggleSetStatus = async (exerciseId: string, exIndex: number, setId: string, setIndex: number) => {
    const currentStatus = exercises[exIndex].sets[setIndex].status;
    const newStatus = currentStatus === 'open' ? 'done' : 'open';
    await handleUpdateSet(exerciseId, exIndex, setId, setIndex, 'status', newStatus);
  };

  const toggleTrainingStatus = async () => {
    if (!user || !db || !id || !training) return;
    
    const newStatus = training.status === 'active' ? 'completed' : 'active';
    
    try {
      const trainingRef = doc(db, 'users', user.uid, 'trainings', id);
      await updateDoc(trainingRef, { status: newStatus });
      setTraining({ ...training, status: newStatus });
      
      if (newStatus === 'completed') {
        navigate('/trainings');
      }
    } catch (error) {
      console.error("Error updating training status:", error);
    }
  };

  const handleDeleteTraining = async () => {
    if (!user || !db || !id) return;
    
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'trainings', id));
      navigate('/trainings');
    } catch (error) {
      console.error("Error deleting training:", error);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-zinc-500">Lade Training...</div>;
  }

  if (!training) {
    return <div className="text-center py-12 text-zinc-500">Training nicht gefunden.</div>;
  }

  const filteredCatalog = catalog.filter(ex => 
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">
              {format(parseISO(training.date), 'EEEE, dd. MMM yyyy', { locale: de })}
            </h2>
            <p className="text-sm font-medium text-zinc-500">{studioName}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider",
              training.status === 'active' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
            )}>
              {training.status === 'active' ? 'Aktiv' : 'Abgeschlossen'}
            </div>
            <button 
              onClick={() => setShowDeleteTraining(true)}
              type="button"
              className="p-2 text-zinc-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
              title="Training löschen"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Exercises List */}
      <div className="space-y-4">
        {exercises.map((ex, exIndex) => (
          <div key={ex.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <div>
                <h3 className="font-bold text-zinc-900">{ex.details.name}</h3>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mt-0.5">
                  {ex.details.muscleGroup}
                  {ex.details.contextDependent && ' • Studio-gebunden'}
                </p>
              </div>
              <button 
                onClick={() => handleDeleteExercise(ex.id)}
                type="button"
                className="text-zinc-400 hover:text-red-500 p-2 -mr-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Sets Header */}
              {ex.sets.length > 0 && (
                <div className="flex text-xs font-semibold text-zinc-400 uppercase tracking-wider px-2">
                  <div className="w-8 text-center">Set</div>
                  {ex.details.type === 'weighted' && (
                    <>
                      <div className="flex-1 text-center">kg</div>
                      <div className="flex-1 text-center">Reps</div>
                    </>
                  )}
                  {ex.details.type === 'reps_only' && (
                    <div className="flex-1 text-center">Reps</div>
                  )}
                  {ex.details.type === 'cardio_basic' && (
                    <>
                      <div className="flex-1 text-center">Min</div>
                      <div className="flex-1 text-center">km</div>
                    </>
                  )}
                  <div className="w-10"></div>
                </div>
              )}

              {/* Sets List */}
              {ex.sets.map((set, setIndex) => (
                <div 
                  key={set.id} 
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-xl transition-colors",
                    set.status === 'done' ? "bg-emerald-50/50" : "bg-zinc-50"
                  )}
                >
                  <div className="w-8 text-center font-bold text-zinc-400 text-sm">
                    {setIndex + 1}
                  </div>
                  
                  {ex.details.type === 'weighted' && (
                    <>
                      <input 
                        type="number" 
                        value={set.weight || ''}
                        onChange={(e) => handleUpdateSet(ex.id, exIndex, set.id, setIndex, 'weight', parseFloat(e.target.value) || 0)}
                        className="flex-1 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-center font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="0"
                      />
                      <input 
                        type="number" 
                        value={set.reps || ''}
                        onChange={(e) => handleUpdateSet(ex.id, exIndex, set.id, setIndex, 'reps', parseInt(e.target.value) || 0)}
                        className="flex-1 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-center font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="0"
                      />
                    </>
                  )}

                  {ex.details.type === 'reps_only' && (
                    <input 
                      type="number" 
                      value={set.reps || ''}
                      onChange={(e) => handleUpdateSet(ex.id, exIndex, set.id, setIndex, 'reps', parseInt(e.target.value) || 0)}
                      className="flex-1 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-center font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="0"
                    />
                  )}

                  {ex.details.type === 'cardio_basic' && (
                    <>
                      <input 
                        type="number" 
                        value={set.duration || ''}
                        onChange={(e) => handleUpdateSet(ex.id, exIndex, set.id, setIndex, 'duration', parseInt(e.target.value) || 0)}
                        className="flex-1 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-center font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="0"
                      />
                      <input 
                        type="number" 
                        step="0.1"
                        value={set.distance || ''}
                        onChange={(e) => handleUpdateSet(ex.id, exIndex, set.id, setIndex, 'distance', parseFloat(e.target.value) || 0)}
                        className="flex-1 bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-center font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="0"
                      />
                    </>
                  )}

                  <button 
                    onClick={() => toggleSetStatus(ex.id, exIndex, set.id, setIndex)}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                      set.status === 'done' ? "text-emerald-600" : "text-zinc-300 hover:text-zinc-400"
                    )}
                  >
                    {set.status === 'done' ? <CheckCircle2 className="w-7 h-7" /> : <Circle className="w-7 h-7" />}
                  </button>
                  <button
                    onClick={() => handleDeleteSet(ex.id, exIndex, set.id)}
                    type="button"
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-300 hover:text-red-500 transition-colors"
                    title="Satz löschen"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}

              <button 
                onClick={() => handleAddSet(ex.id, exIndex)}
                className="w-full py-2.5 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-500 font-medium text-sm flex items-center justify-center hover:border-emerald-300 hover:text-emerald-600 transition-colors mt-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                Satz hinzufügen
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Exercise Button */}
      <button 
        onClick={() => setShowCatalog(true)}
        className="w-full bg-white border border-zinc-200 text-zinc-900 p-4 rounded-2xl flex items-center justify-center font-bold hover:bg-zinc-50 transition-colors shadow-sm"
      >
        <Plus className="w-5 h-5 mr-2 text-zinc-400" />
        Übung hinzufügen
      </button>

      {/* Complete Training Button */}
      {exercises.length > 0 && (
        <button 
          onClick={toggleTrainingStatus}
          className={cn(
            "w-full p-4 rounded-2xl flex items-center justify-center font-bold transition-colors shadow-sm",
            training.status === 'active' 
              ? "bg-emerald-600 text-white hover:bg-emerald-700" 
              : "bg-zinc-900 text-white hover:bg-zinc-800"
          )}
        >
          <Check className="w-5 h-5 mr-2" />
          {training.status === 'active' ? 'Training abschließen' : 'Training wieder öffnen'}
        </button>
      )}

      {/* Exercise Catalog Modal */}
      {showCatalog && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="p-4 border-b border-zinc-200 flex items-center gap-3 bg-white sticky top-0">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Übung suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-100 border-transparent rounded-xl pl-10 pr-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-all"
                autoFocus
              />
            </div>
            <button 
              onClick={() => setShowCatalog(false)}
              className="p-3 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {filteredCatalog.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => handleAddExercise(ex.id)}
                  className="w-full text-left p-4 bg-white border border-zinc-200 rounded-2xl hover:border-emerald-300 transition-colors flex justify-between items-center group"
                >
                  <div>
                    <div className="font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors">{ex.name}</div>
                    <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mt-1 flex items-center gap-2">
                      <span>{ex.muscleGroup}</span>
                      {ex.contextDependent && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                          <span>Studio-gebunden</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                </button>
              ))}
              {filteredCatalog.length === 0 && (
                <div className="text-center py-12 text-zinc-500">
                  Keine Übung gefunden.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog 
        isOpen={showDeleteTraining}
        title="Training löschen"
        message="Möchtest du dieses Training wirklich löschen? Alle Übungen und Sätze werden unwiderruflich entfernt."
        onConfirm={handleDeleteTraining}
        onCancel={() => setShowDeleteTraining(false)}
      />
    </div>
  );
}
