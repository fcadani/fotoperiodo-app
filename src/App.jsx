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
- Si querés soporte de autenticación y sincronización, podés conectar Supabase/Firebase en la etapa 2.

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
  // === CÁLCULOS SOLICITADOS ========================================
  // =================================================================

  // Días transcurridos (Días de Cultivo)
  const daysSinceStart = useMemo(() => {
    const diffMs = now.getTime() - startDateObj.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.floor(diffDays);
  }, [now, startDateObj]);

  // 💡 NUEVO CÁLCULO: Ahorro de Horas de Luz
  const lightSaving = useMemo(() => {
    const daysElapsed = Math.max(0, daysSinceStart);
    const standardLightHours = 12; // Base: 12 horas de luz en un ciclo 12/12 (24h)
    
    // Ahorro/Gasto de horas de luz en comparación con 12h estándar
    const savingPerHour = standardLightHours - Number(hoursLight); 
    
    // El ahorro se aplica solo por cada ciclo de 24h
    // Usaremos el día de cultivo como referencia de 24h
    const totalSaving = savingPerHour * daysElapsed;

    return {
      savingPerHour: savingPerHour,
      totalSaving: totalSaving,
      comparison: savingPerHour === 0 ? 'Igual' : (savingPerHour > 0 ? 'Ahorro' : 'Gasto')
    };
  }, [daysSinceStart, hoursLight]);


  // Horarios de Luz/Oscuridad del Día Actual (Mantenido)
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

    const formatHour = (h) => (h % 24).toString().padStart(2, '0') + ':00';
    
    if (Number(hoursLight) === 0) return { status: 'Oscuridad total (24D)', isLight: false, lightStart: 'N/A', lightEnd: 'N/A', darkStart: '00:00', darkEnd: '24:00' };
    if (Number(hoursDark) === 0) return { status: 'Luz total (24L)', isLight: true, lightStart: '00:00', lightEnd: '24:00', darkStart: 'N/A', darkEnd: 'N/A' };


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

  // Próximo Cambio de Estado (Mantenido)
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
    const formattedTime = nextChangeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

  function handleImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        if (obj.startDate) setStartDate(obj.startDate);
        if (obj.hoursLight !== undefined) setHoursLight(Number(obj.hoursLight));
        if (obj.hoursDark !== undefined) setHoursDark(Number(obj.hoursDark));
        if (obj.durationDays !== undefined) setDurationDays(Number(obj.durationDays));
      } catch (err) {
        alert("Archivo inválido: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function resetDefaults() {
    const d = new Date(); d.setHours(0,0,0,0);
    setStartDate(d.toISOString().slice(0,16));
    setHoursLight(13); setHoursDark(14); setDurationDays(60);
  }

  // =================================================================
  // === CLASES TAILWIND CSS (Mantenidas) ============================
  // =================================================================

  const INPUT_CLASS = "w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out my-2";
  const BUTTON_BASE_CLASS = "px-4 py-2 rounded-lg font-medium shadow-md transition duration-200 ease-in-out";
  const PRIMARY_BUTTON_CLASS = `${BUTTON_BASE_CLASS} bg-indigo-600 text-white hover:bg-indigo-700`;
  const SECONDARY_BUTTON_CLASS = `${BUTTON_BASE_CLASS} bg-emerald-500 text-white hover:bg-emerald-600`;
  const TERTIARY_BUTTON_CLASS = `${BUTTON_BASE_CLASS} bg-gray-100 text-gray-700 hover:bg-gray-200`;
  const CARD_CLASS = "p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition duration-300";

  // Función de formato para la fecha de inicio
  const formatStartDate = (dateObj) => {
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-extrabold text-indigo-700 tracking-tight">Fotoperiodo 💡</h1>
          <p className="text-md text-gray-500 mt-1">Configuración de ciclos de luz/oscuridad para cultivos, con visualización de calendario.</p>
        </header>

        <section className="grid lg:grid-cols-3 gap-6 mb-8">
          
          {/* Configuración */}
          <div className={`${CARD_CLASS} lg:col-span-2`}>
            <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-indigo-600">Configuración del Ciclo</h2>
            
            <label className="block text-sm font-medium text-gray-700">Fecha y hora de inicio</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={INPUT_CLASS}
            />

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Horas luz (L)</label>
                <input type="number" min="0" step="0.5" value={hoursLight}
                  onChange={(e) => setHoursLight(clamp(Number(e.target.value), 0, 9999))}
                  className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Horas oscuridad (D)</label>
                <input type="number" min="0" step="0.5" value={hoursDark}
                  onChange={(e) => setHoursDark(clamp(Number(e.target.value), 0, 9999))}
                  className={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Duración (días)</label>
                <input type="number" min="1" max="9999" value={durationDays}
                  onChange={(e) => setDurationDays(clamp(Number(e.target.value), 1, 9999))}
                  className={INPUT_CLASS} />
              </div>
            </div>

            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button onClick={handleExport} className={PRIMARY_BUTTON_CLASS}>Exportar JSON</button>
              <label className={SECONDARY_BUTTON_CLASS + " cursor-pointer"}>
                Importar JSON
                <input type="file" accept="application/json" onChange={(e) => handleImport(e.target.files?.[0])} className="hidden" />
              </label>
              <button onClick={resetDefaults} className={TERTIARY_BUTTON_CLASS}>Restablecer</button>
            </div>
          </div>

          {/* Estado actual */}
          <div className={CARD_CLASS}>
            <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-indigo-600">Estado Actual 🕒</h2>
            
            {/* Días transcurridos y fecha de inicio */}
            <div className="text-md text-gray-700 mb-4">
                <p className="font-semibold text-gray-900 mb-1">📅 Inicio de Cultivo: <span className="text-indigo-700">{formatStartDate(startDateObj)}</span></p>
                <p className="font-semibold text-gray-900">🌱 Días de Cultivo (transcurridos): <span className="text-3xl font-extrabold text-indigo-600 ml-2">{Math.max(0, daysSinceStart)}</span></p>
            </div>
            
            <div className="text-sm text-gray-700 space-y-1 border-t pt-3">
              <div>⏰ **Ahora:** {now.toLocaleString()}</div>
              
              <div className="mt-2">🔄 **Longitud ciclo:** <strong className="text-indigo-700">{cycleLength}</strong> horas ({hoursLight}L / {hoursDark}D)</div>
              
              <div>📅 **Día actual (Cultivo):** <strong className="text-indigo-700">{currentDayIndex + 1}</strong> (Índice: {currentDayIndex})</div>
              <div>🕰️ **Hora actual del día:** <strong className="text-indigo-700">{currentHourIndex}:00</strong></div>
              
              <div className="mt-3 pt-3 border-t">
                <span className="font-semibold">Estado actual:</span>
                <span className={`ml-2 px-3 py-1 rounded-full text-xs font-bold shadow-md ${isNowLight ? 'bg-green-100 text-green-700 ring-1 ring-green-400' : 'bg-pink-100 text-pink-700 ring-1 ring-pink-400'}`}>
                  {isNowLight ? 'LUZ' : 'OSCURIDAD'}
                </span>
              </div>
              
              {/* HORARIOS DEL DÍA ACTUAL */}
              <h3 className="font-semibold text-gray-900 mt-4 pt-2 border-t">Horario del Día Calendario:</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>☀️ **LUZ:** <strong className="text-green-600">{lightScheduleToday.lightStart}</strong> a <strong className="text-green-600">{lightScheduleToday.lightEnd}</strong></div>
                <div>🌑 **OSCURIDAD:** <strong className="text-pink-600">{lightScheduleToday.darkStart}</strong> a <strong className="text-pink-600">{lightScheduleToday.darkEnd}</strong></div>
              </div>
              {lightScheduleToday.status && <p className="text-xs text-red-500 mt-1">*{lightScheduleToday.status}</p>}


            </div>

            {/* Progreso dentro del ciclo */}
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">Progreso dentro del ciclo</label>
              
              <div className="w-full bg-gray-200 rounded-full h-3 mt-2 overflow-hidden">
                <div className="h-3 rounded-full" style={{ width: `${(currentInCycle / cycleLength) * 100}%`, background: isNowLight ? '#10b981' : '#f43f5e' }} />
              </div>
              <div className="text-xs text-gray-500 mt-1 text-right">{currentInCycle.toFixed(2)} / {cycleLength} horas</div>

              <div className="text-sm font-semibold mt-3 p-2 bg-indigo-50 rounded-lg border border-indigo-200">
                  El próximo cambio es a **{nextChangeEvent.nextState.toUpperCase()}** ({nextChangeEvent.action}):
                  <br/>
                  <span className="text-indigo-700 text-base font-bold ml-1">{nextChangeEvent.time}</span> del <span className="text-indigo-700 text-base font-bold">{nextChangeEvent.date}</span>
                  <span className="text-xs text-gray-500 ml-2"> (en {nextChangeEvent.hoursToNextChange.toFixed(2)} hrs)</span>
              </div>

            </div>
            
            {/* NUEVA SECCIÓN DE AHORRO */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-xl font-semibold text-green-600 mb-2">Eficiencia del Cultivo</h3>
              
              <div className="text-sm space-y-2">
                
                <p>
                  **Comparación vs 12L/12D:**
                  <span className={`ml-2 px-2 py-0.5 rounded-md font-bold ${lightSaving.savingPerHour > 0 ? 'bg-yellow-100 text-yellow-800' : (lightSaving.savingPerHour < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800')}`}>
                    {Math.abs(lightSaving.savingPerHour).toFixed(1)} {lightSaving.comparison === 'Ahorro' ? 'horas menos' : (lightSaving.comparison === 'Gasto' ? 'horas más' : 'horas')} de luz por día
                  </span>
                </p>

                <p className="text-lg font-bold">
                  {lightSaving.comparison === 'Ahorro' ? '🟢 Ahorro Total:' : (lightSaving.comparison === 'Gasto' ? '🔴 Gasto Total:' : '🟡 Balance Total:')}
                  <span className={`ml-2 text-2xl font-extrabold ${lightSaving.comparison === 'Ahorro' ? 'text-green-700' : (lightSaving.comparison === 'Gasto' ? 'text-red-700' : 'text-gray-700')}`}>
                    {Math.abs(lightSaving.totalSaving).toFixed(1)} hrs
                  </span>
                </p>
                <p className="text-xs text-gray-500 pt-1">
                    *El cálculo se basa en el ciclo personalizado vs el ciclo común de 12L/12D, multiplicado por los días de cultivo transcurridos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Calendario */}
        <section className={CARD_CLASS + " p-0"}>
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold text-indigo-600">Visualización Calendario (Día × Hora)</h2>
            <div className="text-sm text-gray-500">Mostrando: **{durationDays} días**</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="p-2 border-r text-left w-20 text-xs font-semibold uppercase tracking-wider text-gray-600">Día</th>
                  {Array.from({length:24}).map((_,h) => (
                    <th key={h} className="p-2 border-r text-center text-xs font-semibold uppercase tracking-wider text-gray-600">{h}h</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calendar.map((row, d) => (
                  <tr key={d} className={`transition duration-100 ${d === currentDayIndex ? 'bg-indigo-50 shadow-inner' : 'hover:bg-gray-50'}`}>
                    <td className="p-2 border-r text-xs font-medium text-gray-900 sticky left-0 bg-white z-10">{d+1}</td>
                    {row.map((isLight, h) => {
                      const isCurrentCell = d === currentDayIndex && h === currentHourIndex;
                      const cellClass = isLight 
                        ? 'bg-green-100 text-green-800' // LUZ
                        : 'bg-pink-100 text-pink-800'; // OSCURIDAD

                      return (
                        <td key={h} className={`p-0.5 border-r text-center align-middle`}>
                          <div className={`w-full h-8 flex items-center justify-center text-xs font-bold rounded-sm ${cellClass} ${isCurrentCell ? 'ring-2 ring-indigo-500 scale-105 shadow-lg' : ''} transition-all duration-100 ease-in-out`}>
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

          <footer className="mt-3 p-4 text-xs text-gray-500 border-t">
            **Sugerencias:** Cambia a **18/6** para crecimiento o **12/12** para floración. La configuración se guarda automáticamente en tu navegador.
          </footer>
        </section>

      </div>
    </div>
  );
}