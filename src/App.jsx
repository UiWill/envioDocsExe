import React, { useState } from 'react';
import Login from './components/Login';
import Explorer from './components/Explorer';
import './styles/App.css';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">📄</div>
          <h1>EnvioDocs</h1>
        </div>
      </header>
      
      <main className="app-content">
        {!user ? (
          <Login onLogin={handleLogin} />
        ) : (
          <Explorer user={user} />
        )}
      </main>
      
      <footer className="app-footer">
        <p>&copy; 2025 EnvioDocs - Sistema de Processamento de Documentos</p>
      </footer>
    </div>
  );
};

export default App; 