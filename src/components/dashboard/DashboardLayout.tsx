import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, User, Bell, ChevronDown, Menu, X, Shield,
  Stethoscope, HeartPulse, ShieldCheck, Sparkles, Check
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, Link } from '@/lib/router';
import { notificationApi } from '@/lib/api';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

interface DashboardLayoutProps {
  title: string;
  roleBadgeText: string;
  roleBadgeColor: 'emerald' | 'teal' | 'indigo' | 'amber';
  navItems: NavItem[];
  activeNav: string;
  onSelectNav: (id: string) => void;
  children: React.ReactNode;
}

export function DashboardLayout({
  title,
  roleBadgeText,
  roleBadgeColor,
  navItems,
  activeNav,
  onSelectNav,
  children,
}: DashboardLayoutProps) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const fetchNotifications = async () => {
      try {
        const res = await notificationApi.getNotifications();
        if (mounted && res && res.status === 'success') {
          setNotifications(res.notifications || []);
          setUnreadCount(res.unread_count || 0);
        }
      } catch (err) {
        // Silently tolerate if not logged in yet
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (e) {}
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      try {
        await notificationApi.markRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: 1 } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (e) {}
    }
    if (notif.link) {
      setNotifOpen(false);
      navigate(notif.link);
    }
  };

  const getRoleClasses = () => {
    switch (roleBadgeColor) {
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'teal':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
      case 'indigo':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'amber':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="parakh-dashboard min-h-screen bg-[#070B14] text-slate-100 flex flex-col lg:flex-row">
      {/* SIDEBAR: Desktop */}
      <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-slate-800/80 bg-slate-950/70 p-5 backdrop-blur-xl shrink-0">
        <div className="space-y-6">
          {/* Logo & Platform Name */}
          <Link to="/" className="flex items-center gap-2.5 px-2">
            <div className="relative flex h-9 w-9 items-center justify-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/40">
                <Activity className="h-5 w-5 text-emerald-400" />
              </span>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1">
                PARAKH <span className="text-[10px] text-emerald-400 font-semibold">परख</span>
              </span>
              <p className="text-[9px] uppercase tracking-wider text-slate-500 font-medium">Healthcare Ecosystem</p>
            </div>
          </Link>

          {/* Role Pill */}
          <div className="px-2">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getRoleClasses()}`}>
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{roleBadgeText}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectNav(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom User & Logout */}
        <div className="border-t border-slate-800/80 pt-4 space-y-3">
          <div className="flex items-center gap-2.5 px-2">
            <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-emerald-400 ring-1 ring-slate-700">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="truncate flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.full_name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>

        </div>
      </aside>

      {/* MOBILE TOPBAR */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
        <Link to="/" className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-400" />
          <span className="font-bold text-white text-base">PARAKH</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-400 hover:text-white p-1"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* MOBILE MENU DROPDOWN */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-slate-800 bg-slate-950 p-4 space-y-3">
          <div className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${getRoleClasses()}`}>
            {roleBadgeText}
          </div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectNav(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${
                    isActive ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="text-[10px] text-amber-400 font-bold">{item.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-bold text-white capitalize">{title}</h1>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Public Portal
            </Link>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-slate-950">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-2xl space-y-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1.5">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-2.5 rounded-lg border border-slate-800/60 cursor-pointer transition-colors ${
                            n.is_read ? 'opacity-70 bg-slate-900/40 hover:bg-slate-800/40' : 'bg-slate-800/80 hover:bg-slate-800 border-emerald-500/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-white truncate">{n.title}</p>
                            {!n.is_read && (
                              <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 ml-2" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                          <span className="text-[9px] text-slate-500 mt-1.5 block">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Toggle */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-700"
              >
                <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px]">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <span className="hidden sm:inline max-w-[120px] truncate">{user?.full_name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl space-y-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="text-xs font-semibold text-white truncate">{user?.full_name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                    <span className="mt-1 inline-block text-[10px] font-mono uppercase text-emerald-400">
                      Role: {user?.role}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onSelectNav('settings');
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Account Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Child Pages Body */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
