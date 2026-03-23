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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="bg-surface-container-lowest border-b border-surface-container sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center">
          <h1 className="font-headline font-extrabold text-on-surface">Trainingsapp</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 pb-28">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 rounded-t-[32px] bg-white/80 backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        <div className="max-w-md mx-auto flex justify-around items-center px-4 pb-8 pt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
                             (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center space-y-1 text-xs transition-all duration-150 active:scale-90",
                  isActive
                    ? "bg-primary/10 text-primary rounded-2xl p-3"
                    : "text-zinc-400 p-3 hover:text-primary"
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
