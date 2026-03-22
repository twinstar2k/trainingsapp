import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Activity, Scale, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Training', path: '/trainings', icon: Dumbbell },
    { name: 'Übungen', path: '/exercises', icon: Activity },
    { name: 'Gewicht', path: '/weight', icon: Scale },
    { name: 'Profil', path: '/profile', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-semibold text-zinc-900">Trainingsapp</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24">
        {children}
      </main>

      {/* Bottom Navigation (Mobile First) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 pb-safe">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
                             (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs",
                  isActive ? "text-emerald-600 font-medium" : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
