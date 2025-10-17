/**
Fotoperiodo-App (React) - Prototipo

Cómo usar:
- Este archivo exporta un componente React por defecto (App).
- Funciona en un proyecto creado con Vite/React o Create React App.
- Requiere Tailwind CSS para estilos (recomendado). Si no lo tenés, el componente seguirá funcionando con estilos básicos de clase.

Características incluidas:
- Fotoperiodo totalmente configurable (horas de luz y oscuridad ilimitadas).
- Fecha y hora de inicio configurables.
- Duración en días configurable.
- Visualización calendario día x hora (mapa de 24h) coloreado según luz/oscuridad.
- Cálculo automático del día y la hora actuales dentro del ciclo.
- Guardado automático en localStorage + botones exportar/importar JSON.
- Botón para reiniciar al estado por defecto.

Notas técnicas:
- Algoritmo: para cada celda (día, hora) calculamos "hoursSinceStart = (dayIndex * 24) + hour + fractionalStartOffset" y luego
  `hoursInCycle = ((hoursSinceStart % cycleLength) + cycleLength) % cycleLength`. Si hoursInCycle < hoursLight entonces es LUZ.
- Si querés soporte de autenticación y sincronización, podés conectar Supabase/Firebase en la etapa 2. */

import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "fotoperiodo_settings_v1";

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

export default function App() {
  const [startDate, setStartDate] = useState(() => {
    // default today at 00:00
    const d = new Date();
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,16); // yyyy-mm-ddThh:mm for input[type=datetime-local]
  });

  const [hoursLight, setHoursLight] = useState(13);
  const [hoursDark, setHoursDark] = useState(14);
  const [durationDays, setDurationDays] = useState(60);
  const [tzOffsetHours] = useState(() => new Date().getTimezoneOffset() / -60); 
  const [now, setNow] = useState(new Date());

  // load settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj.startDate) setStartDate(obj.startDate);
        if (obj.hoursLight !== undefined) setHoursLight(Number(obj.hoursLight));
        if (obj.hoursDark !== undefined) setHoursDark(Number(obj.hoursDark));
        if (obj.durationDays !== undefined) setDurationDays(Number(obj.durationDays));
      }
    } catch (e) {
      console.warn("No se pudieron cargar los ajustes:", e);
    }
  }, []);

  // autosave
  useEffect(() => {
    const obj = { startDate, hoursLight, hoursDark, durationDays };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }, [startDate, hoursLight, hoursDark, durationDays]);

  // tick every 30s so "current" updates
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const cycleLength = useMemo(() => Math.max(0.0001, Number(hoursLight) + Number(hoursDark)), [hoursLight, hoursDark]);

  // parse startDate string into Date
  const startDateObj = useMemo(() => {
    const d = new Date(startDate);
    if (isNaN(d.getTime())) {
      const fallback = new Date(); fallback.setHours(0,0,0,0); return fallback;
    }
    return d;
  }, [startDate]);

  // fractional offset in hours between the startDate time and midnight: used for precise alignment
  const fractionalStartOffset = useMemo(() => {
    // startDateObj already has hours/minutes
    return startDateObj.getHours() + startDateObj.getMinutes() / 60 + startDateObj.getSeconds() / 3600;
  }, [startDateObj]);

  // helper to compute whether a given absolute hour (hours since start) is light
  function isLightAtAbsoluteHours(hoursSinceStart) {
    // modulo cycle length, keep positive
    const inCycle = ((hoursSinceStart % cycleLength) + cycleLength) % cycleLength;
    return inCycle < Number(hoursLight);
  }

  // build calendar grid data: array of days, each day is array of 24 booleans (true -> light)
  const calendar = useMemo(() => {
    const days = [];
    for (let d = 0; d < durationDays; d++) {
      const dayRow = [];
      for (let h = 0; h < 24; h++) {
        const hoursSinceStart = d * 24 + h - fractionalStartOffset; 
        dayRow.push(isLightAtAbsoluteHours(hoursSinceStart));
      }
      days.push(dayRow);
    }
    return days;
  }, [durationDays, cycleLength, fractionalStartOffset, hoursLight]);

  // current position in hours since start
  const hoursSinceStartNow = useMemo(() => {
    const diffMs = now.getTime() - startDateObj.getTime();
    return diffMs / (1000 * 60 * 60);
  }, [now, startDateObj]);

  const currentInCycle = useMemo(() => {
    const raw = ((hoursSinceStartNow % cycleLength) + cycleLength) % cycleLength;
    return raw;
  }, [hoursSinceStartNow, cycleLength]);

  const isNowLight = useMemo(() => isLightAtAbsoluteHours(hoursSinceStartNow), [hoursSinceStartNow, cycleLength]);

  const currentDayIndex = useMemo(() => Math.floor(hoursSinceStartNow / 24), [hoursSinceStartNow]);
  const currentHourIndex = useMemo(() => Math.floor(((hoursSinceStartNow % 24) + 24) % 24), [hoursSinceStartNow]);

  // =================================================================
  // === CÁLCULOS PRINCIPALES ========================================
  // =================================================================

  // Días transcurridos (Días de Cultivo)
  const daysSinceStart = useMemo(() => {
    const constDiffMs = now.getTime() - startDateObj.getTime();
    const diffDays = constDiffMs / (1000 * 60 * 60 * 24);
    return Math.floor(diffDays);
  }, [now, startDateObj]);

  // Ahorro de Horas de Luz (vs 12L/12D)
  const lightSaving = useMemo(() => {
    const daysElapsed = Math.max(0, daysSinceStart);
    const standardLightHours = 12; 
    
    const savingPerHour = standardLightHours - Number(hoursLight); 
    const totalSaving = savingPerHour * daysElapsed;

    return {
      totalSaving: totalSaving,
    };
  }, [daysSinceStart, hoursLight]);


  // Horarios de Luz/Oscuridad del Día Actual (Formato AM/PM)
  const lightScheduleToday = useMemo(() => {
    const currentDayStartHoursSinceStart = currentDayIndex * 24 - fractionalStartOffset;
    
    let lightStartHour = -1;
    let darkStartHour = -1;
    
    for (let h = 0; h < 24; h++) {
      const hoursAbsolute = currentDayStartHoursSinceStart + h;
      const isLight = isLightAtAbsoluteHours(hoursAbsolute);
      const isPrevLight = isLightAtAbsoluteHours(hoursAbsolute - 1);

      if (isLight && !isPrevLight && lightStartHour === -1) lightStartHour = h;
      if (!isLight && isPrevLight && darkStartHour === -1) darkStartHour = h;
    }

    const formatHour = (h) => {
        const militaryHour = Math.round(h % 24);
        const date = new Date();
        date.setHours(militaryHour, 0, 0, 0); 
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    
    if (Number(hoursLight) === 0) return { status: 'Oscuridad total (24D)', isLight: false, lightStart: 'N/A', lightEnd: 'N/A', darkStart: formatHour(0), darkEnd: formatHour(24) };
    if (Number(hoursDark) === 0) return { status: 'Luz total (24L)', isLight: true, lightStart: formatHour(0), lightEnd: formatHour(24), darkStart: 'N/A', darkEnd: 'N/A' };


    let ls = 'N/A';
    let le = 'N/A';
    let ds = 'N/A';
    let de = 'N/A';

    if (lightStartHour !== -1) {
        ls = formatHour(lightStartHour);
        le = formatHour(lightStartHour + Number(hoursLight));
    } else {
        if (darkStartHour !== -1) {
             le = formatHour(darkStartHour);
             ls = formatHour(darkStartHour - Number(hoursLight));
        }
    }
    
    if (darkStartHour !== -1) {
        ds = formatHour(darkStartHour);
        de = formatHour(darkStartHour + Number(hoursDark));
    } else {
        if (lightStartHour !== -1) {
             de = formatHour(lightStartHour);
             ds = formatHour(lightStartHour - Number(hoursDark));
        }
    }

    return {
        lightStart: ls,
        lightEnd: le,
        darkStart: ds,
        darkEnd: de,
        status: null,
    };
    
  }, [currentDayIndex, fractionalStartOffset, hoursLight, hoursDark]);

  // Próximo Cambio de Estado
  const nextChangeEvent = useMemo(() => {
    let hoursToNextChange;
    let nextState;

    if (isNowLight) {
        const hoursInLightPeriod = currentInCycle;
        const hoursRemainingInLight = Number(hoursLight) - hoursInLightPeriod;
        hoursToNextChange = hoursRemainingInLight;
        nextState = 'Oscuridad';
    } else {
        const hoursInDarkPeriod = currentInCycle - Number(hoursLight);
        const hoursRemainingInDark = Number(hoursDark) - hoursInDarkPeriod;
        hoursToNextChange = hoursRemainingInDark;
        nextState = 'Luz';
    }

    const diffMs = hoursToNextChange * (1000 * 60 * 60);
    const nextChangeDate = new Date(now.getTime() + diffMs);

    const formattedDate = nextChangeDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const formattedTime = nextChangeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    return {
        hoursToNextChange: hoursToNextChange,
        date: formattedDate,
        time: formattedTime,
        nextState: nextState,
        action: nextState === 'Luz' ? 'Encendido' : 'Apagado'
    };
  }, [now, isNowLight, currentInCycle, hoursLight, hoursDark]);


  // =================================================================
  // === FUNCIONALIDADES EXISTENTES (Exportar/Importar/Reset) ========
  // =================================================================

  function handleExport() {
    const payload = { startDate, hoursLight, hoursDark, durationDays };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "fotoperiodo-config.json"; a.click();
    URL.revokeObjectURL(url);
  }

  function resetDefaults() {
    const d = new Date(); d.setHours(0,0,0,0);
    setStartDate(d.toISOString().slice(0,16));
    setHoursLight(13); setHoursDark(14); setDurationDays(60);
  }

  // =================================================================
  // === CLASES TAILWIND CSS (FUTURISTA/NEÓN) ========================
  // =================================================================

  const PRIMARY_COLOR = 'cyan'; 
  const SECONDARY_COLOR = 'indigo';

  const INPUT_CLASS = `w-full p-2 border border-${PRIMARY_COLOR}-700/50 rounded-lg bg-gray-700 text-white 
                       focus:ring-2 focus:ring-${PRIMARY_COLOR}-400 focus:border-${PRIMARY_COLOR}-400 
                       transition duration-200 ease-in-out shadow-inner shadow-gray-900`;
  
  const BUTTON_BASE_CLASS = "px-4 py-2 rounded-lg font-semibold shadow-lg transition duration-300 ease-in-out text-sm tracking-wide";
  
  const PRIMARY_BUTTON_CLASS = `${BUTTON_BASE_CLASS} bg-${PRIMARY_COLOR}-600 text-gray-900 hover:bg-${PRIMARY_COLOR}-500 
                                shadow-${PRIMARY_COLOR}-500/50 hover:shadow-${PRIMARY_COLOR}-400/70`;
  
  const TERTIARY_BUTTON_CLASS = `${BUTTON_BASE_CLASS} bg-gray-700 text-${PRIMARY_COLOR}-400 hover:bg-gray-600 shadow-none border border-${PRIMARY_COLOR}-700/50`;
  
  // Tarjeta de fondo oscuro con borde neón
  const CARD_CLASS = `p-5 bg-gray-800 rounded-xl border border-${PRIMARY_COLOR}-700/50 shadow-2xl 
                      shadow-gray-950 transition duration-500 hover:border-${PRIMARY_COLOR}-500/70`;

  // Títulos con acento neón
  const TITLE_CLASS = `text-xl font-bold mb-4 pb-2 border-b border-${PRIMARY_COLOR}-700 text-${PRIMARY_COLOR}-400`;


  const formatStartDate = (dateObj) => {
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return (
    // Fondo oscuro
    <div className="min-h-screen bg-gray-900 text-gray-300 p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className={`text-4xl font-extrabold tracking-widest text-${PRIMARY_COLOR}-400`} style={{textShadow: `0 0 5px #06B6D4, 0 0 10px #06B6D4`}}>
            FOTOPERIODO 💡 MATRIX
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de Ciclos de Luz | Módulo Bio-Digital
          </p>
        </header>

        <section className="grid lg:grid-cols-3 gap-6 mb-8">
          
          {/* Configuración */}
          <div className={`${CARD_CLASS} lg:col-span-2`}>
            <h2 className={TITLE_CLASS}>
              // Módulo de Configuración
            </h2>
            
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Fecha y Hora de Inicio del Ciclo
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={INPUT_CLASS}
            />

            <div className="grid sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">HORAS LUZ (L)</label>
                <input type="number" min="0" step="0.5" value={hoursLight}
                  onChange={(e) => setHoursLight(clamp(Number(e.target.value), 0, 9999))}
                  className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">HORAS OSCURIDAD (D)</label>
                <input type="number" min="0" step="0.5" value={hoursDark}
                  onChange={(e) => setHoursDark(clamp(Number(e.target.value), 0, 9999))}
                  className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">DURACIÓN (DÍAS)</label>
                <input type="number" min="1" max="9999" value={durationDays}
                  onChange={(e) => setDurationDays(clamp(Number(e.target.value), 1, 9999))}
                  className={INPUT_CLASS} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-700/50">
              <button onClick={handleExport} className={PRIMARY_BUTTON_CLASS}>EXPORTAR CONFIG</button>
              <button onClick={resetDefaults} className={TERTIARY_BUTTON_CLASS}>REINICIAR VALORES</button>
            </div>
          </div>

          {/* Estado actual y Ahorro */}
          <div className={CARD_CLASS}>
            <h2 className={TITLE_CLASS}>
              // Estado del Sistema
            </h2>
            
            {/* Días transcurridos y fecha de inicio */}
            <div className="text-sm text-gray-400 mb-4 pb-3 border-b border-gray-700">
                <p className="font-semibold text-gray-300 text-xs mb-1">📅 CICLO INICIADO:</p>
                <span className={`text-base font-mono text-${PRIMARY_COLOR}-400`}>{formatStartDate(startDateObj)}</span>
                
                <p className="font-semibold text-gray-300 flex items-center mt-3">
                    🌱 DÍAS DE CULTIVO: 
                    <span className={`text-3xl font-extrabold font-mono text-${PRIMARY_COLOR}-500 ml-2 leading-none`}>
                        {Math.max(0, daysSinceStart)}
                    </span>
                </p>
            </div>
            
            <div className="text-sm text-gray-400 space-y-3">
              <p className="font-mono text-xs">
                ⏰ HORA DEL SISTEMA: <span className="text-white font-normal">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              </p>
              
              {/* Indicador de Estado LUZ/OSCURIDAD */}
              <div className="flex justify-between items-center p-2 rounded-lg border border-gray-700/50 bg-gray-700/50">
                  <span className="font-medium text-xs">ESTADO ACTUAL:</span>
                  <span className={`ml-2 px-3 py-1 rounded-full text-xs font-bold ring-1 ${isNowLight 
                    ? `bg-green-700 text-green-300 ring-green-500/50` 
                    : `bg-purple-800 text-purple-300 ring-purple-500/50`}`}>
                    {isNowLight ? 'LUZ ACTIVA' : 'OSCURIDAD'}
                  </span>
              </div>
              
              {/* Progreso (Próximo Cambio) */}
              <div className={`font-semibold p-3 rounded-xl border border-dashed border-${SECONDARY_COLOR}-700 bg-gray-900/50`}>
                  <p className="text-xs text-gray-500 mb-1">PRÓXIMO EVENTO ({nextChangeEvent.action}):</p>
                  <span className={`text-${SECONDARY_COLOR}-400 text-lg font-bold font-mono`}>
                    {nextChangeEvent.time}
                  </span>
                  <span className="text-gray-500 text-sm ml-1">
                    del {nextChangeEvent.date}
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                     (T-Minus: {nextChangeEvent.hoursToNextChange.toFixed(2)} hrs)
                  </p>
              </div>

              {/* Horarios del Día Actual (AM/PM) */}
              <div className="pt-3 border-t border-gray-700">
                <h3 className="font-bold text-gray-300 text-sm mb-2">// Horarios de Ciclo (HOY):</h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>☀️ LUZ: <strong className="text-green-500">{lightScheduleToday.lightStart}</strong> a <strong className="text-green-500">{lightScheduleToday.lightEnd}</strong></div>
                  <div>🌑 OSCURIDAD: <strong className="text-purple-500">{lightScheduleToday.darkStart}</strong> a <strong className="text-purple-500">{lightScheduleToday.darkEnd}</strong></div>
                </div>
                {lightScheduleToday.status && <p className="text-xs text-red-500 mt-1">*{lightScheduleToday.status}</p>}
              </div>

            </div>

            {/* SECCIÓN DE AHORRO (COMPACTA) */}
            <div className="mt-6 pt-5 border-t border-gray-700">
              <h3 className={`text-sm font-bold text-${PRIMARY_COLOR}-400 mb-2`}>// BALANCE ENERGÉTICO (vs 12L/12D)</h3>
              
              <div className="p-3 rounded-lg bg-gray-900 border border-gray-700 shadow-xl shadow-gray-950/50">
                <p className="text-sm font-medium text-gray-400">Balance Total de Horas Luz:</p>
                <p className="text-3xl font-extrabold mt-1 font-mono">
                    <span className={`${lightSaving.totalSaving > 0 ? 'text-green-500' : (lightSaving.totalSaving < 0 ? 'text-red-500' : 'text-gray-500')}`}>
                        {lightSaving.totalSaving > 0 ? '+' : ''}{lightSaving.totalSaving.toFixed(1)} 
                    </span>
                    <span className="text-base text-gray-500 font-normal ml-1">hrs</span>
                </p>
                
                <p className="text-xs text-gray-600 mt-2">
                    {lightSaving.totalSaving > 0 
                        ? 'Ahorro de Luz (Menos horas que el ciclo estándar).'
                        : (lightSaving.totalSaving < 0 
                            ? 'Gasto Extra (Más horas que el ciclo estándar).'
                            : 'Uso Estándar (Exactamente 12 horas de luz).'
                        )
                    }
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Calendario */}
        <section className={CARD_CLASS + " p-0"}>
          <div className={`flex items-center justify-between p-4 border-b border-${PRIMARY_COLOR}-700/50`}>
            <h2 className={`text-xl font-bold text-${PRIMARY_COLOR}-400`}>
              // Visualización de Ciclos (Día × Hora)
            </h2>
            <div className="text-xs text-gray-500">
              Período de {durationDays} días
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs divide-y divide-gray-700">
              <thead className="bg-gray-700 sticky top-0 z-10 shadow-lg shadow-gray-900">
                <tr>
                  <th className={`p-2 border-r border-gray-700 text-left w-20 text-xs font-semibold uppercase tracking-wider text-${PRIMARY_COLOR}-400 sticky left-0 bg-gray-700`}>Día #</th>
                  {Array.from({length:24}).map((_,h) => (
                    <th key={h} className="p-2 border-r border-gray-800 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">{h}h</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {calendar.map((row, d) => (
                  <tr key={d} className={`transition duration-100 ${d === currentDayIndex ? 'bg-gray-800 border-l-2 border-l-purple-500' : 'hover:bg-gray-800/50'}`}>
                    <td className={`p-2 border-r border-gray-700 text-xs font-bold text-gray-300 sticky left-0 ${d === currentDayIndex ? 'bg-gray-800' : 'bg-gray-800'}`}>{d+1}</td>
                    {row.map((isLight, h) => {
                      const isCurrentCell = d === currentDayIndex && h === currentHourIndex;
                      const cellClass = isLight 
                        ? 'bg-yellow-800/40 text-yellow-300 border-yellow-700/50' // LUZ NEÓN
                        : 'bg-indigo-800/40 text-indigo-300 border-indigo-700/50'; // OSCURIDAD NEÓN

                      return (
                        <td key={h} className={`p-0.5 border-r border-gray-800 text-center align-middle`}>
                          <div className={`w-full h-6 flex items-center justify-center text-xs font-bold rounded-sm border ${cellClass} ${isCurrentCell ? 'ring-2 ring-red-500 scale-110 shadow-lg shadow-red-900 z-20' : ''} transition-all duration-100 ease-in-out font-mono`}>
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

          <footer className="mt-3 p-4 text-xs text-gray-600 border-t border-gray-700">
            **Leyenda:** <span className="text-yellow-400">L (Luz)</span> / <span className="text-indigo-400">D (Oscuridad)</span>. La celda actual tiene un marcador rojo neón.
          </footer>
        </section>

      </div>
    </div>
  );
}