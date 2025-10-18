/**
 * App.jsx — Versión Final con claridad de fuentes mejorada
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sun, Moon, Download, Upload, RefreshCw } from "lucide-react";
import html2canvas from "html2canvas";

const STORAGE_KEY = "fotoperiodo_settings_v1";
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function safeParseJSON(str, fallback) { try { return JSON.parse(str); } catch { return fallback; } }
function fmtDateTimeLocal(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function App() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return fmtDateTimeLocal(d);
  });
  const [hoursLight, setHoursLight] = useState(13);
  const [hoursDark, setHoursDark] = useState(14);
  const [durationDays, setDurationDays] = useState(60);
  const [now, setNow] = useState(new Date());
  const [errorMsg, setErrorMsg] = useState("");
  const calendarRef = useRef(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = safeParseJSON(raw, null);
    if (!obj) return;
    if (obj.startDate) setStartDate(String(obj.startDate));
    if (obj.hoursLight) setHoursLight(Number(obj.hoursLight));
    if (obj.hoursDark) setHoursDark(Number(obj.hoursDark));
    if (obj.durationDays) setDurationDays(Number(obj.durationDays));
  }, []);

  useEffect(() => {
    const payload = { startDate, hoursLight, hoursDark, durationDays };
    const id = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)), 300);
    return () => clearTimeout(id);
  }, [startDate, hoursLight, hoursDark, durationDays]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const startDateObj = useMemo(() => new Date(startDate), [startDate]);
  const cycleLength = useMemo(() => hoursLight + hoursDark, [hoursLight, hoursDark]);
  const hoursSinceStartNow = (now - startDateObj) / 3600000;
  const currentInCycle = ((hoursSinceStartNow % cycleLength) + cycleLength) % cycleLength;
  const isNowLight = currentInCycle < hoursLight;
  const currentDayIndex24h = Math.floor((now - startDateObj) / (1000 * 60 * 60 * 24));
  const currentHourIndex = now.getHours();
  const customCycleDayIndex = Math.floor(hoursSinceStartNow / cycleLength);

  function isLightAt(hoursSinceStart) {
    const c = ((hoursSinceStart % cycleLength) + cycleLength) % cycleLength;
    return c < hoursLight;
  }

  const calendar = useMemo(() => {
    const rows = [];
    const start = new Date(startDateObj);
    start.setHours(0, 0, 0, 0);
    for (let d = 0; d < durationDays; d++) {
      const row = [];
      for (let h = 0; h < 24; h++) {
        const hoursSinceStart = d * 24 + h;
        row.push({ isLight: isLightAt(hoursSinceStart) });
      }
      rows.push(row);
    }
    return rows;
  }, [startDateObj, hoursLight, hoursDark, durationDays]);

  const downloadCalendarImage = useCallback(async (format = "png") => {
    if (!calendarRef.current) return;
    const canvas = await html2canvas(calendarRef.current, { scale: 2, backgroundColor: null });
    const dataUrl = canvas.toDataURL(`image/${format}`);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `fotoperiodo_calendar.${format}`;
    a.click();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

        :root {
          --accent-indigo: #4f46e5;
          --accent-pink: #f472b6;
          --superciclo-red: #ef4444;
          --highlight-now: rgba(244,114,182,0.95);
        }

        body, .font-inter {
          font-family: 'Inter', system-ui, sans-serif;
          color: #f3f4f6; /* texto claro general */
        }

        @media (prefers-color-scheme: light) {
          body, .font-inter { color: #0f172a; }
        }

        input, label, th, td, p, h1, h2, h3, h4, h5, h6 {
          color: inherit !important;
        }

        input::placeholder {
          color: rgba(255,255,255,0.6);
        }
        @media (prefers-color-scheme: light) {
          input::placeholder {
            color: rgba(0,0,0,0.55);
          }
        }

        input:focus {
          border: 1px solid var(--accent-indigo);
          box-shadow: 0 0 0 2px rgba(79,70,229,0.2);
          outline: none;
        }

        table td div {
          text-shadow: 0 0 4px rgba(255,255,255,0.3); /* claridad visual en calendario */
        }

        .now-cell {
          border: 2px solid var(--highlight-now);
          box-shadow: 0 0 12px var(--highlight-now);
        }
      `}</style>

      <div className="min-h-screen font-inter px-4 py-6" style={{ background: 'linear-gradient(180deg,#071029 0%,#081225 100%)' }}>
        <div className="max-w-6xl mx-auto rounded-2xl shadow-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <header className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <Sun className="text-yellow-300 w-8 h-8" />
              <h1 className="text-3xl font-bold" style={{ color: 'var(--accent-indigo)' }}>Fotoperiodo</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => downloadCalendarImage('png')} className="px-3 py-2 rounded-md text-sm font-bold" style={{ background: 'var(--accent-indigo)', color: '#fff' }}>Descargar PNG</button>
              <button onClick={() => downloadCalendarImage('jpeg')} className="px-3 py-2 rounded-md text-sm font-bold" style={{ background: 'var(--accent-pink)', color: '#111' }}>JPG</button>
            </div>
          </header>

          <main className="grid lg:grid-cols-3 gap-6">
            {/* Configuración */}
            <section className="p-4 rounded-xl bg-white/5">
              <h2 className="font-semibold mb-3 text-indigo-400">Configuración</h2>
              <label className="text-sm">Fecha y hora de inicio</label>
              <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full mb-3 p-2 rounded-md bg-transparent border border-white/10" />
              <label className="text-sm">Horas de luz</label>
              <input type="number" value={hoursLight} onChange={(e) => setHoursLight(Number(e.target.value))} className="w-full mb-3 p-2 rounded-md bg-transparent border border-white/10" />
              <label className="text-sm">Horas de oscuridad</label>
              <input type="number" value={hoursDark} onChange={(e) => setHoursDark(Number(e.target.value))} className="w-full mb-3 p-2 rounded-md bg-transparent border border-white/10" />
              <label className="text-sm">Duración (días)</label>
              <input type="number" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} className="w-full p-2 rounded-md bg-transparent border border-white/10" />
            </section>

            {/* Estado */}
            <aside className="p-4 rounded-xl bg-white/5 lg:col-span-1">
              <h3 className="font-semibold text-indigo-400 mb-3">Estado</h3>
              <p className="text-sm mb-2" style={{ color: "var(--superciclo-red)" }}>DÍAS SUPER CICLO</p>
              <p className="text-4xl font-extrabold mb-3" style={{ color: "var(--superciclo-red)" }}>{customCycleDayIndex}</p>
              <div className="inline-block px-3 py-1 rounded-full text-sm font-bold" style={{ background: isNowLight ? 'linear-gradient(90deg,#facc15,#f472b6)' : 'var(--accent-indigo)', color: isNowLight ? '#111' : '#fff' }}>
                {isNowLight ? 'ON 🔆' : 'OFF 🌙'}
              </div>
            </aside>

            {/* Calendario */}
            <section className="lg:col-span-3 p-4 rounded-xl bg-white/5">
              <div ref={calendarRef} className="overflow-x-auto">
                <table className="min-w-full text-xs border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="p-2 sticky left-0 bg-black/20">Día</th>
                      {Array.from({ length: 24 }).map((_, h) => (
                        <th key={h} className="p-2">{h}h</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calendar.map((row, d) => (
                      <tr key={d}>
                        <td className="p-1 sticky left-0 bg-black/20">{d + 1}</td>
                        {row.map((cell, h) => {
                          const isCurrent = d === currentDayIndex24h && h === currentHourIndex;
                          return (
                            <td key={h} className="p-0.5">
                              <div className={`h-7 rounded-sm flex items-center justify-center font-semibold ${isCurrent ? 'now-cell' : ''}`} style={{
                                background: cell.isLight ? 'linear-gradient(90deg,#f59e0b,#f472b6)' : 'linear-gradient(90deg,#4338ca,#3730a3)',
                                color: '#fff',
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
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
