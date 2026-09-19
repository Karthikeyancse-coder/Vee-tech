import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  Radio,
  ShieldCheck,
  MoreHorizontal,
  TrendingUp,
  FileText,
  Newspaper,
  Database,
  Bell,
  X
} from 'lucide-react';

interface MobileBottomNavProps {
  criticalCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ criticalCount }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close sheet on route changes
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  // Prevent background scroll when More sheet is open
  useEffect(() => {
    if (isMoreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMoreOpen]);

  // Check if any "More" route is currently active
  const isMoreRouteActive = [
    '/analysis',
    '/dashboard/analysis',
    '/reports',
    '/dashboard/reports',
    '/news',
    '/dashboard/news',
    '/sources',
    '/dashboard/sources',
    '/alerts',
    '/dashboard/alerts'
  ].some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));

  const primaryNavItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      isActive: location.pathname === '/' || location.pathname === '/dashboard'
    },
    {
      id: 'war-room',
      label: 'Crisis War Room',
      path: '/crisis-war-room',
      icon: AlertTriangle,
      isActive: location.pathname.includes('crisis-war-room')
    },
    {
      id: 'competitor-radar',
      label: 'Competitor Radar',
      path: '/competitor-radar',
      icon: Radio,
      isActive: location.pathname.includes('competitor-radar')
    },
    {
      id: 'sla-engine',
      label: 'SLA Engine',
      path: '/sla-proof-engine',
      icon: ShieldCheck,
      isActive: location.pathname.includes('sla-proof-engine')
    }
  ];

  const moreSections = [
    {
      title: 'ANALYTICS',
      items: [
        {
          label: 'Analysis',
          path: '/analysis',
          icon: TrendingUp,
          description: 'Sentiment & trend analytics'
        },
        {
          label: 'Reports',
          path: '/reports',
          icon: FileText,
          description: 'Executive dossiers & exports'
        }
      ]
    },
    {
      title: 'INTELLIGENCE',
      items: [
        {
          label: 'News Feed',
          path: '/news',
          icon: Newspaper,
          description: 'Real-time telemetry wire'
        },
        {
          label: 'Sources',
          path: '/sources',
          icon: Database,
          description: 'Configured intelligence sources'
        },
        {
          label: 'Alerts',
          path: '/alerts',
          icon: Bell,
          description: 'Critical high-risk signals',
          hasBadge: criticalCount > 0,
          badgeCount: criticalCount
        }
      ]
    }
  ];

  return (
    <>
      {/* 1. FIXED BOTTOM NAVIGATION BAR (< 768px ONLY) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="h-[68px] flex items-center justify-around">
          {/* 4 Primary Nav Links */}
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive;

            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors select-none cursor-pointer group ${
                  active ? 'text-rose-600 font-semibold' : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <div
                  className={`relative p-1 rounded-xl transition-all ${
                    active ? 'bg-rose-50 text-rose-600 scale-105' : 'group-hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-5 h-5 transition-transform" />
                  {active && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-600" />
                  )}
                </div>
                <span
                  className={`text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-[64px] ${
                    active ? 'font-bold text-rose-600' : 'text-slate-500'
                  }`}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {/* 5th Item: More Button */}
          <button
            onClick={() => setIsMoreOpen((prev) => !prev)}
            aria-expanded={isMoreOpen}
            aria-label="Open more navigation items"
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors select-none cursor-pointer group ${
              isMoreRouteActive || isMoreOpen
                ? 'text-rose-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div
              className={`relative p-1 rounded-xl transition-all ${
                isMoreRouteActive || isMoreOpen
                  ? 'bg-rose-50 text-rose-600 scale-105'
                  : 'group-hover:bg-slate-50'
              }`}
            >
              <MoreHorizontal className="w-5 h-5 transition-transform" />
              {criticalCount > 0 && !isMoreOpen && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-600 rounded-full ring-2 ring-white" />
              )}
              {isMoreRouteActive && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-600" />
              )}
            </div>
            <span
              className={`text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-[64px] ${
                isMoreRouteActive || isMoreOpen ? 'font-bold text-rose-600' : 'text-slate-500'
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* 2. MOBILE MORE MENU (BOTTOM SHEET) */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setIsMoreOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Bottom Sheet Card */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More Navigation"
            className="relative z-50 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 p-5 space-y-5 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-250 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            {/* Header / Grab Handle */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  More Intelligence
                </h3>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Sections */}
            <div className="space-y-4">
              {moreSections.map((sec) => (
                <div key={sec.title} className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2">
                    {sec.title}
                  </span>
                  <div className="grid grid-cols-1 gap-1">
                    {sec.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        location.pathname === item.path ||
                        location.pathname.startsWith(`${item.path}/`);

                      return (
                        <button
                          key={item.path}
                          onClick={() => {
                            navigate(item.path);
                            setIsMoreOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                            isActive
                              ? 'bg-rose-50 text-rose-600 font-semibold'
                              : 'hover:bg-slate-50 text-slate-700 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                isActive ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold leading-tight">{item.label}</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                {item.description}
                              </div>
                            </div>
                          </div>

                          {item.hasBadge && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-rose-600 text-white">
                              {item.badgeCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Live System Indicator in Sheet */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-slate-800">System Online</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Supabase Live</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
