import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Training, TrainingExercise, TrainingSet, Exercise } from '../types';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Check, Plus, Trash2, X, Search, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LastSessionLabel } from '../components/LastSessionLabel';

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
        const trainingRef = doc(db, 'users', user.uid, 'trainings', id);
        const trainingSnap = await getDoc(trainingRef);
        if (!trainingSnap.exists()) { navigate('/trainings'); return; }

        const tData = { id: trainingSnap.id, ...trainingSnap.data() } as Training;
        setTraining(tData);

        if (tData.studioId) {
          const studioSnap = await getDoc(doc(db, 'users', user.uid, 'studios', tData.studioId));
          if (studioSnap.exists()) setStudioName(studioSnap.data().name);
        }

        const catalogRef = collection(db, 'exercises');
        const catalogSnap = await getDocs(catalogRef);
        const catalogData: Exercise[] = [];
        catalogSnap.forEach(doc => catalogData.push({ id: doc.id, ...doc.data() } as Exercise));
        setCatalog(catalogData);

        const exercisesRef = collection(db, 'users', user.uid, 'trainings', id, 'exercises');
        const qExercises = query(exercisesRef, orderBy('order', 'asc'));
        const exercisesSnap = await getDocs(qExercises);

        const loadedExercises: (TrainingExercise & { details: Exercise, sets: TrainingSet[] })[] = [];
        for (const exDoc of exercisesSnap.docs) {
          const exData = { id: exDoc.id, ...exDoc.data() } as TrainingExercise;
          const details = catalogData.find(e => e.id === exData.exerciseId);
          if (details) {
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
      const docRef = await addDoc(exercisesRef, { exerciseId, order: newOrder, status: 'open' });
      const details = catalog.find(e => e.id === exerciseId);
      if (details) {
        setExercises([...exercises, { id: docRef.id, exerciseId, order: newOrder, status: 'open', details, sets: [] }]);
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

    let newSetData: Partial<TrainingSet> = { order: newOrder, status: 'open' };
    if (exercise.sets.length > 0) {
      const lastSet = exercise.sets[exercise.sets.length - 1];
      if (lastSet.reps !== undefined) newSetData.reps = lastSet.reps;
      if (lastSet.weight !== undefined) newSetData.weight = lastSet.weight;
      if (lastSet.duration !== undefined) newSetData.duration = lastSet.duration;
      if (lastSet.distance !== undefined) newSetData.distance = lastSet.distance;
    } else {
      if (exercise.details.type === 'weighted') { newSetData.reps = 10; newSetData.weight = 0; }
      else if (exercise.details.type === 'reps_only') { newSetData.reps = 10; }
      else if (exercise.details.type === 'cardio_basic') { newSetData.duration = 15; newSetData.distance = 0; }
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
    const updatedExercises = [...exercises];
    const updatedSets = [...updatedExercises[exIndex].sets];
    updatedSets[setIndex] = { ...updatedSets[setIndex], [field]: value };
    updatedExercises[exIndex] = { ...updatedExercises[exIndex], sets: updatedSets };
    setExercises(updatedExercises);

    try {
      const setRef = doc(db, 'users', user.uid, 'trainings', id, 'exercises', exerciseId, 'sets', setId);
      await updateDoc(setRef, { [field]: value });
    } catch (error) {
      console.error("Error updating set:", error);
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
    await handleUpdateSet(exerciseId, exIndex, setId, setIndex, 'status', currentStatus === 'open' ? 'done' : 'open');
  };

  const toggleTrainingStatus = async () => {
    if (!user || !db || !id || !training) return;
    const newStatus = training.status === 'active' ? 'completed' : 'active';
    try {
      await updateDoc(doc(db, 'users', user.uid, 'trainings', id), { status: newStatus });
      setTraining({ ...training, status: newStatus });
      if (newStatus === 'completed') navigate('/trainings');
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

  if (loading) return <div className="text-center py-12 text-on-surface-variant">Lade Training...</div>;
  if (!training) return <div className="text-center py-12 text-on-surface-variant">Training nicht gefunden.</div>;

  const isActive = training.status === 'active';

  const filteredCatalog = catalog.filter(ex =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container shadow-sm">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-xl font-headline font-bold text-on-surface">
              {format(parseISO(training.date), 'EEEE, dd. MMM yyyy', { locale: de })}
            </h2>
            <p className="text-sm font-medium text-on-surface-variant">{studioName}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider",
              training.status === 'active'
                ? "bg-amber-100 text-amber-700"
                : "bg-primary/10 text-primary"
            )}>
              {training.status === 'active' ? 'Aktiv' : 'Abgeschlossen'}
            </div>
            <button
              onClick={() => setShowDeleteTraining(true)}
              className="p-2 text-outline hover:text-error transition-colors rounded-xl hover:bg-error-container"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Exercises */}
      <div className="space-y-4">
        {exercises.map((ex, exIndex) => (
          <div key={ex.id} className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm overflow-hidden">
            <div className="p-4 border-b border-surface-container flex justify-between items-center bg-surface-container-low">
              <div>
                <button
                  onClick={() => navigate(`/exercises/${ex.details.id}`)}
                  className="font-bold text-on-surface hover:text-primary transition-colors text-left"
                >
                  {ex.details.name}
                </button>
                {training.status === 'active' && (
                  <LastSessionLabel
                    exerciseId={ex.details.id}
                    exerciseType={ex.details.type}
                    contextDependent={ex.details.contextDependent}
                    currentStudioId={training.studioId}
                  />
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-md">
                    {ex.details.muscleGroup}
                  </span>
                  {ex.details.contextDependent && (
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100 text-[10px] font-bold uppercase tracking-wider">
                      Studio-gebunden
                    </span>
                  )}
                </div>
              </div>
              {isActive && (
                <button
                  onClick={() => handleDeleteExercise(ex.id)}
                  className="text-outline hover:text-error p-2 -mr-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-4 space-y-3">
              {/* Sets Header */}
              {ex.sets.length > 0 && (
                <div className="flex text-xs font-semibold text-outline uppercase tracking-wider px-2">
                  <div className="w-8 text-center">Set</div>
                  {ex.details.type === 'weighted' && (
                    <>
                      <div className="flex-1 text-center">kg</div>
                      <div className="flex-1 text-center">Reps</div>
                    </>
                  )}
                  {ex.details.type === 'reps_only' && <div className="flex-1 text-center">Reps</div>}
                  {ex.details.type === 'cardio_basic' && (
                    <>
                      <div className="flex-1 text-center">Min</div>
                      <div className="flex-1 text-center">km</div>
                    </>
                  )}
                  <div className="w-10" />
                </div>
              )}

              {/* Sets */}
              {ex.sets.map((set, setIndex) => (
                <div
                  key={set.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-xl transition-colors duration-150",
                    set.status === 'done' ? "bg-primary/10" : "bg-surface-container-low"
                  )}
                >
                  <div className="w-8 text-center font-bold text-outline text-sm">{setIndex + 1}</div>

                  {ex.details.type === 'weighted' && (
                    <>
                      <input
                        type="number"
                        value={set.weight || ''}
                        onChange={(e) => handleUpdateSet(ex.id, exIndex, set.id, setIndex, 'weight', parseFloat(e.target.value) || 0)}
                        disabled={!isActive}
                        className="flex-1 min-w-0 bg-surface-container-lowest ring-1 ring-outline-variant/30 rounded-xl px-2 py-1.5 text-center font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="0"
                      />
                      <input
                        type="number"
                        value={set.reps || ''}
                        onChange={(e) => handleUpdateSet(ex.id, exIndex, set.id, setIndex, 'reps', parseInt(e.target.value) || 0)}
                        disabled={!isActive}
                        className="flex-1 min-w-0 bg-surface-container-lowest ring-1 ring-outline-variant/30 rounded-xl px-2 py-1.5 text-center font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="0"
                      />
                    </>
                  )}

                  {ex.details.type === 'reps_only' && (
                    <input
                      type="number"
                      value={set.reps || ''}
                      onChange={(e) => handleUpdateSet(ex.id, exIndex, set.id, setIndex, 'reps', parseInt(e.target.value) || 0)}
                      disabled={!isActive}
                      className="flex-1 min-w-0 bg-surface-container-lowest ring-1 ring-outline-variant/30 rounded-xl px-2 py-1.5 text-center font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
                      placeholder="0"
                    />
                  )}

                  {ex.details.type === 'cardio_basic' && (
                    <>
                      <input
                        type="number"
                        value={set.duration || ''}
                        onChange={(e) => handleUpdateSet(ex.id, exIndex, set.id, setIndex, 'duration', parseInt(e.target.value) || 0)}
                        disabled={!isActive}
                        className="flex-1 min-w-0 bg-surface-container-lowest ring-1 ring-outline-variant/30 rounded-xl px-2 py-1.5 text-center font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="0"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={set.distance || ''}
                        onChange={(e) => handleUpdateSet(ex.id, exIndex, set.id, setIndex, 'distance', parseFloat(e.target.value) || 0)}
                        disabled={!isActive}
                        className="flex-1 min-w-0 bg-surface-container-lowest ring-1 ring-outline-variant/30 rounded-xl px-2 py-1.5 text-center font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="0"
                      />
                    </>
                  )}

                  <button
                    onClick={() => toggleSetStatus(ex.id, exIndex, set.id, setIndex)}
                    disabled={!isActive}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-xl transition-colors duration-150 disabled:cursor-not-allowed",
                      set.status === 'done' ? "text-primary" : "text-outline hover:text-on-surface-variant"
                    )}
                  >
                    {set.status === 'done' ? <CheckCircle2 className="w-7 h-7" /> : <Circle className="w-7 h-7" />}
                  </button>
                  {isActive && (
                    <button
                      onClick={() => handleDeleteSet(ex.id, exIndex, set.id)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl text-outline hover:text-error transition-colors duration-150"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}

              {isActive && (
                <button
                  onClick={() => handleAddSet(ex.id, exIndex)}
                  className="w-full py-2.5 border-2 border-dashed border-surface-container rounded-xl text-on-surface-variant font-medium text-sm flex items-center justify-center hover:border-primary/20 hover:text-primary transition-all duration-150 mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Satz hinzufügen
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Exercise */}
      {isActive && (
        <button
          onClick={() => setShowCatalog(true)}
          className="w-full bg-surface-container-lowest border border-surface-container text-on-surface p-4 rounded-2xl flex items-center justify-center font-bold hover:bg-surface-container-low hover:border-primary/20 transition-all duration-150 shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2 text-primary" />
          Übung hinzufügen
        </button>
      )}

      {/* Complete Training */}
      {exercises.length > 0 && (
        <button
          onClick={toggleTrainingStatus}
          className={cn(
            "w-full h-14 rounded-2xl flex items-center justify-center font-bold transition-all duration-150 shadow-lg active:scale-[0.97]",
            training.status === 'active'
              ? "bg-primary text-on-primary shadow-primary/20 hover:bg-primary-container"
              : "bg-on-surface text-surface-container-lowest hover:bg-on-surface-variant"
          )}
        >
          <Check className="w-5 h-5 mr-2" />
          {training.status === 'active' ? 'Training abschließen' : 'Training wieder öffnen'}
        </button>
      )}

      {/* Catalog Modal */}
      {showCatalog && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="p-4 border-b border-surface-container flex items-center gap-3 bg-surface-container-lowest sticky top-0">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
              <input
                type="text"
                placeholder="Übung suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-14 bg-surface-container-low ring-1 ring-outline-variant/30 rounded-2xl pl-12 pr-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-150"
                autoFocus
              />
            </div>
            <button
              onClick={() => setShowCatalog(false)}
              className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center hover:bg-surface-container-highest transition-all duration-150 active:scale-90"
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
                  className="w-full text-left p-4 bg-surface-container-lowest border border-surface-container rounded-2xl hover:border-primary/20 hover:shadow-sm transition-all duration-150 active:scale-[0.98] flex justify-between items-center group"
                >
                  <div>
                    <div className="font-bold text-on-surface">{ex.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-md">
                        {ex.muscleGroup}
                      </span>
                      {ex.contextDependent && (
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100 text-[10px] font-bold uppercase tracking-wider">
                          Studio-gebunden
                        </span>
                      )}
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-outline group-hover:text-primary transition-colors" />
                </button>
              ))}
              {filteredCatalog.length === 0 && (
                <div className="text-center py-12 text-on-surface-variant">Keine Übung gefunden.</div>
              )}
            </div>
          </div>
        </div>
      )}

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
