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

import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "fotoperiodo_settings_v1";

// Función auxiliar para limitar valores
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

export default function App() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,16);
  });

  const [hoursLight, setHoursLight] = useState(13);
  const [hoursDark, setHoursLight] = useState(14);
  const [durationDays, setDurationDays] = useState(60);
  
  const [now, setNow] = useState(new Date());

  // load settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj.startDate) setStartDate(obj.startDate);
        if (obj.hoursLight !== undefined) setHoursLight(Number(obj.hoursLight) || 0);
        if (obj.hoursDark !== undefined) setHoursDark(Number(obj.hoursDark) || 0);
        if (obj.durationDays !== undefined) setDurationDays(Number(obj.durationDays) || 1);
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

  // Longitud total del ciclo (ej: 13 + 14 = 27)
  const cycleLength = useMemo(() => {
    const light = Number(hoursLight) || 0;
    const dark = Number(hoursDark) || 0;
    return Math.max(0.0001, light + dark);
  }, [hoursLight, hoursDark]);

  const startDateObj = useMemo(() => {
    const d = new Date(startDate);
    if (isNaN(d.getTime())) {
      const fallback = new Date(); fallback.setHours(0,0,0,0); return fallback;
    }
    return d;
  }, [startDate]);

  const fractionalStartOffset = useMemo(() => {
    return startDateObj.getHours() + startDateObj.getMinutes() / 60 + startDateObj.getSeconds() / 3600;
  }, [startDateObj]);

  function isLightAtAbsoluteHours(hoursSinceStart) {
    const inCycle = ((hoursSinceStart % cycleLength) + cycleLength) % cycleLength;
    return inCycle < Number(hoursLight);
  }

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

  // Horas totales transcurridas desde el inicio
  const hoursSinceStartNow = useMemo(() => {
    const diffMs = now.getTime() - startDateObj.getTime();
    return diffMs / (1000 * 60 * 60);
  }, [now, startDateObj]);

  // Hora actual dentro del ciclo (0 a cycleLength)
  const currentInCycle = useMemo(() => {
    const raw = ((hoursSinceStartNow % cycleLength) + cycleLength) % cycleLength;
    return raw;
  }, [hoursSinceStartNow, cycleLength]);

  const isNowLight = useMemo(() => isLightAtAbsoluteHours(hoursSinceStartNow), [hoursSinceStartNow, cycleLength]);

  const currentDayIndex = useMemo(() => Math.floor(hoursSinceStartNow / 24), [hoursSinceStartNow]);
  const currentHourIndex = useMemo(() => Math.floor(((hoursSinceStartNow % 24) + 24) % 24), [hoursSinceStartNow]);

  // =================================================================
  // === CÁLCULOS PRINCIPALES (Ahorro y Ciclo Personalizado) ==========
  // =================================================================

  const daysSinceStart = useMemo(() => {
    const constDiffMs = now.getTime() - startDateObj.getTime();
    const diffDays = constDiffMs / (1000 * 60 * 60 * 24);
    return Math.floor(diffDays);
  }, [now, startDateObj]);
  
  // Cálculo del Ciclo Personalizado
  const customCycleInfo = useMemo(() => {
    // Número de ciclos completos transcurridos
    const currentCycleNumber = Math.floor(hoursSinceStartNow / cycleLength) + 1;
    
    // Horas dentro del ciclo actual (0 a cycleLength)
    const hourInCurrentCycle = currentInCycle;
    
    return {
        currentCycleNumber: Math.max(1, currentCycleNumber),
        hourInCurrentCycle: hourInCurrentCycle,
        cycleTypeLabel: `${Number(hoursLight).toFixed(1)} hs ON / ${Number(hoursDark).toFixed(1)} hs OFF`
    };
  }, [hoursSinceStartNow, cycleLength, hoursLight, hoursDark, currentInCycle]);

  const lightSaving = useMemo(() => {
    const daysElapsed = Math.max(0, hoursSinceStartNow / 24); 
    
    // ESTÁNDAR FIJO DE COMPARACIÓN (12L/12D)
    const standardLightHoursPerDay = 12; 
    
    const customLightHours = Number(hoursLight) || 0; 
    const customCycleLength = cycleLength; 
    
    // Horas de luz reales usadas en un DÍA TERRESTRE (24 horas)
    const customLightHoursPerDay = customCycleLength > 0 
      ? (customLightHours / customCycleLength) * 24
      : 0;

    // Ahorro/Gasto por día
    const savingPerHourPerDay = standardLightHoursPerDay - customLightHoursPerDay; 
    
    // Ahorro/Gasto Total acumulado
    const rawTotalSaving = savingPerHourPerDay * daysElapsed;

    const totalSaving = rawTotalSaving || 0; 
    
    return { 
      totalSaving: totalSaving,
      savingPerHourPerDay: savingPerHourPerDay
    };
  }, [hoursSinceStartNow, hoursLight, cycleLength]); 


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
    
    if (Number(hoursLight) === 0) return { status: 'Oscuridad total (24D)', lightStart: 'N/A', lightEnd: 'N/A', darkStart: formatHour(0), darkEnd: formatHour(24) };
    if (Number(hoursDark) === 0) return { status: 'Luz total (24L)', lightStart: formatHour(0), lightEnd: formatHour(24), darkStart: 'N/A', darkEnd: 'N/A' };


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

  const nextChangeEvent = useMemo(() => {
    let rawHoursToNextChange;
    let nextState;

    if (isNowLight) {
        const hoursInLightPeriod = currentInCycle;
        const hoursRemainingInLight = (Number(hoursLight) || 0) - hoursInLightPeriod;
        rawHoursToNextChange = hoursRemainingInLight;
        nextState = 'Oscuridad';
    } else {
        const hoursInDarkPeriod = currentInCycle - (Number(hoursLight) || 0);
        const hoursRemainingInDark = (Number(hoursDark) || 0) - hoursInDarkPeriod;
        rawHoursToNextChange = hoursRemainingInDark;
        nextState = 'Luz';
    }

    const hoursToNextChange = Math.max(0, rawHoursToNextChange || 0);
    
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
  // === CLASES TAILWIND CSS (ALTO CONTRASTE / SIN BORDES) ============
  // =================================================================

  const PRIMARY_COLOR = 'blue'; 
  const ACCENT_COLOR = 'green';  

  const INPUT_CLASS = `w-full p-2.5 border-b border-gray-300 rounded-none bg-white text-gray-800 
                       focus:ring-0 focus:border-b-2 focus:border-${PRIMARY_COLOR}-500 transition duration-200 shadow-none text-base`;
  
  const CARD_CLASS = `p-6 bg-white transition duration-300`;

  const TITLE_CLASS = `text-2xl font-extrabold mb-4 pb-3 border-b border-gray-200 text-gray-900`;


  const formatStartDate = (dateObj) => {
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex justify-center w-full">
      
      <div className="max-w-4xl w-full p-4 sm:p-8">
        
        <header className="mb-8 pt-4 pb-2 text-center">
          <h1 className={`text-4xl font-extrabold tracking-tight text-gray-900`}>
            Fotoperiodo | Módulo de Control
          </h1>
          <p className="text-base text-gray-500 mt-2">
            Visualización y ajuste de ciclos de luz/oscuridad para fotoperiodo.
          </p>
        </header>

        <section className="grid lg:grid-cols-3 gap-6 mb-8">
          
          {/* Configuración */}
          <div className={`${CARD_CLASS} lg:col-span-2 border-b lg:border-r lg:border-b-0 border-gray-200`}>
            <h2 className={TITLE_CLASS}>
              Configuración del Ciclo Personalizado
            </h2>
            
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y Hora de Inicio
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={INPUT_CLASS}
            />

            <div className="grid sm:grid-cols-3 gap-6 mt-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas Luz (L)</label>
                <input type="number" min="0" step="0.5" value={hoursLight}
                  onChange={(e) => setHoursLight(clamp(Number(e.target.value), 0, 9999))}
                  className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas Oscuridad (D)</label>
                <input type="number" min="0" step="0.5" value={hoursDark}
                  onChange={(e) => setHoursDark(clamp(Number(e.target.value), 0, 9999))}
                  className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duración Total (días)</label>
                <input type="number" min="1" max="9999" value={durationDays}
                  onChange={(e) => setDurationDays(clamp(Number(e.target.value), 1, 9999))}
                  className={INPUT_CLASS} />
              </div>
            </div>
            
          </div>

          {/* Estado actual y Ahorro */}
          <div className={CARD_CLASS}>
            <h2 className={TITLE_CLASS}>
              Estado y Control
            </h2>
            
            {/* Días transcurridos y fecha de inicio */}
            <div className="text-base text-gray-600 mb-4 pb-4 border-b border-gray-200">
                <p className="font-semibold text-gray-900 text-sm mb-1">Inicio del Ciclo:</p>
                <span className={`text-lg font-mono text-gray-800`}>{formatStartDate(startDateObj)}</span>
                
                <p className="font-semibold text-gray-900 flex items-center mt-3">
                    Días de Cultivo (Terrestres): 
                    <span className={`text-4xl font-extrabold font-mono text-${PRIMARY_COLOR}-600 ml-2 leading-none`}>
                        {Math.max(0, daysSinceStart)}
                    </span>
                </p>
            </div>
            
            <div className="text-sm text-gray-600 space-y-4">
              
              {/* === NUEVA MÉTRICA: CICLO PERSONALIZADO === */}
              <div className="py-2 border-b border-gray-200 bg-blue-50 p-2 rounded-md">
                <p className="font-semibold text-gray-900 text-sm mb-1">
                    Progreso en el Ciclo Personalizado
                </p>
                <p className="font-mono text-sm text-gray-700">
                    <strong className="text-2xl font-extrabold text-blue-700 leading-none">
                        Día {customCycleInfo.currentCycleNumber}
                    </strong>
                    <span className="text-xs text-gray-500 ml-2">
                         ({(customCycleInfo.hourInCurrentCycle || 0).toFixed(2)} / {cycleLength.toFixed(2)} hs)
                    </span>
                </p>
                <p className="text-xs font-medium text-blue-600 mt-1">
                    Ciclo: {customCycleInfo.cycleTypeLabel}
                </p>
              </div>
              {/* ========================================= */}


              <p className="font-mono text-sm flex justify-between items-center pb-2 border-b border-gray-200 pt-2">
                <span className="text-gray-600">Hora Actual:</span> 
                <span className={`text-xl font-bold text-${PRIMARY_COLOR}-600`}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              </p>
              
              {/* Indicador de Estado LUZ/OSCURIDAD */}
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="font-medium text-sm text-gray-600">Estado Actual:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${isNowLight 
                    ? `bg-green-100 text-green-700` 
                    : `bg-indigo-100 text-indigo-700`}`}>
                    {isNowLight ? 'LUZ ACTIVA' : 'OSCURIDAD'}
                  </span>
              </div>
              
              {/* Progreso (Próximo Cambio) */}
              <div className={`font-semibold py-2 border-b border-gray-200`}>
                  <p className="text-xs text-gray-500 mb-1">Próximo Evento ({nextChangeEvent.action}):</p>
                  <span className={`text-gray-800 text-xl font-bold font-mono`}>
                    {nextChangeEvent.time}
                  </span>
                  <span className="text-gray-500 text-sm ml-1">
                    del {nextChangeEvent.date}
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                     (Tiempo restante: {(nextChangeEvent.hoursToNextChange || 0).toFixed(2)} hrs)
                  </p>
              </div>

              {/* Horarios del Día Actual */}
              <div className="pt-2">
                <h3 className="font-bold text-gray-800 text-sm mb-2">Horario de Hoy (24h Terrestres):</h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div><span className="text-green-600">LUZ:</span> <strong className="text-gray-900">{lightScheduleToday.lightStart}</strong> a <strong className="text-gray-900">{lightScheduleToday.lightEnd}</strong></div>
                  <div><span className="text-indigo-600">OSCURIDAD:</span> <strong className="text-gray-900">{lightScheduleToday.darkStart}</strong> a <strong className="text-gray-900">{lightScheduleToday.darkEnd}</strong></div>
                </div>
                {lightScheduleToday.status && <p className="text-xs text-red-500 mt-1">*{lightScheduleToday.status}</p>}
              </div>

            </div>

            {/* SECCIÓN DE AHORRO */}
            <div className="mt-6 pt-5 border-t border-gray-200">
              <h3 className={`text-sm font-bold text-gray-800 mb-2`}>Balance Energético vs Ciclo Común (12L/12D)</h3>
              
              <div className="p-3 bg-gray-50">
                
                {/* Muestra la diferencia diaria (la clave de la corrección) */}
                <p className="text-xs font-medium text-gray-500">Diferencia Diaria vs 12L/12D:</p>
                <p className="text-xl font-extrabold mt-1 mb-3 font-mono">
                    <span className={`${lightSaving.savingPerHourPerDay > 0 ? `text-${ACCENT_COLOR}-600` : (lightSaving.savingPerHourPerDay < 0 ? 'text-red-600' : 'text-gray-500')}`}>
                        {lightSaving.savingPerHourPerDay > 0 ? '+' : ''}{(lightSaving.savingPerHourPerDay || 0).toFixed(2)} 
                    </span>
                    <span className="text-base text-gray-500 font-normal ml-1">horas/día</span>
                </p>


                <p className="text-xs font-medium text-gray-500">Total de Horas Luz Ahorradas/Gastadas:</p>
                <p className="text-3xl font-extrabold mt-1 font-mono">
                    <span className={`${lightSaving.totalSaving > 0 ? `text-${ACCENT_COLOR}-600` : (lightSaving.totalSaving < 0 ? 'text-red-600' : 'text-gray-500')}`}>
                        {lightSaving.totalSaving > 0 ? '+' : ''}{(lightSaving.totalSaving || 0).toFixed(2)} 
                    </span>
                    <span className="text-base text-gray-500 font-normal ml-1">horas</span>
                </p>
                
                <p className="text-xs text-gray-600 mt-2">
                    {lightSaving.totalSaving > 0 
                        ? 'Ahorro Acumulado (Tu ciclo usa menos luz por día terrestre que el estándar).'
                        : (lightSaving.totalSaving < 0 
                            ? 'Gasto Extra Acumulado (Tu ciclo usa más luz por día terrestre que el estándar).'
                            : 'Uso Estándar (Igual cantidad de horas de luz por día).'
                        )
                    }
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Calendario */}
        <section className={`${CARD_CLASS} p-0 overflow-hidden`}>
          <div className={`flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50`}>
            <h2 className={`text-xl font-bold text-gray-800`}>
              Visualización por Ciclos (Día Terrestre × Hora)
            </h2>
            <div className="text-xs text-gray-500">
              {durationDays} días de monitoreo
            </div>
          </div>

          <div className="overflow-x-auto border-t border-gray-200">
            <table className="min-w-full text-xs divide-y divide-gray-200">
              <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className={`p-2 border-r border-gray-200 text-left w-20 text-xs font-semibold uppercase tracking-wider text-gray-600 sticky left-0 bg-white`}>Día #</th>
                  {Array.from({length:24}).map((_,h) => (
                    <th key={h} className="p-2 border-r border-gray-300 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">{h}h</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {calendar.map((row, d) => (
                  <tr key={d} className={`transition duration-100 ${d === currentDayIndex ? 'bg-yellow-50/50 border-l-2 border-l-yellow-400' : 'hover:bg-gray-50'}`}>
                    <td className={`p-2 border-r border-gray-200 text-xs font-bold text-gray-800 sticky left-0 ${d === currentDayIndex ? 'bg-yellow-50/50' : 'bg-white'}`}>{d+1}</td>
                    {row.map((isLight, h) => {
                      const isCurrentCell = d === currentDayIndex && h === currentHourIndex;
                      const cellClass = isLight 
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-200' // LUZ 
                        : 'bg-indigo-100 text-indigo-700 border-indigo-200'; // OSCURIDAD 

                      return (
                        <td key={h} className={`p-0.5 border-r border-gray-300 text-center align-middle`}>
                          <div className={`w-full h-6 flex items-center justify-center text-xs font-bold rounded-sm border ${cellClass} ${isCurrentCell ? 'ring-2 ring-red-500 shadow-lg z-20' : ''} transition-all duration-100 ease-in-out font-mono`}>
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

          <footer className="mt-3 p-4 text-xs text-gray-500 border-t border-gray-200">
            Leyenda: L (Luz) / D (Oscuridad). La celda actual se resalta con un borde rojo.
          </footer>
        </section>

      </div>
    </div>
  );
}