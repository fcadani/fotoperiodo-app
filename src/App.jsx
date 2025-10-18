/**
 * App.jsx — Fotoperiodo (versión estética mejorada)
 * - Fuente Inter (Google Fonts)
 * - Modo claro/oscuro automático (prefers-color-scheme)
 * - Paleta índigo + acentos rosados
 * - Mantiene toda la lógica original (sin cambios en cálculos)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Sun, Moon, Download, Upload, RefreshCw, Zap } from "lucide-react";

const STORAGE_KEY = "fotoperiodo_settings_v1";

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

function fmtDateTimeLocal(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  const pad = (n) => n.toString().padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

export default function App() {
  // ---- State ----
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    return fmtDateTimeLocal(d);
  });

  const [hoursLight, setHoursLight] = useState(13);
  const [hoursDark, setHoursDark] = useState(14);
  const [durationDays, setDurationDays] = useState(60);

  const [now, setNow] = useState(new Date());
  const [errorMsg, setErrorMsg] = useState("");

  // ---- Load saved settings on mount ----
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = safeParseJSON(raw, null);
    if (!obj) return;
    if (obj.startDate) setStartDate(String(obj.startDate));
    if (Number.isFinite(Number(obj.hoursLight))) setHoursLight(Number(obj.hoursLight));
    if (Number.isFinite(Number(obj.hoursDark))) setHoursDark(Number(obj.hoursDark));
    if (Number.isFinite(Number(obj.durationDays))) setDurationDays(Number(obj.durationDays));
  }, []);

  // ---- Autosave (debounced simple) ----
  useEffect(() => {
    const payload = { startDate, hoursLight, hoursDark, durationDays };
    const id = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); }
      catch (e) { console.warn("No se pudo guardar en localStorage:", e); }
    }, 300);
    return () => clearTimeout(id);
  }, [startDate, hoursLight, hoursDark, durationDays]);

  // ---- Tick ----
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000); // 30s
    return () => clearInterval(id);
  }, []);

  // ---- Validation helpers ----
  const validateInputs = useCallback(() => {
    setErrorMsg("");
    if (!startDate) { setErrorMsg("La fecha de inicio es requerida."); return false; }
    const d = new Date(startDate);
    if (isNaN(d.getTime())) { setErrorMsg("Formato de fecha inválido."); return false; }
    if (!Number.isFinite(Number(hoursLight)) || Number(hoursLight) < 0) { setErrorMsg("Horas de luz inválidas."); return false; }
    if (!Number.isFinite(Number(hoursDark)) || Number(hoursDark) < 0) { setErrorMsg("Horas de oscuridad inválidas."); return false; }
    if (!Number.isFinite(Number(durationDays)) || durationDays < 1) { setErrorMsg("Duración debe ser >= 1 día."); return false; }
    return true;
  }, [startDate, hoursLight, hoursDark, durationDays]);

  // ---- Computed values ----
  const startDateObj = useMemo(() => {
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return new Date();
    return d;
  }, [startDate]);

  const cycleLength = useMemo(() => {
    const sum = Number(hoursLight) + Number(hoursDark);
    return sum > 0 ? sum : 0.0000001; // avoid zero division
  }, [hoursLight, hoursDark]);

  const fractionalStartOffset = useMemo(() => {
    return startDateObj.getHours() + startDateObj.getMinutes() / 60 + startDateObj.getSeconds() / 3600;
  }, [startDateObj]);

  const hoursSinceStartNow = useMemo(() => {
    return (now.getTime() - startDateObj.getTime()) / (1000 * 60 * 60);
  }, [now, startDateObj]);

  const currentInCycle = useMemo(() => {
    return ((hoursSinceStartNow % cycleLength) + cycleLength) % cycleLength;
  }, [hoursSinceStartNow, cycleLength]);

  const isNowLight = useMemo(() => {
    return currentInCycle < Number(hoursLight);
  }, [currentInCycle, hoursLight]);

  // Días Cultivo (Personalizado): Cantidad de ciclos personalizados COMPLETOS
  const customCycleDayIndex = useMemo(() => Math.floor(hoursSinceStartNow / cycleLength), [hoursSinceStartNow, cycleLength]);

  // Para el calendario y el horario de hoy (basado en día de 24h)
  const currentHourIndex = useMemo(() => now.getHours(), [now]);
  const currentDayIndex24h = useMemo(() => {
    const startOfDayNow = new Date(now);
    startOfDayNow.setHours(0, 0, 0, 0);

    const startOfDayStart = new Date(startDateObj);
    startOfDayStart.setHours(0, 0, 0, 0);

    const daysSinceStart = (startOfDayNow.getTime() - startOfDayStart.getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(daysSinceStart);
  }, [now, startDateObj]);

  // Ciclo: LUZ comienza en la hora 0 (del ciclo), dura hoursLight.
  function isLightAtAbsoluteHours(hoursSinceStart) {
    const inCycle = ((hoursSinceStart % cycleLength) + cycleLength) % cycleLength;
    return inCycle < Number(hoursLight);
  }

  // ---- Balance Energético (vs 12L/12D) ----
  const energyBalance = useMemo(() => {
    if (hoursSinceStartNow < 0) return 0;

    const hoursLightCustom = Number(hoursLight);
    const cycleLenCustom = cycleLength;

    const lightHoursConsumedCustom = (hoursLightCustom / cycleLenCustom) * hoursSinceStartNow;
    const lightHoursConsumedStandard = 0.5 * hoursSinceStartNow;

    const totalBalance = lightHoursConsumedStandard - lightHoursConsumedCustom;
    return totalBalance;
  }, [hoursLight, hoursSinceStartNow, cycleLength]);

  // ---- FORMATO DE TIEMPO TRANSCURRIDO (DÍAS, HORAS, MINUTOS) ----
  const formattedTimeElapsed = useMemo(() => {
    if (hoursSinceStartNow < 0) return { days: 0, hours: 0, minutes: 0, display: "0 d" };

    let totalMinutes = Math.floor(hoursSinceStartNow * 60);
    const days = Math.floor(totalMinutes / (24 * 60));
    totalMinutes %= (24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let parts = [];
    if (days > 0) parts.push(`${days} d`);
    if (hours > 0 || (days === 0 && minutes > 0)) parts.push(`${hours} h`);
    if (minutes > 0 && days === 0 && hours === 0) parts.push(`${minutes} m`);

    return {
      days,
      hours,
      minutes,
      display: parts.length > 0 ? parts.join(' y ') : '0 d'
    };
  }, [hoursSinceStartNow]);

  // ---- Build calendar data (array of days x 24) ----
  const calendar = useMemo(() => {
    const rows = [];
    const days = clamp(Number(durationDays) || 0, 1, 9999);

    const startOfDayStart = new Date(startDateObj);
    startOfDayStart.setHours(0, 0, 0, 0); // Establece la hora a 00:00:00 del día de inicio

    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    for (let d = 0; d < days; d++) {
      const row = [];
      // Calcular la fecha para mostrar en la columna 'Día'
      const dateForDay = new Date(startOfDayStart.getTime() + d * MS_PER_DAY);

      // Formato numérico DD/MM
      const dateDisplay = dateForDay.toLocaleDateString([], {
        day: '2-digit',
        month: '2-digit'
      }).replace(/\//g, '/');

      for (let h = 0; h < 24; h++) {
        const hoursSinceStart = d * 24 + h - fractionalStartOffset;
        row.push({
          isLight: Boolean(isLightAtAbsoluteHours(hoursSinceStart)),
          dateDisplay: dateDisplay
        });
      }
      rows.push(row);
    }
    return rows;
  }, [durationDays, fractionalStartOffset, hoursLight, hoursDark, cycleLength, startDateObj]);

  // ---- next change event ----
  const nextChangeEvent = useMemo(() => {
    let hoursToNext;
    let nextState;
    if (isNowLight) {
      hoursToNext = Number(hoursLight) - currentInCycle;
      nextState = 'Oscuridad';
    } else {
      hoursToNext = cycleLength - currentInCycle;
      nextState = 'Luz';
    }
    if (!Number.isFinite(hoursToNext) || hoursToNext < 0) hoursToNext = 0;
    const nextDate = new Date(now.getTime() + Math.round(hoursToNext * 3600000));
    return {
      hoursToNext: hoursToNext,
      date: nextDate.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      time: nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      nextState,
      action: nextState === 'Luz' ? 'Encendido' : 'Apagado'
    };
  }, [now, isNowLight, currentInCycle, hoursLight, hoursDark, cycleLength]);

  // ---- export / import / reset ----
  const handleExport = useCallback(() => {
    const payload = { startDate, hoursLight, hoursDark, durationDays };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fotoperiodo-config.json'; a.click();
    URL.revokeObjectURL(url);
  }, [startDate, hoursLight, hoursDark, durationDays]);

  const handleImport = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        if (obj.startDate) setStartDate(String(obj.startDate));
        if (Number.isFinite(Number(obj.hoursLight))) setHoursLight(Number(obj.hoursLight));
        if (Number.isFinite(Number(obj.hoursDark))) setHoursDark(Number(obj.hoursDark));
        if (Number.isFinite(Number(obj.durationDays))) setDurationDays(Number(obj.durationDays));
      } catch (err) {
        alert('Archivo inválido o con formato incorrecto.');
      }
    };
    reader.readAsText(file);
  }, []);

  const resetDefaults = useCallback(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    setStartDate(fmtDateTimeLocal(d));
    setHoursLight(13); setHoursDark(14); setDurationDays(60);
  }, []);

  // ---- small UI helpers ----
  const formatStartDate = useCallback((dObj) => {
    if (!dObj || isNaN(dObj.getTime())) return '--';
    return dObj.toLocaleString();
  }, []);

  // run validation to show errors early
  useEffect(() => { validateInputs(); }, [validateInputs]);

  // ---- JSX ----
  const balanceColor = energyBalance > 0 ? 'text-emerald-400' : energyBalance < 0 ? 'text-rose-400' : 'text-gray-400';
  const balanceIcon = energyBalance > 0 ? '▲' : energyBalance < 0 ? '▼' : '—';
  const balanceText = energyBalance > 0 ? 'Ahorro de' : energyBalance < 0 ? 'Gasto Extra de' : 'Balance Neutral de';

  return (
    <>
      {/* Google Font + basic CSS variables + prefers-color-scheme */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');

        :root{
          --bg-1: #0f1724; /* dark fallback */
          --bg-2: #0b1220;
          --card: rgba(17,24,39,0.6);
          --muted: #9aa4b2;
          --accent: #4f46e5; /* indigo-600 */
          --accent-700: #3730a3;
          --accent-pink: #f472b6; /* pink-400 */
          --glass: rgba(255,255,255,0.04);
        }

        @media (prefers-color-scheme: light) {
          :root{
            --bg-1: #f8fafc;
            --bg-2: #eef2ff;
            --card: rgba(255,255,255,0.7);
            --muted: #556074;
            --accent: #4338ca; /* indigo */
            --accent-700: #3730a3;
            --accent-pink: #f472b6;
            --glass: rgba(0,0,0,0.03);
          }
        }

        .font-inter { font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }

        /* small utility to subtly animate the current cell */
        .pulse-current {
          transition: transform .18s ease, box-shadow .18s ease;
          transform-origin: center;
        }
      `}</style>

      <div className="min-h-screen font-inter px-4 py-6" style={{ background: `linear-gradient(180deg, ${getComputedStyle(document.documentElement).getPropertyValue('--bg-2') || '#0b1220'} 0%, ${getComputedStyle(document.documentElement).getPropertyValue('--bg-1') || '#0f1724'} 100%)` }}>
        <div className="max-w-6xl mx-auto rounded-3xl shadow-2xl p-4 sm:p-8" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.04))', border: '1px solid rgba(255,255,255,0.04)' }}>

          {/* Header */}
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(244,114,182,0.06))' }}>
                <Sun className="w-8 h-8 text-yellow-300" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight" style={{ color: 'var(--accent)' }}>Fotoperiodo</h1>
                <p className="text-sm text-gray-400 mt-1">Control de ciclos · Vista calendario · Responsive</p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="text-sm text-gray-400 hidden sm:block">Sincronizado con el sistema (claro/oscuro)</div>
              <div className="flex gap-2">
                <button onClick={handleExport} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm" style={{ background: 'var(--accent)', color: '#fff' }}>
                  <Download className="w-4 h-4" /> Exportar
                </button>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm cursor-pointer" style={{ background: 'var(--accent-pink)', color: '#fff' }}>
                  <Upload className="w-4 h-4" /> Importar
                  <input type="file" accept="application/json" onChange={(e) => handleImport(e.target.files?.[0])} className="hidden" />
                </label>
                <button onClick={resetDefaults} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted)' }}>
                  <RefreshCw className="w-4 h-4" /> Reset
                </button>
              </div>
            </div>
          </header>

          <main className="grid lg:grid-cols-3 gap-6">
            {/* Configuración */}
            <section className="lg:col-span-2 p-4 sm:p-6 rounded-xl" style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.03)' }}>
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-700)' }}>Configuración</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Fecha y hora de inicio</label>
                  <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-3 rounded-lg border border-transparent outline-none"
                    style={{ background: 'rgba(255,255,255,0.02)', color: 'inherit' }} />
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-gray-300 block mb-1">Horas luz (h)</label>
                    <input type="number" min="0" step="0.5" value={hoursLight}
                      onChange={(e) => setHoursLight(clamp(Number(e.target.value), 0, 9999))}
                      className="w-full p-3 rounded-lg border border-transparent outline-none"
                      style={{ background: 'rgba(255,255,255,0.02)' }} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 block mb-1">Horas oscuridad (h)</label>
                    <input type="number" min="0" step="0.5" value={hoursDark}
                      onChange={(e) => setHoursDark(clamp(Number(e.target.value), 0, 9999))}
                      className="w-full p-3 rounded-lg border border-transparent outline-none"
                      style={{ background: 'rgba(255,255,255,0.02)' }} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 block mb-1">Duración (días)</label>
                    <input type="number" min="1" max="9999" value={durationDays}
                      onChange={(e) => setDurationDays(clamp(Number(e.target.value), 1, 9999))}
                      className="w-full p-3 rounded-lg border border-transparent outline-none"
                      style={{ background: 'rgba(255,255,255,0.02)' }} />
                  </div>
                </div>

                {errorMsg && <div className="p-3 rounded-md text-sm" style={{ background: 'rgba(244,67,54,0.08)', color: '#f87171' }}>{errorMsg}</div>}

                <div className="text-xs text-gray-400">Guardado local automático.</div>
              </div>
            </section>

            {/* Estado */}
            <aside className="p-4 sm:p-6 rounded-xl" style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.03)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-700)' }}>Estado</h3>

              <div className="space-y-4 text-sm">
                <div className="border-b border-white/5 pb-2">
                  <div className="text-xs text-gray-400">Inicio</div>
                  <div className="font-mono text-sm">{formatStartDate(startDateObj)}</div>
                </div>

                <div className="border-b border-white/5 pb-2 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold text-rose-400">DÍAS SUPER CICLO</div>
                    <div className="font-extrabold text-3xl" style={{ color: 'var(--accent)' }}>
                      {Math.max(0, customCycleDayIndex)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">(Ciclos de {cycleLength.toFixed(1)}h)</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-300">TIEMPO TRANSCURRIDO</div>
                    <div className="font-mono text-xl mt-1">{formattedTimeElapsed.display}</div>
                    <div className="text-xs text-gray-400 mt-1">(equivalente en días 24h)</div>
                  </div>
                </div>

                <div className="border-b border-white/5 pb-2">
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Balance Energético (vs 12L/12D)
                  </div>
                  <div className={`font-extrabold text-xl`} style={{ color: energyBalance > 0 ? '#10b981' : energyBalance < 0 ? 'var(--accent-pink)' : '#94a3b8' }}>
                    {balanceIcon} {Math.abs(energyBalance).toFixed(2)} hrs
                  </div>
                  <div className="text-xs text-gray-400">{balanceText} luz acumulado desde el inicio.</div>
                </div>

                <div className="border-b border-white/5 pb-2">
                  <div className="text-xs text-gray-400">Hora actual</div>
                  <div className="font-mono text-lg">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>

                <div className="border-b border-white/5 pb-2">
                  <div className="text-xs text-gray-400">Estado del ciclo</div>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold`} style={{ background: isNowLight ? 'linear-gradient(90deg,#facc15,#f472b6)' : 'var(--accent)', color: isNowLight ? '#111827' : '#fff' }}>
                    {isNowLight ? 'LUZ ACTIVA' : 'OSCURIDAD'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400">Próximo evento ({nextChangeEvent.action})</div>
                  <div className="font-semibold">{nextChangeEvent.nextState} — {nextChangeEvent.time} ({nextChangeEvent.date})</div>
                  <div className="text-xs text-gray-400">En {nextChangeEvent.hoursToNext?.toFixed(2) ?? '--'} hrs</div>
                </div>
              </div>
            </aside>

            {/* Calendario (full width row) */}
            <section className="lg:col-span-3 mt-4 rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <h4 className="font-semibold">Calendario (Día × Hora)</h4>
                <div className="text-sm text-gray-400">{durationDays} días</div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <tr>
                      <th className="p-2 text-left sticky left-0" style={{ width: 80, zIndex: 20, background: 'rgba(0,0,0,0.14)' }}>Día</th>
                      {Array.from({length:24}).map((_,h) => (
                        <th key={h} className="p-2 text-center" style={{ minWidth: 36 }}>{h}h</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calendar.map((row, d) => (
                      <tr key={d} className={`${d === currentDayIndex24h ? 'bg-indigo-900/10' : ''} hover:bg-white/2 transition`} >
                        <td className={`p-1 sticky left-0 font-semibold`} style={{ zIndex: 10, background: d === currentDayIndex24h ? 'rgba(99,102,241,0.12)' : 'var(--card)' }}>
                          {row[0].dateDisplay}
                        </td>

                        {row.map((cell, h) => {
                          const isCurrent = d === currentDayIndex24h && h === currentHourIndex;
                          return (
                            <td key={h} className="p-0.5">
                              <div className={`w-full h-7 rounded-sm flex items-center justify-center text-xs font-mono font-semibold pulse-current ${isCurrent ? 'scale-105' : ''}`}
                                style={{
                                  background: cell.isLight ? 'linear-gradient(90deg,#f59e0b,#f472b6)' : 'linear-gradient(90deg,#4338ca,#4338ca99)',
                                  color: cell.isLight ? '#fff' : '#f8fafc',
                                  boxShadow: isCurrent ? '0 6px 20px rgba(244,114,182,0.14)' : 'none'
                                }}>
                                {cell.isLight ? 'L' : 'D'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 text-xs text-gray-400 border-t border-white/5">Leyenda: L = Luz, D = Oscuridad. Celda actual resaltada.</div>
            </section>
          </main>

        </div>
      </div>
    </>
  );
}
