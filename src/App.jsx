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
    const diffMs = now.getTime() - startDateObj.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.floor(diffDays);
  }, [now, startDateObj]);

  // Ahorro de Horas de Luz
  const lightSaving = useMemo(() => {
    const daysElapsed = Math.max(0, daysSinceStart);
    const standardLightHours = 12; 
    
    const savingPerHour = standardLightHours - Number(hoursLight); 
    const totalSaving = savingPerHour * daysElapsed;

    return {
      savingPerHour: savingPerHour,
      totalSaving: totalSaving,
      comparison: savingPerHour === 0 ? 'Igual' : (savingPerHour > 0 ? 'Ahorro' : 'Gasto')
    };
  }, [daysSinceStart, hoursLight]);


  // Horarios de Luz/Oscuridad del Día Actual
  const lightScheduleToday = useMemo(() => {
    // Horas absolutas desde el inicio (en el punto de inicio del día actual)
    const currentDayStartHoursSinceStart = currentDayIndex * 24 - fractionalStartOffset;
    
    let lightStartHour = -1;
    let darkStartHour = -1;
    
    // Iteramos a través de las 24 horas del día actual (0 a 23)
    for (let h = 0; h < 24; h++) {
      const hoursAbsolute = currentDayStartHoursSinceStart + h;
      const isLight = isLightAtAbsoluteHours(hoursAbsolute);
      const isPrevLight = isLightAtAbsoluteHours(hoursAbsolute - 1);

      // El ciclo cambia a luz (L -> D)
      if (isLight && !isPrevLight && lightStartHour === -1) lightStartHour = h;
      // El ciclo cambia a oscuridad (D -> L)
      if (!isLight && isPrevLight && darkStartHour === -1) darkStartHour = h;
    }

    // NUEVO FORMATO: Convertir hora militar a AM/PM
    const formatHour = (h) => {
        const militaryHour = Math.round(h % 24);
        const date = new Date();
        date.setHours(militaryHour, 0, 0, 0); // Establece la hora militar
        // Usa toLocaleTimeString para obtener el formato AM/PM
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    
    // Casos extremos
    if (Number(hoursLight) === 0) return { status: 'Oscuridad total (24D)', isLight: false, lightStart: 'N/A', lightEnd: 'N/A', darkStart: formatHour(0), darkEnd: formatHour(24) };
    if (Number(hoursDark) === 0) return { status: 'Luz total (24L)', isLight: true, lightStart: formatHour(0), lightEnd: formatHour(24), darkStart: 'N/A', darkEnd: 'N/A' };


    let ls = 'N/A';
    let le = 'N/A';
    let ds = 'N/A';
    let de = 'N/A';

    // Cálculo de inicio/fin de luz
    if (lightStartHour !== -1) {
        ls = formatHour(lightStartHour);
        le = formatHour(lightStartHour + Number(hoursLight));
    } else {
        // La luz comenzó en el día anterior
        if (darkStartHour !== -1) {
             le = formatHour(darkStartHour);
             ls = formatHour(darkStartHour - Number(hoursLight));
        }
    }
    
    // Cálculo de inicio/fin de oscuridad
    if (darkStartHour !== -1) {
        ds = formatHour(darkStartHour);
        de = formatHour(darkStartHour + Number(hoursDark));
    } else {
        // La oscuridad comenzó en el día anterior
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
    
    // Formato AM/PM para el próximo cambio
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

  // Se eliminó handleImport y el input de Importar JSON

  function resetDefaults() {
    const d = new Date(); d.setHours(0,0,0,0);
    setStartDate(d.toISOString().slice(0,16));
    setHoursLight(13); setHoursDark(14); setDurationDays(60);
  }

  // =================================================================
  // === CLASES TAILWIND CSS MEJORADAS (Estética Final) ==============
  // =================================================================

  const PRIMARY_COLOR = 'indigo'; 
  const ACCENT_COLOR = 'teal'; 

  const INPUT_CLASS = `w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-800 
                       focus:ring-2 focus:ring-${PRIMARY_COLOR}-500 focus:border-${PRIMARY_COLOR}-500 
                       transition duration-200 ease-in-out shadow-sm`;
  
  const BUTTON_BASE_CLASS = "px-5 py-2.5 rounded-full font-semibold shadow-md transition duration-200 ease-in-out text-sm";
  
  const PRIMARY_BUTTON_CLASS = `${BUTTON_BASE_CLASS} bg-${PRIMARY_COLOR}-600 text-white hover:bg-${PRIMARY_COLOR}-700 
                                shadow-${PRIMARY_COLOR}-500/50`;
  
  const SECONDARY_BUTTON_CLASS = `${BUTTON_BASE_CLASS} bg-${ACCENT_COLOR}-500 text-white hover:bg-${ACCENT_COLOR}-600 
                                  shadow-${ACCENT_COLOR}-500/50`;
  
  const TERTIARY_BUTTON_CLASS = `${BUTTON_BASE_CLASS} bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-none border border-gray-200`;
  
  const CARD_CLASS = "p-7 bg-white rounded-3xl shadow-2xl shadow-gray-200/50 transition duration-500 hover:shadow-3xl";

  // Función de formato para la fecha de inicio
  const formatStartDate = (dateObj) => {
    // También se cambia a AM/PM aquí
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return (
    // Fondo más profesional y fuente estándar
    <div className="min-h-screen bg-gray-100 text-gray-800 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className={`text-5xl font-extrabold text-${PRIMARY_COLOR}-700 tracking-tight`}>
            Fotoperiodo 💡
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Gestión de ciclos de luz/oscuridad y eficiencia de cultivo.
          </p>
        </header>

        <section className="grid lg:grid-cols-3 gap-8 mb-10">
          
          {/* Configuración */}
          <div className={`${CARD_CLASS} lg:col-span-2`}>
            <h2 className={`text-2xl font-bold mb-5 border-b pb-3 text-${PRIMARY_COLOR}-600`}>
              Configuración del Ciclo
            </h2>
            
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y hora de inicio
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={INPUT_CLASS}
            />

            <div className="grid sm:grid-cols-3 gap-5 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas luz (L)</label>
                <input type="number" min="0" step="0.5" value={hoursLight}
                  onChange={(e) => setHoursLight(clamp(Number(e.target.value), 0, 9999))}
                  className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas oscuridad (D)</label>
                <input type="number" min="0" step="0.5" value={hoursDark}
                  onChange={(e) => setHoursDark(clamp(Number(e.target.value), 0, 9999))}
                  className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duración (días)</label>
                <input type="number" min="1" max="9999" value={durationDays}
                  onChange={(e) => setDurationDays(clamp(Number(e.target.value), 1, 9999))}
                  className={INPUT_CLASS} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t border-gray-200">
              {/* Opción 'Importar JSON' Eliminada */}
              <button onClick={handleExport} className={PRIMARY_BUTTON_CLASS}>Exportar JSON</button>
              <button onClick={resetDefaults} className={TERTIARY_BUTTON_CLASS}>Restablecer Valores</button>
            </div>
          </div>

          {/* Estado actual y Ahorro */}
          <div className={CARD_CLASS}>
            <h2 className={`text-2xl font-bold mb-5 border-b pb-3 text-${PRIMARY_COLOR}-600`}>
              Estado Actual
            </h2>
            
            {/* Días transcurridos y fecha de inicio */}
            <div className="text-sm text-gray-700 mb-5 pb-3 border-b border-gray-100">
                <p className="font-semibold text-gray-900 mb-1">📅 Inicio: <span className="text-base text-indigo-700">{formatStartDate(startDateObj)}</span></p>
                <p className="font-semibold text-gray-900 flex items-center mt-2">
                    🌱 Días de Cultivo: 
                    <span className="text-4xl font-extrabold text-indigo-600 ml-2 leading-none">
                        {Math.max(0, daysSinceStart)}
                    </span>
                </p>
            </div>
            
            <div className="text-sm text-gray-700 space-y-3">
              <p className="font-medium">
                ⏰ **Ahora:** <span className="text-gray-900 font-normal">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              </p>
              
              <div className="flex justify-between items-center p-2 rounded-lg border border-gray-100 bg-gray-50">
                  <span className="font-medium">Estado:</span>
                  <span className={`ml-2 px-3 py-1 rounded-full text-xs font-bold ${isNowLight ? 'bg-green-100 text-green-700 ring-1 ring-green-400' : 'bg-pink-100 text-pink-700 ring-1 ring-pink-400'}`}>
                    {isNowLight ? 'LUZ' : 'OSCURIDAD'}
                  </span>
              </div>
              
              {/* Progreso (Próximo Cambio) */}
              <div className="font-semibold p-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50">
                  <p className="text-xs text-indigo-700 mb-1">Próximo Cambio ({nextChangeEvent.action}):</p>
                  <span className="text-indigo-900 text-lg font-bold">
                    {nextChangeEvent.time}
                  </span>
                  <span className="text-indigo-700 text-sm ml-1">
                    del {nextChangeEvent.date}
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                     (En {nextChangeEvent.hoursToNextChange.toFixed(2)} horas)
                  </p>
              </div>

              {/* Horarios del Día Actual (AHORA EN AM/PM) */}
              <div className="pt-3 border-t border-gray-100">
                <h3 className="font-bold text-gray-900 mb-2">Horario de Hoy:</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>☀️ LUZ: <strong className="text-green-600">{lightScheduleToday.lightStart}</strong> a <strong className="text-green-600">{lightScheduleToday.lightEnd}</strong></div>
                  <div>🌑 OSCURIDAD: <strong className="text-pink-600">{lightScheduleToday.darkStart}</strong> a <strong className="text-pink-600">{lightScheduleToday.darkEnd}</strong></div>
                </div>
                {lightScheduleToday.status && <p className="text-xs text-red-500 mt-1">*{lightScheduleToday.status}</p>}
              </div>

            </div>

            {/* SECCIÓN DE AHORRO */}
            <div className="mt-6 pt-5 border-t border-gray-200">
              <h3 className={`text-xl font-bold text-${ACCENT_COLOR}-600 mb-2`}>Eficiencia (vs 12L/12D)</h3>
              
              <div className="text-sm space-y-2">
                
                <p>
                  **Diferencia diaria:**
                  <span className={`ml-2 px-2 py-0.5 rounded-md font-bold text-xs ${lightSaving.savingPerHour > 0 ? 'bg-green-100 text-green-800' : (lightSaving.savingPerHour < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800')}`}>
                    {Math.abs(lightSaving.savingPerHour).toFixed(1)} {lightSaving.comparison === 'Ahorro' ? 'horas menos' : (lightSaving.comparison === 'Gasto' ? 'horas más' : 'horas')}
                  </span>
                </p>

                <div className="p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
                  <p className="text-sm font-medium">Balance Total:</p>
                  <p className="text-2xl font-extrabold mt-1">
                    <span className={`${lightSaving.comparison === 'Ahorro' ? 'text-green-700' : (lightSaving.comparison === 'Gasto' ? 'text-red-700' : 'text-gray-700')}`}>
                      {lightSaving.totalSaving > 0 ? '+' : ''}{lightSaving.totalSaving.toFixed(1)}
                    </span> 
                    <span className="text-base text-gray-500 font-normal ml-1">hrs ahorradas</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Calendario */}
        <section className={CARD_CLASS + " p-0"}>
          <div className={`flex items-center justify-between p-5 border-b border-gray-200`}>
            <h2 className={`text-2xl font-bold text-${PRIMARY_COLOR}-600`}>
              Visualización Calendario (Día × Hora)
            </h2>
            <div className="text-sm text-gray-600">
              Duración: **{durationDays} días**
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 border-r text-left w-20 text-xs font-semibold uppercase tracking-wider text-gray-600 sticky left-0 bg-gray-50">Día</th>
                  {/* Se mantiene el formato de 24h en la tabla para coherencia con la columna de hora */}
                  {Array.from({length:24}).map((_,h) => (
                    <th key={h} className="p-3 border-r text-center text-xs font-semibold uppercase tracking-wider text-gray-600">{h}h</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calendar.map((row, d) => (
                  <tr key={d} className={`transition duration-100 ${d === currentDayIndex ? 'bg-indigo-50 shadow-inner' : 'hover:bg-gray-50'}`}>
                    <td className="p-3 border-r text-xs font-bold text-gray-900 sticky left-0 bg-white z-10">{d+1}</td>
                    {row.map((isLight, h) => {
                      const isCurrentCell = d === currentDayIndex && h === currentHourIndex;
                      const cellClass = isLight 
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-200' // LUZ (Amarillo más vivo)
                        : 'bg-blue-100 text-blue-800 border-blue-200'; // OSCURIDAD (Azul oscuro para noche)

                      return (
                        <td key={h} className={`p-0.5 border-r text-center align-middle`}>
                          <div className={`w-full h-8 flex items-center justify-center text-xs font-bold rounded-sm border ${cellClass} ${isCurrentCell ? 'ring-2 ring-red-500 scale-105 shadow-lg z-20' : ''} transition-all duration-100 ease-in-out`}>
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

          <footer className="mt-3 p-5 text-xs text-gray-500 border-t border-gray-200">
            **Nota:** Las celdas en **Amarillo** representan Luz (L), y las celdas en **Azul** representan Oscuridad (D). La celda actual está marcada con un borde rojo.
          </footer>
        </section>

      </div>
    </div>
  );
}