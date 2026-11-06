import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  RefreshCw, 
  Trash2, 
  Check, 
  Copy, 
  Clock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle,
  Palette,
  Calendar,
  Database,
  Grid,
  Laptop,
  Wifi,
  Bell
} from 'lucide-react';
import { api } from '../../utils/ipc';
import type { CredentialStatus, TotpCodeResult, LmsSyncState } from '../../types';
import { useThemeStore, ThemePreset, UiScale } from '../../stores/themeStore';
import { useCommandCenterStore } from '../../stores/commandCenterStore';

type SettingsTab = 'appearance' | 'accounts' | 'sync' | 'system';

interface ThemePresetOption {
  id: ThemePreset;
  name: string;
  desc: string;
  lightBg: string;
  lightSurface: string;
  lightAccent: string;
  darkBg: string;
  darkSurface: string;
  darkAccent: string;
}

const THEME_PRESETS: ThemePresetOption[] = [
  {
    id: 'default',
    name: 'Warm Stone',
    desc: 'Campus Blue & subtle beige tones',
    lightBg: '#f3f3f0',
    lightSurface: '#ffffff',
    lightAccent: '#2f5fd0',
    darkBg: '#141515',
    darkSurface: '#1d1e1e',
    darkAccent: '#6f95f0',
  },
  {
    id: 'cool',
    name: 'Pure Slate',
    desc: 'OLED Black & iOS Indigo accents',
    lightBg: '#f2f2f7',
    lightSurface: '#ffffff',
    lightAccent: '#007aff',
    darkBg: '#000000',
    darkSurface: '#1c1c1e',
    darkAccent: '#0a84ff',
  },
  {
    id: 'paper',
    name: 'Sepia Ink',
    desc: 'Warm parchment paper & Terracotta',
    lightBg: '#f3eee4',
    lightSurface: '#fffdf8',
    lightAccent: '#a85a32',
    darkBg: '#16130e',
    darkSurface: '#211d17',
    darkAccent: '#e08a5c',
  },
  {
    id: 'mist',
    name: 'Nordic Fjord',
    desc: 'Glacial cyan & deep navy tones',
    lightBg: '#edf1f6',
    lightSurface: '#fbfcfe',
    lightAccent: '#2b6cb0',
    darkBg: '#10141a',
    darkSurface: '#192029',
    darkAccent: '#63b3ed',
  },
  {
    id: 'moss',
    name: 'Forest Sage',
    desc: 'Emerald sage & soothing pine dark',
    lightBg: '#eef2ec',
    lightSurface: '#fcfdfb',
    lightAccent: '#24733f',
    darkBg: '#111510',
    darkSurface: '#1a2019',
    darkAccent: '#6fc48b',
  },
];

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<LmsSyncState | null>(null);

  // Theme Store
  const { theme, preset, uiScale, setUiScale, setThemeAndPreset } = useThemeStore();
  const { refreshAll } = useCommandCenterStore();

  // Science Tokyo Auth Form State
  const [scienceUsername, setScienceUsername] = useState('');
  const [sciencePassword, setSciencePassword] = useState('');
  const [showSciencePassword, setShowSciencePassword] = useState(false);
  const [totpSeed, setTotpSeed] = useState('');
  const [showSeed, setShowSeed] = useState(false);
  const [savingScience, setSavingScience] = useState(false);
  const [scienceSaveSuccess, setScienceSaveSuccess] = useState(false);

  // Live TOTP states
  const [liveTotp, setLiveTotp] = useState<TotpCodeResult | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [testingSeed, setTestingSeed] = useState(false);
  const [savingSeedOnly, setSavingSeedOnly] = useState(false);
  const [totpSaveSuccess, setTotpSaveSuccess] = useState(false);

  // Tokyo Tech Portal Form State
  const [titechUsername, setTitechUsername] = useState('');
  const [titechPassword, setTitechPassword] = useState('');
  const [showTitechPassword, setShowTitechPassword] = useState(false);
  const [matrixCard, setMatrixCard] = useState('');
  const [matrixInputMode, setMatrixInputMode] = useState<'row' | 'col'>('row');
  const [showMatrix, setShowMatrix] = useState(false);
  const [savingTitech, setSavingTitech] = useState(false);
  const [titechSaveSuccess, setTitechSaveSuccess] = useState(false);
  const [testingTitechLogin, setTestingTitechLogin] = useState(false);
  const [titechLoginMessage, setTitechLoginMessage] = useState<string | null>(null);

  // Sync & Calendar states
  const [autoSyncOnStartup, setAutoSyncOnStartup] = useState<boolean>(() => {
    return localStorage.getItem('lifeos-auto-sync') === 'true';
  });
  const [defaultCalView, setDefaultCalView] = useState<string>(() => {
    return localStorage.getItem('lifeos-default-cal-view') || 'week';
  });
  const [isSyncingLms, setIsSyncingLms] = useState(false);
  const [lmsSyncMessage, setLmsSyncMessage] = useState<string | null>(null);

  // Campus Wi-Fi & Notification states
  const [campusWifiAuto, setCampusWifiAuto] = useState<boolean>(() => {
    return localStorage.getItem('lifeos-campus-wifi-auto') === 'true';
  });
  const [wifiChecking, setWifiChecking] = useState(false);
  const [wifiLoggingIn, setWifiLoggingIn] = useState(false);
  const [wifiStatusMessage, setWifiStatusMessage] = useState<string | null>(null);
  const [notifTestMessage, setNotifTestMessage] = useState<string | null>(null);

  // Data & System states
  const [trackerEnabled, setTrackerEnabled] = useState<boolean>(() => {
    return localStorage.getItem('lifeos-tracker-enabled') !== 'false';
  });
  const [systemMessage, setSystemMessage] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);

  // Transpose helpers for 10 cols x 7 rows Matrix
  // Row-Major: A1..J1 (10), A2..J2 (10) ... A7..J7 (10) -> length 70
  // Column-Major: A1..A7 (7), B1..B7 (7) ... J1..J7 (7) -> length 70
  const rowToColMajor = (rowMajorStr: string): string => {
    const chars = rowMajorStr.replace(/[\s\r\n]/g, '').toUpperCase().split('');
    let out = '';
    for (let c = 0; c < 10; c++) {
      for (let r = 0; r < 7; r++) {
        const idx = r * 10 + c;
        out += chars[idx] || '';
      }
    }
    return out;
  };

  const colToRowMajor = (colMajorStr: string): string => {
    const chars = colMajorStr.replace(/[\s\r\n]/g, '').toUpperCase().split('');
    let out = '';
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 10; c++) {
        const idx = c * 7 + r;
        out += chars[idx] || '';
      }
    }
    return out;
  };

  // The displayed input string depends on active entry mode
  const displayedMatrixInput = useMemo(() => {
    const standardRowMajor = matrixCard.replace(/[\s\r\n]/g, '').toUpperCase();
    if (matrixInputMode === 'col') {
      return rowToColMajor(standardRowMajor);
    }
    return standardRowMajor;
  }, [matrixCard, matrixInputMode]);

  const handleMatrixInputChange = (rawVal: string) => {
    const cleaned = rawVal.replace(/[\s\r\n]/g, '').toUpperCase().slice(0, 70);
    if (matrixInputMode === 'col') {
      setMatrixCard(colToRowMajor(cleaned));
    } else {
      setMatrixCard(cleaned);
    }
  };

  // Standard row-major 70 chars for the live visualizer
  const cleanStandardMatrix = matrixCard.replace(/[\s\r\n]/g, '').toUpperCase();

  useEffect(() => {
    loadStatus();
    loadSyncState();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const loadStatus = async () => {
    try {
      const s = await api.getCredentialStatus();
      setStatus(s);

      if (s.science_username) {
        setScienceUsername(s.science_username);
      } else if (s.username) {
        setScienceUsername(s.username);
      }

      if (s.titech_username) {
        setTitechUsername(s.titech_username);
      }

      if (s.has_totp) {
        fetchCurrentTotp();
        startTotpPolling();
      }
    } catch (e: any) {
      console.error('Failed to get credential status:', e);
    }
  };

  const loadSyncState = async () => {
    try {
      const state = await api.getLmsSyncState();
      setSyncState(state);
    } catch (e) {
      console.warn('Failed to load LMS sync state:', e);
    }
  };

  const fetchCurrentTotp = async () => {
    try {
      const res = await api.getCurrentTotp();
      setLiveTotp(res);
    } catch {
      setLiveTotp(null);
    }
  };

  const startTotpPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const res = await api.getCurrentTotp();
        setLiveTotp(res);
      } catch {
        // ignore
      }
    }, 2000);
  };

  const handleTestSeed = async () => {
    if (!totpSeed.trim()) return;
    try {
      setTestingSeed(true);
      setErrorMessage(null);
      const res = await api.verifyTotpSeed(totpSeed.trim());
      setLiveTotp(res);
    } catch (e: any) {
      setErrorMessage(`Invalid TOTP Key/URL: ${e.toString()}`);
    } finally {
      setTestingSeed(false);
    }
  };

  const handleSaveTotpOnly = async () => {
    if (!totpSeed.trim()) return;
    try {
      setSavingSeedOnly(true);
      setErrorMessage(null);
      const res = await api.saveTotpSeed(totpSeed.trim());
      setLiveTotp(res);
      setTotpSaveSuccess(true);
      setTimeout(() => setTotpSaveSuccess(false), 3000);
      const s = await api.getCredentialStatus();
      setStatus(s);
      startTotpPolling();
    } catch (e: any) {
      setErrorMessage(`Failed to save TOTP: ${e.toString()}`);
    } finally {
      setSavingSeedOnly(false);
    }
  };

  const handleSaveScience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scienceUsername.trim() && !status?.has_science_username) {
      setErrorMessage('Please enter your Science Tokyo username / email.');
      return;
    }
    try {
      setSavingScience(true);
      setErrorMessage(null);
      await api.saveScienceCredentials(
        scienceUsername.trim() || undefined,
        sciencePassword || undefined,
        totpSeed.trim() || undefined
      );
      setScienceSaveSuccess(true);
      setTimeout(() => setScienceSaveSuccess(false), 3000);
      const s = await api.getCredentialStatus();
      setStatus(s);
      if (s.has_totp) {
        fetchCurrentTotp();
        startTotpPolling();
      }
    } catch (err: any) {
      setErrorMessage(`Failed to save Science Tokyo credentials: ${err.toString()}`);
    } finally {
      setSavingScience(false);
    }
  };

  const handleClearScience = async () => {
    if (!confirm('Clear Science Tokyo SSO credentials and TOTP seed from OS Keyring?')) return;
    try {
      await api.clearScienceCredentials();
      setScienceUsername('');
      setSciencePassword('');
      setTotpSeed('');
      setLiveTotp(null);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      const s = await api.getCredentialStatus();
      setStatus(s);
    } catch (err: any) {
      setErrorMessage(`Failed to clear Science Tokyo credentials: ${err.toString()}`);
    }
  };

  const handleSaveTitech = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanStandardMatrix;
    if (cleaned && cleaned.length !== 70) {
      setErrorMessage(
        `Tokyo Tech Matrix card must contain exactly 70 alphanumeric characters (found ${cleaned.length}). 7 rows × 10 columns (A–J, 1–7).`
      );
      return;
    }
    try {
      setSavingTitech(true);
      setErrorMessage(null);
      await api.saveTitechCredentials(
        titechUsername.trim().toUpperCase() || undefined,
        titechPassword || undefined,
        cleaned || undefined
      );
      setTitechSaveSuccess(true);
      setTimeout(() => setTitechSaveSuccess(false), 3000);
      const s = await api.getCredentialStatus();
      setStatus(s);
    } catch (err: any) {
      setErrorMessage(`Failed to save Tokyo Tech credentials: ${err.toString()}`);
    } finally {
      setSavingTitech(false);
    }
  };

  const handleClearTitech = async () => {
    if (!confirm('Clear Tokyo Tech Portal credentials and Matrix card from OS Keyring?')) return;
    try {
      await api.clearTitechCredentials();
      setTitechUsername('');
      setTitechPassword('');
      setMatrixCard('');
      const s = await api.getCredentialStatus();
      setStatus(s);
    } catch (err: any) {
      setErrorMessage(`Failed to clear Tokyo Tech credentials: ${err.toString()}`);
    }
  };

  const handleTestTitechLogin = async () => {
    try {
      setTestingTitechLogin(true);
      setTitechLoginMessage(null);
      setErrorMessage(null);
      const res = await api.loginTitech();
      setTitechLoginMessage(res);
    } catch (err: any) {
      setErrorMessage(`Tokyo Tech portal login failed: ${err.toString()}`);
    } finally {
      setTestingTitechLogin(false);
    }
  };

  const handleForceLmsSync = async () => {
    setIsSyncingLms(true);
    setLmsSyncMessage(null);
    try {
      const res = await api.syncLms();
      setLmsSyncMessage(res);
      await loadSyncState();
      await refreshAll();
    } catch (err: any) {
      setErrorMessage(`LMS Sync failed: ${err.toString()}`);
    } finally {
      setIsSyncingLms(false);
    }
  };

  const handleResetLayout = async () => {
    if (!confirm('Reset dashboard workspace layout to defaults?')) return;
    try {
      await api.resetLayout();
      setSystemMessage('Workspace layout reset to default. Reloading...');
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      setErrorMessage(`Reset layout failed: ${err.toString()}`);
    }
  };

  const handleWipeAllCredentials = async () => {
    if (!confirm('Permanently wipe ALL credentials, TOTP seeds, and matrix cards from OS Keyring?')) return;
    try {
      await api.clearCredentials();
      setScienceUsername('');
      setSciencePassword('');
      setTotpSeed('');
      setTitechUsername('');
      setTitechPassword('');
      setMatrixCard('');
      setLiveTotp(null);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      const s = await api.getCredentialStatus();
      setStatus(s);
      setSystemMessage('All credentials removed from host OS Vault.');
    } catch (err: any) {
      setErrorMessage(`Wipe credentials failed: ${err.toString()}`);
    }
  };

  const handleCheckWifi = async () => {
    setWifiChecking(true);
    setWifiStatusMessage(null);
    try {
      const isCaptive = await api.checkCampusWifi();
      if (isCaptive) {
        setWifiStatusMessage('ScienceTokyo captive portal detected! Sign-in is required.');
      } else {
        setWifiStatusMessage('Connected directly to the internet. No captive portal detected.');
      }
    } catch (e: any) {
      setWifiStatusMessage(`Wi-Fi check failed: ${e?.message || e}`);
    } finally {
      setWifiChecking(false);
    }
  };

  const handleLoginWifi = async () => {
    setWifiLoggingIn(true);
    setWifiStatusMessage(null);
    try {
      const res = await api.loginCampusWifi();
      setWifiStatusMessage(res);
    } catch (e: any) {
      setWifiStatusMessage(`Wi-Fi sign-in failed: ${e?.message || e}`);
    } finally {
      setWifiLoggingIn(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await api.triggerTestNotification(
        'LifeOS Command Center',
        'Campus deadlines and native desktop notifications are active!'
      );
      setNotifTestMessage('Notification dispatched to OS desktop!');
      setTimeout(() => setNotifTestMessage(null), 4000);
    } catch (e: any) {
      setNotifTestMessage(`Notification failed: ${e?.message || e}`);
    }
  };

  const rows = ['1', '2', '3', '4', '5', '6', '7'];
  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  return (
    <div className="max-w-4xl mx-auto py-4 px-3 sm:px-6">
      {/* Settings Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-[var(--border-subtle)] gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Settings</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Configure appearance, university credential profiles, sync parameters, and local data
          </p>
        </div>

        {/* 4 Category Tabs */}
        <div className="flex items-center space-x-1 p-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Appearance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'accounts'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Accounts & Auth</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'sync'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Sync & Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'system'
                ? 'bg-[var(--accent)] text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Data & System</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="mb-6 flex items-center justify-between p-3 text-xs rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: APPEARANCE (5 LIGHT + 5 DARK COLOR THEME PRESETS) */}
      {/* ========================================================= */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          {/* Light Presets */}
          <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Light Mode Color Presets</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">5 tailored light palettes with crisp 1px borders</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                Light Warm Beige Default
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {THEME_PRESETS.map((p) => {
                const isSelected = theme === 'light' && preset === p.id;
                return (
                  <button
                    key={`light-${p.id}`}
                    type="button"
                    onClick={() => setThemeAndPreset('light', p.id)}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between h-28 relative ${
                      isSelected
                        ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/20 shadow-xs'
                        : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)]/40'
                    }`}
                    style={{ backgroundColor: p.lightBg }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold" style={{ color: '#1a1a1a' }}>
                        {p.name}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5 mt-auto">
                      <span
                        className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: p.lightAccent }}
                        title="Accent"
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: p.lightSurface }}
                        title="Surface"
                      />
                      <span className="text-[10px] font-mono text-neutral-600 truncate">
                        {p.id}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dark Presets */}
          <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Dark Mode Color Presets</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">5 deep dark slate & espresso themes</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                Obsidian Slate
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {THEME_PRESETS.map((p) => {
                const isSelected = theme === 'dark' && preset === p.id;
                return (
                  <button
                    key={`dark-${p.id}`}
                    type="button"
                    onClick={() => setThemeAndPreset('dark', p.id)}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between h-28 relative ${
                      isSelected
                        ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/20 shadow-xs'
                        : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)]/40'
                    }`}
                    style={{ backgroundColor: p.darkBg }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold" style={{ color: '#f0f0f0' }}>
                        {p.name}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5 mt-auto">
                      <span
                        className="w-4 h-4 rounded-full border border-white/10 shrink-0"
                        style={{ backgroundColor: p.darkAccent }}
                        title="Accent"
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-white/10 shrink-0"
                        style={{ backgroundColor: p.darkSurface }}
                        title="Surface"
                      />
                      <span className="text-[10px] font-mono text-neutral-400 truncate">
                        {p.id}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* UI Text Density / Scale */}
          <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">UI Text Density</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Adjust base typography scale across timetables, cards, and reader panes
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { id: 'compact', label: 'Compact', size: '13px', desc: 'Maximum information density' },
                { id: 'default', label: 'Default', size: '14px', desc: 'Balanced desktop layout' },
                { id: 'comfortable', label: 'Comfortable', size: '15px', desc: 'Relaxed reading size' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUiScale(opt.id as UiScale)}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    uiScale === opt.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)] font-semibold'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[10px] font-mono opacity-70">{opt.size}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ACCOUNTS & AUTH (SPLIT SCIENCE TOKYO VS TOKYO TECH) */}
      {/* ========================================================= */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          {/* Keyring Status Summary */}
          <div className="p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
              <div>
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">OS Keyring Vault Status</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Encrypted securely in Windows Credential Manager / macOS Keychain</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                status?.has_science_username
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-[var(--bg-canvas)] text-[var(--text-muted)] border-[var(--border-subtle)]'
              }`}>
                Science SSO: {status?.has_science_username ? 'Configured' : 'Missing'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                status?.has_totp
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-[var(--bg-canvas)] text-[var(--text-muted)] border-[var(--border-subtle)]'
              }`}>
                TOTP Seed: {status?.has_totp ? 'Active' : 'Missing'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                status?.has_titech_username
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-[var(--bg-canvas)] text-[var(--text-muted)] border-[var(--border-subtle)]'
              }`}>
                Tokyo Tech ID: {status?.has_titech_username ? 'Configured' : 'Missing'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                status?.has_matrix
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-[var(--bg-canvas)] text-[var(--text-muted)] border-[var(--border-subtle)]'
              }`}>
                Matrix Card: {status?.has_matrix ? '70 Chars' : 'Missing'}
              </span>
            </div>
          </div>

          {/* CARD A: Science Tokyo (LMS / Extic SSO) */}
          <form onSubmit={handleSaveScience} className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Science Tokyo Profile (LMS & Extic SSO)</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Used for automated Moodle course syncing and homework submission</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                isct.ex-tic.com
              </span>
            </div>

            {scienceSaveSuccess && (
              <div className="flex items-center gap-2 p-2.5 text-xs rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Science Tokyo credentials securely saved in OS Vault</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Science Tokyo Username / Email
                </label>
                <input
                  type="text"
                  value={scienceUsername}
                  onChange={(e) => setScienceUsername(e.target.value)}
                  placeholder={status?.science_username || 'e.g. user.x.yy@m.isct.ac.jp'}
                  className="w-full px-3 py-2 text-xs rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showSciencePassword ? 'text' : 'password'}
                    value={sciencePassword}
                    onChange={(e) => setSciencePassword(e.target.value)}
                    placeholder={status?.has_science_password ? '•••••••••••• (Leave blank to keep current)' : 'Password'}
                    className="w-full px-3 py-2 text-xs rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSciencePassword(!showSciencePassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {showSciencePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* TOTP Seed Configuration */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                TOTP Secret Key (MFA Seed)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showSeed ? 'text' : 'password'}
                    value={totpSeed}
                    onChange={(e) => setTotpSeed(e.target.value)}
                    placeholder={status?.has_totp ? '•••••••••••• (Active in vault)' : 'Base32 Seed or otpauth:// URL'}
                    className="w-full px-3 py-2 text-xs font-mono rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSeed(!showSeed)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {showSeed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleTestSeed}
                  disabled={!totpSeed.trim() || testingSeed}
                  className="px-3 py-2 text-xs font-semibold rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:bg-[var(--border-subtle)]/30 disabled:opacity-40 cursor-pointer"
                >
                  {testingSeed ? 'Verifying...' : 'Verify'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveTotpOnly}
                  disabled={!totpSeed.trim() || savingSeedOnly}
                  className="px-3 py-2 text-xs font-semibold rounded bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 disabled:opacity-40 cursor-pointer"
                >
                  {savingSeedOnly ? 'Saving...' : totpSaveSuccess ? 'Saved!' : 'Save Seed'}
                </button>
              </div>
            </div>

            {/* Live 6-digit TOTP generator box */}
            {liveTotp && (
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Live 6-Digit Authenticator Code</span>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    Refreshes in {liveTotp.seconds_remaining}s
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold tracking-widest text-[var(--text-primary)]">
                    {liveTotp.code}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(liveTotp.code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="flex items-center space-x-1 px-3 py-1 text-xs font-semibold rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:bg-[var(--border-subtle)]/30 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-1000"
                    style={{ width: `${(liveTotp.seconds_remaining / 30) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <button
                type="button"
                onClick={handleClearScience}
                disabled={!status?.has_science_username && !status?.has_totp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Science Tokyo Profile
              </button>

              <button
                type="submit"
                disabled={savingScience}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                {savingScience ? 'Saving...' : 'Save Science Tokyo Profile'}
              </button>
            </div>
          </form>

          {/* CARD B: Tokyo Tech Portal (GetAccess & 70-character Matrix Input) */}
          <form onSubmit={handleSaveTitech} className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Tokyo Tech Profile (GetAccess Portal & Matrix)</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Used for Tokyo Tech authentication and matrix challenge negotiation</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                portal.nap.gsic.titech.ac.jp
              </span>
            </div>

            {titechSaveSuccess && (
              <div className="flex items-center gap-2 p-2.5 text-xs rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Tokyo Tech credentials & Matrix Card securely saved</span>
              </div>
            )}

            {titechLoginMessage && (
              <div className="flex items-center gap-2 p-2.5 text-xs rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{titechLoginMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Tokyo Tech ID / Username
                </label>
                <input
                  type="text"
                  value={titechUsername}
                  onChange={(e) => setTitechUsername(e.target.value.toUpperCase())}
                  placeholder={status?.titech_username || 'e.g. 24B00000'}
                  className="w-full px-3 py-2 text-xs font-mono uppercase rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showTitechPassword ? 'text' : 'password'}
                    value={titechPassword}
                    onChange={(e) => setTitechPassword(e.target.value)}
                    placeholder={status?.has_titech_password ? '•••••••••••• (Leave blank to keep current)' : 'Password'}
                    className="w-full px-3 py-2 text-xs rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTitechPassword(!showTitechPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {showTitechPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Upgraded 70-Character Matrix Input */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <Grid className="w-4 h-4 text-[var(--accent)]" />
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      Matrix Authentication Card (10 Columns × 7 Rows = 70 Chars)
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Enter characters row by row: <code className="font-mono">A1, B1, C1... J1</code>, then <code className="font-mono">A2, B2... J2</code>, up to <code className="font-mono">J7</code>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Mode Toggle: Row-Major vs Column-Major */}
                  <div className="flex items-center space-x-1 p-0.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-md text-[10px]">
                    <button
                      type="button"
                      onClick={() => setMatrixInputMode('row')}
                      className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                        matrixInputMode === 'row'
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      title="Type row-by-row (A1, B1, C1... J1)"
                    >
                      Row-Major (A1→J1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixInputMode('col')}
                      className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                        matrixInputMode === 'col'
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      title="Type column-by-column (A1→A7, B1→B7)"
                    >
                      Col-Major (A1→A7)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMatrix(!showMatrix)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] cursor-pointer"
                    title={showMatrix ? 'Mask matrix characters' : 'Reveal matrix characters'}
                  >
                    {showMatrix ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* 70-character Monospace Input */}
              <div className="relative">
                <input
                  type={showMatrix ? 'text' : 'password'}
                  value={displayedMatrixInput}
                  onChange={(e) => handleMatrixInputChange(e.target.value)}
                  placeholder={status?.has_matrix ? '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••' : 'Paste or enter 70 characters (A1 through J7)'}
                  maxLength={70}
                  className="w-full px-3 py-2 text-xs font-mono tracking-wider rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] pr-20"
                />
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono ${
                  cleanStandardMatrix.length === 70
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-[var(--text-muted)]'
                }`}>
                  {cleanStandardMatrix.length} / 70
                </span>
              </div>

              {/* Live 10 Columns (A–J) x 7 Rows (1–7) Matrix Preview Table */}
              <div className="overflow-x-auto rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2">
                <table className="w-full text-center text-xs font-mono select-none">
                  <thead>
                    <tr>
                      <th className="px-1.5 py-1 text-[10px] text-[var(--text-muted)] border-b border-r border-[var(--border-subtle)] w-8">
                        #
                      </th>
                      {cols.map((col) => (
                        <th
                          key={col}
                          className="px-1.5 py-1 text-[10px] font-bold text-[var(--text-muted)] border-b border-[var(--border-subtle)]"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rIdx) => (
                      <tr key={row}>
                        <td className="px-1.5 py-1 text-[10px] font-bold text-[var(--text-muted)] border-r border-[var(--border-subtle)]">
                          {row}
                        </td>
                        {cols.map((col, cIdx) => {
                          const idx = rIdx * 10 + cIdx;
                          const char = cleanStandardMatrix[idx] || '·';
                          const isFilled = idx < cleanStandardMatrix.length;
                          return (
                            <td
                              key={col}
                              className={`px-1.5 py-1 border border-[var(--border-subtle)]/40 ${
                                isFilled
                                  ? 'text-[var(--text-primary)] font-semibold bg-[var(--bg-surface)]'
                                  : 'text-[var(--text-muted)]/30'
                              }`}
                              title={`${col}${row}`}
                            >
                              {showMatrix ? char : isFilled ? '•' : '·'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleClearTitech}
                disabled={!status?.has_titech_username && !status?.has_matrix}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Tokyo Tech Profile
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleTestTitechLogin}
                  disabled={testingTitechLogin || (!status?.has_titech_username && !titechUsername)}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:bg-[var(--border-subtle)]/30 disabled:opacity-40 cursor-pointer"
                >
                  {testingTitechLogin ? 'Testing Handshake...' : 'Test Portal Login'}
                </button>

                <button
                  type="submit"
                  disabled={savingTitech}
                  className="px-4 py-1.5 text-xs font-semibold rounded bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                >
                  {savingTitech ? 'Saving...' : 'Save Tokyo Tech Profile'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: SYNC & CALENDAR (AUTO-SYNC, CALENDAR VIEW, TERM) */}
      {/* ========================================================= */}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          {/* Auto-Sync Toggle Card */}
          <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Auto-Sync LMS on Startup</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Silently fetch courses, homework deadlines, and timetable on app launch
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !autoSyncOnStartup;
                  setAutoSyncOnStartup(next);
                  localStorage.setItem('lifeos-auto-sync', next ? 'true' : 'false');
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  autoSyncOnStartup ? 'bg-[var(--accent)]' : 'bg-[var(--border-subtle)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoSyncOnStartup ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Default Calendar View Selector */}
          <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Default Calendar View</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Choose the initial layout when opening the Schedule workspace
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                { id: 'week', label: 'Week View' },
                { id: 'day', label: 'Day View' },
                { id: 'month', label: 'Month View' },
                { id: 'timetable', label: 'Timetable Grid' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setDefaultCalView(opt.id);
                    localStorage.setItem('lifeos-default-cal-view', opt.id);
                    window.dispatchEvent(new Event('calendar-view-changed'));
                  }}
                  className={`p-3 rounded-lg border text-center transition-colors cursor-pointer text-xs font-semibold ${
                    defaultCalView === opt.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Academic Term Override */}
          <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Active Academic Term</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Synchronized from LMS timetable dropdown headers
                </p>
              </div>

              <button
                type="button"
                onClick={handleForceLmsSync}
                disabled={isSyncingLms}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:bg-[var(--border-subtle)]/30 cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLms ? 'animate-spin' : ''}`} />
                <span>{isSyncingLms ? 'Syncing...' : 'Force LMS Sync'}</span>
              </button>
            </div>

            {lmsSyncMessage && (
              <div className="flex items-center gap-2 p-2.5 text-xs rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{lmsSyncMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-subtle)]">
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-medium">Academic Year</span>
                <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                  {syncState?.active_academic_year || 'Auto (2025/2026)'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-medium">Active Quarter</span>
                <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                  {syncState?.active_quarter || 'Auto (3Q/4Q)'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[var(--text-muted)] block font-medium">Last Synced</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {syncState?.last_synced_at ? new Date(syncState.last_synced_at).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          {/* ScienceTokyo Campus Wi-Fi Auto-Login */}
          <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Wifi className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">ScienceTokyo Campus Wi-Fi</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Automatically sign into Cisco Meraki captive portal on ScienceTokyo Wi-Fi using vault credentials
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !campusWifiAuto;
                  setCampusWifiAuto(next);
                  localStorage.setItem('lifeos-campus-wifi-auto', next ? 'true' : 'false');
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  campusWifiAuto ? 'bg-[var(--accent)]' : 'bg-[var(--border-subtle)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    campusWifiAuto ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCheckWifi}
                disabled={wifiChecking || wifiLoggingIn}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:bg-[var(--border-subtle)]/30 cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${wifiChecking ? 'animate-spin' : ''}`} />
                <span>{wifiChecking ? 'Checking Portal...' : 'Check Wi-Fi Status'}</span>
              </button>

              <button
                type="button"
                onClick={handleLoginWifi}
                disabled={wifiChecking || wifiLoggingIn}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--accent)] text-white hover:opacity-90 cursor-pointer disabled:opacity-40"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>{wifiLoggingIn ? 'Signing In...' : 'Sign In to Campus Wi-Fi'}</span>
              </button>
            </div>

            {wifiStatusMessage && (
              <div className="flex items-center gap-2 p-2.5 text-xs rounded bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>{wifiStatusMessage}</span>
              </div>
            )}
          </div>

          {/* Native OS Desktop Notifications */}
          <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Native Desktop Notifications</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Background daemon polls every 30m and notifies you of new assignments and 24-hour upcoming deadlines
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestNotification}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:bg-[var(--border-subtle)]/30 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Test Notification</span>
              </button>
            </div>

            {notifTestMessage && (
              <div className="flex items-center gap-2 p-2.5 text-xs rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{notifTestMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: DATA & SYSTEM (ACTIVITY TRACKER, RESET, LOGOUT)    */}
      {/* ========================================================= */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Desktop Window Activity Tracker Toggle */}
          <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Laptop className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">Desktop Window Activity Tracker</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Background worker logs active foreground window titles locally into SQLite
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !trackerEnabled;
                  setTrackerEnabled(next);
                  localStorage.setItem('lifeos-tracker-enabled', next ? 'true' : 'false');
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  trackerEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--border-subtle)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    trackerEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Local SQLite Cache and Workspace Controls */}
          <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Cache & Layout Recovery</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Manage local layout coordinates and cached HTTP session cookies
            </p>

            {systemMessage && (
              <div className="flex items-center gap-2 p-2.5 text-xs rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{systemMessage}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={handleResetLayout}
                className="px-3.5 py-2 text-xs font-semibold rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:bg-[var(--border-subtle)]/30 cursor-pointer"
              >
                Reset Bento Grid Layout to Default
              </button>

              <button
                type="button"
                onClick={handleWipeAllCredentials}
                className="px-3.5 py-2 text-xs font-semibold rounded text-red-600 dark:text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 cursor-pointer"
              >
                Wipe All Saved Credentials from OS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
