/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Square,
  Triangle,
  Clock, 
  StickyNote, 
  Bell, 
  Mic, 
  Volume2, 
  Share2, 
  LogOut, 
  Calendar, 
  Tag, 
  ChevronRight, 
  Trash2, 
  AlertTriangle,
  MoreVertical,
  X,
  Play,
  Pause,
  Save,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Settings,
  MessageCircle,
  Sparkles,
  BarChart3,
  ExternalLink,
  Briefcase,
  User as UserIcon,
  Home,
  Heart,
  ShoppingCart,
  GraduationCap,
  ListTodo,
  Dumbbell,
  Wallet,
  MailOpen,
  CreditCard,
  Utensils,
  Plane,
  Lightbulb,
  FolderKanban,
  Folder,
  Key,
  Search,
  RefreshCw,
  Image as ImageIcon,
  TrendingUp,
  History,
  Copy,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  or,
  and,
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp, 
  orderBy,
  limit,
  getDocFromServer,
  setDoc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  writeBatch,
  deleteField
} from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
import { auth, db } from './firebase';
import type { 
  Task, 
  Note, 
  Reminder, 
  TaskStatus, 
  Subtask, 
  Project, 
  Budget, 
  Expense, 
  BudgetConcept, 
  AppNotification 
} from './types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toPng } from 'html-to-image';
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import { GoogleGenAI } from "@google/genai";

// --- AI Proxy Helper ---
const getLocalAIKey = () => localStorage.getItem('GEMINI_API_KEY') || localStorage.getItem('MY_GEMINI_API_KEY') || undefined;

// --- Configuración de Entorno ---
const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }
  return 'https://chatbot-gemini.onrender.com';
};
const BASE_URL = getBackendUrl();

const generateAIContent = async (prompt: string, config?: any, systemInstruction?: string, apiKey?: string) => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const hasBackendUrl = !!import.meta.env.VITE_BACKEND_URL;
  const sdkKey = apiKey || getLocalAIKey() || (import.meta.env.VITE_GEMINI_API_KEY) || "";

  // --- MODO DIRECTO (SDK de Google) ---
  // Se activa automáticamente si no estamos en localhost y no hay VITE_BACKEND_URL (Entorno AI Studio)
  const isAIStudioMode = !isLocal && !hasBackendUrl;

  if (isAIStudioMode || (sdkKey && !hasBackendUrl)) {
    if (!sdkKey) {
      throw new Error("No se encontró una API Key para el modo directo de AI Studio.");
    }
    try {
      const ai = new GoogleGenAI({ apiKey: sdkKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          ...config,
          systemInstruction: systemInstruction || "Eres TaskMaster AI."
        }
      });
      return response;
    } catch (e) {
      console.error("Error en modo directo SDK:", e);
      if (isAIStudioMode) throw e;
    }
  }

  // --- MODO BACKEND (Render / Local) ---
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt, 
        config, 
        systemInstruction,
        apiKey: sdkKey 
      })
    });
    
    if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
    
    const data = await response.json();
    // Normalizamos: aceptamos 'text' o 'respuesta' (compatibilidad con server.js local)
    const normalizedText = data.text || data.respuesta || "";
    return { ...data, text: normalizedText };
  } catch (err) {
    console.error("Error de conexión con el Backend:", err);
    // Si falla el backend en producción pero tenemos clave, intentamos SDK como último recurso
    if (!isLocal && sdkKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: sdkKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: { ...config, systemInstruction: systemInstruction || "Eres TaskMaster AI." }
        });
        return response;
      } catch (sdkErr) {
        throw new Error("Error de conexión con el servidor y el SDK falló.");
      }
    }
    throw new Error(`No se pudo conectar con el servidor en ${BASE_URL || 'la nube'}.`);
  }
};

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Environment Detection ---
const APP_VERSION = '1.0.1';

const getAppEnvironment = () => {
  if ((window as any).APP_ENVIRONMENT) return (window as any).APP_ENVIRONMENT;
  const host = window.location.hostname;
  const href = window.location.href;
  if (host.includes('ais-dev') || href.includes('ais-dev')) return 'development';
  if (host.includes('ais-pre') || href.includes('ais-pre') || host.includes('ais-test') || href.includes('ais-test')) return 'testing';
  return 'production';
};

// --- Environment Indicator ---
const EnvironmentIndicator = () => {
  const env = getAppEnvironment();
  
  const config = {
    development: {
      icon: <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />,
      label: 'Desarrollo',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50/80'
    },
    testing: {
      icon: <Square className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />,
      label: 'Pruebas',
      color: 'text-amber-600',
      bg: 'bg-amber-50/80'
    },
    production: {
      icon: <Triangle className="w-2.5 h-2.5 fill-blue-500 text-blue-500" />,
      label: 'Producción',
      color: 'text-blue-600',
      bg: 'bg-blue-50/80'
    }
  }[env as 'development' | 'testing' | 'production'] || {
    icon: <Triangle className="w-2.5 h-2.5 fill-blue-500 text-blue-500" />,
    label: 'Producción',
    color: 'text-blue-600',
    bg: 'bg-blue-50/80'
  };

  return (
    <div className={`fixed bottom-20 left-4 z-[60] flex items-center gap-2 ${config.bg} backdrop-blur-md px-2.5 py-1 rounded-full border border-neutral-200 shadow-sm pointer-events-none sm:bottom-6 sm:left-6`}>
      {config.icon}
      <span className={`text-[9px] font-bold uppercase tracking-widest ${config.color}`}>
        {config.label} <span className="opacity-40 ml-1">v{APP_VERSION}</span>
      </span>
    </div>
  );
};

// --- Components ---

const audioCache = new Map<string, string>();

const getCategoryStyle = (category: string) => {
  const cat = category?.toLowerCase() || 'default';
  const styles: Record<string, { color: string, icon: any, bg: string, border: string, text: string, accent: string }> = {
    trabajo: { color: 'blue', icon: <Briefcase className="w-4 h-4" />, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'bg-blue-500' },
    personal: { color: 'purple', icon: <UserIcon className="w-4 h-4" />, bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-500' },
    hogar: { color: 'orange', icon: <Home className="w-4 h-4" />, bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: 'bg-orange-500' },
    salud: { color: 'emerald', icon: <Heart className="w-4 h-4" />, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'bg-emerald-500' },
    compras: { color: 'pink', icon: <ShoppingCart className="w-4 h-4" />, bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', accent: 'bg-pink-500' },
    estudios: { color: 'indigo', icon: <GraduationCap className="w-4 h-4" />, bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', accent: 'bg-indigo-500' },
    deportes: { color: 'rose', icon: <Dumbbell className="w-4 h-4" />, bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', accent: 'bg-rose-500' },
    finanzas: { color: 'cyan', icon: <Wallet className="w-4 h-4" />, bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', accent: 'bg-cyan-500' },
    comida: { color: 'orange', icon: <Utensils className="w-4 h-4" />, bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: 'bg-orange-500' },
    viajes: { color: 'sky', icon: <Plane className="w-4 h-4" />, bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', accent: 'bg-sky-500' },
    ideas: { color: 'violet', icon: <Lightbulb className="w-4 h-4" />, bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', accent: 'bg-violet-500' },
    default: { color: 'neutral', icon: <Tag className="w-4 h-4" />, bg: 'bg-white', border: 'border-neutral-200', text: 'text-neutral-700', accent: 'bg-neutral-400' }
  };
  return styles[cat] || styles.default;
};

// --- Budget Components ---

const BudgetCard = ({ 
  budget, 
  currentUserId,
  onEdit, 
  onAddExpense,
  onDeleteExpense,
  filter = 'all'
}: { 
  budget: Budget, 
  currentUserId: string,
  onEdit: (b: Budget) => void, 
  onAddExpense: (b: Budget) => void,
  onDeleteExpense: (budget: Budget, expenseId: string) => void,
  filter?: 'all' | 'withBalance'
}) => {
  const percent = Math.min(Math.round((budget.spent / budget.limit) * 100), 100);
  const remaining = budget.limit - budget.spent;
  const isShared = (budget.sharedWith && budget.sharedWith.length > 0) || budget.userId !== currentUserId;
  const isOwner = budget.userId === currentUserId;
  
  const getProgressColor = (p: number) => {
    if (p < 70) return 'bg-amber-400';
    if (p < 90) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const getProgressTextColor = (p: number) => {
    if (p < 70) return 'text-amber-600';
    if (p < 90) return 'text-blue-600';
    return 'text-emerald-600';
  };

  const filteredConcepts = (budget.concepts || []).filter(c => {
    if (filter === 'all') return true;
    return (c.limit - c.spent) > 0;
  });

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm", budget.color || 'bg-emerald-500')}>
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-neutral-800 leading-tight">{budget.title}</h3>
              {isShared && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded-md text-[8px] font-black uppercase tracking-tighter">
                  <Share2 className="w-2 h-2" />
                  Compartido
                </div>
              )}
            </div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              {budget.currency} {budget.limit.toLocaleString()} total
              {!isOwner && budget.ownerEmail && ` • De: ${budget.ownerEmail.split('@')[0]}`}
            </p>
          </div>
        </div>
        {!budget.isClosed && (
          <button 
            onClick={() => onEdit(budget)}
            className="p-2 text-neutral-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-end text-xs font-bold">
          <span className="text-neutral-500">Progreso General</span>
          <span className={cn(getProgressTextColor(percent))}>
            {percent}%
          </span>
        </div>
        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            className={cn("h-full transition-all duration-500", getProgressColor(percent))}
          />
        </div>
      </div>

      {/* Concepts List */}
      <div className="space-y-3 mb-4">
        <div className="px-1">
          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Conceptos</span>
        </div>
        {filteredConcepts.map(concept => {
          const conceptPercent = Math.min(Math.round((concept.spent / concept.limit) * 100), 100);
          return (
            <div key={concept.id} className="space-y-1">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-neutral-700">{concept.title}</span>
                <span className="text-neutral-500">{budget.currency} {concept.spent.toLocaleString()} / {concept.limit.toLocaleString()}</span>
              </div>
              <div className="h-1 bg-neutral-50 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-500", getProgressColor(conceptPercent))}
                  style={{ width: `${conceptPercent}%` }}
                />
              </div>
            </div>
          );
        })}
        {filter === 'withBalance' && filteredConcepts.length === 0 && (
          <p className="text-[10px] text-neutral-400 italic px-1">Sin conceptos con saldo</p>
        )}
      </div>

      {/* Recent Expenses across all concepts */}
      {budget.concepts?.some(c => c.expenses?.length > 0) && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1 px-1">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Gastos Recientes</span>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
            {budget.concepts
              .flatMap(c => (c.expenses || []).map(e => ({ ...e, conceptTitle: c.title })))
              .sort((a, b) => b.date.toMillis() - a.date.toMillis())
              .slice(0, 5)
              .map((exp) => (
                <div key={exp.id} className="flex items-center justify-between py-1.5 border-b border-neutral-50 last:border-0 group/exp">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-neutral-700">{exp.concept}</span>
                    <span className="text-[9px] text-neutral-400">{exp.conceptTitle} • {exp.date.toDate().toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-800">-{budget.currency} {exp.amount.toLocaleString()}</span>
                    {!budget.isClosed && (
                      <button 
                        onClick={() => onDeleteExpense(budget, exp.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Eliminar pago"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {!budget.isClosed && (
        <button 
          onClick={() => onAddExpense(budget)}
          className="w-full py-2.5 bg-neutral-50 hover:bg-emerald-50 text-neutral-600 hover:text-emerald-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-neutral-100 border-dashed"
        >
          <Plus className="w-3.5 h-3.5" />
          Registrar Gasto
        </button>
      )}
    </motion.div>
  );
};

const BudgetDashboard = ({ 
  budgets, 
  userId,
  period, 
  onPeriodChange, 
  onAddBudget, 
  onEditBudget, 
  onAddExpense, 
  onDeleteExpense,
  onClone,
  onCloseMonth,
  onReopenMonth,
  onVoicePayment,
  onToast
}: { 
  budgets: Budget[], 
  userId: string,
  period: string, 
  onPeriodChange: (p: string) => void, 
  onAddBudget: () => void, 
  onEditBudget: (b: Budget) => void, 
  onAddExpense: (b: Budget) => void,
  onDeleteExpense: (budget: Budget, expenseId: string) => void,
  onClone: () => void,
  onCloseMonth: () => void,
  onReopenMonth: () => void,
  onVoicePayment: () => void,
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}) => {
  const [filter, setFilter] = useState<'all' | 'withBalance'>('all');

  const isMonthClosed = budgets.length > 0 && budgets.every(b => b.isClosed);
  const canReopen = budgets.length > 0 && budgets.some(b => b.isClosed && b.closedBy === userId);

  const [isListening, setIsListening] = useState(false);

  const totalLimit = budgets.reduce((acc, b) => acc + b.limit, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
  const totalPercent = totalLimit > 0 ? Math.min(Math.round((totalSpent / totalLimit) * 100), 100) : 0;

  const filteredBudgets = budgets.filter(b => {
    if (filter === 'all') return true;
    // Show category if it has at least one concept with balance
    return (b.concepts || []).some(c => (c.limit - c.spent) > 0);
  });

  const getGlobalProgressColor = (p: number) => {
    if (p < 70) return 'bg-amber-400';
    if (p < 90) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const nextMonth = () => {
    const [year, month] = period.split('-').map(Number);
    const d = new Date(year, month, 1); // This creates the next month in local time
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    onPeriodChange(`${y}-${m}`);
  };

  const prevMonth = () => {
    const [year, month] = period.split('-').map(Number);
    const d = new Date(year, month - 2, 1); // This creates the previous month in local time
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    onPeriodChange(`${y}-${m}`);
  };

  const [year, month] = period.split('-').map(Number);
  const displayDate = new Date(year, month - 1, 1);
  const monthName = displayDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header & Month Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm">
        <div className="flex items-center justify-center md:justify-start gap-4">
          <button onClick={prevMonth} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div className="text-center min-w-[140px]">
            <h2 className="text-lg font-bold text-neutral-800 capitalize">{monthName}</h2>
          </div>
          <button onClick={nextMonth} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5 text-neutral-600" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap md:flex-nowrap gap-2 w-full md:w-auto">
          {budgets.length === 0 && (
            <button 
              onClick={onClone}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-neutral-100 text-neutral-600 rounded-xl text-xs sm:text-sm font-bold hover:bg-neutral-200 transition-all"
              title="Clonar Mes Anterior"
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Clonar Mes Anterior</span>
              <span className="sm:hidden">Clonar</span>
            </button>
          )}
          {!isMonthClosed && budgets.length > 0 && (
            <button 
              onClick={onVoicePayment}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              title="Realizar Pago (IA)"
            >
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">Realizar Pago (IA)</span>
              <span className="sm:hidden">Pago IA</span>
            </button>
          )}
          {!isMonthClosed && budgets.length > 0 && (
            <button 
              onClick={onCloseMonth}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-neutral-800 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-black transition-all shadow-sm"
              title="Cerrar Mes"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar Mes</span>
              <span className="sm:hidden">Cerrar</span>
            </button>
          )}
          {!isMonthClosed && (
            <button 
              onClick={onAddBudget}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm"
              title="Nueva Categoría"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nueva Categoría</span>
              <span className="sm:hidden">Nueva</span>
            </button>
          )}
        </div>
      </div>

      {isMonthClosed && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <p className="text-sm font-medium text-amber-800">Este mes está cerrado. No se pueden registrar nuevos gastos ni modificar presupuestos.</p>
          </div>
          {canReopen && (
            <button 
              onClick={onReopenMonth}
              className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-200 transition-all border border-amber-200"
            >
              Reabrir Mes
            </button>
          )}
        </div>
      )}

      {/* Global Stats & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-[32px] border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-neutral-800">Distribución de Gastos</h3>
              <p className="text-xs text-neutral-400">Comparativa por categoría</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Gasto</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-neutral-200" />
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Límite</span>
              </div>
            </div>
          </div>
          
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={budgets.map(b => ({
                  name: b.title,
                  gasto: b.spent,
                  limite: b.limit
                }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                barGap={8}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#a3a3a3' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#a3a3a3' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8f8f8' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 rounded-2xl shadow-xl border border-neutral-100">
                          <p className="text-xs font-bold text-neutral-800 mb-2 uppercase tracking-wider">{payload[0].payload.name}</p>
                          <div className="space-y-1">
                            <p className="text-xs text-emerald-600 flex justify-between gap-4">
                              <span>Gasto:</span>
                              <span className="font-bold">${payload[0].value?.toLocaleString()}</span>
                            </p>
                            <p className="text-xs text-neutral-400 flex justify-between gap-4">
                              <span>Límite:</span>
                              <span className="font-bold">${payload[1].value?.toLocaleString()}</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="gasto" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="limite" fill="#e5e5e5" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white p-6 rounded-[32px] border border-neutral-100 shadow-sm">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Presupuesto Total</p>
            <p className="text-3xl font-black text-neutral-800">${totalLimit.toLocaleString()}</p>
            <div className="mt-4 pt-4 border-t border-neutral-50 flex justify-between items-end">
              <div>
                <p className="text-[10px] font-bold text-neutral-400 uppercase">Disponible</p>
                <p className="text-lg font-bold text-emerald-600">${(totalLimit - totalSpent).toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-100" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-[32px] border border-neutral-100 shadow-sm">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Gasto Total</p>
            <p className={cn("text-3xl font-black", totalSpent > totalLimit ? "text-rose-600" : "text-neutral-800")}>
              ${totalSpent.toLocaleString()}
            </p>
            <div className="mt-4 h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-500", getGlobalProgressColor(totalPercent))}
                style={{ width: `${Math.min(totalPercent, 100)}%` }}
              />
            </div>
            <p className="text-[10px] font-bold text-neutral-400 mt-2 uppercase tracking-widest">{totalPercent}% del total</p>
          </div>
        </div>
      </div>

      {/* Filter Selector */}
      <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setFilter('all')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all",
            filter === 'all' ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
          )}
        >
          Todos
        </button>
        <button 
          onClick={() => setFilter('withBalance')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all",
            filter === 'withBalance' ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
          )}
        >
          Solo con Saldo
        </button>
      </div>

      {/* Budget Grid */}
      {filteredBudgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-neutral-200">
          <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-neutral-300" />
          </div>
          <h3 className="text-lg font-bold text-neutral-800 mb-1">
            {filter === 'all' ? 'No hay presupuestos este mes' : 'No hay conceptos con saldo disponible'}
          </h3>
          <p className="text-sm text-neutral-500 max-w-xs">
            {filter === 'all' 
              ? 'Comienza creando categorías de presupuesto o clona las del mes anterior.' 
              : 'Todos los conceptos en tus categorías han alcanzado su límite.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBudgets.map(b => (
            <BudgetCard 
              key={b.id} 
              budget={b} 
              currentUserId={userId}
              onEdit={onEditBudget} 
              onAddExpense={onAddExpense} 
              onDeleteExpense={onDeleteExpense}
              filter={filter}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const NotificationModal = ({ 
  notifications, 
  onClose, 
  onClear,
  onMarkRead
}: { 
  notifications: AppNotification[], 
  onClose: () => void, 
  onClear: () => void,
  onMarkRead: (id: string) => void
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-neutral-800">Mensajero</h2>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Movimientos compartidos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button 
                onClick={onClear}
                className="p-2 text-neutral-400 hover:text-rose-500 transition-colors"
                title="Limpiar bandeja"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-neutral-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
                <MailOpen className="w-8 h-8 text-neutral-200" />
              </div>
              <p className="text-sm font-medium text-neutral-400">No tienes mensajes nuevos</p>
            </div>
          ) : (
            notifications.map((n) => (
              <motion.div 
                key={n.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer",
                  n.read ? "bg-white border-neutral-100 opacity-60" : "bg-emerald-50/30 border-emerald-100 shadow-sm"
                )}
                onClick={() => !n.read && onMarkRead(n.id!)}
              >
                <div className="flex gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    n.type === 'payment' ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                  )}>
                    {n.type === 'payment' ? <CreditCard className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-800 leading-relaxed">{n.message}</p>
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mt-1">
                      {n.date.toDate().toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.read && <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1" />}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

const BudgetModal = ({ 
  userId, 
  userEmail,
  budget, 
  period, 
  onClose,
  onToast,
  onDeleteExpense,
  setConfirmDialog,
  mode = 'budget' // 'budget' or 'expense'
}: { 
  userId: string, 
  userEmail?: string | null,
  budget?: Budget | null, 
  period: string, 
  onClose: () => void,
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void,
  onDeleteExpense?: (budget: Budget, expenseId: string) => void,
  setConfirmDialog: (config: any) => void,
  mode?: 'budget' | 'expense'
}) => {
  const [title, setTitle] = useState(budget?.title || '');
  const [color, setColor] = useState(budget?.color || 'bg-emerald-500');
  const [currency, setCurrency] = useState(budget?.currency || '$');
  const [concepts, setConcepts] = useState<BudgetConcept[]>(budget?.concepts || []);
  const [sharedWith, setSharedWith] = useState<string[]>(budget?.sharedWith || []);
  const [newShareEmail, setNewShareEmail] = useState('');
  
  // Expense fields
  const [selectedConceptId, setSelectedConceptId] = useState<string>('');
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const isOwner = !budget || budget.userId === userId;

  useEffect(() => {
    if (mode === 'expense' && budget?.concepts?.length) {
      const firstConcept = budget.concepts[0];
      setSelectedConceptId(firstConcept.id);
      
      // Default amount: available balance
      const available = firstConcept.limit - (firstConcept.spent || 0);
      setAmount(available > 0 ? available.toString() : '');

      // Default description for "Créditos"
      if (budget.title.toLowerCase().includes('crédito') || budget.title.toLowerCase().includes('credito')) {
        const [year, month] = period.split('-').map(Number);
        const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long' });
        setConcept(`Pago cuota ${monthName}`);
      }
    }
  }, [budget, mode, period]);

  const handleConceptChange = (conceptId: string) => {
    setSelectedConceptId(conceptId);
    const selected = budget?.concepts.find(c => c.id === conceptId);
    if (selected) {
      const available = selected.limit - (selected.spent || 0);
      setAmount(available > 0 ? available.toString() : '');
    }
  };

  const handleAddConcept = () => {
    const newConcept: BudgetConcept = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 11),
      title: '',
      limit: 0,
      spent: 0,
      expenses: []
    };
    setConcepts([...concepts, newConcept]);
  };

  const handleUpdateConcept = (id: string, field: keyof BudgetConcept, value: any) => {
    setConcepts(concepts.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleRemoveConcept = (id: string) => {
    setConcepts(concepts.filter(c => c.id !== id));
  };

  const handleAddShare = () => {
    if (!newShareEmail || !newShareEmail.includes('@')) {
      onToast('Ingresa un correo válido.', 'error');
      return;
    }
    if (newShareEmail === userEmail) {
      onToast('No puedes compartir contigo mismo.', 'error');
      return;
    }
    if (sharedWith.includes(newShareEmail)) {
      onToast('Este usuario ya tiene acceso.', 'error');
      return;
    }
    setSharedWith([...sharedWith, newShareEmail]);
    setNewShareEmail('');
  };

  const handleRemoveShare = (email: string) => {
    setSharedWith(sharedWith.filter(e => e !== email));
  };

  const handleSave = async () => {
    if (mode === 'budget') {
      if (!title || concepts.length === 0) {
        onToast('Debes incluir un título y al menos un concepto.', 'error');
        return;
      }
      setIsSaving(true);
      try {
        const totalLimit = concepts.reduce((acc, c) => acc + (parseFloat(c.limit.toString()) || 0), 0);
        const totalSpent = concepts.reduce((acc, c) => acc + (c.spent || 0), 0);

        const data = {
          userId: budget?.userId || userId,
          ownerEmail: budget?.ownerEmail || userEmail,
          sharedWith,
          period,
          title,
          limit: totalLimit,
          spent: totalSpent,
          currency,
          color,
          concepts: concepts.map(c => ({
            ...c,
            limit: parseFloat(c.limit.toString()) || 0
          })),
          createdAt: budget?.createdAt || serverTimestamp()
        };

        if (budget?.id) {
          await updateDoc(doc(db, 'budgets', budget.id), data);
          onToast('Presupuesto actualizado.', 'success');
          
          // Create notifications for shared users
          const recipients = new Set([budget.userId, ...(budget.sharedWith || []), ...(sharedWith || [])]);
          recipients.delete(userId);
          if (userEmail) recipients.delete(userEmail);

          for (const recipient of recipients) {
            await addDoc(collection(db, 'notifications'), {
              userId: recipient,
              message: `${userEmail?.split('@')[0] || 'Un usuario'} actualizó el presupuesto "${title}"`,
              date: Timestamp.now(),
              read: false,
              type: 'budget',
              budgetId: budget.id
            });
          }
        } else {
          const newDoc = await addDoc(collection(db, 'budgets'), data);
          onToast('Presupuesto creado.', 'success');

          // Create notifications for shared users
          const recipients = new Set([...(sharedWith || [])]);
          if (userEmail) recipients.delete(userEmail);

          for (const recipient of recipients) {
            await addDoc(collection(db, 'notifications'), {
              userId: recipient,
              message: `${userEmail?.split('@')[0] || 'Un usuario'} creó el presupuesto "${title}" y lo compartió contigo`,
              date: Timestamp.now(),
              read: false,
              type: 'budget',
              budgetId: newDoc.id
            });
          }
        }
        onClose();
      } catch (e) {
        console.error('Error saving budget:', e);
        onToast('Error al guardar presupuesto.', 'error');
      } finally {
        setIsSaving(false);
      }
    } else if (mode === 'expense' && budget?.id) {
      if (!selectedConceptId || !concept || !amount) return;
      setIsSaving(true);
      try {
        const newExpense: Expense = {
          id: Date.now().toString(36) + Math.random().toString(36).substring(2, 11),
          concept,
          amount: parseFloat(amount),
          date: Timestamp.now()
        };
        
        const updatedConcepts = budget.concepts.map(c => {
          if (c.id === selectedConceptId) {
            const updatedExpenses = [...(c.expenses || []), newExpense];
            const newSpent = updatedExpenses.reduce((acc, e) => acc + e.amount, 0);
            return { ...c, expenses: updatedExpenses, spent: newSpent };
          }
          return c;
        });

        const newTotalSpent = updatedConcepts.reduce((acc, c) => acc + c.spent, 0);
        
        await updateDoc(doc(db, 'budgets', budget.id), {
          concepts: updatedConcepts,
          spent: newTotalSpent
        });

        // Create notifications for shared users
        const recipients = new Set([budget.userId, ...(budget.sharedWith || [])]);
        recipients.delete(userId);
        if (userEmail) recipients.delete(userEmail);

        for (const recipient of recipients) {
          await addDoc(collection(db, 'notifications'), {
            userId: recipient,
            message: `${userEmail?.split('@')[0] || 'Un usuario'} registró un pago de ${budget.currency}${parseFloat(amount).toLocaleString()} en "${budget.concepts.find(c => c.id === selectedConceptId)?.title}" (${budget.title})`,
            date: Timestamp.now(),
            read: false,
            type: 'payment',
            budgetId: budget.id
          });
        }

        onToast('Gasto registrado.', 'success');
        onClose();
      } catch (e) {
        console.error('Error saving expense:', e);
        onToast('Error al registrar gasto.', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!budget?.id) return;
    
    setConfirmDialog({
      title: 'Eliminar Presupuesto',
      message: '¿Estás seguro de eliminar este presupuesto?',
      variant: 'danger',
      onConfirm: async () => {
        setIsSaving(true);
        try {
          await deleteDoc(doc(db, 'budgets', budget.id!));
          onToast('Presupuesto eliminado.', 'success');

          // Create notifications for shared users
          const recipients = new Set([budget.userId, ...(budget.sharedWith || [])]);
          recipients.delete(userId);
          if (userEmail) recipients.delete(userEmail);

          for (const recipient of recipients) {
            await addDoc(collection(db, 'notifications'), {
              userId: recipient,
              message: `${userEmail?.split('@')[0] || 'Un usuario'} eliminó el presupuesto "${budget.title}"`,
              date: Timestamp.now(),
              read: false,
              type: 'budget'
            });
          }

          onClose();
        } catch (e) {
          console.error('Error deleting budget:', e);
          onToast('Error al eliminar presupuesto.', 'error');
        } finally {
          setIsSaving(false);
        }
      }
    });
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      onToast('Tu navegador no soporta reconocimiento de voz.', 'error');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      
      try {
        const response = await generateAIContent(
          `Extrae el concepto y el monto de este gasto dictado: "${text}". Responde solo en JSON con formato { "concept": string, "amount": number }.`,
          { responseMimeType: "application/json" }
        );
        
        const result = JSON.parse(response.text);
        if (result.concept) setConcept(result.concept);
        if (result.amount) setAmount(result.amount.toString());
      } catch (e) {
        console.error('AI parsing error:', e);
      }
    };
    recognition.start();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[32px] overflow-y-auto shadow-2xl max-h-[90vh]"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-neutral-800">
              {mode === 'budget' ? (budget ? 'Editar Categoría' : 'Nueva Categoría') : 'Registrar Gasto'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          <div className="space-y-4">
            {mode === 'budget' ? (
              <>
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Título de Categoría</label>
                  <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Hogar, Transporte..."
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                  />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Conceptos Internos</label>
                    <button 
                      onClick={handleAddConcept}
                      className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700"
                    >
                      + Añadir Concepto
                    </button>
                  </div>
                  
                  {concepts.map((c, idx) => (
                    <div key={c.id} className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 space-y-2 relative group">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={c.title} 
                          onChange={(e) => handleUpdateConcept(c.id, 'title', e.target.value)}
                          placeholder="Concepto (ej: Alquiler)"
                          className="flex-1 px-3 py-2 bg-white border border-neutral-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="w-32 sm:w-40 relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-400">{currency}</span>
                          <input 
                            type="number" 
                            value={c.limit} 
                            onChange={(e) => handleUpdateConcept(c.id, 'limit', e.target.value)}
                            placeholder="Monto"
                            className="w-full pl-6 pr-2 py-2 bg-white border border-neutral-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <button 
                          onClick={() => handleRemoveConcept(c.id)}
                          className="p-2 text-neutral-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {concepts.length > 0 && (
                    <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <span className="text-xs font-bold text-emerald-700">Límite Total:</span>
                      <span className="text-sm font-black text-emerald-800">
                        {currency} {concepts.reduce((acc, c) => acc + (parseFloat(c.limit.toString()) || 0), 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Expense History - Show when editing existing budget or adding expense to it */}
                {budget && budget.concepts?.some(c => c.expenses?.length > 0) && (
                  <div className="space-y-3 pt-4 border-t border-neutral-100">
                    <h4 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                      <History className="w-4 h-4 text-emerald-500" />
                      Historial de Gastos
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {budget.concepts
                        .flatMap(c => (c.expenses || []).map(e => ({ ...e, conceptTitle: c.title })))
                        .sort((a, b) => b.date.toMillis() - a.date.toMillis())
                        .map((exp) => (
                          <div key={exp.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-neutral-700">{exp.concept}</span>
                              <span className="text-[10px] text-neutral-400">{exp.conceptTitle} • {exp.date.toDate().toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-neutral-800">-{currency} {exp.amount.toLocaleString()}</span>
                              {!budget.isClosed && onDeleteExpense && (
                                <button 
                                  onClick={() => onDeleteExpense(budget, exp.id)}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                                  title="Eliminar pago"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Moneda</label>
                    <input 
                      type="text" 
                      value={currency} 
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1 mb-2 block">Color</label>
                    <div className="flex flex-wrap gap-2">
                      {['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-purple-500', 'bg-neutral-800'].map(c => (
                        <button 
                          key={c}
                          onClick={() => setColor(c)}
                          className={cn(
                            "w-8 h-8 rounded-full transition-all",
                            c,
                            color === c ? "ring-4 ring-neutral-200 scale-110" : "opacity-60 hover:opacity-100"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sharing Section - Only for owners */}
                {isOwner && (
                  <div className="space-y-4 pt-4 border-t border-neutral-100">
                    <div>
                      <h4 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-emerald-500" />
                        Compartir Presupuesto
                      </h4>
                      <p className="text-[10px] text-neutral-400">Permite que otros usuarios registrados vean y registren gastos en esta categoría.</p>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="email"
                        value={newShareEmail}
                        onChange={(e) => setNewShareEmail(e.target.value)}
                        placeholder="correo@ejemplo.com"
                        className="flex-1 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                      <button 
                        onClick={handleAddShare}
                        className="px-4 py-2 bg-neutral-800 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
                      >
                        Agregar
                      </button>
                    </div>

                    {sharedWith.length > 0 && (
                      <div className="space-y-2">
                        {sharedWith.map(email => (
                          <div key={email} className="flex items-center justify-between p-2 bg-neutral-50 rounded-xl border border-neutral-100">
                            <span className="text-xs text-neutral-600">{email}</span>
                            <button 
                              onClick={() => handleRemoveShare(email)}
                              className="p-1 text-neutral-400 hover:text-rose-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4">
                  <p className="text-xs text-emerald-700 font-bold mb-1">Categoría: {budget?.title}</p>
                  <p className="text-[10px] text-emerald-600 opacity-80 uppercase tracking-wider">Disponible: {budget?.currency} {(budget!.limit - budget!.spent).toLocaleString()}</p>
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Seleccionar Concepto</label>
                  <select 
                    value={selectedConceptId}
                    onChange={(e) => handleConceptChange(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium appearance-none"
                  >
                    <option value="" disabled>Selecciona un concepto...</option>
                    {budget?.concepts.map(c => (
                      <option key={c.id} value={c.id}>{c.title} (Disp: {budget.currency} {(c.limit - c.spent).toLocaleString()})</option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Descripción del Gasto</label>
                  <input 
                    type="text" 
                    value={concept} 
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="¿En qué gastaste?"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium pr-12"
                  />
                  <button 
                    onClick={handleVoiceInput}
                    className={cn(
                      "absolute right-3 top-[30px] p-2 rounded-xl transition-all",
                      isListening ? "bg-rose-100 text-rose-600 animate-pulse" : "bg-neutral-100 text-neutral-400 hover:text-emerald-500"
                    )}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1 mb-1 block">Monto</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-neutral-400">{budget?.currency}</span>
                    <input 
                      type="number" 
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-black text-lg"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-8 flex gap-3">
            {mode === 'budget' && budget && (
              <button 
                onClick={handleDelete}
                disabled={isSaving}
                className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={handleSave}
              disabled={isSaving || budget?.isClosed}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Guardando...' : (budget?.isClosed ? 'Mes Cerrado' : 'Guardar')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const playPCM = async (base64Data: string, sampleRate: number = 24000) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.error('AudioContext not supported');
      return;
    }
    
    const audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // PCM 16-bit is 2 bytes per sample
    const float32Data = new Float32Array(bytes.length / 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < float32Data.length; i++) {
      // Gemini TTS returns 16-bit linear PCM, little-endian
      const s = view.getInt16(i * 2, true);
      float32Data[i] = s / 32768;
    }
    
    const audioBuffer = audioContext.createBuffer(1, float32Data.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32Data);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    return new Promise<void>((resolve) => {
      source.onended = () => {
        audioContext.close();
        resolve();
      };
      source.start();
    });
  } catch (err) {
    console.error('Error playing PCM:', err);
  }
};

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[ErrorBoundary] Caught error:', event.message, event.error);
      setHasError(true);
      setErrorInfo(event.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-8 bg-red-50 text-red-800 rounded-xl border border-red-200 m-4">
        <h2 className="text-xl font-bold mb-2">Algo salió mal</h2>
        <p className="text-sm opacity-80">{errorInfo}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Recargar aplicación
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

const LoadingScreen = () => {
  console.log('[App] Rendering LoadingScreen');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowHelp(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-6 text-center">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mb-4"
      />
      <p className="text-neutral-500 font-medium">Cargando R3 Notas & Tareas...</p>
      
      {showHelp && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 max-w-xs"
        >
          <p className="text-xs text-neutral-400 mb-4">
            ¿Tardando demasiado? Algunos navegadores como Chrome bloquean el acceso en este modo.
          </p>
          <button 
            onClick={() => window.open(window.location.href, '_blank')}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white border border-neutral-200 text-neutral-600 rounded-xl text-sm font-bold hover:bg-neutral-100 transition-all shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir en pestaña nueva
          </button>
        </motion.div>
      )}
    </div>
  );
};

const LoginScreen = ({ onInstall, showInstall, deferredPrompt }: { onInstall: () => void, showInstall: boolean, deferredPrompt: any }) => {
  console.log('[App] Rendering LoginScreen');
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-emerald-500 selection:text-black overflow-x-hidden">
      {/* Hero Section - Editorial Style */}
      <header className="relative h-screen flex flex-col justify-center px-6 md:px-20 overflow-hidden">
        <div className="absolute top-10 left-6 md:left-20 flex items-center gap-3 z-20">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-black" />
          </div>
          <span className="font-bold text-xl tracking-tighter uppercase">R3 Studio</span>
        </div>

        <div className="relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="skew-x-[-10deg]"
          >
            <h1 className="text-[18vw] md:text-[14vw] font-black leading-[0.82] tracking-[-0.04em] uppercase">
              Notas<br />
              <span className="text-emerald-500">&</span> Tareas
            </h1>
          </motion.div>

          <div className="mt-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="max-w-md text-lg md:text-xl font-medium leading-relaxed"
            >
              Gestiona tu vida con precisión quirúrgica. Inteligencia artificial, 
              comandos de voz y una interfaz diseñada para el alto rendimiento.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="flex flex-col gap-4 w-full md:w-auto"
            >
              <button 
                onClick={handleLogin}
                className="group relative flex items-center justify-center gap-4 py-5 px-10 bg-white text-black rounded-full font-black text-xl hover:bg-emerald-500 transition-all duration-500"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
                COMENZAR AHORA
                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </button>

              {showInstall && (
                <button 
                  onClick={onInstall}
                  className="flex items-center justify-center gap-3 py-4 px-8 border border-white/20 rounded-full hover:bg-white/10 transition-all font-bold text-sm uppercase tracking-widest"
                >
                  <Plus className="w-5 h-5" />
                  Instalar App
                </button>
              )}
            </motion.div>
          </div>
        </div>

        {/* Background Decorative Elements */}
        <div className="absolute top-1/2 right-[-10%] w-[60vw] h-[60vw] bg-emerald-500/10 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] bg-blue-500/10 rounded-full blur-[100px] -z-10" />
      </header>

      {/* Features Grid - Brutalist Style */}
      <section className="py-24 px-6 md:px-20 border-t border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-6">
            <div className="text-6xl font-black text-emerald-500/20">01</div>
            <h3 className="text-3xl font-bold uppercase tracking-tighter">IA Nativa</h3>
            <p className="text-neutral-400 leading-relaxed">
              Refina tus notas, genera subtareas automáticamente y categoriza tu vida con el poder de Gemini 1.5 Flash.
            </p>
          </div>
          <div className="space-y-6">
            <div className="text-6xl font-black text-emerald-500/20">02</div>
            <h3 className="text-3xl font-bold uppercase tracking-tighter">Voz a Texto</h3>
            <p className="text-neutral-400 leading-relaxed">
              Dicta tus pensamientos. Nuestra integración de voz permite capturar ideas al vuelo sin tocar el teclado.
            </p>
          </div>
          <div className="space-y-6">
            <div className="text-6xl font-black text-emerald-500/20">03</div>
            <h3 className="text-3xl font-bold uppercase tracking-tighter">Presupuestos</h3>
            <p className="text-neutral-400 leading-relaxed">
              Control total de tus finanzas. Visualiza tus gastos, establece límites y mantén tu economía bajo control.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section - Minimalist */}
      <section className="py-24 px-6 md:px-20 bg-white text-black">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6">Planes</h2>
          <p className="text-xl text-neutral-600">Elige la potencia que necesitas para tu día a día.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="p-10 rounded-[40px] border-2 border-neutral-100 flex flex-col justify-between hover:border-emerald-500 transition-colors group">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Personal</span>
              <h4 className="text-4xl font-bold mt-2 mb-6">Gratis</h4>
              <ul className="space-y-4 text-neutral-600">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Tareas y Notas ilimitadas</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> IA Básica (Refinado)</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Sincronización en la nube</li>
              </ul>
            </div>
            <button onClick={handleLogin} className="mt-12 w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-black transition-all">
              Empezar Gratis
            </button>
          </div>

          <div className="p-10 rounded-[40px] bg-neutral-900 text-white flex flex-col justify-between relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-6">
              <div className="bg-emerald-500 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Recomendado</div>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">Professional</span>
              <h4 className="text-4xl font-bold mt-2 mb-6">$9.99<span className="text-lg text-neutral-500 font-medium">/mes</span></h4>
              <ul className="space-y-4 text-neutral-300">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Todo lo de Personal</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> IA Avanzada (Chat & Sugerencias)</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Análisis de Presupuesto Pro</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Soporte Prioritario</li>
              </ul>
            </div>
            <button onClick={handleLogin} className="mt-12 w-full py-4 bg-emerald-500 text-black rounded-2xl font-bold hover:bg-emerald-400 transition-all">
              Suscribirse a Pro
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-20 border-t border-white/10 text-center text-neutral-500 text-xs font-medium uppercase tracking-[0.2em]">
        © 2026 R3 Studio — Todos los derechos reservados
      </footer>
    </div>
  );
};

// --- Main App ---

export default function App() {
  console.log('[App] Component initializing');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'notes' | 'reminders' | 'ai' | 'projects' | 'budget'>('projects');
  const [viewMode, setViewMode] = useState<'week' | 'category' | 'all' | 'project'>('all');
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentBudgetPeriod, setCurrentBudgetPeriod] = useState<string>(() => {
    const saved = localStorage.getItem('currentBudgetPeriod');
    if (saved) return saved;
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  useEffect(() => {
    localStorage.setItem('currentBudgetPeriod', currentBudgetPeriod);
  }, [currentBudgetPeriod]);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(null);
  
  const [selectedVoice, setSelectedVoice] = useState<'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'>('Kore');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [manualApiKey, setManualApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ 
    id?: string, 
    type?: string, 
    onConfirm?: () => void, 
    onCancel?: () => void,
    onSecondary?: () => void,
    title?: string, 
    message?: string,
    confirmText?: string,
    cancelText?: string,
    secondaryText?: string,
    variant?: 'danger' | 'info' | 'success' | 'warning'
  } | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showNotificationStatus, setShowNotificationStatus] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isIframe, setIsIframe] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPro, setIsPro] = useState(() => localStorage.getItem('isPro') === 'true');

  useEffect(() => {
    setIsIframe(window.self !== window.top);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'reminders') {
      setShowNotificationStatus(true);
      const timer = setTimeout(() => {
        setShowNotificationStatus(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // Push Notification Registration
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const registerPush = async (userId: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast('Tu navegador no soporta notificaciones push.', 'error');
      return;
    }

    setIsRegistering(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      // If permission is already denied, we can't request it again easily
      if (Notification.permission === 'denied') {
        showToast('El permiso de notificaciones ha sido denegado anteriormente. Por favor, actívalo en la configuración de tu navegador.', 'error');
        setIsRegistering(false);
        return;
      }

      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission !== 'granted') {
        if (isIframe) {
          showToast('Las notificaciones están bloqueadas en este modo. Abre la app en una pestaña nueva.', 'error');
        } else {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
          if (isIOS) {
            showToast('En iOS, añade la app a tu Pantalla de Inicio para recibir notificaciones.', 'info');
          } else {
            showToast('Permiso de notificación denegado.', 'error');
          }
        }
        setIsRegistering(false);
        return;
      }

      // Try multiple ways to get the VAPID key
      const publicVapidKey = 
        import.meta.env.VITE_VAPID_PUBLIC_KEY || 
        import.meta.env.VITE_VAPID_PUBLIC_KEY ||
        'BKpIkmpTq6CU7mCuxJYlV4Mrva34EyYDNSroPk4Jfq901eYjawCZ_FMJNfRKUnDK1OWWt2pDC5vc2PaLiakEYCM'; // Fallback to example key if missing
      if (!publicVapidKey) {
        showToast('Error de configuración: VAPID key no encontrada.', 'error');
        setIsRegistering(false);
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
      }

      // Store subscription in Firestore directly from client
      // Use a more robust hash of the endpoint to avoid duplicates
      const encoder = new TextEncoder();
      const data = encoder.encode(subscription.endpoint);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const subId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 60);

      await setDoc(doc(db, 'subscriptions', subId), {
        userId,
        endpoint: subscription.endpoint, // Store endpoint for easier deduplication
        subscription: JSON.parse(JSON.stringify(subscription)),
        createdAt: serverTimestamp()
      });

      setNotificationPermission('granted');
      showToast('Notificaciones activadas.', 'success');
    } catch (error) {
      console.error('Push registration failed:', error);
      showToast('Error al activar notificaciones.', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  // Firestore connection test
  useEffect(() => {
    if (user && notificationPermission === 'granted') {
      registerPush(user.uid);
    }
  }, [user, notificationPermission]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.log('[Auth] State changed, user:', u ? u.email : 'null');
      if (u) {
        // Ensure user profile exists in Firestore
        try {
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL
            });
          }

          // Ensure Default Project exists
          const qDefault = query(collection(db, 'projects'), where('userId', '==', u.uid), where('name', '==', 'Proyecto por defecto'));
          const snapDefault = await getDocs(qDefault);
          if (snapDefault.empty) {
            await addDoc(collection(db, 'projects'), {
              userId: u.uid,
              name: 'Proyecto por defecto',
              description: 'Tareas y notas sin proyecto asignado',
              color: 'bg-neutral-800',
              status: 'active',
              createdAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.error("Error setting up user data:", e);
        }
      }
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qTasks = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));

    const qNotes = query(collection(db, 'notes'), where('userId', '==', user.uid));
    const unsubNotes = onSnapshot(qNotes, (snapshot) => {
      const notesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Note));
      // Sort client-side to avoid index requirement
      notesData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setNotes(notesData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notes'));

    const qReminders = query(collection(db, 'reminders'), where('userId', '==', user.uid));
    const unsubReminders = onSnapshot(qReminders, (snapshot) => {
      setReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'reminders'));

    const qProjects = query(collection(db, 'projects'), where('userId', '==', user.uid));
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      const projectsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      projectsData.sort((a, b) => {
        const priorityA = a.priority || 0;
        const priorityB = b.priority || 0;
        if (priorityB !== priorityA) return priorityB - priorityA;
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setProjects(projectsData);
      
      const defProj = projectsData.find(p => p.name === 'Proyecto por defecto');
      if (defProj) setDefaultProjectId(defProj.id!);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'projects'));

    const qBudgets = query(
      collection(db, 'budgets'), 
      and(
        where('period', '==', currentBudgetPeriod),
        or(
          where('userId', '==', user.uid),
          where('sharedWith', 'array-contains', user.email),
          where('ownerEmail', '==', user.email)
        )
      )
    );
    const unsubBudgets = onSnapshot(qBudgets, (snapshot) => {
      setBudgets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Budget)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgets'));

    const qNotifications = query(
      collection(db, 'notifications'),
      where('userId', 'in', [user.uid, user.email]),
      orderBy('date', 'desc'),
      limit(50)
    );
    const unsubNotifications = onSnapshot(qNotifications, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));

    return () => {
      unsubTasks();
      unsubNotes();
      unsubReminders();
      unsubProjects();
      unsubBudgets();
      unsubNotifications();
    };
  }, [user, currentBudgetPeriod]);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen onInstall={handleInstallClick} showInstall={!!deferredPrompt && !isIframe} deferredPrompt={deferredPrompt} />;

  // Filter items based on selected project
  const filteredTasks = tasks.filter(t => {
    if (!selectedProjectId) return false;
    if (selectedProjectId === defaultProjectId) return !t.projectId || t.projectId === defaultProjectId;
    return t.projectId === selectedProjectId;
  });

  const filteredNotes = notes.filter(n => {
    if (!selectedProjectId) return false;
    if (selectedProjectId === defaultProjectId) return !n.projectId || n.projectId === defaultProjectId;
    return n.projectId === selectedProjectId;
  });

  const filteredReminders = reminders.filter(r => {
    if (!selectedProjectId) return false;
    if (selectedProjectId === defaultProjectId) return !r.projectId || r.projectId === defaultProjectId;
    return r.projectId === selectedProjectId;
  });

  const activeItems = activeTab === 'tasks' ? filteredTasks : 
                     activeTab === 'notes' ? filteredNotes : 
                     activeTab === 'reminders' ? filteredReminders : 
                     activeTab === 'projects' ? projects : [];

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleClonePreviousMonth = async () => {
    if (!user) return;
    const [year, month] = currentBudgetPeriod.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1); // Previous month in local time
    const prevPeriod = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;

    try {
      const q = query(collection(db, 'budgets'), where('userId', '==', user.uid), where('period', '==', prevPeriod));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        showToast('No se encontraron presupuestos en el mes anterior.', 'error');
        return;
      }

      setConfirmDialog({
        id: 'clone',
        type: 'budget',
        title: 'Clonar Presupuestos',
        message: `¿Deseas clonar los ${snap.size} presupuestos de ${prevPeriod} a ${currentBudgetPeriod}?`,
        variant: 'info',
        confirmText: 'Clonar Ahora',
        onConfirm: async () => {
          const promises = snap.docs.map(d => {
            const data = d.data() as Budget;
            return addDoc(collection(db, 'budgets'), {
              userId: user.uid,
              period: currentBudgetPeriod,
              title: data.title,
              limit: data.limit,
              spent: 0,
              currency: data.currency,
              color: data.color,
              concepts: (data.concepts || []).map(c => ({
                ...c,
                spent: 0,
                expenses: []
              })),
              createdAt: serverTimestamp()
            });
          });

          await Promise.all(promises);
          showToast('Presupuestos clonados con éxito.', 'success');
        }
      });
    } catch (e) {
      console.error('Error cloning budgets:', e);
      showToast('Error al clonar presupuestos.', 'error');
    }
  };

  const handleCloseMonth = async () => {
    if (!user) return;
    setConfirmDialog({
      title: 'Cerrar Mes',
      message: '¿Estás seguro de cerrar este mes? Ya no podrás registrar gastos ni modificar presupuestos en este periodo.',
      variant: 'success',
      confirmText: 'Cerrar Mes',
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          budgets.forEach(b => {
            if (b.id) {
              batch.update(doc(db, 'budgets', b.id), { 
                isClosed: true,
                closedBy: user.uid
              });
            }
          });
          await batch.commit();

          // Create notifications for shared users
          const [year, month] = currentBudgetPeriod.split('-').map(Number);
          const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long' });
          const allRecipients = new Set<string>();
          budgets.forEach(b => {
            [b.userId, ...(b.sharedWith || [])].forEach(r => allRecipients.add(r));
          });
          allRecipients.delete(user.uid);
          if (user.email) allRecipients.delete(user.email);

          for (const recipient of allRecipients) {
            await addDoc(collection(db, 'notifications'), {
              userId: recipient,
              message: `${user.displayName || user.email?.split('@')[0]} cerró el mes de ${monthName}`,
              date: Timestamp.now(),
              read: false,
              type: 'budget'
            });
          }
          
          // Move to next month
          const nextD = new Date(year, month, 1);
          const y = nextD.getFullYear();
          const m = (nextD.getMonth() + 1).toString().padStart(2, '0');
          setCurrentBudgetPeriod(`${y}-${m}`);
          
          showToast('Mes cerrado correctamente.', 'success');
        } catch (e) {
          console.error('Error closing month:', e);
          showToast('Error al cerrar el mes.', 'error');
        }
      }
    });
  };

  const handleReopenMonth = async () => {
    if (!user) return;
    setConfirmDialog({
      title: 'Reabrir Mes',
      message: '¿Deseas reabrir este mes para realizar modificaciones?',
      variant: 'info',
      confirmText: 'Reabrir Mes',
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          budgets.forEach(b => {
            if (b.id && b.isClosed && b.closedBy === user.uid) {
              batch.update(doc(db, 'budgets', b.id), { 
                isClosed: deleteField(),
                closedBy: deleteField()
              });
            }
          });
          await batch.commit();

          // Create notifications for shared users
          const [year, month] = currentBudgetPeriod.split('-').map(Number);
          const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long' });
          const allRecipients = new Set<string>();
          budgets.forEach(b => {
            [b.userId, ...(b.sharedWith || [])].forEach(r => allRecipients.add(r));
          });
          allRecipients.delete(user.uid);
          if (user.email) allRecipients.delete(user.email);

          for (const recipient of allRecipients) {
            await addDoc(collection(db, 'notifications'), {
              userId: recipient,
              message: `${user.displayName || user.email?.split('@')[0]} reabrió el mes de ${monthName}`,
              date: Timestamp.now(),
              read: false,
              type: 'budget'
            });
          }

          showToast('Mes reabierto correctamente', 'success');
        } catch (error) {
          console.error('Error reopening month:', error);
          showToast('Error al reabrir el mes', 'error');
        }
      }
    });
  };

  const handleVoicePayment = async () => {
    if (!('webkitSpeechRecognition' in window)) {
      showToast('Tu navegador no soporta reconocimiento de voz.', 'error');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'es-ES';
    
    showToast('Escuchando pago...', 'info');

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      showToast(`Procesando: "${text}"`, 'info');

      try {
        const allConcepts = budgets.flatMap(b => (b.concepts || []).map(c => ({
          budgetId: b.id,
          budgetTitle: b.title,
          conceptId: c.id,
          conceptTitle: c.title,
          available: c.limit - (c.spent || 0)
        })));

        const response = await generateAIContent(
          `Analiza este comando de voz para un pago: "${text}".
          Tengo estos conceptos disponibles: ${JSON.stringify(allConcepts)}.
          Identifica el concepto que mejor coincida.
          Si menciona un monto numérico, extráelo. Si no menciona monto, devuelve null.
          Extrae una descripción corta y clara del pago (ej: "Pago luz", "Compra supermercado").
          Responde estrictamente en JSON: { "budgetId": string, "conceptId": string, "amount": number | null, "description": string }.`,
          { responseMimeType: "application/json" }
        );

        const result = JSON.parse(response.text);
        const budget = budgets.find(b => b.id === result.budgetId);
        if (!budget) {
          showToast('No se encontró una categoría que coincida.', 'error');
          return;
        }

        const concept = budget.concepts.find(c => c.id === result.conceptId);
        if (!concept) {
          showToast('No se encontró el concepto específico.', 'error');
          return;
        }

        const finalAmount = result.amount !== null ? result.amount : (concept.limit - (concept.spent || 0));
        const description = result.description || `Pago ${concept.title}`;

        setConfirmDialog({
          title: 'Confirmar Pago IA',
          message: `¿Registrar pago de ${budget.currency}${finalAmount.toLocaleString()} en "${concept.title}"?\nDescripción: ${description}`,
          confirmText: 'Confirmar',
          secondaryText: 'Reintentar',
          cancelText: 'Cancelar',
          variant: 'success',
          onConfirm: async () => {
            const newExpense: Expense = {
              id: Date.now().toString(36) + Math.random().toString(36).substring(2, 11),
              concept: description,
              amount: finalAmount,
              date: Timestamp.now()
            };

            const updatedConcepts = budget.concepts.map(c => {
              if (c.id === concept.id) {
                const updatedExpenses = [...(c.expenses || []), newExpense];
                const newSpent = updatedExpenses.reduce((acc, e) => acc + e.amount, 0);
                return { ...c, expenses: updatedExpenses, spent: newSpent };
              }
              return c;
            });

            const newTotalSpent = updatedConcepts.reduce((acc, c) => acc + c.spent, 0);

            await updateDoc(doc(db, 'budgets', budget.id!), {
              concepts: updatedConcepts,
              spent: newTotalSpent
            });

            // Create notifications for shared users
            const recipients = new Set([budget.userId, ...(budget.sharedWith || [])]);
            recipients.delete(user.uid);
            recipients.delete(user.email!);

            for (const recipient of recipients) {
              await addDoc(collection(db, 'notifications'), {
                userId: recipient,
                message: `${user.displayName || user.email} registró un pago de ${budget.currency}${finalAmount.toLocaleString()} en "${concept.title}" (${budget.title})`,
                date: Timestamp.now(),
                read: false,
                type: 'payment',
                budgetId: budget.id
              });
            }

            showToast(`Pago registrado en ${concept.title}.`, 'success');
          },
          onSecondary: () => {
            handleVoicePayment();
          }
        });
      } catch (e) {
        console.error('IA Payment error:', e);
        showToast('Error al procesar el pago con IA.', 'error');
      }
    };

    recognition.start();
  };

  const handleDeleteExpense = async (budget: Budget, expenseId: string) => {
    if (!budget.id) return;
    
    setConfirmDialog({
      id: expenseId,
      type: 'expense',
      title: 'Eliminar Gasto',
      message: '¿Estás seguro de eliminar este gasto?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const updatedConcepts = budget.concepts.map(c => {
            const updatedExpenses = (c.expenses || []).filter(e => e.id !== expenseId);
            const newSpent = updatedExpenses.reduce((acc, e) => acc + e.amount, 0);
            return { ...c, expenses: updatedExpenses, spent: newSpent };
          });

          const newTotalSpent = updatedConcepts.reduce((acc, c) => acc + c.spent, 0);
          
          await updateDoc(doc(db, 'budgets', budget.id!), {
            concepts: updatedConcepts,
            spent: newTotalSpent
          });

          // Create notifications for shared users
          const recipients = new Set([budget.userId, ...(budget.sharedWith || [])]);
          recipients.delete(user.uid);
          if (user.email) recipients.delete(user.email);

          for (const recipient of recipients) {
            await addDoc(collection(db, 'notifications'), {
              userId: recipient,
              message: `${user.displayName || user.email?.split('@')[0]} eliminó un pago en "${budget.title}"`,
              date: Timestamp.now(),
              read: false,
              type: 'payment',
              budgetId: budget.id
            });
          }

          showToast('Gasto eliminado.', 'success');
        } catch (e) {
          console.error('Error deleting expense:', e);
          showToast('Error al eliminar el gasto.', 'error');
        }
      }
    });
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans pb-24">
        <EnvironmentIndicator />
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-lg sm:rounded-xl flex items-center justify-center text-white">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight hidden xs:block">R3 Notas & Tareas</h1>
            {isPro && <PremiumBadge />}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 overflow-x-auto no-scrollbar py-1">
            <span className="text-[9px] text-neutral-400 whitespace-nowrap hidden md:block">
              PWA: {deferredPrompt ? '✅' : '⏳'}
            </span>
            {deferredPrompt && !isIframe && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-sm"
              >
                <Plus className="w-3 h-3" />
                Instalar App
              </button>
            )}
            {isIframe && (
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-[10px] font-bold hover:bg-blue-100 transition-all"
                title="Abrir en pestaña nueva"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir App
              </button>
            )}
            {notificationPermission !== 'granted' && (
              <button 
                onClick={() => registerPush(user.uid)}
                disabled={isRegistering}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-[10px] font-bold hover:bg-amber-100 transition-all disabled:opacity-50"
                title="Activar notificaciones"
              >
                <Bell className={`w-3 h-3 ${isRegistering ? 'animate-pulse' : ''}`} />
                {isRegistering ? 'Activando...' : 'Activar Avisos'}
              </button>
            )}
            <div className="flex items-center gap-2 bg-neutral-100 px-2 md:px-3 py-1.5 rounded-xl border border-neutral-200">
              <Volume2 className="w-3 h-3 md:w-4 h-4 text-neutral-500" />
              <select 
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value as any)}
                className="bg-transparent text-[9px] md:text-[10px] font-bold text-neutral-600 border-none focus:ring-0 cursor-pointer uppercase tracking-wider max-w-[80px] md:max-w-none"
              >
                <option value="Kore">Kore (F)</option>
                <option value="Zephyr">Zephyr (M)</option>
                <option value="Puck">Puck</option>
                <option value="Charon">Charon</option>
                <option value="Fenrir">Fenrir</option>
              </select>
            </div>
            <button 
              onClick={() => setShowNotifications(true)}
              className="p-2 text-neutral-500 hover:text-emerald-600 transition-colors relative"
              title="Notificaciones"
            >
              <Bell className="w-5 h-5" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-neutral-500 hover:text-emerald-600 transition-colors"
              title="Ajustes Generales"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowMetrics(true)}
              className="p-2 text-neutral-500 hover:text-emerald-600 transition-colors"
              title="Métricas de IA"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                setConfirmDialog({
                  title: 'Cerrar sesión',
                  message: '¿Estás seguro de que deseas cerrar tu sesión?',
                  variant: 'warning',
                  confirmText: 'Cerrar Sesión',
                  onConfirm: () => signOut(auth)
                });
              }}
              className="p-2 text-neutral-500 hover:text-red-600 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              alt="Profile" 
              className="w-10 h-10 rounded-full border border-neutral-200"
            />
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto p-4 sm:p-6">
          {/* Project Header (Only when a project is selected) */}
          {selectedProjectId && (
            <div className="mb-4 overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-sm">
              {projects.find(p => p.id === selectedProjectId)?.imageUrl && (
                <div className="h-24 w-full overflow-hidden relative">
                  <img 
                    src={projects.find(p => p.id === selectedProjectId)?.imageUrl} 
                    alt="Project Header" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <button 
                    onClick={() => {
                      setSelectedProjectId(null);
                      setActiveTab('projects');
                    }}
                    className="p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors flex-shrink-0"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 truncate text-neutral-900">
                      <Folder className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-emerald-500" />
                      <span className="truncate">{projects.find(p => p.id === selectedProjectId)?.name}</span>
                    </h2>
                    <p className="text-[10px] sm:text-xs truncate text-neutral-500">
                      {projects.find(p => p.id === selectedProjectId)?.description}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const p = projects.find(p => p.id === selectedProjectId);
                      if (p) {
                        setEditingProject(p);
                        setIsAddingProject(true);
                      }
                    }}
                    className="p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-400 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs & View Mode */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-2">
                {!selectedProjectId && (
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Menú Ppal</span>
                )}
                <div className="flex bg-neutral-200/50 p-1 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
                  {selectedProjectId ? (
                    <>
                      <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<CheckCircle2 className="w-4 h-4" />} label="Tareas" />
                      <TabButton active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} icon={<StickyNote className="w-4 h-4" />} label="Notas" />
                      <TabButton active={activeTab === 'reminders'} onClick={() => setActiveTab('reminders')} icon={<Bell className="w-4 h-4" />} label="Recordatorios" />
                    </>
                  ) : (
                    <>
                      <TabButton active={activeTab === 'projects'} onClick={() => { setActiveTab('projects'); setSelectedProjectId(null); }} icon={<FolderKanban className="w-4 h-4" />} label="Proyectos" />
                      <TabButton active={activeTab === 'budget'} onClick={() => { setActiveTab('budget'); setSelectedProjectId(null); }} icon={<Wallet className="w-4 h-4" />} label="Presupuesto" />
                      <TabButton active={activeTab === 'ai'} onClick={() => { setActiveTab('ai'); setSelectedProjectId(null); }} icon={<Sparkles className="w-4 h-4" />} label="Asistente AI" />
                    </>
                  )}
                </div>
              </div>
              
              {selectedProjectId && (
                <div className="flex bg-neutral-200/50 p-1 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
                  <ViewButton active={viewMode === 'week'} onClick={() => setViewMode('week')} icon={<Calendar className="w-4 h-4" />} label="Semana" />
                  <ViewButton active={viewMode === 'category'} onClick={() => setViewMode('category')} icon={<Tag className="w-4 h-4" />} label="Temas" />
                  <ViewButton active={viewMode === 'all'} onClick={() => setViewMode('all')} icon={<ListTodo className="w-4 h-4" />} label="Lista" />
                </div>
              )}
            </div>
          </div>

          {/* Content List */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + viewMode + selectedProjectId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'ai' ? (
                <AIAssistant userId={user.uid} onToast={showToast} onSaveNote={async (note: any) => {
                  try {
                    const targetProjectId = selectedProjectId || defaultProjectId;
                    await addDoc(collection(db, 'notes'), {
                      ...note,
                      userId: user.uid,
                      projectId: targetProjectId,
                      createdAt: serverTimestamp()
                    });
                    
                    setConfirmDialog({
                      title: 'Nota Guardada',
                      message: '¿Deseas ver la nota ahora o seguir chateando?',
                      confirmText: 'Ver Nota',
                      cancelText: 'Seguir Chateando',
                      variant: 'success',
                      onConfirm: () => {
                        setActiveTab('notes');
                        if (targetProjectId) {
                          setSelectedProjectId(targetProjectId);
                        }
                      }
                    });
                  } catch (err) {
                    handleFirestoreError(err, OperationType.CREATE, 'notes');
                  }
                }} />
              ) : activeTab === 'budget' ? (
                <BudgetDashboard 
                  budgets={budgets}
                  userId={user.uid}
                  period={currentBudgetPeriod}
                  onPeriodChange={setCurrentBudgetPeriod}
                  onAddBudget={() => { setEditingBudget(null); setIsAddingBudget(true); }}
                  onEditBudget={(b) => { setEditingBudget(b); setIsAddingBudget(true); }}
                  onAddExpense={(b) => { setEditingBudget(b); setEditingItem({ mode: 'expense' }); setIsAddingBudget(true); }}
                  onDeleteExpense={handleDeleteExpense}
                  onClone={handleClonePreviousMonth}
                  onCloseMonth={handleCloseMonth}
                  onReopenMonth={handleReopenMonth}
                  onVoicePayment={handleVoicePayment}
                  onToast={showToast}
                />
              ) : (
                <ContentList 
                  type={activeTab} 
                  viewMode={viewMode} 
                  items={activeItems}
                  selectedVoice={selectedVoice}
                  user={user}
                  onRegisterPush={() => registerPush(user.uid)}
                  notificationPermission={notificationPermission}
                  isIframe={isIframe}
                  showNotificationStatus={showNotificationStatus}
                  onSelectProject={(p: any) => {
                    setSelectedProjectId(p.id);
                    setActiveTab('tasks'); // Default to tasks when entering a project
                  }}
                  projects={projects}
                  onEdit={(item: any) => { 
                    if (activeTab === 'projects') {
                      setEditingProject(item);
                      setIsAddingProject(true);
                    } else {
                      setEditingItem(item); 
                      setIsAdding(true); 
                    }
                  }}
                  onDelete={async (id: string) => {
                    setConfirmDialog({ id, type: activeTab, variant: 'danger' });
                  }}
                  onToggleTask={async (task: any) => {
                    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
                    await updateDoc(doc(db, 'tasks', task.id!), { status: newStatus });
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Floating Action Button */}
        <button 
          onClick={() => { 
            if (activeTab === 'projects' && !selectedProjectId) {
              setEditingProject(null);
              setIsAddingProject(true);
            } else if (activeTab === 'budget') {
              setEditingBudget(null);
              setIsAddingBudget(true);
            } else {
              setEditingItem(selectedProjectId ? { projectId: selectedProjectId } : { projectId: defaultProjectId }); 
              setIsAdding(true); 
            }
          }}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-200 flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-40"
        >
          <Plus className="w-7 h-7 sm:w-8 sm:h-8" />
        </button>

        {/* Modal for Adding/Editing */}
        <AnimatePresence>
          {isAddingBudget && (
            <BudgetModal 
              userId={user.uid}
              userEmail={user.email}
              budget={editingBudget}
              period={currentBudgetPeriod}
              onClose={() => { setIsAddingBudget(false); setEditingItem(null); }}
              onToast={showToast}
              onDeleteExpense={handleDeleteExpense}
              setConfirmDialog={setConfirmDialog}
              mode={editingItem?.mode === 'expense' ? 'expense' : 'budget'}
            />
          )}
          {showNotifications && (
            <NotificationModal 
              notifications={notifications}
              onClose={() => setShowNotifications(false)}
              onClear={async () => {
                const batch = writeBatch(db);
                notifications.forEach(n => {
                  if (n.id) batch.delete(doc(db, 'notifications', n.id));
                });
                await batch.commit();
                showToast('Notificaciones limpiadas.', 'success');
              }}
              onMarkRead={async (id: string) => {
                await updateDoc(doc(db, 'notifications', id), { read: true });
              }}
            />
          )}
          {isAddingProject && (
            <ProjectModal 
              userId={user.uid}
              project={editingProject}
              onClose={() => setIsAddingProject(false)}
              onToast={showToast}
            />
          )}
          {isAdding && (
            <ItemModal 
              type={activeTab === 'projects' ? 'tasks' : activeTab}
              item={editingItem}
              onClose={() => setIsAdding(false)}
              userId={user.uid}
              onToast={showToast}
              existingItems={activeTab === 'tasks' ? tasks : activeTab === 'notes' ? notes : reminders}
              projects={projects}
              defaultProjectId={defaultProjectId}
            />
          )}
          {confirmDialog && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
              >
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
                  confirmDialog.variant === 'success' ? "bg-emerald-50 text-emerald-500" :
                  confirmDialog.variant === 'info' ? "bg-blue-50 text-blue-500" :
                  confirmDialog.variant === 'warning' ? "bg-amber-50 text-amber-500" :
                  "bg-red-50 text-red-500"
                )}>
                  {confirmDialog.variant === 'success' ? <CheckCircle2 className="w-10 h-10" /> :
                   confirmDialog.variant === 'info' ? <Bell className="w-10 h-10" /> :
                   confirmDialog.variant === 'warning' ? <AlertTriangle className="w-10 h-10" /> :
                   <Trash2 className="w-10 h-10" />}
                </div>
                <h3 className="text-2xl font-bold text-neutral-900 mb-2">{confirmDialog.title || '¿Estás seguro?'}</h3>
                <p className="text-neutral-500 mb-8">{confirmDialog.message || 'Esta acción no se puede deshacer.'}</p>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        if (confirmDialog.onCancel) confirmDialog.onCancel();
                        setConfirmDialog(null);
                      }}
                      className="flex-1 py-4 px-6 bg-neutral-100 text-neutral-600 font-bold rounded-2xl hover:bg-neutral-200 transition-all"
                    >
                      {confirmDialog.cancelText || 'Cancelar'}
                    </button>
                    <button 
                      onClick={async () => {
                        if (confirmDialog.onConfirm) {
                          await confirmDialog.onConfirm();
                          setConfirmDialog(null);
                        } else if (confirmDialog.id && confirmDialog.type) {
                          await deleteDoc(doc(db, confirmDialog.type, confirmDialog.id));
                          setConfirmDialog(null);
                          showToast('Eliminado correctamente', 'success');
                        }
                      }}
                      className={cn(
                        "flex-1 py-4 px-6 text-white font-bold rounded-2xl transition-all shadow-lg",
                        confirmDialog.variant === 'success' ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100" :
                        confirmDialog.variant === 'info' ? "bg-blue-500 hover:bg-blue-600 shadow-blue-100" :
                        confirmDialog.variant === 'warning' ? "bg-amber-500 hover:bg-amber-600 shadow-amber-100" :
                        "bg-red-500 hover:bg-red-600 shadow-red-200"
                      )}
                    >
                      {confirmDialog.confirmText || (confirmDialog.onConfirm ? 'Confirmar' : 'Eliminar')}
                    </button>
                  </div>
                  {confirmDialog.onSecondary && (
                    <button 
                      onClick={() => {
                        confirmDialog.onSecondary!();
                        setConfirmDialog(null);
                      }}
                      className="w-full py-4 px-6 bg-indigo-50 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-100 transition-all"
                    >
                      {confirmDialog.secondaryText || 'Reintentar'}
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
          
          {/* Toast Notification */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 50, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: 50, x: '-50%' }}
                className={cn(
                  "fixed bottom-8 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-xl text-white font-bold text-sm flex items-center gap-3 min-w-[280px]",
                  toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
                )}
              >
                {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : toast.type === 'error' ? <X className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                {toast.message}
              </motion.div>
            )}
          </AnimatePresence>
          {showSettings && (
            <GeneralSettingsModal 
              isOpen={showSettings} 
              onClose={() => setShowSettings(false)} 
              apiKey={manualApiKey}
              setApiKey={(key) => {
                setManualApiKey(key);
                localStorage.setItem('GEMINI_API_KEY', key);
              }}
              isPro={isPro}
              setIsPro={setIsPro}
              onToast={showToast}
            />
          )}
          {showMetrics && (
            <MetricsModal 
              onClose={() => setShowMetrics(false)}
              userId={user.uid}
              onToast={showToast}
            />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

// --- AI Assistant Component ---

function AIAssistant({ userId, onSaveNote, onToast }: { userId: string, onSaveNote: (note: any) => void, onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await generateAIContent(userMsg, {
        thinkingConfig: { thinkingLevel: "LOW" },
        maxOutputTokens: 2048,
        temperature: 0.7
      });

      const aiText = response.text || "Lo siento, no pude generar una respuesta.";
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
      trackAIUsage(userId, 'chat', userMsg.length + aiText.length);
    } catch (err: any) {
      console.error('AI Chat error:', err);
      let errorMsg = 'Lo siento, hubo un error al procesar tu mensaje.';
      
      if (err.message?.includes('API key not valid') || err.message?.includes('INVALID_ARGUMENT') || err.message?.includes('400')) {
        const keySource = localStorage.getItem('GEMINI_API_KEY') ? 'Manual' : 'Servidor/Entorno';
        errorMsg = `La API Key (${keySource}) parece no ser válida. Si la configuraste en los Secretos del servidor, asegúrate de que sea correcta y no tenga espacios ni comillas.`;
      } else if (err.message?.includes('SAFETY')) {
        errorMsg = 'El contenido fue bloqueado por los filtros de seguridad de la IA.';
      } else if (err.message?.includes('API Key')) {
        errorMsg = 'Error de Configuración: ' + err.message;
      } else if (err.message?.includes('fetch')) {
        errorMsg = 'Error de conexión. Por favor, revisa tu internet.';
      } else {
        // Show more detail for debugging
        errorMsg = `Error: ${err.message || 'Error desconocido'}. Por favor, verifica la configuración de la API Key en los ajustes.`;
      }
      
      setMessages(prev => [...prev, { role: 'ai', text: errorMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm flex flex-col h-[500px] sm:h-[600px] max-h-[80vh] overflow-hidden">
      <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
          <Sparkles className="w-5 h-5" />
        </div>
        <h3 className="font-bold">Asistente AI</h3>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400 text-center px-8">
            <Sparkles className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium">¡Hola! Soy tu asistente inteligente.</p>
            <p className="text-sm">Pregúntame lo que quieras y guarda las respuestas como notas.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
            <div className={cn(
              "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed markdown-body",
              msg.role === 'user' 
                ? "bg-emerald-600 text-white rounded-tr-none" 
                : "bg-neutral-100 text-neutral-800 rounded-tl-none"
            )}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
              {msg.role === 'ai' && !msg.text.includes('API Key') && (
                <button 
                  onClick={() => {
                    const prevMsg = i > 0 ? messages[i-1] : null;
                    const queryTitle = prevMsg?.role === 'user' 
                      ? (prevMsg.text.length > 40 ? prevMsg.text.substring(0, 40) + '...' : prevMsg.text)
                      : 'Respuesta de IA';
                    onSaveNote({ title: queryTitle, content: msg.text, category: 'AI Assistant' });
                  }}
                  className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider bg-white/50 hover:bg-white px-2 py-1 rounded-lg transition-all text-emerald-700"
                >
                  <StickyNote className="w-3 h-3" />
                  Guardar como nota
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="bg-neutral-100 p-4 rounded-2xl rounded-tl-none">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-neutral-100 bg-neutral-50/50">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Escribe tu mensaje..."
            className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- AI Usage Tracking ---

async function trackAIUsage(userId: string, type: string, chars: number) {
  try {
    const statsRef = doc(db, 'users', userId, 'stats', 'ai');
    const statsSnap = await getDoc(statsRef);
    
    if (statsSnap.exists()) {
      await updateDoc(statsRef, {
        [`${type}_calls`]: increment(1),
        [`${type}_chars`]: increment(chars),
        lastUsed: Timestamp.now()
      });
    } else {
      await setDoc(statsRef, {
        [`${type}_calls`]: 1,
        [`${type}_chars`]: chars,
        lastUsed: Timestamp.now()
      });
    }
  } catch (err) {
    console.error('Error tracking usage:', err);
  }
}

function PremiumBadge() {
  return (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm"
    >
      <Sparkles className="w-2.5 h-2.5" />
      PRO
    </motion.div>
  );
}

function GeneralSettingsModal({ isOpen, onClose, apiKey, setApiKey, isPro, setIsPro, onToast }: { isOpen: boolean, onClose: () => void, apiKey: string, setApiKey: (key: string) => void, isPro: boolean, setIsPro: (v: boolean) => void, onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [localKey, setLocalKey] = useState(apiKey);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-neutral-200"
      >
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">Ajustes Generales</h3>
              <p className="text-xs text-neutral-500">Configuración global de la app</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Pro Status Section */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Estado de Cuenta</span>
                {isPro && <PremiumBadge />}
              </div>
            </div>
            {isPro ? (
              <p className="text-sm text-neutral-600">Tienes acceso a todas las funciones profesionales. ¡Gracias por tu apoyo!</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-neutral-600">Mejora tu cuenta para desbloquear IA avanzada y métricas detalladas.</p>
                <button 
                  onClick={() => {
                    setIsPro(true);
                    localStorage.setItem('isPro', 'true');
                  }}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-100 hover:shadow-xl transition-all"
                >
                  Mejorar a PRO (Simulado)
                </button>
              </div>
            )}
          </div>

          {/* API Key Status Section */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Asistente IA</span>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
              <span className="text-[10px] font-bold text-neutral-500 uppercase">
                Activo
              </span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              La IA está configurada y lista para usarse a través del servidor seguro.
            </p>
          </div>

          {/* Version Info */}
          <div className="pt-4 border-t border-neutral-100">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Versión de la App</span>
              <span className="text-[10px] font-mono font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md">
                v{APP_VERSION}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-neutral-50/50 border-t border-neutral-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white border border-neutral-200 text-neutral-600 rounded-2xl text-sm font-bold hover:bg-neutral-100 transition-all"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MetricsModal({ onClose, userId, onToast }: { onClose: () => void, userId: string, onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const statsRef = doc(db, 'users', userId, 'stats', 'ai');
    const unsub = onSnapshot(statsRef, (snap) => {
      setStats(snap.data());
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">Métricas de IA</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !stats ? (
          <div className="text-center py-12 text-neutral-400">
            <p>Aún no has usado las funciones de IA.</p>
            <p className="text-sm">¡Prueba dictar una nota o escuchar una tarea!</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Voz (TTS)</p>
                <p className="text-3xl font-bold text-emerald-600">{stats.tts_calls || 0}</p>
                <p className="text-[10px] text-neutral-500 mt-1">Peticiones totales</p>
              </div>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Refinado</p>
                <p className="text-3xl font-bold text-emerald-600">{stats.refine_calls || 0}</p>
                <p className="text-[10px] text-neutral-500 mt-1">Textos procesados</p>
              </div>
            </div>

            <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Caracteres Procesados</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-bold">{(stats.tts_chars || 0) + (stats.refine_chars || 0)}</p>
                <p className="text-sm text-neutral-400 mb-1.5">caracteres</p>
              </div>
              <div className="mt-4 h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500" 
                  style={{ width: `${Math.min(100, ((stats.tts_chars || 0) + (stats.refine_chars || 0)) / 10000 * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-neutral-500 mt-2">Muestra el uso acumulado de procesamiento de texto.</p>
            </div>

            <div className="pt-4 border-t border-neutral-100 text-center">
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Última actividad</p>
              <p className="text-sm text-neutral-600 font-medium">
                {stats.lastUsed?.toDate().toLocaleString('es-ES')}
              </p>
            </div>
          </div>
        )}

        <button 
          onClick={onClose}
          className="w-full mt-8 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-colors"
        >
          Entendido
        </button>
      </motion.div>
    </div>
  );
}

// --- Sub-components ---

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap",
        active ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
      )}
    >
      {icon}
      <span className={cn(active ? "block" : "hidden lg:block")}>{label}</span>
    </button>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap",
        active ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
      )}
    >
      {icon}
      <span className={cn(active ? "block" : "hidden lg:block")}>{label}</span>
    </button>
  );
}

function AllTasksListItem({ task, onToggle }: any) {
  const style = getCategoryStyle(task.category);
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn("border rounded-xl p-4 shadow-sm", style.bg, style.border)}
    >
      <div className="flex items-center gap-3">
        <button 
          onClick={onToggle}
          className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            task.status === 'completed' ? "bg-emerald-500 border-emerald-500 text-white" : "border-neutral-300 text-transparent"
          )}
        >
          <CheckCircle2 className="w-3 h-3" />
        </button>
        <div className="flex-1 min-w-0">
          <h4 className={cn("font-semibold break-all", task.status === 'completed' && "line-through text-neutral-400")}>
            {task.title}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded flex items-center gap-1", style.bg, style.text)}>
              {style.icon}
              {task.category || 'General'}
            </span>
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const text = `*Tarea:* ${task.title}\n${task.category ? `*Categoría:* ${task.category}\n` : ''}${task.dueDate ? `*Fecha:* ${task.dueDate.toDate().toLocaleString('es-ES')}\n` : ''}${task.subtasks?.length > 0 ? `\n*Subtareas:*\n${task.subtasks.map((s: any) => `${s.completed ? '✅' : '⚪'} ${s.text}`).join('\n')}` : ''}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }}
          className="p-2 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
          title="Enviar por WhatsApp"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      </div>
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mt-3 ml-8 space-y-2 border-l-2 border-neutral-200/50 pl-4">
          {task.subtasks.map((sub: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-neutral-600">
              <div className={cn("w-1.5 h-1.5 rounded-full", sub.completed ? "bg-emerald-500" : "bg-neutral-300")} />
              <span className={sub.completed ? "line-through text-neutral-400" : ""}>{sub.text}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ContentList({ type, viewMode, items, onEdit, onDelete, onToggleTask, selectedVoice, user, onRegisterPush, notificationPermission, isIframe, showNotificationStatus, onSelectProject, projects = [] }: any) {
  if (type === 'projects') {
    return (
      <ProjectList 
        projects={items} 
        onEdit={onEdit} 
        onDelete={onDelete} 
        onSelectProject={onSelectProject} 
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
          {type === 'tasks' ? <CheckCircle2 className="w-8 h-8" /> : type === 'notes' ? <StickyNote className="w-8 h-8" /> : <Bell className="w-8 h-8" />}
        </div>
        <p className="text-lg font-medium">No hay {type === 'tasks' ? 'tareas' : type === 'notes' ? 'notas' : 'recordatorios'} todavía.</p>
        <p className="text-sm">¡Crea uno nuevo para empezar!</p>
        
        {type === 'reminders' && showNotificationStatus && (
          <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
            {isIframe ? (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-800 text-sm mb-4">
                <p className="font-bold mb-1 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Modo Vista Previa
                </p>
                <p>Las notificaciones no funcionan dentro de este panel. Para activarlas, abre la app en una pestaña nueva.</p>
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="mt-3 w-full py-2 bg-amber-600 text-white rounded-xl font-bold text-xs hover:bg-amber-700 transition-all"
                >
                  Abrir en pestaña nueva
                </button>
              </div>
            ) : (
              <>
                {notificationPermission !== 'granted' && (
                  <button 
                    onClick={onRegisterPush}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
                  >
                    <Bell className="w-5 h-5" />
                    Activar Avisos
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  if (viewMode === 'all' && type === 'tasks') {
    return (
      <div className="space-y-4">
        {items.map((task: any) => (
          <AllTasksListItem key={task.id} task={task} onToggle={() => onToggleTask(task)} />
        ))}
      </div>
    );
  }

  // Grouping logic
  const grouped = items.reduce((acc: any, item: any) => {
    let key = 'Sin categoría';
    if (viewMode === 'category') {
      key = item.category || 'Sin categoría';
    } else {
      // Weekly view - group by day
      const date = item.dueDate ? item.dueDate.toDate() : (item.createdAt ? item.createdAt.toDate() : new Date());
      key = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {type === 'reminders' && showNotificationStatus && (
        <div className="flex flex-col gap-4 mb-6">
          {isIframe && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-800 text-sm">
              <p className="font-bold mb-1 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Modo Vista Previa
              </p>
              <p>Las notificaciones están bloqueadas en este panel. Para que funcionen, debes abrir la aplicación en una pestaña independiente.</p>
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="mt-3 py-2 px-4 bg-amber-600 text-white rounded-xl font-bold text-xs hover:bg-amber-700 transition-all inline-flex items-center gap-2"
              >
                Abrir en pestaña nueva
              </button>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-900">Estado de Notificaciones</p>
                <p className="text-xs text-emerald-700">
                  {notificationPermission === 'granted' ? '✅ Activadas correctamente' : 
                   notificationPermission === 'denied' ? '❌ Permiso denegado (bloqueado)' : 
                   '⚠️ Pendiente de activación'}
                </p>
              </div>
            </div>
            {!isIframe && notificationPermission !== 'granted' && (
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={onRegisterPush}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all"
                >
                  <Bell className="w-4 h-4" />
                  Activar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {Object.entries(grouped).map(([group, groupItems]: [string, any]) => (
        <section key={group}>
          <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            {group}
          </h3>
          <div className="grid gap-4 w-full">
            {groupItems.map((item: any, idx: number) => (
              <ItemCard 
                key={item.id || `item-${idx}`} 
                type={type} 
                item={item} 
                selectedVoice={selectedVoice}
                onEdit={() => onEdit(item)} 
                onDelete={() => onDelete(item.id)}
                onToggle={() => type === 'tasks' && onToggleTask(item)}
                projects={projects}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ProjectCard({ project, onEdit, onDelete, onClick }: any) {
  const isDefault = project.name === 'Proyecto por defecto';
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white border border-neutral-200 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden"
      onClick={onClick}
    >
      {project.imageUrl && (
        <div className="h-32 w-full overflow-hidden relative">
          <img 
            src={project.imageUrl} 
            alt={project.name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg",
            project.color || 'bg-emerald-500'
          )}>
            <FolderKanban className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-2 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
              title="Editar Proyecto"
            >
              <Settings className="w-4 h-4" />
            </button>
            {!isDefault && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-1 truncate">{project.name}</h3>
        {project.description && (
          <p className="text-xs sm:text-sm text-neutral-500 line-clamp-2 mb-4 h-10">{project.description}</p>
        )}
        
        <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
              project.status === 'active' ? "bg-emerald-100 text-emerald-700" : 
              project.status === 'completed' ? "bg-blue-100 text-blue-700" : 
              "bg-neutral-100 text-neutral-600"
            )}>
              {project.status === 'active' ? 'Activo' : project.status === 'completed' ? 'Finalizado' : 'Archivado'}
            </span>
            {project.priority && project.priority > 1 && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                P{project.priority}
              </span>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </motion.div>
  );
}

function ProjectList({ projects, onEdit, onDelete, onSelectProject }: any) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
          <FolderKanban className="w-8 h-8" />
        </div>
        <p className="text-lg font-medium">No tienes proyectos todavía.</p>
        <p className="text-sm">Crea un proyecto para organizar tus tareas y notas.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project: any) => (
        <ProjectCard 
          key={project.id} 
          project={project} 
          onEdit={() => onEdit(project)} 
          onDelete={() => onDelete(project.id)}
          onClick={() => onSelectProject(project)}
        />
      ))}
    </div>
  );
}

function ItemCard({ type, item, onEdit, onDelete, onToggle, selectedVoice, projects = [] }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const project = item.projectId ? projects.find((p: any) => p.id === item.projectId) : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShare = async () => {
    if (!shareRef.current) return;
    setIsSharing(true);
    try {
      // Wait for state update to render share content
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = await toPng(shareRef.current, { quality: 0.95, backgroundColor: '#ffffff' });
      
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${item.title}.png`, { type: 'image/png' });

      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: item.title,
          text: `Detalles de mi ${type === 'tasks' ? 'tarea' : type === 'notes' ? 'nota' : 'recordatorio'}: ${item.title}`
        });
      } else {
        // Fallback for WhatsApp
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Mira mi ${type === 'tasks' ? 'tarea' : type === 'notes' ? 'nota' : 'recordatorio'}: ${item.title}`)}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const speak = async () => {
    const textToSpeak = type === 'notes' ? item.content : item.description;
    if (!textToSpeak || isSpeaking || isTTSLoading) return;

    setTtsError(null);
    const cacheKey = `${selectedVoice}_${textToSpeak}`;
    
    if (audioCache.has(cacheKey)) {
      setIsSpeaking(true);
      await playPCM(audioCache.get(cacheKey)!, 24000);
      setIsSpeaking(false);
      return;
    }

    setIsTTSLoading(true);
    try {
      const response = await generateAIContent(textToSpeak, {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice || 'Kore' } }
        },
        maxOutputTokens: 1024
      });

      const base64Audio = response.audio;
      
      setIsTTSLoading(false);
      if (base64Audio) {
        audioCache.set(cacheKey, base64Audio);
        trackAIUsage(item.userId, 'tts', textToSpeak.length);
        setIsSpeaking(true);
        await playPCM(base64Audio, 24000);
        setIsSpeaking(false);
      }
    } catch (err: any) {
      console.error('TTS error:', err);
      setIsTTSLoading(false);
      setIsSpeaking(false);
      
      if (err.message?.includes('API key not valid') || err.message?.includes('INVALID_ARGUMENT') || err.message?.includes('400')) {
        setTtsError("La API Key de Gemini no es válida. Por favor, revísala en los ajustes.");
      } else if (err.message?.includes('429') || err.status === 'RESOURCE_EXHAUSTED') {
        setTtsError("Límite de cuota excedido. Por favor, intenta de nuevo en unos minutos.");
      } else {
        setTtsError("Error al generar el audio.");
      }
      
      setTimeout(() => setTtsError(null), 5000);
    }
  };

  const handleWhatsAppShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const typeText = type === 'tasks' ? 'Tarea' : type === 'notes' ? 'Nota' : 'Recordatorio';
    let text = `*${typeText}:* ${item.title}\n`;
    
    if (item.category) text += `*Categoría:* ${item.category}\n`;
    if (item.dueDate) text += `*Fecha:* ${item.dueDate.toDate().toLocaleString('es-ES')}\n`;
    
    const content = item.description || item.content;
    if (content) text += `\n${content}\n`;
    
    if (type === 'tasks' && item.subtasks?.length > 0) {
      text += `\n*Subtareas:*\n${item.subtasks.map((s: any) => `${s.completed ? '✅' : '⚪'} ${s.text}`).join('\n')}`;
    }
    
    if ((type === 'notes' || type === 'reminders') && item.details?.length > 0) {
      text += `\n*Detalles:*\n${item.details.map((d: string) => `• ${d}`).join('\n')}`;
    }

    // If there are images and sharing is supported, use navigator.share
    const images = item.images || [];
    if (images.length > 0 && navigator.share && navigator.canShare) {
      try {
        const files = await Promise.all(images.map(async (base64: string, i: number) => {
          const res = await fetch(base64);
          const blob = await res.blob();
          return new File([blob], `imagen-${i}.png`, { type: 'image/png' });
        }));

        if (navigator.canShare({ files })) {
          await navigator.share({
            files,
            title: item.title,
            text: text
          });
          return;
        }
      } catch (err) {
        console.error('Error sharing images:', err);
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const style = getCategoryStyle(item.category);

  return (
    <div className="relative group">
      <motion.div 
        layout
        className={cn(
          "border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer w-full min-w-0",
          style.bg,
          style.border
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {type === 'tasks' && (
              <button 
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className={cn(
                  "mt-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0",
                  item.status === 'completed' ? "bg-emerald-500 border-emerald-500 text-white" : "border-neutral-300 text-transparent"
                )}
              >
                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h4 className={cn(
                "font-bold text-base sm:text-lg break-all",
                type === 'tasks' && item.status === 'completed' && "line-through text-neutral-400"
              )}>
                {item.title}
              </h4>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-[10px] sm:text-sm text-neutral-500">
                {project && (
                  <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-neutral-100 text-neutral-600 truncate max-w-[120px]")}>
                    <Folder className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{project.name}</span>
                  </span>
                )}
                {item.category && (
                  <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-lg truncate max-w-[100px]", style.bg, style.text)}>
                    {style.icon}
                    <span className="truncate">{item.category}</span>
                  </span>
                )}
                {item.dueDate && (
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    {item.dueDate.toDate().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
                {item.repeat && item.repeat !== 'none' && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-blue-50 text-blue-600 font-bold text-[10px] sm:text-xs">
                    <RefreshCw className="w-3 h-3 flex-shrink-0" />
                    {item.repeat === 'daily' ? 'Diario' : item.repeat === 'weekly' ? 'Semanal' : 'Mensual'}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            {ttsError && (
              <motion.span 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-1 rounded-lg mr-2"
              >
                {ttsError}
              </motion.span>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); speak(); }}
              disabled={isSpeaking || isTTSLoading}
              className={cn(
                "p-1.5 sm:p-2 rounded-xl transition-all relative",
                isSpeaking 
                  ? "text-emerald-600 bg-emerald-50 animate-pulse" 
                  : isTTSLoading
                    ? "text-emerald-400 bg-emerald-50"
                    : "text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50"
              )}
              title="Escuchar"
            >
              {isTTSLoading ? (
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
            <button 
              onClick={handleWhatsAppShare}
              className="p-1.5 sm:p-2 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
              title="Enviar por WhatsApp"
            >
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              className="p-1.5 sm:p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
              title="Compartir Imagen"
            >
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="relative" ref={menuRef}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1.5 sm:p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-xl transition-all"
              >
                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <AnimatePresence>
                {showMenu && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl py-2 w-32 z-20"
                  >
                    <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(); }} className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50">Editar</button>
                    <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete(); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Eliminar</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-neutral-100">
                {/* Images for Notes (Before) */}
                {type === 'notes' && item.imagePosition === 'before' && item.images && item.images.length > 0 && (
                  <div className={cn(
                    "grid gap-2 mb-4 items-start",
                    item.images.length === 1 ? "grid-cols-1" : 
                    item.images.length === 2 ? "grid-cols-2" : "grid-cols-3"
                  )}>
                    {item.images.map((img: string, i: number) => (
                      <div key={i} className="relative rounded-xl overflow-hidden shadow-sm border border-neutral-100 bg-neutral-50/50">
                        <img 
                          src={img} 
                          alt={`Note image ${i}`} 
                          className="w-full h-auto max-h-[500px] object-contain cursor-zoom-in hover:scale-105 transition-transform" 
                          referrerPolicy="no-referrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(img, '_blank');
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {(item.description || item.content) && (
                  <div className="text-neutral-600 text-sm mb-4 leading-relaxed markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {item.description || item.content}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Images for Notes (After) */}
                {type === 'notes' && (item.imagePosition === 'after' || !item.imagePosition) && item.images && item.images.length > 0 && (
                  <div className={cn(
                    "grid gap-2 mb-4 items-start",
                    item.images.length === 1 ? "grid-cols-1" : 
                    item.images.length === 2 ? "grid-cols-2" : "grid-cols-3"
                  )}>
                    {item.images.map((img: string, i: number) => (
                      <div key={i} className="relative rounded-xl overflow-hidden shadow-sm border border-neutral-100 bg-neutral-50/50">
                        <img 
                          src={img} 
                          alt={`Note image ${i}`} 
                          className="w-full h-auto max-h-[500px] object-contain cursor-zoom-in hover:scale-105 transition-transform" 
                          referrerPolicy="no-referrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(img, '_blank');
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Subtasks or Details */}
                {type === 'tasks' && item.subtasks && item.subtasks.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Subtareas</p>
                    {item.subtasks.map((st: Subtask, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                        {st.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" /> : <Circle className="w-4 h-4 text-neutral-300 mt-0.5 flex-shrink-0" />}
                        <span className={cn("break-all", st.completed ? "line-through text-neutral-400" : "")}>{st.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(type === 'notes' || type === 'reminders') && item.details && item.details.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Detalles</p>
                    <ul className="list-disc list-inside text-sm text-neutral-600 space-y-1 break-all">
                      {item.details.map((detail: string, i: number) => (
                        <li key={i} className="break-all">{detail}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-neutral-100">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  >
                    Editar
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Hidden Share Content */}
      <div className="fixed -left-full top-0 opacity-0 pointer-events-none">
        <div ref={shareRef} className="w-[500px] p-10 bg-white border-8 border-emerald-500 rounded-3xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
              {type === 'tasks' ? <CheckCircle2 className="w-8 h-8" /> : type === 'notes' ? <StickyNote className="w-8 h-8" /> : <Bell className="w-8 h-8" />}
            </div>
            <div>
              <h2 className="text-3xl font-black text-neutral-900 tracking-tight">{item.title}</h2>
              <p className="text-emerald-600 font-bold uppercase tracking-widest text-sm">
                {type === 'tasks' ? 'Tarea' : type === 'notes' ? 'Nota' : 'Recordatorio'} • {item.category || 'General'}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {(item.description || item.content) && (
              <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100">
                <p className="text-neutral-700 text-lg leading-relaxed italic">"{item.description || item.content}"</p>
              </div>
            )}

            {type === 'tasks' && item.subtasks && item.subtasks.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-black text-neutral-400 uppercase tracking-widest">Subtareas</p>
                {item.subtasks.map((st: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-xl font-medium text-neutral-800">
                    <div className={cn("w-6 h-6 rounded-full border-2", st.completed ? "bg-emerald-500 border-emerald-500" : "border-neutral-300")} />
                    <span className={st.completed ? "line-through text-neutral-400" : ""}>{st.text}</span>
                  </div>
                ))}
              </div>
            )}

            {(type === 'notes' || type === 'reminders') && item.details && item.details.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-black text-neutral-400 uppercase tracking-widest">Detalles</p>
                <ul className="space-y-3">
                  {item.details.map((detail: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-xl font-medium text-neutral-800">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2.5 flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {item.dueDate && (
              <div className="pt-6 border-t border-neutral-100 flex items-center gap-2 text-neutral-500 font-bold">
                <Calendar className="w-5 h-5" />
                <span>Fecha: {item.dueDate.toDate().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}</span>
              </div>
            )}
          </div>

          <div className="mt-12 text-center">
            <p className="text-neutral-300 font-bold tracking-tighter text-xl italic">Generado con TaskMaster AI</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectModal({ project, onClose, userId, onToast }: { project?: any, onClose: () => void, userId: string, onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const isDefault = project?.name === 'Proyecto por defecto';
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [status, setStatus] = useState<'active' | 'archived' | 'completed'>(project?.status || 'active');
  const [priority, setPriority] = useState<number>(project?.priority || 1);
  const [color, setColor] = useState(project?.color || 'bg-emerald-500');
  const [imageUrl, setImageUrl] = useState(project?.imageUrl || '');
  const [loading, setLoading] = useState(false);

  const colors = [
    'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-rose-500', 
    'bg-amber-500', 'bg-indigo-500', 'bg-neutral-800', 'bg-sky-500'
  ];

  const presets = [
    { name: 'Trabajo', url: 'https://picsum.photos/seed/work/800/400' },
    { name: 'Estudio', url: 'https://picsum.photos/seed/study/800/400' },
    { name: 'Salud', url: 'https://picsum.photos/seed/health/800/400' },
    { name: 'Viajes', url: 'https://picsum.photos/seed/travel/800/400' },
    { name: 'Finanzas', url: 'https://picsum.photos/seed/finance/800/400' },
    { name: 'Ideas', url: 'https://picsum.photos/seed/ideas/800/400' },
    { name: 'Hogar', url: 'https://picsum.photos/seed/home/800/400' },
    { name: 'Deportes', url: 'https://picsum.photos/seed/sports/800/400' }
  ];

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const data = {
        userId,
        name,
        description,
        status,
        priority,
        color,
        imageUrl,
        createdAt: project?.createdAt || serverTimestamp()
      };

      if (project?.id) {
        await updateDoc(doc(db, 'projects', project.id), data);
      } else {
        await addDoc(collection(db, 'projects'), data);
      }
      onClose();
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">{project ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Nombre del Proyecto</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isDefault}
                placeholder="Ej: Rediseño Web, Viaje a Japón..."
                className={cn(
                  "w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all",
                  isDefault && "opacity-50 cursor-not-allowed"
                )}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Descripción (Opcional)</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="¿De qué trata este proyecto?"
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all h-24 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Estado</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="active">Activo</option>
                  <option value="completed">Finalizado</option>
                  <option value="archived">Archivado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Prioridad</label>
                <select 
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="1">Baja (1)</option>
                  <option value="2">Media-Baja (2)</option>
                  <option value="3">Media (3)</option>
                  <option value="4">Alta (4)</option>
                  <option value="5">Muy Alta (5)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map(c => (
                    <button 
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        c,
                        color === c ? "ring-2 ring-offset-2 ring-neutral-900 scale-110" : "opacity-60 hover:opacity-100"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Imagen de Encabezado</label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
                {presets.map(p => (
                  <button
                    key={p.url}
                    type="button"
                    onClick={() => setImageUrl(p.url)}
                    className={cn(
                      "aspect-video rounded-lg overflow-hidden border-2 transition-all",
                      imageUrl === p.url ? "border-emerald-500 scale-105 shadow-md" : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={p.url} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input 
                  type="url" 
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="O pega una URL de imagen personalizada..."
                  className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm"
                />
                {imageUrl && (
                  <button 
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="px-4 py-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all font-bold text-xs"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-10">
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={loading || !name.trim()}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Proyecto'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ItemModal({ type, item, onClose, userId, onToast, existingItems = [], projects = [], defaultProjectId }: any) {
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || item?.content || '');
  const [category, setCategory] = useState(item?.category || '');
  const [projectId, setProjectId] = useState(item?.projectId || defaultProjectId || '');
  const [dueDate, setDueDate] = useState(() => {
    if (!item?.dueDate) return '';
    const d = item.dueDate.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [dueTime, setDueTime] = useState(() => {
    if (!item?.dueDate) return '';
    const d = item.dueDate.toDate();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [subtasks, setSubtasks] = useState<Subtask[]>(item?.subtasks || []);
  const [details, setDetails] = useState<string[]>(item?.details || []);
  const [images, setImages] = useState<string[]>(item?.images || []);
  const [imagePosition, setImagePosition] = useState<'before' | 'after'>(item?.imagePosition || 'after');
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly'>(item?.repeat || 'none');
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isPastingAI, setIsPastingAI] = useState(false);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const descriptionRef = useRef(description);

  useEffect(() => {
    descriptionRef.current = description;
  }, [description]);

  const refineText = async (text: string) => {
    // Basic deduplication for common STT artifacts
    const words = text.split(/\s+/);
    const uniqueWords = words.filter((w, i) => w.toLowerCase() !== words[i-1]?.toLowerCase());
    const cleanText = uniqueWords.join(' ').trim();

    if (!cleanText || cleanText.length < 3) return '';
    
    setIsRefining(true);
    try {
      const response = await generateAIContent(
        `Actúa como un transcriptor y editor profesional. El siguiente texto es el resultado bruto de un dictado por voz (STT). 
        Tu tarea es:
        1. Limpiar el texto eliminando repeticiones accidentales y ruidos de transcripción.
        2. Corregir puntuación, capitalización y gramática.
        3. Mantener el significado exacto y el tono del usuario.
        4. Solo devuelve el texto limpio y final, sin comentarios ni comillas.
        
        Texto a procesar: "${cleanText}"`,
        {
          thinkingConfig: { thinkingLevel: "LOW" },
          maxOutputTokens: 1024
        }
      );

      trackAIUsage(userId, 'refine', cleanText.length);
      return response.text.trim() || cleanText;
    } catch (err) {
      console.error('Refine error:', err);
      return text;
    } finally {
      setIsRefining(false);
    }
  };

  const suggestCategory = async () => {
    if (!title) return;
    setIsSuggestingCategory(true);
    console.log('Suggesting category for:', title);
    try {
      const response = await generateAIContent(
        `Analiza el siguiente título de una tarea o nota y sugiere una categoría corta (una sola palabra) que mejor la describa.
        Ejemplos: "Comprar leche" -> Hogar, "Reunión de equipo" -> Trabajo, "Correr 5km" -> Salud.
        
        Título: "${title}"`,
        {
          thinkingConfig: { thinkingLevel: "LOW" },
          maxOutputTokens: 128,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              category: { 
                type: "STRING",
                description: "La categoría sugerida (una sola palabra)"
              }
            },
            required: ["category"]
          }
        }
      );
      
      const text = response.text;
      console.log('AI Raw Response:', text);
      if (!text) throw new Error("La IA no devolvió texto.");
      
      const data = JSON.parse(text);
      const suggested = data.category?.trim();
      if (suggested) {
        setCategory(suggested);
      } else {
        console.warn('No se encontró categoría en la respuesta JSON');
      }
      trackAIUsage(userId, 'suggest_category', title.length);
    } catch (err: any) {
      console.error('Suggest category error:', err);
      onToast('Error de IA (Categoría): ' + (err.message || 'Error desconocido'), 'error');
    } finally {
      setIsSuggestingCategory(false);
    }
  };

  const parseAIResponse = (text: string) => {
    try {
      // Try to find JSON block if AI wrapped it in markdown
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : text;
      return JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', text);
      // Fallback: if it's not JSON, maybe it's just the content?
      // But we expect title and content.
      throw new Error('La respuesta de la IA no tiene el formato esperado.');
    }
  };

  const smartPaste = async () => {
    let text = '';
    try {
      // Try to read from clipboard
      if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      }
    } catch (err) {
      console.warn('Clipboard access denied or failed:', err);
    }

    // If clipboard fails or is empty, ask the user
    if (!text || !text.trim()) {
      text = window.prompt('Pega aquí el texto que quieres que la IA organice y formatee:') || '';
    }

    if (!text.trim()) return;

    setIsPastingAI(true);
    try {
      const response = await generateAIContent(
        `Organiza y formatea el siguiente texto usando Markdown (negritas, listas, etc.). Genera un título corto y descriptivo.
        
        Texto:
        ${text}
        
        Responde estrictamente en formato JSON con los campos "title" y "content".`,
        {
          thinkingConfig: { thinkingLevel: "LOW" },
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      );

      const responseText = response.text;
      if (!responseText) {
        throw new Error("La IA no devolvió ninguna respuesta.");
      }

      const data = parseAIResponse(responseText);
      setTitle(data.title || 'Nota Importada');
      setDescription(data.content || text);
      trackAIUsage(userId, 'smart_paste', (data.content?.length || 0) + text.length);
    } catch (err: any) {
      console.error('Smart Paste error:', err);
      let errorMsg = 'Error al procesar con IA';
      
      if (err.message?.includes('SAFETY')) {
        errorMsg = 'El contenido fue bloqueado por los filtros de seguridad de la IA.';
      } else if (err.message) {
        errorMsg = `Error de API: ${err.message}`;
      }
      
      onToast(errorMsg, 'error');
    } finally {
      setIsPastingAI(false);
    }
  };

  const generateSubtasks = async () => {
    if (!title) return;
    setIsGeneratingSubtasks(true);
    console.log('Generating subtasks for:', title);
    try {
      const response = await generateAIContent(
        `Genera una lista de 3 a 5 subtareas lógicas y concisas para completar la siguiente tarea principal.
        
        Tarea principal: "${title}"`,
        {
          thinkingConfig: { thinkingLevel: "LOW" },
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              subtasks: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Lista de subtareas"
              }
            },
            required: ["subtasks"]
          }
        }
      );
      
      const text = response.text;
      console.log('AI Raw Response (Subtasks):', text);
      if (!text) throw new Error("La IA no devolvió texto.");

      const data = JSON.parse(text);
      if (data.subtasks && Array.isArray(data.subtasks)) {
        const newSubtasks = data.subtasks
          .filter((st: any) => typeof st === 'string' && st.trim() !== '')
          .map((st: string) => ({ text: st.trim(), completed: false }));
        
        if (newSubtasks.length > 0) {
          setSubtasks(prev => [...prev, ...newSubtasks]);
        }
      }
      trackAIUsage(userId, 'generate_subtasks', title.length);
    } catch (err: any) {
      console.error('Generate subtasks error:', err);
      onToast('Error de IA (Subtareas): ' + (err.message || 'Error desconocido'), 'error');
    } finally {
      setIsGeneratingSubtasks(false);
    }
  };

  const extractReminders = async () => {
    if (!description) return;
    setIsRefining(true);
    try {
      const response = await generateAIContent(
        `Analiza el siguiente texto y extrae una fecha y hora para un recordatorio si existe.
        Si no hay fecha u hora clara, devuelve null para esos campos.
        
        Texto: "${description}"`,
        {
          thinkingConfig: { thinkingLevel: "LOW" },
          maxOutputTokens: 256,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              date: { 
                type: "STRING", 
                description: "Fecha en formato YYYY-MM-DD o null",
                nullable: true
              },
              time: { 
                type: "STRING", 
                description: "Hora en formato HH:MM o null",
                nullable: true
              }
            },
            required: ["date", "time"]
          }
        }
      );
      const data = JSON.parse(response.text || '{}');
      if (data.date) setDueDate(data.date);
      if (data.time) setDueTime(data.time);
      trackAIUsage(userId, 'extract_reminder', description.length);
    } catch (err) {
      console.error('Extract reminder error:', err);
    } finally {
      setIsRefining(false);
    }
  };

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES';

      recognitionRef.current.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            transcriptRef.current += chunk;
          } else {
            interim += chunk;
          }
        }
        setLiveTranscript(transcriptRef.current + interim);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = async () => {
        setIsRecording(false);
        const rawText = transcriptRef.current;
        if (rawText) {
          const refined = await refineText(rawText);
          if (refined) {
            const base = descriptionRef.current;
            setDescription(base + (base && !base.endsWith(' ') ? ' ' : '') + refined);
          }
        }
        transcriptRef.current = '';
        setLiveTranscript('');
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      transcriptRef.current = '';
      setLiveTranscript('');
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const handleSave = async () => {
    if (!title) return;
    if (type === 'reminders' && !dueDate) {
      onToast('Por favor, selecciona una fecha para el recordatorio.', 'info');
      return;
    }
    setIsSaving(true);
    try {
      // Standardize category: Trim and Capitalize first letter
      const trimmedCategory = category.trim();
      const finalCategory = trimmedCategory 
        ? trimmedCategory.charAt(0).toUpperCase() + trimmedCategory.slice(1).toLowerCase()
        : 'General';

      // Fix date handling: ensure valid date string
      let finalDueDate: Timestamp | null = null;
      if (dueDate) {
        const timeStr = dueTime || '12:00';
        const dateObj = new Date(`${dueDate}T${timeStr}:00`);
        if (!isNaN(dateObj.getTime())) {
          finalDueDate = Timestamp.fromDate(dateObj);
        }
      }

      const data: any = {
        userId,
        title,
        category: finalCategory,
        dueDate: finalDueDate,
        repeat: type === 'reminders' ? repeat : 'none',
        projectId: projectId || defaultProjectId || null,
        createdAt: item?.createdAt || serverTimestamp()
      };

      if (type === 'reminders') {
        // If the due date changed, reset notified to false so it can be triggered again
        const oldDueDate = item?.dueDate?.toDate()?.getTime();
        const newDueDate = finalDueDate?.toDate()?.getTime();
        if (oldDueDate !== newDueDate) {
          data.notified = false;
        } else {
          data.notified = item?.notified || false;
        }
      }

      if (type === 'tasks') {
        data.description = description || '';
        data.status = item?.status || 'pending';
        data.subtasks = subtasks.filter(st => st.text.trim() !== '');
      } else if (type === 'notes') {
        data.content = description || '';
        data.details = details.filter(d => d.trim() !== '');
        data.images = images;
        data.imagePosition = imagePosition;
      } else {
        data.description = description || '';
        data.details = details.filter(d => d.trim() !== '');
      }

      if (item?.id) {
        await updateDoc(doc(db, type, item.id), data);
      } else {
        await addDoc(collection(db, type), data);
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, item?.id ? OperationType.UPDATE : OperationType.CREATE, type);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (images.length >= 3) return;
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          
          setImages(prev => {
            if (prev.length >= 3) return prev;
            return [...prev, compressedBase64];
          });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <h2 className="text-xl font-bold">
            {item ? 'Editar' : 'Nueva'} {type === 'tasks' ? 'Tarea' : type === 'notes' ? 'Nota' : 'Recordatorio'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {type === 'notes' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={smartPaste}
                disabled={isPastingAI}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-200 text-xs font-bold hover:bg-blue-100 transition-all disabled:opacity-50"
              >
                <Save className={cn("w-4 h-4", isPastingAI && "animate-pulse")} />
                {isPastingAI ? 'Procesando...' : 'Pegado Inteligente'}
              </button>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Título</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Qué tienes en mente?"
              className="w-full text-xl font-bold border-none focus:ring-0 p-0 placeholder:text-neutral-300"
              autoFocus
            />
          </div>

          {/* Description / Content with Voice */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest">
                {type === 'notes' ? 'Contenido' : 'Descripción'}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  type="button"
                  onClick={toggleRecording}
                  disabled={isRefining}
                  className={cn(
                    "flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all",
                    isRecording 
                      ? "bg-red-100 text-red-600 animate-pulse" 
                      : isRefining
                        ? "bg-amber-100 text-amber-600"
                        : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                  )}
                >
                  {isRefining ? (
                    <>
                      <Sparkles className="w-3 h-3 animate-spin" />
                      Refinando...
                    </>
                  ) : (
                    <>
                      <Mic className="w-3 h-3" />
                      {isRecording ? 'Grabando...' : 'Dictar'}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const refined = await refineText(description);
                    setDescription(refined);
                  }}
                  disabled={isRefining || !description}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all"
                  title="Pulir con IA"
                >
                  <Sparkles className="w-3 h-3" />
                  Pulir
                </button>
                <button
                  type="button"
                  onClick={extractReminders}
                  disabled={isRefining || !description}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-purple-100 text-purple-600 hover:bg-purple-200 transition-all"
                  title="Extraer Fecha/Hora"
                >
                  <Clock className="w-3 h-3" />
                  Extraer
                </button>
              </div>
            </div>
            <div className="relative">
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Escribe o dicta los detalles aquí..."
              className={cn(
                "w-full min-h-[120px] bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-neutral-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none",
                isRecording && "border-red-200 bg-red-50/30"
              )}
            />
            
            {/* Live Preview Overlay */}
            {(isRecording || isRefining) && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-6 text-center z-10">
                {isRecording ? (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm font-bold text-red-600 uppercase tracking-widest">Escuchando...</span>
                    </div>
                    <p className="text-neutral-500 italic text-sm line-clamp-3">
                      {liveTranscript || "Empieza a hablar..."}
                    </p>
                    <button 
                      onClick={toggleRecording}
                      className="mt-4 px-6 py-2 bg-red-600 text-white rounded-full text-xs font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                    >
                      Detener y Refinar
                    </button>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-8 h-8 text-emerald-500 mb-3 animate-bounce" />
                    <span className="text-sm font-bold text-emerald-600 uppercase tracking-widest">Perfeccionando texto...</span>
                    <p className="text-neutral-400 text-xs mt-2">La IA está eliminando repeticiones y errores</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Images for Notes */}
          {type === 'notes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest">Imágenes (Máx 3)</label>
                <div className="flex bg-neutral-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setImagePosition('before')}
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                      imagePosition === 'before' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500"
                    )}
                  >
                    Antes
                  </button>
                  <button
                    type="button"
                    onClick={() => setImagePosition('after')}
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                      imagePosition === 'after' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500"
                    )}
                  >
                    Después
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3 items-start">
                {images.map((img, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden group border border-neutral-100 bg-neutral-50/50">
                    <img src={img} alt={`Note ${idx}`} className="w-full h-auto object-contain" referrerPolicy="no-referrer" />
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                      className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full transition-all shadow-lg z-20"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all text-neutral-400 hover:text-emerald-600">
                    <ImageIcon className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Añadir</span>
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

          {/* Category & Date/Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Proyecto (Opcional)</label>
              <div className="relative">
                <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <select 
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none"
                >
                  <option value="">Ninguno</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest">Categoría</label>
                <button
                  type="button"
                  onClick={suggestCategory}
                  disabled={isSuggestingCategory || !title}
                  className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-tighter hover:text-emerald-700 transition-all"
                >
                  {isSuggestingCategory ? (
                    <Sparkles className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  Sugerir
                </button>
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                  type="text" 
                  list="category-suggestions"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ej: Trabajo"
                  className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <datalist id="category-suggestions">
                  {Array.from(new Set(existingItems.map((i: any) => i.category).filter(Boolean))).map((cat: any) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Fecha</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                  type="date" 
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Hora</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                  type="time" 
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {type === 'reminders' && (
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Repetir</label>
              <div className="relative">
                <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <select 
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as any)}
                  className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none"
                >
                  <option value="none">No repetir</option>
                  <option value="daily">Diariamente</option>
                  <option value="weekly">Semanalmente</option>
                  <option value="monthly">Mensualmente</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Subtasks (Tasks only) */}
          {type === 'tasks' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest">Subtareas (Opcional)</label>
                <button
                  type="button"
                  onClick={generateSubtasks}
                  disabled={isGeneratingSubtasks || !title}
                  className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-tighter hover:text-emerald-700 transition-all"
                >
                  {isGeneratingSubtasks ? (
                    <Sparkles className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  Generar con IA
                </button>
              </div>
              <div className="space-y-2">
                {subtasks.map((st, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const newSt = [...subtasks];
                        newSt[i].completed = !newSt[i].completed;
                        setSubtasks(newSt);
                      }}
                      className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", st.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-neutral-300")}
                    >
                      {st.completed && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                    <input 
                      type="text" 
                      value={st.text}
                      onChange={(e) => {
                        const newSt = [...subtasks];
                        newSt[i].text = e.target.value;
                        setSubtasks(newSt);
                      }}
                      className="flex-1 min-w-0 bg-transparent border-none p-0 text-sm focus:ring-0"
                    />
                    <button onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))} className="text-neutral-300 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setSubtasks([...subtasks, { text: '', completed: false }])}
                  className="flex items-center gap-2 text-sm text-emerald-600 font-bold hover:text-emerald-700 mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Añadir subtarea
                </button>
              </div>
            </div>
          )}

          {/* Details (Notes/Reminders) */}
          {(type === 'notes' || type === 'reminders') && (
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Detalles (Lista)</label>
              <div className="space-y-2">
                {details.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full" />
                    <input 
                      type="text" 
                      value={d}
                      onChange={(e) => {
                        const newD = [...details];
                        newD[i] = e.target.value;
                        setDetails(newD);
                      }}
                      className="flex-1 min-w-0 bg-transparent border-none p-0 text-sm focus:ring-0"
                    />
                    <button onClick={() => setDetails(details.filter((_, idx) => idx !== i))} className="text-neutral-300 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setDetails([...details, ''])}
                  className="flex items-center gap-2 text-sm text-emerald-600 font-bold hover:text-emerald-700 mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Añadir detalle
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-white border border-neutral-200 rounded-2xl font-bold text-neutral-600 hover:bg-neutral-100 transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || !title}
            className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Guardar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
