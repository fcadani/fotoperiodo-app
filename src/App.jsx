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
    const d = new Date();
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,16);
  });

  const [hoursLight, setHoursLight] = useState(13);
  const [hoursDark, setHoursDark] = useState(14);
  const [durationDays, setDurationDays] = useState(60);
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

  const daysSinceStart = useMemo(() => {
    const constDiffMs = now.getTime() - startDateObj.getTime();
    const diffDays = constDiffMs / (1000 * 60 * 60 * 24);
    return Math.floor(diffDays);
  }, [now, startDateObj]);

  const lightSaving = useMemo(() => {
    const daysElapsed = Math.max(0, daysSinceStart);
    const standardLightHours = 12; 
    const savingPerHour = standardLightHours - Number(hoursLight); 
    const totalSaving = savingPerHour * daysElapsed;

    return { totalSaving: totalSaving };
  }, [daysSinceStart, hoursLight]);


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
  // === CLASES TAILWIND CSS (ALTO CONTRASTE / SIN BORDES) ============
  // =================================================================

  const PRIMARY_COLOR = 'blue'; 
  const ACCENT_COLOR = 'green';  

  // Input: Sin fondo, solo borde inferior gris claro y focus azul.
  const INPUT_CLASS = `w-full p-2.5 border-b border-gray-300 rounded-none bg-white text-gray-800 
                       focus:ring-0 focus:border-b-2 focus:border-${PRIMARY_COLOR}-500 transition duration-200 shadow-none text-base`;
  
  // Tarjeta: Sin bordes, sin sombras, fondo blanco.
  const CARD_CLASS = `p-6 bg-white transition duration-300`;

  // Títulos: Gruesos, alto contraste, solo borde inferior sutil.
  const TITLE_CLASS = `text-2xl font-extrabold mb-4 pb-3 border-b border-gray-200 text-gray-900`;


  const formatStartDate = (dateObj) => {
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return (
    // Fondo blanco puro. Flex para centrar verticalmente si el contenido es corto.
    <div className="min-h-screen bg-white text-gray-900 font-sans flex justify-center w-full">
      
      {/* Contenedor principal: Centrado, ancho fijo (simula tarjeta de app) */}
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
              Configuración del Ciclo
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
                    Días de Cultivo: 
                    <span className={`text-4xl font-extrabold font-mono text-${PRIMARY_COLOR}-600 ml-2 leading-none`}>
                        {Math.max(0, daysSinceStart)}
                    </span>
                </p>
            </div>
            
            <div className="text-sm text-gray-600 space-y-4">
              <p className="font-mono text-sm flex justify-between items-center pb-2 border-b border-gray-200">
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
                     (Tiempo restante: {nextChangeEvent.hoursToNextChange.toFixed(2)} hrs)
                  </p>
              </div>

              {/* Horarios del Día Actual */}
              <div className="pt-2">
                <h3 className="font-bold text-gray-800 text-sm mb-2">Horario de Hoy:</h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div><span className="text-green-600">LUZ:</span> <strong className="text-gray-900">{lightScheduleToday.lightStart}</strong> a <strong className="text-gray-900">{lightScheduleToday.lightEnd}</strong></div>
                  <div><span className="text-indigo-600">OSCURIDAD:</span> <strong className="text-gray-900">{lightScheduleToday.darkStart}</strong> a <strong className="text-gray-900">{lightScheduleToday.darkEnd}</strong></div>
                </div>
                {lightScheduleToday.status && <p className="text-xs text-red-500 mt-1">*{lightScheduleToday.status}</p>}
              </div>

            </div>

            {/* SECCIÓN DE AHORRO */}
            <div className="mt-6 pt-5 border-t border-gray-200">
              <h3 className={`text-sm font-bold text-gray-800 mb-2`}>Balance Energético (vs 12L/12D)</h3>
              
              <div className="p-3 bg-gray-50">
                <p className="text-xs font-medium text-gray-500">Total de Horas Luz Ahorradas:</p>
                <p className="text-3xl font-extrabold mt-1 font-mono">
                    <span className={`${lightSaving.totalSaving > 0 ? `text-${ACCENT_COLOR}-600` : (lightSaving.totalSaving < 0 ? 'text-red-600' : 'text-gray-500')}`}>
                        {lightSaving.totalSaving > 0 ? '+' : ''}{lightSaving.totalSaving.toFixed(1)} 
                    </span>
                    <span className="text-base text-gray-500 font-normal ml-1">horas</span>
                </p>
                
                <p className="text-xs text-gray-600 mt-2">
                    {lightSaving.totalSaving > 0 
                        ? 'Ahorro (Menos horas que el ciclo estándar).'
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
        <section className={`${CARD_CLASS} p-0 overflow-hidden`}>
          <div className={`flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50`}>
            <h2 className={`text-xl font-bold text-gray-800`}>
              Visualización por Ciclos (Día × Hora)
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