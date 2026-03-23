import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Weight from './pages/Weight';
import Trainings from './pages/Trainings';
import NewTraining from './pages/NewTraining';
import TrainingDetail from './pages/TrainingDetail';
import Exercises from './pages/Exercises';
import ExerciseDetail from './pages/ExerciseDetail';

const Login = () => {
  const { user, loading, signInWithGoogle } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Laden...</div>;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="max-w-sm w-full bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-surface-container text-center">
        <h1 className="text-2xl font-headline font-extrabold text-on-surface mb-2">Trainingsapp</h1>
        <p className="text-on-surface-variant mb-8">Logge dich ein, um dein Training zu erfassen.</p>
        <button
          onClick={signInWithGoogle}
          className="w-full h-14 bg-primary text-on-primary font-bold rounded-2xl hover:bg-primary-container transition-all duration-150 shadow-lg shadow-primary/20 active:scale-[0.97]"
        >
          Mit Google anmelden
        </button>
      </div>
    </div>
  );
};

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Laden...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/trainings" element={<ProtectedRoute><Trainings /></ProtectedRoute>} />
          <Route path="/trainings/new" element={<ProtectedRoute><NewTraining /></ProtectedRoute>} />
          <Route path="/trainings/:id" element={<ProtectedRoute><TrainingDetail /></ProtectedRoute>} />
          <Route path="/exercises" element={<ProtectedRoute><Exercises /></ProtectedRoute>} />
          <Route path="/exercises/:exerciseId" element={<ProtectedRoute><ExerciseDetail /></ProtectedRoute>} />
          <Route path="/weight" element={<ProtectedRoute><Weight /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
