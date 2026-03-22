import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Exercise } from '../types';

export const EXERCISE_SEED: Omit<Exercise, 'id'>[] = [
  // Strength weighted, context_dependent: true
  { name: 'GTS Butterfly einarmig', type: 'weighted', muscleGroup: 'Brust', contextDependent: true },
  { name: 'Maschine Abduktor', type: 'weighted', muscleGroup: 'Beine', contextDependent: true },
  { name: 'Maschine Adduktor', type: 'weighted', muscleGroup: 'Beine', contextDependent: true },
  { name: 'Maschine Bauchcrunch', type: 'weighted', muscleGroup: 'Core', contextDependent: true },
  { name: 'Maschine Beinbeuger', type: 'weighted', muscleGroup: 'Beine', contextDependent: true },
  { name: 'Maschine Beinbeuger liegend', type: 'weighted', muscleGroup: 'Beine', contextDependent: true },
  { name: 'Maschine Beinstrecker', type: 'weighted', muscleGroup: 'Beine', contextDependent: true },
  { name: 'Maschine Brustpresse', type: 'weighted', muscleGroup: 'Brust', contextDependent: true },
  { name: 'Maschine Butterfly gestreckte Arme', type: 'weighted', muscleGroup: 'Brust', contextDependent: true },
  { name: 'Maschine Butterfly Reverse gestreckte Arme', type: 'weighted', muscleGroup: 'Schultern / Rücken', contextDependent: true },
  { name: 'Maschine Butterfly Reverse gestreckte Arme proniert', type: 'weighted', muscleGroup: 'Schultern / Rücken', contextDependent: true },
  { name: 'Maschine Klimmzüge mit Unterstützung', type: 'weighted', muscleGroup: 'Rücken', contextDependent: true },
  { name: 'Maschine Latzug', type: 'weighted', muscleGroup: 'Rücken', contextDependent: true },
  { name: 'Maschine Rudern', type: 'weighted', muscleGroup: 'Rücken', contextDependent: true },
  { name: 'Maschine Rückenstrecker', type: 'weighted', muscleGroup: 'Rücken', contextDependent: true },
  { name: 'Maschine Schrägbankdrücken', type: 'weighted', muscleGroup: 'Brust', contextDependent: true },
  { name: 'Maschine Schulterdrücken', type: 'weighted', muscleGroup: 'Schultern', contextDependent: true },
  { name: 'Seilzug Bizeps Curls', type: 'weighted', muscleGroup: 'Bizeps', contextDependent: true },
  { name: 'Seilzug Butterfly einarmig nach unten', type: 'weighted', muscleGroup: 'Brust', contextDependent: true },
  { name: 'Seilzug Butterfly nach oben stehend', type: 'weighted', muscleGroup: 'Brust', contextDependent: true },
  { name: 'Seilzug Butterfly nach unten', type: 'weighted', muscleGroup: 'Brust', contextDependent: true },
  { name: 'Seilzug Butterfly Reverse einarmig', type: 'weighted', muscleGroup: 'Schultern / Rücken', contextDependent: true },
  { name: 'Seilzug Latziehen zur Brust', type: 'weighted', muscleGroup: 'Rücken', contextDependent: true },
  { name: 'Seilzug Rudern eng', type: 'weighted', muscleGroup: 'Rücken', contextDependent: true },
  { name: 'Seilzug Rudern im Untergriff', type: 'weighted', muscleGroup: 'Rücken', contextDependent: true },
  { name: 'Seilzug Rudern weit sitzend', type: 'weighted', muscleGroup: 'Rücken', contextDependent: true },
  { name: 'Seilzug Rumpfrotation', type: 'weighted', muscleGroup: 'Core', contextDependent: true },
  { name: 'Seilzug Seitheben einarmig', type: 'weighted', muscleGroup: 'Schultern', contextDependent: true },
  { name: 'Seilzug Trizepsdrücken einarmig im Obergriff', type: 'weighted', muscleGroup: 'Trizeps', contextDependent: true },
  { name: 'Seilzug Trizepsdrücken im Obergriff', type: 'weighted', muscleGroup: 'Trizeps', contextDependent: true },

  // Strength weighted, context_dependent: false
  { name: 'Core Bag Kniebeugen', type: 'weighted', muscleGroup: 'Beine', contextDependent: false },
  { name: 'Kettlebell Schulterdrücken einarmig', type: 'weighted', muscleGroup: 'Schultern', contextDependent: false },
  { name: 'Kurzhantel Arnold Press', type: 'weighted', muscleGroup: 'Schultern', contextDependent: false },
  { name: 'Kurzhantel Bizeps Curls einarmig', type: 'weighted', muscleGroup: 'Bizeps', contextDependent: false },
  { name: 'Kurzhantel Butterfly Reverse einarmig vorgebeugt', type: 'weighted', muscleGroup: 'Schultern / Rücken', contextDependent: false },
  { name: 'Kurzhantel Butterfly Reverse stehend', type: 'weighted', muscleGroup: 'Schultern / Rücken', contextDependent: false },
  { name: 'Kurzhantel Seitheben', type: 'weighted', muscleGroup: 'Schultern', contextDependent: false },
  { name: 'Kurzhantel Schulterdrücken einarmig', type: 'weighted', muscleGroup: 'Schultern', contextDependent: false },
  { name: 'Kurzhantel Schulterheben', type: 'weighted', muscleGroup: 'Trapez', contextDependent: false },
  { name: 'Kurzhantel Schulterheben stehend', type: 'weighted', muscleGroup: 'Trapez', contextDependent: false },
  { name: 'Langhantel Bankdrücken', type: 'weighted', muscleGroup: 'Brust', contextDependent: false },
  { name: 'Langhantel Rudern vorgebeugt', type: 'weighted', muscleGroup: 'Rücken', contextDependent: false },

  // Strength reps only
  { name: 'Beinheben im Hang mit Kontakt', type: 'reps_only', muscleGroup: 'Core', contextDependent: false },
  { name: 'Dips', type: 'reps_only', muscleGroup: 'Brust / Trizeps', contextDependent: false },
  { name: 'Equalizer Liegestütze', type: 'reps_only', muscleGroup: 'Brust', contextDependent: false },
  { name: 'Liegestütze', type: 'reps_only', muscleGroup: 'Brust', contextDependent: false },
  { name: 'Theraband Butterfly Reverse', type: 'reps_only', muscleGroup: 'Schultern / Rücken', contextDependent: false },

  // Cardio basic
  { name: 'Indoor Cycle', type: 'cardio_basic', muscleGroup: 'Cardio', contextDependent: false },
  { name: 'Laufband', type: 'cardio_basic', muscleGroup: 'Cardio', contextDependent: false },
  { name: 'Rudern Ergometer', type: 'cardio_basic', muscleGroup: 'Cardio', contextDependent: false },
];

export async function seedExercises() {
  if (!db) return;
  
  const exercisesRef = collection(db, 'exercises');
  const snapshot = await getDocs(exercisesRef);
  
  if (!snapshot.empty) {
    console.log('Exercises already seeded.');
    return;
  }

  console.log('Seeding exercises...');
  for (const exercise of EXERCISE_SEED) {
    // Generate a simple ID based on the name
    const id = exercise.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await setDoc(doc(exercisesRef, id), {
      ...exercise,
      id
    });
  }
  console.log('Seeding complete.');
}
