import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import Server from './components/Server/Server';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Server />
  </React.StrictMode>
);
