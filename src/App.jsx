/**
Polished App.jsx — Fotoperiodo App
- Código revisado y limpiado para evitar errores en ejecución.
- Validaciones de inputs, manejo robusto de localStorage, export/import, y UI accesible.
- Mantiene funcionalidad: fotoperiodo ilimitado, duración configurable, calendario día×hora, indicador actual, próximo cambio.

Requisitos:
- Proyecto Vite + React
- Tailwind CSS (opcional pero recomendado)
- lucide-react para íconos (opcional)
*/

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Sun, Moon, Download, Upload, RefreshCw } from "lucide-react";

const STORAGE_KEY = "fotoperiodo_settings_v1";

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

function fmtDateTimeLocal(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  // local datetime-local format: YYYY-MM-DDTHH:mm
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
    // default: today at 00:00 local
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
    // small debounce to avoid flooding localStorage on fast input
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
    if (!Number.isFinite(Number(durationDays)) || Number(durationDays) < 1) { setErrorMsg("Duración debe ser >= 1 día."); return false; }
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

  // hours since start (now)
  const hoursSinceStartNow = useMemo(() => {
    return (now.getTime() - startDateObj.getTime()) / (1000 * 60 * 60);
  }, [now, startDateObj]);

  const currentInCycle = useMemo(() => {
    return ((hoursSinceStartNow % cycleLength) + cycleLength) % cycleLength;
  }, [hoursSinceStartNow, cycleLength]);

  const isNowLight = useMemo(() => {
    return currentInCycle < Number(hoursLight);
  }, [currentInCycle, hoursLight]);

  const currentDayIndex = useMemo(() => Math.floor(hoursSinceStartNow / 24), [hoursSinceStartNow]);
  const currentHourIndex = useMemo(() => Math.floor(((hoursSinceStartNow % 24) + 24) % 24), [hoursSinceStartNow]);

  // given an absolute hoursSinceStart value determine if L or D
  function isLightAtAbsoluteHours(hoursSinceStart) {
    const inCycle = ((hoursSinceStart % cycleLength) + cycleLength) % cycleLength;
    return inCycle < Number(hoursLight);
  }

  // ---- Build calendar data (array of days x 24) ----
  const calendar = useMemo(() => {
    const rows = [];
    const days = clamp(Number(durationDays) || 0, 1, 9999);
    for (let d = 0; d < days; d++) {
      const row = [];
      for (let h = 0; h < 24; h++) {
        // compute hours since start for this cell
        // cellTime = startDateObj + ((d * 24 + h) - fractionalStartOffset) hours
        const hoursSinceStart = d * 24 + h - fractionalStartOffset;
        row.push(Boolean(isLightAtAbsoluteHours(hoursSinceStart)));
      }
      rows.push(row);
    }
    return rows;
  }, [durationDays, fractionalStartOffset, hoursLight, hoursDark]);

  // ---- determine today's schedule (approx) ----
  const lightScheduleToday = useMemo(() => {
    // We'll search within today's 24 hours for transitions
    const dayIndex = currentDayIndex;
    const dayStartHoursSinceStart = dayIndex * 24 - fractionalStartOffset;
    let firstLight = -1;
    let firstDark = -1;
    for (let h = 0; h < 24; h++) {
      const hrs = dayStartHoursSinceStart + h;
      const nowLight = isLightAtAbsoluteHours(hrs);
      const prevLight = isLightAtAbsoluteHours(hrs - 0.5); // check slightly before
      if (nowLight && !prevLight && firstLight === -1) firstLight = h;
      if (!nowLight && prevLight && firstDark === -1) firstDark = h;
    }

    const fmt = (hour) => {
      if (hour === -1) return "--:--";
      const d = new Date(startDateObj.getTime());
      // set to the day's midnight + hour
      d.setHours(0,0,0,0);
      d.setTime(d.getTime() + (dayIndex * 24 + hour) * 3600000);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (Number(hoursLight) === 0) return { status: 'Oscuridad total', lightStart: '--', lightEnd: '--', darkStart: '00:00', darkEnd: '24:00' };
    if (Number(hoursDark) === 0) return { status: 'Luz continua', lightStart: '00:00', lightEnd: '24:00', darkStart: '--', darkEnd: '--' };

    // compute approximate intervals
    const ls = firstLight === -1 ? '--:--' : fmt(firstLight);
    const le = firstLight === -1 ? '--:--' : fmt(firstLight + Number(hoursLight));
    const ds = firstDark === -1 ? '--:--' : fmt(firstDark);
    const de = firstDark === -1 ? '--:--' : fmt(firstDark + Number(hoursDark));

    return { status: null, lightStart: ls, lightEnd: le, darkStart: ds, darkEnd: de };
  }, [currentDayIndex, fractionalStartOffset, hoursLight, hoursDark, startDateObj]);

  // ---- next change event ----
  const nextChangeEvent = useMemo(() => {
    // compute hours remaining until next state flip
    let hoursToNext;
    let nextState;
    if (isNowLight) {
      hoursToNext = Number(hoursLight) - currentInCycle;
      nextState = 'Oscuridad';
    } else {
      // if currently dark, remaining = cycleLength - currentInCycle
      hoursToNext = cycleLength - currentInCycle;
      nextState = 'Luz';
    }
    if (!Number.isFinite(hoursToNext) || hoursToNext < 0) hoursToNext = 0;
    const nextDate = new Date(now.getTime() + Math.round(hoursToNext * 3600000));
    return {
      hoursToNext: hoursToNext,
      date: nextDate.toLocaleDateString(),
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
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-300 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900/70 rounded-3xl shadow-2xl p-6 sm:p-8 transition-all">

        <header className="text-center mb-6">
          <div className="flex justify-center gap-4 mb-3">
            <div className="p-2 rounded-lg bg-yellow-50"><Sun className="w-6 h-6 text-yellow-500" /></div>
            <div className="p-2 rounded-lg bg-indigo-50"><Moon className="w-6 h-6 text-indigo-500" /></div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Fotoperiodo — Control de Ciclos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">Configura cualquier fotoperiodo y visualizá el calendario</p>
        </header>

        <main className="grid lg:grid-cols-3 gap-6">

          {/* Configuration */}
          <section className="lg:col-span-2 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
            <h2 className="text-lg font-semibold mb-3">Configuración</h2>

            <div className="grid gap-3">
              <label className="text-sm text-gray-700">Fecha y hora de inicio</label>
              <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-indigo-300" />

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Horas luz (h)</label>
                  <input type="number" min="0" step="0.5" value={hoursLight}
                    onChange={(e) => setHoursLight(clamp(Number(e.target.value), 0, 9999))}
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-yellow-300" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Horas oscuridad (h)</label>
                  <input type="number" min="0" step="0.5" value={hoursDark}
                    onChange={(e) => setHoursDark(clamp(Number(e.target.value), 0, 9999))}
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Duración (días)</label>
                  <input type="number" min="1" max="9999" value={durationDays}
                    onChange={(e) => setDurationDays(clamp(Number(e.target.value), 1, 9999))}
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg shadow"> <Download className="w-4 h-4"/> Exportar</button>

                <label className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg cursor-pointer">
                  <Upload className="w-4 h-4"/> Importar
                  <input type="file" accept="application/json" onChange={(e) => handleImport(e.target.files?.[0])} className="hidden" />
                </label>

                <button onClick={resetDefaults} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg"> <RefreshCw className="w-4 h-4"/> Reset</button>

                <div className="ml-auto text-xs text-gray-500">Guardado local automático</div>
              </div>

              {errorMsg && <div className="text-sm text-red-600 mt-2">{errorMsg}</div>}
            </div>
          </section>

          {/* Status */}
          <aside className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold mb-3">Estado</h3>

            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div>
                <div className="text-xs text-gray-500">Inicio:</div>
                <div className="font-mono text-sm">{formatStartDate(startDateObj)}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Días de cultivo:</div>
                <div className="text-2xl font-extrabold">{Math.max(0, Math.floor((now - startDateObj) / (1000*60*60*24)))}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Hora actual:</div>
                <div className="font-mono">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Estado del ciclo:</div>
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${isNowLight ? 'bg-green-100 text-green-800' : 'bg-indigo-100 text-indigo-800'}`}>{isNowLight ? 'LUZ' : 'OSCURIDAD'}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Próximo evento:</div>
                <div className="font-semibold">{nextChangeEvent.nextState} — {nextChangeEvent.time}</div>
                <div className="text-xs text-gray-500">En {nextChangeEvent.hoursToNextChange.toFixed(2)} horas</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Horario aproximado hoy:</div>
                <div className="text-sm grid grid-cols-2 gap-2">
                  <div><span className="text-green-600 font-semibold">Luz:</span> {lightScheduleToday.lightStart} — {lightScheduleToday.lightEnd}</div>
                  <div><span className="text-indigo-600 font-semibold">Oscu:</span> {lightScheduleToday.darkStart} — {lightScheduleToday.darkEnd}</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Calendar full width below */}
          <section className="lg:col-span-3 mt-4 bg-white dark:bg-slate-900 p-0 rounded-xl border border-gray-100 dark:border-slate-700 overflow-auto">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h4 className="font-semibold">Calendario (Día × Hora)</h4>
              <div className="text-sm text-gray-500">{durationDays} días</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-white dark:bg-slate-900 sticky top-0">
                  <tr>
                    <th className="p-2 text-left sticky left-0 bg-white dark:bg-slate-900">Día</th>
                    {Array.from({length:24}).map((_,h) => (
                      <th key={h} className="p-2 text-center">{h}h</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendar.map((row, d) => (
                    <tr key={d} className={`${d === currentDayIndex ? 'bg-yellow-50' : ''}`}>
                      <td className={`p-1 sticky left-0 bg-white dark:bg-slate-900 text-sm font-semibold`}>{d+1}</td>
                      {row.map((isLight, h) => {
                        const isCurrent = d === currentDayIndex && h === currentHourIndex;
                        return (
                          <td key={h} className="p-0.5">
                            <div className={`w-full h-6 rounded-sm flex items-center justify-center text-xs font-mono font-semibold transition-all ${isLight ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'} ${isCurrent ? 'ring-2 ring-red-400 shadow-lg' : ''}`}>
                              {isLight ? 'L' : 'D'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 text-xs text-gray-500 border-t border-gray-100">Leyenda: L = Luz, D = Oscuridad. Celda actual resaltada.</div>
          </section>

        </main>

      </div>
    </div>
  );
}
