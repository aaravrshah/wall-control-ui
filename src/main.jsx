import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ExperimentProvider } from './context/ExperimentContext';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ExperimentProvider>
        <App />
      </ExperimentProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
