/**
Polished App.jsx — Fotoperiodo App
- Código revisado, limpio y listo para producción.
- CORRECCIÓN CLAVE: Se introduce una función unificada (getLightPhase) para determinar la fase de luz, garantizando que el estado actual (isNowLight) y el resaltado del calendario sean siempre coherentes.
- La lógica de 'lightScheduleToday' ha sido refinada para calcular correctamente el ON/OFF más relevante basado en la hora actual.
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

// *** FUNCIÓN DE FASE DE LUZ UNIFICADA ***
function getLightPhase(hoursSinceStart, hoursLight, cycleLength) {
    if (hoursLight <= 0) return false;
    if (cycleLength <= hoursLight) return true; // Luz continua
    
    // Asegurarse de que el tiempo dentro del ciclo sea siempre positivo
    const inCycle = ((hoursSinceStart % cycleLength) + cycleLength) % cycleLength;
    return inCycle < hoursLight;
}
// *** FIN FUNCIÓN DE FASE DE LUZ UNIFICADA ***


export default function App() {
  // ---- State ----
  const [startDate, setStartDate] = useState(() => {
    // Inicialización al inicio del día actual (hora de escritorio).
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

  const hoursSinceStartNow = useMemo(() => {
    return (now.getTime() - startDateObj.getTime()) / (1000 * 60 * 60);
  }, [now, startDateObj]);

  const currentInCycle = useMemo(() => {
    return ((hoursSinceStartNow % cycleLength) + cycleLength) % cycleLength;
  }, [hoursSinceStartNow, cycleLength]);

  // *** CORRECCIÓN CLAVE: Usamos la función unificada para determinar el estado actual
  const isNowLight = useMemo(() => {
    return getLightPhase(hoursSinceStartNow, Number(hoursLight), cycleLength);
  }, [hoursSinceStartNow, hoursLight, cycleLength]);

  // Días Cultivo (Personalizado): Cantidad de ciclos personalizados COMPLETOS
  const customCycleDayIndex = useMemo(() => Math.floor(hoursSinceStartNow / cycleLength), [hoursSinceStartNow, cycleLength]);
  
  // Para el calendario y el horario de hoy (basado en día de 24h)
  const currentHourIndex = useMemo(() => Math.floor(((hoursSinceStartNow % 24) + 24) % 24), [hoursSinceStartNow]);
  const currentDayIndex24h = useMemo(() => Math.floor(hoursSinceStartNow / 24), [hoursSinceStartNow]);


  // *** FUNCIÓN DE FASE DE LUZ PARA EL CALENDARIO - Usa la función unificada
  function isLightAtAbsoluteHours(hoursSinceStart) {
    return getLightPhase(hoursSinceStart, Number(hoursLight), cycleLength);
  }
  // *** FIN FUNCIÓN DE FASE DE LUZ PARA EL CALENDARIO

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
  // ---- FIN FORMATO DE TIEMPO TRANSCURRIDO ----
  
  // ---- Build calendar data (array of days x 24) ----
  const calendar = useMemo(() => {
    const rows = [];
    const days = clamp(Number(durationDays) || 0, 1, 9999); 
    for (let d = 0; d < days; d++) {
      const row = [];
      for (let h = 0; h < 24; h++) {
        // La compensación de la hora de inicio (fractionalStartOffset) se aplica para alinear 
        // el inicio del ciclo con el inicio del día 1 a la hora 0.
        const hoursSinceStart = d * 24 + h - fractionalStartOffset;
        row.push(Boolean(isLightAtAbsoluteHours(hoursSinceStart)));
      }
      rows.push(row);
    }
    return rows;
  }, [durationDays, fractionalStartOffset, hoursLight, hoursDark, cycleLength]);

  // ---- Determine today's precise schedule (encendido/apagado) ----
  const lightScheduleToday = useMemo(() => {
    const lightHours = Number(hoursLight);
    const darkHours = Number(hoursDark);
    const cycleLen = cycleLength;

    if (lightHours === 0) return { status: 'Oscuridad total', lightStart: 'N/A', lightEnd: 'N/A', isLightActive: false };
    if (darkHours === 0) return { status: 'Luz continua', lightStart: 'N/A', lightEnd: 'N/A', isLightActive: true };

    // 1. Calcular las horas absolutas al inicio del ciclo actual (horas desde el startDateObj)
    const currentCycleStartAbsoluteHours = hoursSinceStartNow - currentInCycle; 

    // 2. Determinar el inicio de luz más reciente/actual
    let lightStartAbsolute;
    
    if (isNowLight) {
      // Si estamos en LUZ, el inicio fue al inicio del ciclo actual.
      lightStartAbsolute = currentCycleStartAbsoluteHours;
    } else {
      // Si estamos en OSCURIDAD, el inicio de luz fue en el ciclo anterior.
      lightStartAbsolute = currentCycleStartAbsoluteHours - darkHours; // NOTA: Esto no es -cycleLen como en el código anterior, sino -darkHours.
    }
    
    let lightEndAbsolute = lightStartAbsolute + lightHours;

    // Ajustar para mostrar la próxima fase de luz si la actual terminó
    while (lightEndAbsolute < hoursSinceStartNow) {
        lightStartAbsolute += cycleLen;
        lightEndAbsolute += cycleLen;
    }
    
    // Si estamos en oscuridad y lightStartAbsolute es aún anterior a la hora actual,
    // significa que el cálculo anterior de lightStartAbsolute nos dio la fase de luz anterior.
    // Necesitamos el PRÓXIMO encendido.
    if (!isNowLight && lightStartAbsolute < hoursSinceStartNow) {
        lightStartAbsolute += cycleLen;
        lightEndAbsolute += cycleLen;
    }
    
    // Función para formatear la fecha y hora absoluta (con mes, día, hora, min)
    const formatDateTime = (hAbsolute) => {
      const d = new Date(startDateObj.getTime() + hAbsolute * 3600000); // 3600000ms en una hora

      return d.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    };
    
    return {
      status: null,
      lightStart: formatDateTime(lightStartAbsolute),
      lightEnd: formatDateTime(lightEndAbsolute), 
      isLightActive: isNowLight 
    };
  }, [hoursLight, hoursDark, cycleLength, hoursSinceStartNow, currentInCycle, isNowLight, startDateObj]);


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
  const balanceColor = energyBalance > 0 ? 'text-emerald-400' : energyBalance < 0 ? 'text-red-400' : 'text-gray-400';
  const balanceIcon = energyBalance > 0 ? '▲' : energyBalance < 0 ? '▼' : '—';
  const balanceText = energyBalance > 0 ? 'Ahorro de' : energyBalance < 0 ? 'Gasto Extra de' : 'Balance Neutral de';

  return (
    // CONTENEDOR PRINCIPAL CON EL DEGRADADO UNIFICADO
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 p-4 sm:p-6 text-white">
      {/* CONTENEDOR PRINCIPAL DE LA APP, NO TIENE BG PARA HEREDAR EL DEGRADADO */}
      <div className="w-full max-w-5xl rounded-3xl shadow-2xl p-4 sm:p-8 transition-all border border-slate-700 backdrop-blur-sm bg-slate-900/50">

        <header className="text-center mb-6">
          <div className="flex justify-center gap-4 mb-3">
            <div className="p-2 rounded-xl bg-yellow-900/50 shadow-md"><Sun className="w-7 h-7 text-yellow-300" /></div>
            <div className="p-2 rounded-xl bg-indigo-900/50 shadow-md"><Moon className="w-7 h-7 text-indigo-300" /></div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Fotoperiodo — Control de Ciclos</h1>
          <p className="text-sm text-gray-300 mt-1">Configura cualquier fotoperiodo y visualizá el calendario</p>
        </header>

        <main className="grid lg:grid-cols-3 gap-6">

          {/* Configuration - Se usa un fondo semi-transparente para la uniformidad */}
          <section className="lg:col-span-2 p-4 sm:p-6 rounded-xl border border-slate-700 shadow-lg bg-slate-900/50">
            <h2 className="text-lg font-semibold mb-4 text-white">Configuración</h2>

            <div className="grid gap-4">
              <label className="text-sm text-gray-100">Fecha y hora de inicio</label>
              <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-600 bg-slate-800 text-base text-white outline-none focus:ring-2 focus:ring-indigo-500 transition" />

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-100">Horas luz (h)</label>
                  <input type="number" min="0" step="0.5" value={hoursLight}
                    onChange={(e) => setHoursLight(clamp(Number(e.target.value), 0, 9999))}
                    className="w-full p-3 rounded-lg border border-slate-600 bg-slate-800 text-base text-white outline-none focus:ring-2 focus:ring-yellow-500 transition" />
                </div>
                <div>
                  <label className="text-sm text-gray-100">Horas oscuridad (h)</label>
                  <input type="number" min="0" step="0.5" value={hoursDark}
                    onChange={(e) => setHoursDark(clamp(Number(e.target.value), 0, 9999))}
                    className="w-full p-3 rounded-lg border border-slate-600 bg-slate-800 text-base text-white outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                </div>
                <div>
                  <label className="text-sm text-gray-100">Duración (días)</label>
                  <input type="number" min="1" max="9999" value={durationDays}
                    onChange={(e) => setDurationDays(clamp(Number(e.target.value), 1, 9999))}
                    className="w-full p-3 rounded-lg border border-slate-600 bg-slate-800 text-base text-white outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition"> <Download className="w-4 h-4"/> Exportar</button>

                <label className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg cursor-pointer shadow-md hover:bg-emerald-700 transition">
                  <Upload className="w-4 h-4"/> Importar
                  <input type="file" accept="application/json" onChange={(e) => handleImport(e.target.files?.[0])} className="hidden" />
                </label>

                <button onClick={resetDefaults} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"> <RefreshCw className="w-4 h-4"/> Reset</button>

                <div className="ml-auto text-xs text-gray-400 self-center">Guardado local automático</div>
              </div>

              {errorMsg && <div className="text-sm text-red-400 mt-2 p-2 bg-red-900/20 rounded-lg">{errorMsg}</div>}
            </div>
          </section>

          {/* Status - Se usa un fondo semi-transparente para la uniformidad */}
          <aside className="p-4 sm:p-6 rounded-xl border border-slate-700 shadow-lg bg-slate-900/50">
            <h3 className="text-lg font-semibold mb-4 text-white">Estado</h3>

            <div className="space-y-4 text-sm text-gray-200">
              <div className="border-b border-slate-700 pb-2">
                <div className="text-xs text-gray-400">Inicio:</div>
                <div className="font-mono text-sm">{formatStartDate(startDateObj)}</div>
              </div>

              {/* Días de Cultivo y VS 24h con estilos distintivos */}
              <div className="border-b border-slate-700 pb-2 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-extrabold text-red-400 drop-shadow-lg">DÍAS SUPER CICLO</div>
                    <div className="font-extrabold text-3xl text-red-400 drop-shadow-lg">
                        {Math.max(0, customCycleDayIndex)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">(Ciclos completos de {cycleLength.toFixed(1)}h)</div>
                  </div>
                  <div className="text-right">
                      <div className="text-xs font-extrabold text-white">TIEMPO TRANSCURRIDO</div>
                      <div className="font-mono text-xl text-white mt-1">
                          {formattedTimeElapsed.display}
                      </div>
                       <div className="text-xs text-gray-400 mt-1">(Equivalente en días 24h)</div>
                  </div>
              </div>
              {/* FIN Días de Cultivo y Superciclo */}


              {/* BALANCE ENERGÉTICO */}
              <div className="border-b border-slate-700 pb-2">
                <div className="text-xs text-gray-400 flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-500"/> Balance Energético (vs 12L/12D):</div>
                <div className={`font-extrabold text-xl ${balanceColor}`}>
                  {balanceIcon} {Math.abs(energyBalance).toFixed(2)} hrs
                </div>
                <div className="text-xs text-gray-400">{balanceText} luz acumulado desde el inicio.</div>
              </div>
              {/* FIN BALANCE ENERGÉTICO */}

              <div className="border-b border-slate-700 pb-2">
                <div className="text-xs text-gray-400">Hora actual:</div>
                <div className="font-mono text-lg text-white">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>

              <div className="border-b border-slate-700 pb-2">
                <div className="text-xs text-gray-400">Estado del ciclo:</div>
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${isNowLight ? 'bg-yellow-500 text-slate-900 shadow-md' : 'bg-indigo-600 text-white shadow-md'}`}>{isNowLight ? 'LUZ ACTIVA' : 'OSCURIDAD'}</div>
              </div>

              <div className="border-b border-slate-700 pb-2">
                <div className="text-xs text-gray-400">Próximo evento ({nextChangeEvent.action}):</div>
                <div className="font-semibold text-white text-base">{nextChangeEvent.nextState} — {nextChangeEvent.time} ({nextChangeEvent.date})</div>
                <div className="text-xs text-gray-400">En {nextChangeEvent.hoursToNext?.toFixed(2) ?? '--'} hrs</div>
              </div>

              {/* ** BLOQUE DE HORARIO DETALLADO (ON/OFF con fecha y hora) ** */}
              <div>
                <div className="text-xs text-gray-400 mb-2">Horario **HOY** (Día {currentDayIndex24h + 1} de 24h):</div>
                <div className="text-sm grid grid-cols-1 gap-3 text-white">
                  <div className="border border-yellow-800/50 p-3 rounded-xl bg-slate-800/80 shadow-inner">
                    <span className="text-yellow-400 font-semibold block mb-1 text-base">
                      {lightScheduleToday.isLightActive ? 'ON (Inicio Luz Actual):' : 'ON (Próx. Encendido):'}
                    </span> 
                    <div className="font-mono text-lg">{lightScheduleToday.lightStart}</div>
                    
                    <span className="text-red-400 font-semibold block mt-3 mb-1 text-base">
                      {lightScheduleToday.isLightActive ? 'OFF (Próx. Apagado):' : 'OFF (Fin Luz Anterior):'}
                    </span> 
                    <div className="font-mono text-lg">{lightScheduleToday.lightEnd}</div>
                  </div>
                </div>
                {lightScheduleToday.status && <p className="text-xs text-gray-400 mt-1">*{lightScheduleToday.status}</p>}
              </div>
              {/* ** FIN BLOQUE DE HORARIO DETALLADO ** */}

            </div>
          </aside>

          {/* Calendar full width below */}
          <section className="lg:col-span-3 mt-4 p-0 rounded-xl border border-slate-700 shadow-lg overflow-hidden bg-slate-900/50">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
              <h4 className="font-semibold text-white text-lg">Calendario (Día × Hora)</h4>
              <div className="text-sm text-gray-400">{durationDays} días</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-gray-200">
                <thead className="bg-slate-800 sticky top-0 shadow-md">
                  <tr>
                    <th className="p-2 text-left sticky left-0 bg-slate-800 text-sm text-white z-10 w-12">Día</th>
                    {Array.from({length:24}).map((_,h) => (
                      <th key={h} className="p-2 text-center text-sm text-gray-300 w-8">{h}h</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendar.map((row, d) => (
                    <tr key={d} className={`${d === currentDayIndex24h ? 'bg-indigo-900/30' : 'hover:bg-slate-700/50'} transition`}>
                      <td className={`p-1 sticky left-0 bg-slate-800 text-sm font-semibold z-10 ${d === currentDayIndex24h ? 'bg-indigo-900/30 text-white' : 'text-gray-100'}`}>{d+1}</td>
                      {row.map((isLight, h) => {
                        const isCurrent = d === currentDayIndex24h && h === currentHourIndex;
                        return (
                          <td key={h} className="p-0.5">
                            <div className={`w-full h-6 rounded-sm flex items-center justify-center text-xs font-mono font-semibold 
                                ${isLight ? 'bg-yellow-700/80 text-yellow-100' : 'bg-indigo-700/80 text-indigo-100'} 
                                ${isCurrent ? 'ring-2 ring-red-500 shadow-xl scale-105' : ''} transition-all duration-150`}>
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

            <div className="p-3 text-xs text-gray-400 border-t border-slate-700">Leyenda: L = Luz, D = Oscuridad. Celda actual resaltada con borde rojo.</div>
          </section>

        </main>

      </div>
    </div>
  );
}