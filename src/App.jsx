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

*/

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
        if (obj.hoursLight !== undefined) setHoursLight(obj.hoursLight);
        if (obj.hoursDark !== undefined) setHoursDark(obj.hoursDark);
        if (obj.durationDays !== undefined) setDurationDays(obj.durationDays);
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
        const hoursSinceStart = d * 24 + h - (fractionalStartOffset - 0); // we subtract fractionalStartOffset to consider start at given time
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

  // export / import
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">Fotoperiodo — Prototipo</h1>
          <p className="text-sm text-slate-600">Fotoperiodo totalmente personalizable y guardado localmente.</p>
        </header>

        <section className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-white rounded shadow">
            <h2 className="font-semibold mb-2">Configuración</h2>
            <label className="block text-sm">Fecha y hora de inicio</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 border rounded my-2"
            />

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm">Horas luz</label>
                <input type="number" min="0" step="0.5" value={hoursLight}
                  onChange={(e) => setHoursLight(clamp(Number(e.target.value), 0, 9999))}
                  className="w-full p-2 border rounded my-2" />
              </div>
              <div className="flex-1">
                <label className="block text-sm">Horas oscuridad</label>
                <input type="number" min="0" step="0.5" value={hoursDark}
                  onChange={(e) => setHoursDark(clamp(Number(e.target.value), 0, 9999))}
                  className="w-full p-2 border rounded my-2" />
              </div>
            </div>

            <label className="block text-sm">Duración (días)</label>
            <input type="number" min="1" max="9999" value={durationDays}
              onChange={(e) => setDurationDays(clamp(Number(e.target.value), 1, 9999))}
              className="w-full p-2 border rounded my-2" />

            <div className="flex gap-2 mt-2">
              <button onClick={handleExport} className="px-3 py-2 bg-blue-600 text-white rounded">Exportar JSON</button>
              <label className="px-3 py-2 bg-emerald-600 text-white rounded cursor-pointer">
                Importar JSON
                <input type="file" accept="application/json" onChange={(e) => handleImport(e.target.files?.[0])} className="hidden" />
              </label>
              <button onClick={resetDefaults} className="px-3 py-2 bg-gray-200 rounded">Reset</button>
            </div>
          </div>

          <div className="p-4 bg-white rounded shadow">
            <h2 className="font-semibold mb-2">Estado actual</h2>
            <div className="text-sm text-slate-700 mb-2">
              <div>Ahora: {now.toLocaleString()}</div>
              <div>Inicio: {startDateObj.toLocaleString()}</div>
              <div>Longitud ciclo: <strong>{cycleLength}</strong> horas ({hoursLight}L / {hoursDark}D)</div>
              <div>Horas desde inicio: <strong>{hoursSinceStartNow.toFixed(2)}</strong></div>
              <div>Día actual (índice): <strong>{currentDayIndex}</strong></div>
              <div>Hora actual del día (índice): <strong>{currentHourIndex}</strong></div>
              <div className="mt-2">Estado actual del ciclo: <span className={`px-2 py-1 rounded ${isNowLight ? 'bg-green-200 text-green-800' : 'bg-pink-200 text-pink-800'}`}>{isNowLight ? 'LUZ' : 'OSCURIDAD'}</span></div>
            </div>

            <div className="mt-3">
              <label className="text-sm">Progreso dentro del ciclo</label>
              <div className="w-full bg-slate-200 rounded h-3 mt-1">
                <div className="h-3 rounded" style={{ width: `${(currentInCycle / cycleLength) * 100}%`, background: isNowLight ? '#16a34a' : '#ec4899' }} />
              </div>
              <div className="text-xs text-slate-500 mt-1">{currentInCycle.toFixed(2)} / {cycleLength} horas</div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Calendario (día × hora)</h2>
            <div className="text-sm text-slate-600">Ver: {durationDays} días</div>
          </div>

          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="sticky top-0 bg-white">
                  <th className="p-1 border text-left w-16">Día</th>
                  {Array.from({length:24}).map((_,h) => (
                    <th key={h} className="p-1 border text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendar.map((row, d) => (
                  <tr key={d} className={`${d === currentDayIndex ? 'ring-2 ring-blue-200' : ''}`}>
                    <td className="p-1 border text-xs">{d+1}</td>
                    {row.map((isLight, h) => {
                      const isCurrentCell = d === currentDayIndex && h === currentHourIndex;
                      return (
                        <td key={h} className={`p-0.5 border text-center align-middle`}>
                          <div className={`w-full h-6 flex items-center justify-center text-xs ${isLight ? 'bg-green-200 text-green-900' : 'bg-pink-200 text-pink-900'} ${isCurrentCell ? 'ring-2 ring-black' : ''}`}>
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

          <footer className="mt-3 text-xs text-slate-500">Tip: cambialo a 18/6 para crecimiento o 12/12 para floración. Guardado local automático.</footer>
        </section>

      </div>
    </div>
  );
}
