import React, { useState, useEffect } from 'react';
import '../styles/PDFViewer.css';

const PDFViewer = ({ pdfData, fileName, onClose }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (pdfData) {
      try {
        // Converter base64 para blob e criar URL
        const binaryString = atob(pdfData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao processar PDF:', err);
        setError('Erro ao carregar o documento PDF');
        setLoading(false);
      }
    }

    // Cleanup: liberar URL quando componente desmontar
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfData]);

  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = fileName || 'documento.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="pdf-viewer-overlay">
      <div className="pdf-viewer-container">
        <div className="pdf-viewer-header">
          <div className="pdf-viewer-title">
            <h3>📄 Visualizar Documento</h3>
            <span className="pdf-filename">{fileName}</span>
          </div>
          <div className="pdf-viewer-controls">
            <button 
              className="download-button"
              onClick={handleDownload}
              disabled={!pdfUrl}
              title="Baixar documento"
            >
              💾 Baixar
            </button>
            <button 
              className="close-viewer-button"
              onClick={onClose}
              title="Fechar visualizador"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="pdf-viewer-content">
          {loading && (
            <div className="pdf-loading">
              <div className="spinner"></div>
              <p>Carregando documento...</p>
            </div>
          )}
          
          {error && (
            <div className="pdf-error">
              <div className="error-icon">⚠️</div>
              <p>{error}</p>
              <button onClick={onClose} className="error-close-btn">
                Fechar
              </button>
            </div>
          )}
          
          {pdfUrl && !loading && !error && (
            <iframe
              src={pdfUrl}
              className="pdf-iframe"
              title={`Visualizador de ${fileName}`}
              frameBorder="0"
            />
          )}
        </div>
        
        <div className="pdf-viewer-footer">
          <div className="pdf-viewer-tips">
            <span className="tip">💡 Dica: Use Ctrl+F para buscar texto no documento</span>
            <span className="tip">🔍 Zoom: Ctrl + (aumentar) / Ctrl - (diminuir)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer; 