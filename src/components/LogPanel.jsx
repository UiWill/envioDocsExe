import React, { useState } from 'react';
import '../styles/LogPanel.css';

const LogPanel = ({ logs, onRetryFile, onEditFile }) => {
  const [filter, setFilter] = useState('all');
  
  // Filtra logs por tipo
  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.type === filter;
  });
  
  // Formata a data para exibição
  const formatDate = (date) => {
    if (!date) return '';
    
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const handleLogAction = (log) => {
    if (log.type === 'warning' && log.fileData && onEditFile) {
      // Log de warning (precisa de preenchimento manual)
      onEditFile(log.fileData);
    } else if (log.type === 'error' && log.fileName && onRetryFile) {
      // Log de erro (tentar novamente)
      onRetryFile(log.fileName);
    }
  };

  const getActionText = (log) => {
    if (log.type === 'warning' && log.fileData) {
      return 'Corrigir Manualmente';
    } else if (log.type === 'error' && log.fileName) {
      return 'Tentar Novamente';
    }
    return null;
  };

  return (
    <div className="log-panel">
      <div className="log-header">
        <h3>Painel de Logs</h3>
        <div className="log-filters">
          <button 
            className={`filter-button ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          <button 
            className={`filter-button ${filter === 'info' ? 'active' : ''}`}
            onClick={() => setFilter('info')}
          >
            Info
          </button>
          <button 
            className={`filter-button ${filter === 'success' ? 'active' : ''}`}
            onClick={() => setFilter('success')}
          >
            Sucesso
          </button>
          <button 
            className={`filter-button ${filter === 'warning' ? 'active' : ''}`}
            onClick={() => setFilter('warning')}
          >
            Avisos
          </button>
          <button 
            className={`filter-button ${filter === 'error' ? 'active' : ''}`}
            onClick={() => setFilter('error')}
          >
            Erros
          </button>
        </div>
      </div>
      
      <div className="logs-container">
        {filteredLogs.length === 0 ? (
          <div className="empty-logs">
            {logs.length === 0 
              ? 'Nenhum log disponível ainda. Adicione arquivos para processar.' 
              : 'Nenhum log corresponde ao filtro selecionado.'}
          </div>
        ) : (
          <ul className="logs-list">
            {filteredLogs.map((log, index) => (
              <li key={index} className={`log-entry log-${log.type}`}>
                <div className="log-time">{formatDate(log.timestamp)}</div>
                <div className="log-badge">{log.type}</div>
                <div className="log-message">{log.message}</div>
                
                {/* Botões de ação para logs interativos */}
                {getActionText(log) && (
                  <button 
                    className={`log-action-button ${log.type}`}
                    onClick={() => handleLogAction(log)}
                    title={getActionText(log)}
                  >
                    {getActionText(log)}
                  </button>
                )}
                
                {log.data && (
                  <button 
                    className="log-details-toggle"
                    onClick={(e) => {
                      e.currentTarget.parentElement.classList.toggle('expanded');
                    }}
                  >
                    Detalhes
                  </button>
                )}
                {log.data && (
                  <div className="log-details">
                    <table>
                      <tbody>
                        {Object.entries(log.data).map(([key, value]) => (
                          <tr key={key}>
                            <td className="detail-key">{key}:</td>
                            <td className="detail-value">{value?.toString() || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LogPanel; 