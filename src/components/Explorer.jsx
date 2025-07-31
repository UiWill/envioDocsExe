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
  const fileInputRef = useRef(null);
  
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

  // Função para simplificar nome do arquivo
  const simplifyFileName = (fileName) => {
    // Se o nome for muito longo, mostra apenas o início
    if (fileName.length > 30) {
      return fileName.substring(0, 30) + '...';
    }
    return fileName;
  };

  const processNextFile = async () => {
    if (processingQueue.length === 0) return;
    
    setProcessing(true);
    setProcessingProgress(0);
    
    const [fileToProcess, ...remainingQueue] = processingQueue;
    setProcessingQueue(remainingQueue);
    setCurrentProcessingFile(simplifyFileName(fileToProcess.name));
    
    addLog({
      type: 'info',
      message: `Processando ${simplifyFileName(fileToProcess.name)}...`,
      timestamp: new Date()
    });

    // Configura um timeout para interromper processamento muito longo
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    processingTimeoutRef.current = setTimeout(() => {
      addLog({
        type: 'error',
        message: `Processamento de ${simplifyFileName(fileToProcess.name)} excedeu o tempo limite (120s). Abortando.`,
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
          name: simplifyFileName(fileToProcess.name), 
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
      
      // LOG CRÍTICO: Verificar o que o processFile está retornando
      console.log('🚨 PROCESSAMENTO - Resultado retornado pelo processFile:', result);
      console.log('🚨 PROCESSAMENTO - result.data:', result?.data);
      console.log('🚨 PROCESSAMENTO - result.success:', result?.success);
      console.log('🚨 PROCESSAMENTO - result.needsManualInput:', result?.needsManualInput);
      
      clearInterval(progressInterval);
      clearTimeout(processingTimeoutRef.current);
      setProcessingProgress(100);
      
      // Verifica se o arquivo já existe na lista (reprocessamento)
      const existingFileIndex = files.findIndex(f => f.name === fileToProcess.name);
      
      if (result.success) {
        addLog({
          type: 'success',
          message: `✅ Arquivo ${simplifyFileName(fileToProcess.name)} processado com sucesso.`,
          timestamp: new Date(),
          data: result.data
        });
        
        if (existingFileIndex !== -1) {
          // Atualiza arquivo existente
          setFiles(prev => prev.map(file => 
            file.name === fileToProcess.name 
              ? { 
                  name: simplifyFileName(fileToProcess.name), 
                  status: 'success',
                  data: result.data,
                  needsCorrection: false,
                  fullName: fileToProcess.name
                }
              : file
          ));
        } else {
          // Adiciona novo arquivo à lista
          setFiles(prev => [...prev, { 
            name: simplifyFileName(fileToProcess.name), 
            status: 'success',
            data: result.data,
            fullName: fileToProcess.name
          }]);
        }
      } else if (result.needsManualInput || (result.data && Object.keys(result.data).length > 0)) {
        // CORREÇÃO MANUAL: Dados incompletos que precisam ser corrigidos
        console.log('🔍 CRÍTICO - Resultado completo recebido:', result);
        
        // GARANTIR que temos dados para salvar
        const dadosParaSalvar = result.data || {};
        
        // Criar mensagem de erro mais específica
        let errorMessage = `⚠️ ${simplifyFileName(fileToProcess.name)} requer correção.`;
        if (result.error && result.error.includes('Data do documento')) {
          errorMessage = result.error;
        }
        
        addLog({
          type: 'warning',
          message: errorMessage,
          timestamp: new Date(),
          data: dadosParaSalvar,
          fileData: {
            ...fileToProcess,
            result: {
              ...result,
              needsManualInput: true,
              data: dadosParaSalvar
            }
          }
        });
        
        if (existingFileIndex !== -1) {
          // Atualiza arquivo existente
          const arquivoAtualizado = { 
            name: simplifyFileName(fileToProcess.name), 
            status: 'warning',
            data: dadosParaSalvar,
            originalFileData: fileToProcess.data,
            extractedData: dadosParaSalvar,
            result: result,
            needsCorrection: true,
            fullName: fileToProcess.name,
            error: result.error
          };
          
          setFiles(prev => prev.map(file => 
            file.name === fileToProcess.name ? arquivoAtualizado : file
          ));
        } else {
          // Adiciona novo arquivo à lista como pendente de correção manual
          const novoArquivo = { 
            name: simplifyFileName(fileToProcess.name), 
            status: 'warning',
            data: dadosParaSalvar,
            originalFileData: fileToProcess.data,
            extractedData: dadosParaSalvar,
            result: result,
            needsCorrection: true,
            fullName: fileToProcess.name,
            error: result.error
          };
          
          setFiles(prev => [...prev, novoArquivo]);
        }
      } else {
        // ERRO: Falha técnica no processamento
        addLog({
          type: 'error',
          message: `❌ Erro ao processar ${simplifyFileName(fileToProcess.name)}: ${result.error}`,
          timestamp: new Date(),
          fileName: fileToProcess.name,
          fileData: fileToProcess
        });
        
        if (existingFileIndex !== -1) {
          // Atualiza arquivo existente
          setFiles(prev => prev.map(file => 
            file.name === fileToProcess.name 
              ? { 
                  name: simplifyFileName(fileToProcess.name),
                  status: 'error',
                  error: result.error,
                  canRetry: true,
                  needsCorrection: false,
                  fullName: fileToProcess.name
                }
              : file
          ));
        } else {
          // Adiciona novo arquivo à lista como erro
          setFiles(prev => [...prev, { 
            name: simplifyFileName(fileToProcess.name),
            status: 'error',
            error: result.error,
            canRetry: true,
            fullName: fileToProcess.name
          }]);
        }
      }
    } catch (error) {
      clearInterval(progressInterval);
      clearTimeout(processingTimeoutRef.current);
      
      console.error('Erro ao processar arquivo:', error);
      addLog({
        type: 'error',
        message: `Erro ao processar ${simplifyFileName(fileToProcess.name)}: ${error.message}. Clique para tentar novamente.`,
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
          name: simplifyFileName(fileToProcess.name), 
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
    // Se estiver apenas visualizando, fecha sem mostrar erro
    if (currentFileData?.isViewing) {
      setShowManualForm(false);
      setCurrentFileData(null);
      return;
    }

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

  // Função para corrigir manualmente um arquivo
  const handleManualCorrection = (file) => {
    // Se for um documento processado com sucesso ou duplicado, apenas mostra os dados
    if (file.status === 'success' || file.error?.includes('similar já existe') || file.error?.includes('já foi enviado')) {
      console.log('Abrindo visualização de dados:', file);
      setCurrentFileData({
        ...file,
        isViewing: true // Flag para indicar que é apenas visualização
      });
      setShowManualForm(true);
      return;
    }

    // Caso contrário, abre para correção manual
    console.log('Abrindo formulário para correção manual:', file);
    setCurrentFileData(file);
    setShowManualForm(true);
  };

  // Função para tentar processar novamente um arquivo
  const handleRetry = (file) => {
    // Atualiza o status do arquivo para "processando"
    setFiles(prev => prev.map(f => 
      f.name === file.name 
        ? { ...f, status: 'processing', needsCorrection: false }
        : f
    ));
    
    addLog({
      type: 'info',
      message: `Tentando reprocessar arquivo ${file.name} com IA...`,
      timestamp: new Date()
    });
    
    // Adiciona novamente à fila de processamento
    setProcessingQueue(prev => [...prev, file]);
  };

  // Função para abrir seletor de arquivos
  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Função para lidar com arquivos selecionados via input
  const handleFileInputChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    const pdfFiles = selectedFiles.filter(file => file.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length > 0) {
      // Verificar se a seleção excede o limite ANTES de processar
      const currentQueueSize = processingQueue.length;
      const totalDocuments = currentQueueSize + pdfFiles.length;
      
      if (totalDocuments > MAX_DOCUMENTS_PER_BATCH) {
        addLog({
          type: 'error',
          message: `❌ Por favor, processar somente ${MAX_DOCUMENTS_PER_BATCH} no máximo por vez.`,
          timestamp: new Date()
        });
        
        addLog({
          type: 'warning',
          message: `📊 Você selecionou ${pdfFiles.length} arquivos, mas o limite é ${MAX_DOCUMENTS_PER_BATCH} documentos por lote.`,
          timestamp: new Date()
        });
        
        if (currentQueueSize > 0) {
          addLog({
            type: 'info',
            message: `💡 Já existem ${currentQueueSize} documentos na fila. Aguarde o processamento terminar ou limpe a fila.`,
            timestamp: new Date()
          });
        }
        
        // Limpa o input e NÃO processa nenhum arquivo
        event.target.value = '';
        return;
      }
      
      // Se está dentro do limite, processa normalmente
      handleFilePathsSelected(selectedFiles);
    }
    
    // Limpa o input para permitir selecionar os mesmos arquivos novamente se necessário
    event.target.value = '';
  };

  // Renderiza a lista de arquivos processados
  const renderProcessedFiles = () => {
    return (
      <div className="processed-files">
        <h3>Arquivos Processados ({files.length})</h3>
        {files.map((file, index) => {
          // Verifica se é um documento duplicado
          const isDuplicate = file.error?.includes('similar já existe') || 
                            file.error?.includes('já foi enviado');
          
          // Define o status visual correto
          const visualStatus = isDuplicate ? 'duplicate' : file.status;
          
          return (
            <div key={index} className={`file-item ${visualStatus}`}>
              <div className="file-info">
                <div className="file-name">
                  {file.name}
                </div>
                <div className="file-status">
                  {file.status === 'success' && (
                    <>
                      <span className="success-icon">✅</span>
                      <span className="success-message">Processado com Sucesso</span>
                    </>
                  )}
                  {file.status === 'error' && !isDuplicate && (
                    <>
                      <span className="error-icon">❌</span>
                      <span className="error-message">{file.error || 'Erro no processamento'}</span>
                    </>
                  )}
                  {file.status === 'warning' && !isDuplicate && (
                    <>
                      <span className="warning-icon">⚠️</span>
                      <span className="warning-message">{file.error || 'Requer Correção'}</span>
                    </>
                  )}
                  {isDuplicate && (
                    <>
                      <span className="duplicate-icon">📋</span>
                      <span className="duplicate-message">Documento já enviado anteriormente</span>
                    </>
                  )}
                </div>
              </div>
              <div className="file-actions">
                {isDuplicate && (
                  <button 
                    className="btn-info"
                    onClick={() => handleManualCorrection(file)}
                    title="Visualizar dados do documento"
                  >
                    👁️ Visualizar Dados
                  </button>
                )}
                {file.status === 'warning' && !isDuplicate && (
                  <button 
                    className="btn-warning"
                    onClick={() => handleManualCorrection(file)}
                  >
                    🔧 Corrigir Manualmente
                  </button>
                )}
                {file.canRetry && !isDuplicate && (
                  <button 
                    className="btn-retry"
                    onClick={() => handleRetry(file)}
                  >
                    🔄 Tentar Novamente
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
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
              // Verificar se o drag & drop excede o limite ANTES de processar
              const currentQueueSize = processingQueue.length;
              const totalDocuments = currentQueueSize + files.length;
              
              if (totalDocuments > MAX_DOCUMENTS_PER_BATCH) {
                addLog({
                  type: 'error',
                  message: `❌ Por favor, processar somente ${MAX_DOCUMENTS_PER_BATCH} no máximo por vez.`,
                  timestamp: new Date()
                });
                
                addLog({
                  type: 'warning',
                  message: `📊 Você arrastou ${files.length} arquivos, mas o limite é ${MAX_DOCUMENTS_PER_BATCH} documentos por lote.`,
                  timestamp: new Date()
                });
                
                if (currentQueueSize > 0) {
                  addLog({
                    type: 'info',
                    message: `💡 Já existem ${currentQueueSize} documentos na fila. Aguarde o processamento terminar ou limpe a fila.`,
                    timestamp: new Date()
                  });
                }
                
                return; // NÃO processa nenhum arquivo
              }
              
              // Se está dentro do limite, processa normalmente
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
                <p className="drop-subtitle">ou</p>
                <button 
                  className="select-files-button"
                  onClick={handleFileSelect}
                  disabled={processingQueue.length >= MAX_DOCUMENTS_PER_BATCH}
                >
                  📂 Selecionar Arquivos
                </button>
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
              {renderProcessedFiles()}
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
      
      {/* Input file oculto para seleção de arquivos */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".pdf"
        multiple
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default Explorer; 