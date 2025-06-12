import React, { useState, useEffect, useRef } from 'react';
import { processFile } from '../utils/fileManager';
import PDFForm from './PDFForm';
import LogPanel from './LogPanel';
import '../styles/Explorer.css';

const Explorer = ({ user }) => {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processingQueue, setProcessingQueue] = useState([]);
  const [logs, setLogs] = useState([]);
  const [currentFileData, setCurrentFileData] = useState(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState(null);

  const dropAreaRef = useRef(null);
  const processingTimeoutRef = useRef(null);
  
  useEffect(() => {
    // Processa a fila de arquivos um por um
    if (processingQueue.length > 0 && !processing) {
      processNextFile();
    }
  }, [processingQueue, processing]);

  useEffect(() => {
    // Configura listeners para mensagens do preload.js (eventos de drag-drop)
    const handleFileDropMessage = (event) => {
      if (event.data.type === 'drop-files' && Array.isArray(event.data.payload)) {
        handleFilePathsSelected(event.data.payload);
      }
    };

    window.addEventListener('message', handleFileDropMessage);
    return () => {
      window.removeEventListener('message', handleFileDropMessage);
      
      // Limpa qualquer timeout pendente quando o componente é desmontado
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  const handleFilePathsSelected = async (fileList) => {
    const newFiles = [];

    for (const item of fileList) {
      if (typeof item === 'string' && item.toLowerCase().endsWith('.pdf')) {
        try {
          addLog({
            type: 'info',
            message: `Carregando arquivo ${item}...`,
            timestamp: new Date()
          });
          
          const fileData = await window.electron.fileSystem.readFile(item);
          if (fileData) {
            newFiles.push(fileData);
            addLog({
              type: 'info',
              message: `Arquivo ${item} carregado com sucesso.`,
              timestamp: new Date()
            });
          }
        } catch (error) {
          console.error('Erro ao ler arquivo:', error);
          addLog({
            type: 'error',
            message: `Erro ao ler arquivo ${item}: ${error.message}`,
            timestamp: new Date()
          });
        }
      } else if (item instanceof File && item.name.toLowerCase().endsWith('.pdf')) {
        // Web: lê como base64
        try {
          addLog({
            type: 'info',
            message: `Carregando arquivo ${item.name}...`,
            timestamp: new Date()
          });
          
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(item);
          });
          
          newFiles.push({ name: item.name, data: base64, path: item.name });
          
          addLog({
            type: 'info',
            message: `Arquivo ${item.name} carregado com sucesso.`,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('Erro ao ler arquivo:', error);
          addLog({
            type: 'error',
            message: `Erro ao ler arquivo ${item.name}: ${error.message}`,
            timestamp: new Date()
          });
        }
      }
    }

    if (newFiles.length > 0) {
      setProcessingQueue(prev => [...prev, ...newFiles]);
      addLog({
        type: 'info',
        message: `${newFiles.length} arquivo(s) adicionado(s) à fila.`,
        timestamp: new Date()
      });
    }
  };

  const processNextFile = async () => {
    if (processingQueue.length === 0) return;
    
    setProcessing(true);
    setProcessingProgress(0);
    
    const [fileToProcess, ...remainingQueue] = processingQueue;
    setProcessingQueue(remainingQueue);
    setCurrentProcessingFile(fileToProcess.name);
    
    addLog({
      type: 'info',
      message: `Processando ${fileToProcess.name}...`,
      timestamp: new Date()
    });

    // Configura um timeout para interromper processamento muito longo
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    processingTimeoutRef.current = setTimeout(() => {
      addLog({
        type: 'error',
        message: `Processamento de ${fileToProcess.name} excedeu o tempo limite (120s). Abortando.`,
        timestamp: new Date()
      });
      
      // Verifica se o arquivo já existe na lista (reprocessamento)
      const existingFileIndex = files.findIndex(f => f.name === fileToProcess.name);
      if (existingFileIndex !== -1) {
        // Atualiza arquivo existente
        setFiles(prev => prev.map(file => 
          file.name === fileToProcess.name 
            ? { ...file, status: 'error', error: 'Processamento excedeu o tempo limite' }
            : file
        ));
      } else {
        // Adiciona novo arquivo à lista como erro
        setFiles(prev => [...prev, { 
          name: fileToProcess.name, 
          status: 'error',
          error: 'Processamento excedeu o tempo limite'
        }]);
      }
      
      setProcessing(false);
    }, 120000); // 120 segundos
    
    // Atualiza progresso a cada 2 segundos
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => Math.min(prev + 5, 95));
    }, 2000);

    try {
      const result = await processFile(fileToProcess);
      
      clearInterval(progressInterval);
      clearTimeout(processingTimeoutRef.current);
      setProcessingProgress(100);
      
      // Verifica se o arquivo já existe na lista (reprocessamento)
      const existingFileIndex = files.findIndex(f => f.name === fileToProcess.name);
      
      if (result.success) {
        addLog({
          type: 'success',
          message: `Arquivo ${fileToProcess.name} processado com sucesso.`,
          timestamp: new Date(),
          data: result.data
        });
        
        if (existingFileIndex !== -1) {
          // Atualiza arquivo existente
          setFiles(prev => prev.map(file => 
            file.name === fileToProcess.name 
              ? { 
                  name: fileToProcess.name, 
                  status: 'success',
                  data: result.data,
                  needsCorrection: false
                }
              : file
          ));
        } else {
          // Adiciona novo arquivo à lista
          setFiles(prev => [...prev, { 
            name: fileToProcess.name, 
            status: 'success',
            data: result.data
          }]);
        }
      } else if (result.needsManualInput || (result.data && Object.keys(result.data).length > 0)) {
        // Se precisa de input manual OU se tem dados extraídos (mesmo incompletos)
        addLog({
          type: 'warning',
          message: `Arquivo ${fileToProcess.name} requer preenchimento manual. Clique para corrigir.`,
          timestamp: new Date(),
          data: result.data,
          fileData: {
            ...fileToProcess,
            result: {
              ...result,
              needsManualInput: true, // Força como manual input
              data: {
                ...result.data,
                DATA_ARQ: result.data?.DATA_ARQ || '',
                VALOR_PFD: result.data?.VALOR_PFD || '',
                CNPJ_CLIENTE: result.data?.CNPJ_CLIENTE || '',
                NOME_CLIENTE: result.data?.NOME_CLIENTE || '',
                NOME_PDF: result.data?.NOME_PDF || '',
                CNPJ_CURTO: result.data?.CNPJ_CURTO || '',
                HASH: result.data?.HASH || ''
              }
            }
          }
        });
        
        if (existingFileIndex !== -1) {
          // Atualiza arquivo existente
          setFiles(prev => prev.map(file => 
            file.name === fileToProcess.name 
              ? { 
                  name: fileToProcess.name, 
                  status: 'warning',
                  data: result.data,
                  needsCorrection: true
                }
              : file
          ));
        } else {
          // Adiciona novo arquivo à lista como pendente de correção manual
          setFiles(prev => [...prev, { 
            name: fileToProcess.name, 
            status: 'warning',
            data: result.data,
            needsCorrection: true
          }]);
        }
      } else {
        addLog({
          type: 'error',
          message: `Erro ao processar ${fileToProcess.name}: ${result.error}. Clique para tentar novamente.`,
          timestamp: new Date(),
          fileName: fileToProcess.name,
          fileData: fileToProcess
        });
        
        if (existingFileIndex !== -1) {
          // Atualiza arquivo existente
          setFiles(prev => prev.map(file => 
            file.name === fileToProcess.name 
              ? { 
                  ...file, 
                  status: 'error',
                  error: result.error,
                  canRetry: true,
                  needsCorrection: false
                }
              : file
          ));
        } else {
          // Adiciona novo arquivo à lista como erro
          setFiles(prev => [...prev, { 
            name: fileToProcess.name, 
            status: 'error',
            error: result.error,
            canRetry: true
          }]);
        }
      }
    } catch (error) {
      clearInterval(progressInterval);
      clearTimeout(processingTimeoutRef.current);
      
      console.error('Erro ao processar arquivo:', error);
      addLog({
        type: 'error',
        message: `Erro ao processar ${fileToProcess.name}: ${error.message}. Clique para tentar novamente.`,
        timestamp: new Date(),
        fileName: fileToProcess.name,
        fileData: fileToProcess
      });
      
      // Verifica se o arquivo já existe na lista (reprocessamento)
      const existingFileIndex = files.findIndex(f => f.name === fileToProcess.name);
      if (existingFileIndex !== -1) {
        // Atualiza arquivo existente
        setFiles(prev => prev.map(file => 
          file.name === fileToProcess.name 
            ? { 
                ...file, 
                status: 'error',
                error: error.message,
                canRetry: true,
                needsCorrection: false
              }
            : file
        ));
      } else {
        // Adiciona novo arquivo à lista como erro
        setFiles(prev => [...prev, { 
          name: fileToProcess.name, 
          status: 'error',
          error: error.message,
          canRetry: true
        }]);
      }
    } finally {
      clearInterval(progressInterval);
      clearTimeout(processingTimeoutRef.current);
      setProcessing(false);
      setProcessingProgress(0);
      setCurrentProcessingFile(null);
    }
  };

  const addLog = (logEntry) => {
    // Filtrar apenas logs essenciais
    const essentialTypes = [
      'success',           // Logs de sucesso
      'warning',           // Logs de correção manual
    ];
    
    // Logs específicos de informação que queremos manter
    const essentialInfoMessages = [
      'arquivo(s) adicionado(s) à fila',
      'Interface limpa. Pronto para novos arquivos.'
    ];
    
    // Verificar se é um log essencial
    const isEssential = essentialTypes.includes(logEntry.type) || 
                       (logEntry.type === 'info' && 
                        essentialInfoMessages.some(msg => logEntry.message.includes(msg)));
    
    if (isEssential) {
      setLogs(prev => [...prev, logEntry]);
    }
  };

  // Função para limpar logs e arquivos processados (reset da interface)
  const handleClearAll = () => {
    setFiles([]);
    setLogs([]);
    setProcessingQueue([]);
    setCurrentFileData(null);
    setShowManualForm(false);
    setProcessingProgress(0);
    setCurrentProcessingFile(null);
    
    // Limpa qualquer timeout pendente
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    // Se estiver processando, para o processamento
    if (processing) {
      setProcessing(false);
    }
    
    addLog({
      type: 'info',
      message: 'Interface limpa. Pronto para novos arquivos.',
      timestamp: new Date()
    });
  };

  const handleFormSubmit = (processedFile) => {
    // Atualiza o arquivo na mesma posição em vez de adicionar no final
    setFiles(prev => prev.map(file => 
      file.name === currentFileData.name 
        ? { 
            name: currentFileData.name, 
            status: 'success',
            data: processedFile,
            needsCorrection: false // Remove a flag de correção
          }
        : file
    ));
    
    addLog({
      type: 'success',
      message: `Arquivo ${currentFileData.name} processado manualmente com sucesso.`,
      timestamp: new Date(),
      data: processedFile
    });
    
    // Fecha o formulário e limpa o arquivo atual
    setShowManualForm(false);
    setCurrentFileData(null);
  };

  const handleFormCancel = () => {
    addLog({
      type: 'warning',
      message: `Processamento do arquivo ${currentFileData.name} cancelado pelo usuário.`,
      timestamp: new Date()
    });
    
    // Adiciona à lista como erro
    setFiles(prev => [...prev, { 
      name: currentFileData.name, 
      status: 'error',
      error: 'Processamento cancelado pelo usuário'
    }]);
    
    // Fecha o formulário e limpa o arquivo atual
    setShowManualForm(false);
    setCurrentFileData(null);
  };

  // Função para tentar processar arquivo novamente
  const handleRetryFile = (fileName) => {
    // Procura o arquivo nos logs para reprocessar
    const logEntry = logs.find(log => 
      log.type === 'warning' && 
      log.message.includes(fileName) &&
      log.fileData
    );
    
    if (logEntry && logEntry.fileData) {
      // Atualiza o status do arquivo para "processando"
      setFiles(prev => prev.map(file => 
        file.name === fileName 
          ? { ...file, status: 'processing', needsCorrection: false }
          : file
      ));
      
      addLog({
        type: 'info',
        message: `Tentando reprocessar arquivo ${fileName} com IA...`,
        timestamp: new Date()
      });
      
      // Adiciona novamente à fila de processamento
      setProcessingQueue(prev => [...prev, logEntry.fileData]);
    }
  };

  // Função para abrir formulário de correção manual
  const handleEditFile = (fileData) => {
    console.log('Abrindo formulário para correção manual:', fileData);
    setCurrentFileData(fileData);
    setShowManualForm(true);
  };

  return (
    <div className="explorer-container">
      <div className="explorer-header">
        <h2>Explorador de Documentos</h2>
        <div className="header-controls">
          <button 
            className="clear-button" 
            onClick={handleClearAll}
            title="Limpar logs e arquivos processados"
          >
            🗑️ Limpar Logs e Arquivos
          </button>
          <div className="queue-status">
            {processingQueue.length > 0 && (
              <span className="queue-info">
                📄 {processingQueue.length} arquivo(s) na fila
              </span>
            )}
            {processing && currentProcessingFile && (
              <span className="processing-info">
                ⚙️ Processando: {currentProcessingFile}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="explorer-content">
        <LogPanel 
          logs={logs} 
          onRetryFile={handleRetryFile}
          onEditFile={handleEditFile}
        />
        
        <div 
          className={`drop-area ${processing ? 'processing' : ''}`}
          ref={dropAreaRef}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => {
            e.preventDefault();
            e.stopPropagation();
            const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
            if (files.length > 0) {
              handleFilePathsSelected(files);
            }
          }}
        >
          <div className="drop-message">
            {processing ? (
              <div className="processing-indicator">
                <span className="spinner"></span>
                <p>Processando arquivos... {processingProgress}%</p>
                <div className="progress-bar">
                  <div 
                    className="progress-bar-fill" 
                    style={{width: `${processingProgress}%`}}
                  ></div>
                </div>
                {processingQueue.length > 0 && (
                  <p className="queue-counter">
                    {processingQueue.length} arquivo(s) restante(s) na fila
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="pdf-icon">📄</div>
                <p>Arraste e solte arquivos PDF aqui</p>
                <p className="drop-subtitle">Sistema de processamento automático por IA</p>
                {files.length > 0 && (
                  <>
                    <p className="files-processed">
                      ✅ {files.length} arquivo(s) processado(s)
                    </p>
                    <p className="drop-subtitle">
                      Termine de corrigir os erros e use "Limpar" para processar novos lotes
                    </p>
                  </>
                )}
              </>
            )}
          </div>
          
          {files.length > 0 && (
            <div className="files-list">
              <h3>Arquivos Processados ({files.length})</h3>
              <ul>
                {files.map((file, index) => (
                  <li key={index} className={`file-item file-${file.status}`}>
                    <span className="file-name">{file.name}</span>
                    <span className="file-status">
                      {file.status === 'success' && '✅ Processado'}
                      {file.status === 'warning' && '⚠️ Requer Correção'}
                      {file.status === 'error' && '❌ Erro'}
                    </span>
                    {file.needsCorrection && (
                      <div className="file-actions">
                        <button 
                          className="file-action-btn warning"
                          onClick={() => {
                            const logEntry = logs.find(log => 
                              log.type === 'warning' && 
                              log.message.includes(file.name) &&
                              log.fileData
                            );
                            if (logEntry) {
                              handleEditFile(logEntry.fileData);
                            }
                          }}
                        >
                          ✏️ Corrigir
                        </button>
                        <button 
                          className="file-action-btn retry"
                          onClick={() => handleRetryFile(file.name)}
                          title="Tentar processar novamente com IA"
                        >
                          🔄 Tentar Novamente
                        </button>
                      </div>
                    )}
                    {file.status === 'processing' && (
                      <span className="file-status processing">
                        ⚙️ Reprocessando...
                      </span>
                    )}
                    {(file.canRetry || file.status === 'error') && (
                      <div className="file-actions">
                        <button 
                          className="file-action-btn warning"
                          onClick={() => {
                            // Criar dados básicos para correção manual mesmo em caso de erro
                            const basicFileData = {
                              name: file.name,
                              result: {
                                success: false,
                                needsManualInput: true,
                                data: {
                                  DATA_ARQ: '',
                                  VALOR_PFD: '',
                                  CNPJ_CLIENTE: '',
                                  NOME_CLIENTE: '',
                                  NOME_PDF: '',
                                  CNPJ_CURTO: '',
                                  HASH: '',
                                  STATUS: 'N'
                                },
                                missingFields: {
                                  NOME_CLIENTE: true,
                                  DATA_ARQ: true,
                                  VALOR_PFD: true,
                                  CNPJ_CLIENTE: true,
                                  NOME_PDF: true
                                }
                              }
                            };
                            handleEditFile(basicFileData);
                          }}
                          title="Preencher dados manualmente"
                        >
                          ✏️ Corrigir Manualmente
                        </button>
                        <button 
                          className="file-action-btn error"
                          onClick={() => handleRetryFile(file.name)}
                          title="Tentar processar novamente com IA"
                        >
                          🔄 Tentar Novamente
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {showManualForm && currentFileData && (
        <PDFForm 
          fileData={currentFileData} 
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
};

export default Explorer; 