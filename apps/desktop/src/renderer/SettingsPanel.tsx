import { useEffect, useState } from 'react';
import type { ProviderSettings } from '../main/SettingsStore.js';

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ProviderSettings>({ baseUrl: 'http://127.0.0.1:11434/v1', model: 'nemotron-3-nano:4b', timeoutMs: 120_000 });
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (open) void window.idle.settings.get().then(setSettings); }, [open]);
  if (!open) return <button className="icon-button" type="button" onClick={() => setOpen(true)} aria-label="Open settings">⚙</button>;
  return <div className="settings-popover"><div className="settings-heading"><strong>Model Settings</strong><button type="button" onClick={() => setOpen(false)}>×</button></div><label>Base URL<input value={settings.baseUrl} onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))}/></label><label>Model<input value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}/></label><label>API key<input type="password" autoComplete="off" value={settings.apiKey ?? ''} onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))} placeholder="Stored securely on Windows"/></label><label>Timeout (ms)<input type="number" min={1} value={settings.timeoutMs} onChange={(event) => setSettings((current) => ({ ...current, timeoutMs: Number(event.target.value) }))}/></label><button className="action-button primary-action" type="button" onClick={() => void window.idle.settings.set(settings).then(() => setSaved(true))}>{saved ? 'Saved · runtime restarted' : 'Save settings'}</button></div>;
}
