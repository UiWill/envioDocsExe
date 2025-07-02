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
  
  // Constante para limite máximo de documentos por lote
  const MAX_DOCUMENTS_PER_BATCH = 20;
  
  useEffect(() => {
    // Processa a fila de arquivos um por um
    if (processingQueue.length > 0 && !processing) {
      processNextFile();
    }
    
    // Log quando a fila está vazia e pronta para novos documentos
    if (processingQueue.length === 0 && !processing && files.length > 0) {
      addLog({
        type: 'success',
        message: `🎉 Processamento concluído! Fila vazia - pronto para processar até ${MAX_DOCUMENTS_PER_BATCH} novos documentos.`,
        timestamp: new Date()
      });
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
    const pdfFiles = fileList.filter(item => {
      if (typeof item === 'string') {
        return item.toLowerCase().endsWith('.pdf');
      } else if (item instanceof File) {
        return item.name.toLowerCase().endsWith('.pdf');
      }
      return false;
    });

    // Verificar limite de documentos
    const currentQueueSize = processingQueue.length;
    const totalDocuments = currentQueueSize + pdfFiles.length;
    
    if (totalDocuments > MAX_DOCUMENTS_PER_BATCH) {
      const allowedFiles = MAX_DOCUMENTS_PER_BATCH - currentQueueSize;
      const rejectedFiles = pdfFiles.length - allowedFiles;
      
      addLog({
        type: 'warning',
        message: `⚠️ LIMITE ATINGIDO: Máximo de ${MAX_DOCUMENTS_PER_BATCH} documentos por lote.`,
        timestamp: new Date()
      });
      
      addLog({
        type: 'warning',
        message: `📊 Você tentou adicionar ${pdfFiles.length} arquivos, mas já existem ${currentQueueSize} na fila.`,
        timestamp: new Date()
      });
      
      if (allowedFiles > 0) {
        addLog({
          type: 'info',
          message: `✅ Processando apenas os primeiros ${allowedFiles} arquivos. ${rejectedFiles} arquivos foram ignorados.`,
          timestamp: new Date()
        });
        
        addLog({
          type: 'info',
          message: `💡 Dica: Aguarde o processamento atual terminar antes de adicionar mais documentos.`,
          timestamp: new Date()
        });
        
        // Processa apenas os arquivos permitidos
        const allowedFileList = pdfFiles.slice(0, allowedFiles);
        await processFileList(allowedFileList, newFiles);
      } else {
        addLog({
          type: 'error',
          message: `❌ Nenhum arquivo foi adicionado. Aguarde o processamento atual terminar.`,
          timestamp: new Date()
        });
        return;
      }
    } else {
      // Processa todos os arquivos normalmente
      await processFileList(pdfFiles, newFiles);
    }

    if (newFiles.length > 0) {
      setProcessingQueue(prev => [...prev, ...newFiles]);
      addLog({
        type: 'success',
        message: `📁 ${newFiles.length} arquivo(s) adicionado(s) à fila de processamento.`,
        timestamp: new Date()
      });
      
      addLog({
        type: 'info',
        message: `🔄 Total na fila: ${processingQueue.length + newFiles.length} documentos.`,
        timestamp: new Date()
      });
    }
  };

  // Função auxiliar para processar lista de arquivos
  const processFileList = async (fileList, newFiles) => {
    for (const item of fileList) {
      if (typeof item === 'string' && item.toLowerCase().endsWith('.pdf')) {
        try {
          addLog({
            type: 'info',
            message: `📂 Carregando arquivo ${item}...`,
            timestamp: new Date()
          });
          
          const fileData = await window.electron.fileSystem.readFile(item);
          if (fileData) {
            newFiles.push(fileData);
            addLog({
              type: 'success',
              message: `✅ Arquivo ${item} carregado com sucesso.`,
              timestamp: new Date()
            });
          }
        } catch (error) {
          console.error('Erro ao ler arquivo:', error);
          addLog({
            type: 'error',
            message: `❌ Erro ao ler arquivo ${item}: ${error.message}`,
            timestamp: new Date()
          });
        }
      } else if (item instanceof File && item.name.toLowerCase().endsWith('.pdf')) {
        // Web: lê como base64
        try {
          addLog({
            type: 'info',
            message: `📂 Carregando arquivo ${item.name}...`,
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
            type: 'success',
            message: `✅ Arquivo ${item.name} carregado com sucesso.`,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('Erro ao ler arquivo:', error);
          addLog({
            type: 'error',
            message: `❌ Erro ao ler arquivo ${item.name}: ${error.message}`,
            timestamp: new Date()
          });
        }
      }
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
      } else if (result.error && result.error.includes('já foi enviado anteriormente')) {
        // DUPLICATA: Documento já existe no sistema
        addLog({
          type: 'info',
          message: `📋 ${fileToProcess.name} - Documento já foi enviado anteriormente (duplicata).`,
          timestamp: new Date(),
          data: result.data,
          isDuplicate: true
        });
        
        if (existingFileIndex !== -1) {
          // Atualiza arquivo existente
          setFiles(prev => prev.map(file => 
            file.name === fileToProcess.name 
              ? { 
                  name: fileToProcess.name, 
                  status: 'duplicate',
                  data: result.data,
                  error: 'Documento já enviado anteriormente',
                  isDuplicate: true
                }
              : file
          ));
        } else {
          // Adiciona novo arquivo à lista como duplicata
          setFiles(prev => [...prev, { 
            name: fileToProcess.name, 
            status: 'duplicate',
            data: result.data,
            error: 'Documento já enviado anteriormente',
            isDuplicate: true
          }]);
        }
      } else if (result.needsManualInput || (result.data && Object.keys(result.data).length > 0)) {
        // CORREÇÃO MANUAL: Dados incompletos que precisam ser corrigidos
        addLog({
          type: 'warning',
          message: `⚠️ ${fileToProcess.name} requer preenchimento manual. Clique para corrigir.`,
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
        // ERRO: Falha técnica no processamento
        addLog({
          type: 'error',
          message: `❌ Erro ao processar ${fileToProcess.name}: ${result.error}. Clique para tentar novamente.`,
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
      'success',           // Logs de sucesso VERDADEIRO (todos os dados completos)
      'warning',           // Logs de correção manual (dados incompletos)
      'error',             // Logs de erro (falha no processamento)
      'info'               // Logs informativos (incluindo duplicatas)
    ];
    
    // Logs específicos de informação que queremos manter
    const essentialInfoMessages = [
      'arquivo(s) adicionado(s) à fila',
      'Interface limpa. Pronto para novos arquivos.',
      'Processamento concluído! Fila vazia',
      'já foi enviado anteriormente'  // Duplicatas
    ];
    
    // Verificar se é um log essencial
    const isEssential = essentialTypes.includes(logEntry.type) || 
                       (logEntry.type === 'info' && 
                        essentialInfoMessages.some(msg => logEntry.message.includes(msg))) ||
                       logEntry.isDuplicate; // Sempre incluir duplicatas
    
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
            <div className="batch-limit-info">
              <span className="limit-indicator">
                📊 Limite: {processingQueue.length}/{MAX_DOCUMENTS_PER_BATCH} documentos por lote
              </span>
              {processingQueue.length >= MAX_DOCUMENTS_PER_BATCH && (
                <span className="limit-warning">
                  ⚠️ Limite atingido
                </span>
              )}
            </div>
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
                <p className="batch-limit-notice">
                  📋 Máximo de {MAX_DOCUMENTS_PER_BATCH} documentos por lote
                </p>
                {processingQueue.length >= MAX_DOCUMENTS_PER_BATCH && (
                  <p className="limit-reached-warning">
                    ⚠️ Limite de {MAX_DOCUMENTS_PER_BATCH} documentos atingido. Aguarde o processamento terminar.
                  </p>
                )}
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
                      {file.status === 'duplicate' && '📋 Já Enviado'}
                    </span>
                    {file.needsCorrection && (
                      <div className="file-actions">
                        <button 
                          className="file-action-btn warning"
                          onClick={() => {
                            console.log('🔧 Clicou em Corrigir para arquivo:', file.name);
                            console.log('🔧 Dados do arquivo na lista:', file);
                            console.log('🔧 file.data:', file.data);
                            
                            // PRIORIDADE 1: Buscar no log (que sempre funcionou)
                            const logEntry = logs.find(log => 
                              log.type === 'warning' && 
                              log.message.includes(file.name) &&
                              log.fileData
                            );
                            if (logEntry && logEntry.fileData) {
                              console.log('✅ Usando dados do log (método que sempre funcionou)');
                              console.log('📋 logEntry encontrado:', logEntry);
                              console.log('📋 logEntry.fileData:', logEntry.fileData);
                              handleEditFile(logEntry.fileData);
                              return;
                            }
                            
                            // PRIORIDADE 2: Usar dados do arquivo na lista 
                            if (file.data && Object.keys(file.data).length > 0) {
                              console.log('✅ Usando dados do arquivo na lista');
                              const fileDataFromList = {
                                name: file.name,
                                result: {
                                  success: false,
                                  needsManualInput: true,
                                  data: file.data
                                }
                              };
                              console.log('📋 Dados estruturados para enviar ao formulário:', fileDataFromList);
                              handleEditFile(fileDataFromList);
                              return;
                            }
                            
                            // PRIORIDADE 3: Dados vazios como último recurso
                            console.log('⚠️ Nenhum dado encontrado, criando estrutura vazia');
                            const fileDataEmpty = {
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
                                }
                              }
                            };
                            handleEditFile(fileDataEmpty);
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
                    {(file.canRetry || file.status === 'error') && file.status !== 'duplicate' && (
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