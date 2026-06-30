import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Check, Plus, Trash2, BookmarkPlus } from 'lucide-react';
import { cn } from '../lib/utils';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PromptDialog } from '../components/ui/PromptDialog';
import { CompletionCelebration } from '../components/ui/CompletionCelebration';
import { RecommendationDialog } from '../components/ai/RecommendationDialog';
import { ExerciseCard } from '../components/training/ExerciseCard';
import { ExerciseCatalogModal } from '../components/training/ExerciseCatalogModal';
import { TrainingRatingInput } from '../components/training/TrainingRating';
import { useTrainingSession } from '../hooks/useTrainingSession';
import { useTemplates } from '../hooks/useTemplates';

// Seite = Komposition: Daten/Mutationen liegen in useTrainingSession,
// die Übungs-UI in components/training/. Hier nur Header, Karten, Abschluss + Dialoge.
export default function TrainingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    training,
    studioName,
    exercises,
    catalog,
    loading,
    notFound,
    addExercise,
    deleteExercise,
    addSet,
    updateSet,
    deleteSet,
    toggleSetStatus,
    setRir,
    toggleTrainingStatus,
    setRating,
    countCompletedTrainings,
    deleteTraining,
    applyRecommendation,
  } = useTrainingSession(id);
  const { createTemplate } = useTemplates();

  const [showCatalog, setShowCatalog] = useState(false);
  const [showDeleteTraining, setShowDeleteTraining] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [celebrationNumber, setCelebrationNumber] = useState<number | undefined>(undefined);
  const [celebrationSeed, setCelebrationSeed] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  // KI-Empfehlung ist pro Übung: hält die Katalog-ID der Übung, für die der Dialog offen ist.
  const [recommendExerciseId, setRecommendExerciseId] = useState<string | null>(null);

  // Training existiert nicht (mehr) → zurück zur Liste.
  useEffect(() => {
    if (notFound) navigate('/trainings');
  }, [notFound, navigate]);

  const handleSelectExercise = async (catalogExerciseId: string) => {
    if (await addExercise(catalogExerciseId)) setShowCatalog(false);
  };

  const handleToggleTraining = async () => {
    const newStatus = await toggleTrainingStatus();
    if (newStatus === 'completed') {
      setCelebrationNumber(undefined);
      setCelebrationSeed(Math.floor(Math.random() * 1000)); // Zufall im Event-Handler (rein im Render)
      setShowCelebration(true);
      countCompletedTrainings().then((n) => {
        if (n != null) setCelebrationNumber(n);
      });
    }
  };

  const handleCelebrationClose = () => {
    setShowCelebration(false);
    navigate('/trainings');
  };

  const handleDeleteTraining = async () => {
    if (await deleteTraining()) navigate('/trainings');
  };

  // Aktuelle Übungsliste (dedupliziert, in Reihenfolge) als Vorlage speichern.
  const handleSaveTemplate = async (name: string) => {
    const exerciseIds = [...new Set(exercises.map((e) => e.exerciseId))];
    await createTemplate(name, exerciseIds);
    setShowSaveTemplate(false);
  };

  if (loading) return <div className="text-center py-12 text-on-surface-variant">Lade Training...</div>;
  if (!training) return <div className="text-center py-12 text-on-surface-variant">Training nicht gefunden.</div>;

  const isActive = training.status === 'active';

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
            {exercises.length > 0 && (
              <button
                onClick={() => setShowSaveTemplate(true)}
                title="Als Vorlage speichern"
                className="p-2 text-outline hover:text-primary transition-colors rounded-xl hover:bg-primary/5"
              >
                <BookmarkPlus className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowDeleteTraining(true)}
              className="p-2 text-outline hover:text-error transition-colors rounded-xl hover:bg-error-container"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Subjektive Trainingsbewertung — sichtbar/änderbar bei abgeschlossenen Trainings
            (reine Selbsteinschätzung, daher auch unter dem Edit-Lock erlaubt). */}
        {training.status === 'completed' && (
          <div className="mt-2 pt-3 border-t border-surface-container flex justify-center">
            <TrainingRatingInput value={training.rating} onChange={setRating} size="sm" />
          </div>
        )}
      </div>

      {/* Exercises */}
      <div className="space-y-4">
        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            isActive={isActive}
            studioId={training.studioId}
            onDelete={() => deleteExercise(ex.id)}
            onAddSet={() => addSet(ex.id)}
            onUpdateSet={(setId, field, value) => updateSet(ex.id, setId, field, value)}
            onToggleSetStatus={(setId) => toggleSetStatus(ex.id, setId)}
            onDeleteSet={(setId) => deleteSet(ex.id, setId)}
            onSetRir={(rir) => setRir(ex.id, rir)}
            onRecommend={() => setRecommendExerciseId(ex.details.id)}
          />
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
          onClick={handleToggleTraining}
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
        <ExerciseCatalogModal
          catalog={catalog}
          onSelect={handleSelectExercise}
          onClose={() => setShowCatalog(false)}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteTraining}
        title="Training löschen"
        message="Möchtest du dieses Training wirklich löschen? Alle Übungen und Sätze werden unwiderruflich entfernt."
        onConfirm={handleDeleteTraining}
        onCancel={() => setShowDeleteTraining(false)}
      />

      {showSaveTemplate && (
        <PromptDialog
          title="Als Vorlage speichern"
          placeholder="Name (z.B. Push A, Beine)"
          initialValue={format(parseISO(training.date), 'EEEE', { locale: de })}
          onConfirm={handleSaveTemplate}
          onCancel={() => setShowSaveTemplate(false)}
        />
      )}

      {recommendExerciseId && training && (
        <RecommendationDialog
          studioId={training.studioId}
          date={training.date}
          exercises={exercises
            .filter((e) => e.details.id === recommendExerciseId)
            .map((e) => ({ exerciseId: e.details.id, name: e.details.name, type: e.details.type }))}
          onApply={applyRecommendation}
          onClose={() => setRecommendExerciseId(null)}
        />
      )}

      <CompletionCelebration
        isOpen={showCelebration}
        trainingNumber={celebrationNumber}
        messageSeed={celebrationSeed}
        rating={training.rating}
        onRate={setRating}
        onClose={handleCelebrationClose}
      />
    </div>
  );
}
