import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle 
} from 'lucide-react';
import { api } from '../../utils/ipc';
import type { CredentialStatus, TotpCodeResult } from '../../types';

export const SettingsView: React.FC = () => {
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpSeed, setTotpSeed] = useState('');
  const [matrixCard, setMatrixCard] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);

  // Live TOTP states
  const [liveTotp, setLiveTotp] = useState<TotpCodeResult | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [testingSeed, setTestingSeed] = useState(false);
  const [savingSeedOnly, setSavingSeedOnly] = useState(false);
  const [totpSaveSuccess, setTotpSaveSuccess] = useState(false);

  // Matrix states
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [matrixSaveSuccess, setMatrixSaveSuccess] = useState(false);
  const [testingTitechLogin, setTestingTitechLogin] = useState(false);
  const [titechLoginMessage, setTitechLoginMessage] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);

  // Load status and live TOTP on mount
  useEffect(() => {
    loadStatus();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const s = await api.getCredentialStatus();
      setStatus(s);
      if (s.username) {
        setUsername(s.username);
      }
      if (s.has_totp) {
        fetchCurrentTotp();
        startTotpPolling();
      }
    } catch (e: any) {
      console.error('Failed to get credential status:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentTotp = async () => {
    try {
      const res = await api.getCurrentTotp();
      setLiveTotp(res);
    } catch (e) {
      // No valid TOTP or expired
      setLiveTotp(null);
    }
  };

  const startTotpPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const res = await api.getCurrentTotp();
        setLiveTotp(res);
      } catch (e) {
        // Ignore background polling errors
      }
    }, 2000);
  };

  // Immediate preview of TOTP when user types or pastes a secret key
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

  // Dedicated button to save TOTP Secret Key alone (useful during LMS 2FA setup screen)
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

  const handleSaveMatrixOnly = async () => {
    const cleaned = matrixCard.replace(/[\s\r\n]/g, '').toUpperCase();
    if (cleaned.length !== 70) {
      setErrorMessage(
        `Tokyo Tech Matrix card must contain exactly 70 alphanumeric characters (found ${cleaned.length}). 7 rows (1–7) × 10 columns (A–J).`
      );
      return;
    }
    try {
      setSavingMatrix(true);
      setErrorMessage(null);
      await api.saveMatrixCard(cleaned);
      setMatrixSaveSuccess(true);
      setTimeout(() => setMatrixSaveSuccess(false), 3000);
      const s = await api.getCredentialStatus();
      setStatus(s);
    } catch (err: any) {
      setErrorMessage(`Failed to save Matrix card: ${err.toString()}`);
    } finally {
      setSavingMatrix(false);
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
      setErrorMessage(`Tokyo Tech login failed: ${err.toString()}`);
    } finally {
      setTestingTitechLogin(false);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() && !status?.has_username) {
      setErrorMessage('Please enter your portal login ID (e.g. titech account ID or email).');
      return;
    }
    const cleanedMatrix = matrixCard.replace(/[\s\r\n]/g, '').toUpperCase();
    if (cleanedMatrix && cleanedMatrix.length !== 70) {
      setErrorMessage(
        `Tokyo Tech Matrix card must contain exactly 70 alphanumeric characters (found ${cleanedMatrix.length}). 7 rows × 10 columns (A–J, 1–7).`
      );
      return;
    }
    try {
      setSaving(true);
      setErrorMessage(null);
      await api.saveCredentials(
        username.trim() || undefined,
        password || undefined,
        totpSeed.trim() || undefined,
        cleanedMatrix || undefined
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Refresh
      const s = await api.getCredentialStatus();
      setStatus(s);
      if (s.has_totp) {
        fetchCurrentTotp();
        startTotpPolling();
      }
      // Clear password from local state for security
      setPassword('');
    } catch (err: any) {
      setErrorMessage(err.toString());
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to remove stored university credentials and TOTP keys from your OS keychain?')) {
      return;
    }
    try {
      await api.clearCredentials();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setLiveTotp(null);
      setUsername('');
      setPassword('');
      setTotpSeed('');
      setMatrixCard('');
      setTitechLoginMessage(null);
      const s = await api.getCredentialStatus();
      setStatus(s);
    } catch (e: any) {
      setErrorMessage(e.toString());
    }
  };

  const copyTotpToClipboard = () => {
    if (!liveTotp) return;
    navigator.clipboard.writeText(liveTotp.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatCode = (code: string) => {
    if (code.length === 6) {
      return `${code.slice(0, 3)} ${code.slice(3)}`;
    }
    return code;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-canvas)] overflow-y-auto">
      <div className="max-w-3xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
            Institutional Settings & Authentication
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Configure secure OS-level keychain credentials and TOTP 2FA for Science Tokyo and Tokyo Tech LMS / Extic SSO.
          </p>
        </div>

        {/* Live Authenticator Display Card */}
        <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Active 2FA Authenticator Code
              </span>
            </div>
            {status?.has_totp && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Synchronized
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-[var(--text-muted)] mb-1">
                {liveTotp ? 'Enter this 6-digit verification code into the LMS setup screen:' : 'No TOTP secret configured yet.'}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-3xl font-bold tracking-widest text-[var(--text-primary)]">
                  {liveTotp ? formatCode(liveTotp.code) : '— — —   — — —'}
                </span>
                {liveTotp && (
                  <button
                    type="button"
                    onClick={copyTotpToClipboard}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors cursor-pointer"
                    title="Copy 6-digit code"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {liveTotp && (
              <div className="flex items-center gap-2 sm:self-center border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2 rounded-md">
                <Clock className="w-4 h-4 text-[var(--accent)] animate-spin" style={{ animationDuration: '30s' }} />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Expires in</span>
                  <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                    {liveTotp.seconds_remaining}s
                  </span>
                </div>
                {/* Visual bar */}
                <div className="w-16 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden ml-2">
                  <div 
                    className="h-full bg-[var(--accent)] transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(liveTotp.seconds_remaining / 30) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {totpSaveSuccess && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>TOTP key successfully verified and securely stored in Windows Credential Manager!</span>
            </div>
          )}
        </div>

        {/* Status Card */}
        <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Host OS Keyring Status (Windows Credential Manager)
              </span>
            </div>
            <button
              onClick={loadStatus}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase font-medium">Username / ID</span>
              <span className="text-xs font-medium text-[var(--text-primary)] mt-1 flex items-center gap-1.5">
                {status?.has_username ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    {status.username || 'Stored'}
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    Not Set
                  </>
                )}
              </span>
            </div>

            <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase font-medium">Password</span>
              <span className="text-xs font-medium text-[var(--text-primary)] mt-1 flex items-center gap-1.5">
                {status?.has_password ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Enclave Encrypted
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    Not Set
                  </>
                )}
              </span>
            </div>

            <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase font-medium">TOTP 2FA Key</span>
              <span className="text-xs font-medium text-[var(--text-primary)] mt-1 flex items-center gap-1.5">
                {status?.has_totp ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Configured (Auto-auth)
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    Not Configured
                  </>
                )}
              </span>
            </div>

            <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase font-medium">Tokyo Tech Matrix</span>
              <span className="text-xs font-medium text-[var(--text-primary)] mt-1 flex items-center gap-1.5">
                {status?.has_matrix ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    7×10 Grid Saved
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    Not Configured
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* TOTP Quick Setup Card */}
        <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Add / Register TOTP Secret Key
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Copy the secret key text (Base32 like <code className="font-mono bg-[var(--bg-elevated)] px-1 rounded">JBSWY3DPEHPK3PXP</code>) or the <code className="font-mono bg-[var(--bg-elevated)] px-1 rounded">otpauth://totp/...</code> URI from your university authenticator setup page.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showSeed ? 'text' : 'password'}
                  value={totpSeed}
                  onChange={(e) => setTotpSeed(e.target.value)}
                  placeholder="Paste Secret Key or otpauth:// URL here..."
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
                disabled={testingSeed || !totpSeed.trim()}
                className="px-3 py-2 text-xs font-medium rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] disabled:opacity-50 cursor-pointer"
              >
                {testingSeed ? 'Verifying...' : 'Preview Code'}
              </button>

              <button
                type="button"
                onClick={handleSaveTotpOnly}
                disabled={savingSeedOnly || !totpSeed.trim()}
                className="px-4 py-2 text-xs font-semibold rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {savingSeedOnly ? 'Saving...' : 'Save & Generate Code'}
              </button>
            </div>
          </div>
        </div>

        {/* Tokyo Tech Portal (GetAccess Matrix 7×10 Grid) */}
        <div className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Tokyo Tech Portal (GetAccess Matrix 7×10 Grid)
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Enter your 70-character client authentication matrix card from Tokyo Tech GetAccess. Columns are A–J (10 columns), rows are 1–7 (7 rows), entered row by row from top-left [A,1] to bottom-right [J,7].
              </p>
            </div>
            {status?.has_matrix && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Configured
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showMatrix ? 'text' : 'password'}
                  value={matrixCard}
                  onChange={(e) => setMatrixCard(e.target.value)}
                  placeholder="Paste 70-character Matrix string here (e.g. 7 rows of 10 chars)..."
                  className="w-full px-3 py-2 text-xs font-mono tracking-wider rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => setShowMatrix(!showMatrix)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showMatrix ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveMatrixOnly}
                disabled={savingMatrix || !matrixCard.trim()}
                className="px-4 py-2 text-xs font-semibold rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {savingMatrix ? 'Saving...' : 'Save Matrix Card'}
              </button>

              <button
                type="button"
                onClick={handleTestTitechLogin}
                disabled={testingTitechLogin || (!status?.has_matrix && !matrixCard.trim())}
                className="px-3 py-2 text-xs font-medium rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] disabled:opacity-50 cursor-pointer"
              >
                {testingTitechLogin ? 'Authenticating...' : 'Test Portal Login'}
              </button>
            </div>

            {/* Matrix Character Counter & Grid Visualizer */}
            {(() => {
              const cleaned = matrixCard.replace(/[\s\r\n]/g, '').toUpperCase();
              const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
              const rows = ['1', '2', '3', '4', '5', '6', '7'];
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      Matrix Status: {cleaned.length === 70 ? (
                        <span className="text-emerald-500 font-semibold">✓ Exact 70 Characters (Ready)</span>
                      ) : (
                        <span className="text-amber-500 font-medium">{cleaned.length} / 70 characters</span>
                      )}
                    </span>
                  </div>

                  {cleaned.length > 0 && (
                    <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] overflow-x-auto">
                      <div className="text-[10px] text-[var(--text-muted)] mb-2 font-sans font-medium">
                        7×10 Matrix Card Layout Preview:
                      </div>
                      <table className="text-center font-mono text-xs border-collapse mx-auto">
                        <thead>
                          <tr>
                            <th className="px-2 py-1 text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]"></th>
                            {cols.map((col) => (
                              <th key={col} className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, rIdx) => (
                            <tr key={row}>
                              <td className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] border-r border-[var(--border-subtle)]">
                                {row}
                              </td>
                              {cols.map((col, cIdx) => {
                                const idx = rIdx * 10 + cIdx;
                                const char = cleaned[idx] || '·';
                                const isFilled = idx < cleaned.length;
                                return (
                                  <td
                                    key={col}
                                    className={`px-2 py-1 border border-[var(--border-subtle)]/40 ${
                                      isFilled
                                        ? 'text-[var(--text-primary)] font-semibold bg-[var(--bg-surface)]'
                                        : 'text-[var(--text-muted)]/30'
                                    }`}
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
                  )}
                </div>
              );
            })()}

            {matrixSaveSuccess && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
                <span>Tokyo Tech Matrix Card securely stored in OS Credential Manager!</span>
              </div>
            )}

            {titechLoginMessage && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
                <span>{titechLoginMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Full Credentials Form */}
        <form onSubmit={handleSaveAll} className="p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              University Portal Credentials (SSO)
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Used strictly by the native Rust backend to silently authenticate via SAML Extic SSO and fetch courses, deadlines, and upload homework.
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 p-3 text-xs rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-2 p-3 text-xs rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Credentials saved securely in the host OS Keychain!</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Portal Username / Tokyo Tech ID
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={status?.username || 'e.g. 24B00000 or email'}
                className="w-full px-3 py-2 text-xs rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={status?.has_password ? '•••••••••••• (Leave blank to keep current)' : 'Portal Password'}
                  className="w-full px-3 py-2 text-xs rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
            <button
              type="button"
              onClick={handleClear}
              disabled={!status?.has_username && !status?.has_password && !status?.has_totp && !status?.has_matrix}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Wipe Credentials from OS
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Full Credentials'}
            </button>
          </div>
        </form>

        {/* Security & Architecture Note */}
        <div className="text-[11px] text-[var(--text-muted)] space-y-1.5 p-4 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
          <div className="font-semibold text-[var(--text-primary)]">Architecture & Security Notice:</div>
          <p>
            • Your credentials and TOTP seed are stored exclusively in the host OS Credential Manager (Windows Vault) using the native Windows API via Rust.
          </p>
          <p>
            • Secrets are never saved to SQLite, local files, or unencrypted storage.
          </p>
          <p>
            • The Rust backend uses <code className="font-mono">totp-rs</code> to silently generate codes on-demand during automated headless SSO redirects.
          </p>
        </div>
      </div>
    </div>
  );
};
