import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' // Importación CLAVE del CSS de Tailwind
import App from './App.jsx' // O './fotoperiodo_app.jsx' si ese es el nombre del archivo

// Asegúrate de que este 'root' existe en tu index.html
const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    {/* Aquí es donde se carga el componente principal */}
    <App /> 
  </React.StrictMode>
);


