import React, { useState, useEffect } from 'react';
import { saveManualData, validateClient } from '../utils/fileManager';
import { saveNewDocumentType } from '../utils/pdfProcessor';
import { correctionLogsAPI, auth } from '../utils/supabaseClient';
import PDFViewer from './PDFViewer';
import '../styles/PDFForm.css';

const PDFForm = ({ fileData, onSubmit, onCancel }) => {
  console.log('🆕 PDFForm NOVA LÓGICA - Iniciando componente');
  console.log('🆕 PDFForm NOVA LÓGICA - fileData recebido:', fileData);
  
  // FUNÇÃO SIMPLIFICADA para extrair dados
  const extractDataFromFileData = (fileData) => {
    // PRIORIDADE 1: extractedData (nova estrutura)
    if (fileData?.extractedData && typeof fileData.extractedData === 'object') {
      console.log('✅ PDFForm - Usando extractedData:', fileData.extractedData);
      return fileData.extractedData;
    }
    
    // PRIORIDADE 2: result.data
    if (fileData?.result?.data && typeof fileData.result.data === 'object') {
      console.log('✅ PDFForm - Usando result.data:', fileData.result.data);
      return fileData.result.data;
    }
    
    // FALLBACK: Dados vazios
    console.log('❌ PDFForm - Usando dados vazios (fallback)');
    return {
      NOME_CLIENTE: '',
      DATA_ARQ: '',
      VALOR_PFD: '',
      CNPJ_CLIENTE: '',
      NOME_PDF: '',
      HASH: '',
      CNPJ_CURTO: '',
      STATUS: 'N'
    };
  };
  
  const extractedData = extractDataFromFileData(fileData);
  
  // Garantir que o nome do arquivo seja preenchido
  if (!extractedData.NOME_PDF && fileData?.name) {
    extractedData.NOME_PDF = fileData.name.replace('.pdf', '').toUpperCase();
  }
  
  const missingFields = fileData?.result?.missingFields || {};
  
  console.log('🎯 PDFForm - Dados extraídos final:', extractedData);
  
  // Inicialização do state com dados extraídos
  const [formData, setFormData] = useState({
    DATA_ARQ: extractedData.DATA_ARQ || '',
    VALOR_PFD: extractedData.VALOR_PFD || '',
    CNPJ_CLIENTE: extractedData.CNPJ_CLIENTE || '',
    NOME_CLIENTE: extractedData.NOME_CLIENTE || '',
    NOME_PDF: extractedData.NOME_PDF || '',
    HASH: extractedData.HASH || '',
    CNPJ_CURTO: extractedData.CNPJ_CURTO || '',
  });
  
  console.log('✅ PDFForm - Estado inicial do formulário:', formData);
  
  // EFEITO SIMPLIFICADO para atualizar formulário
  useEffect(() => {
    console.log('🆕 PDFForm NOVA LÓGICA - useEffect executado');
    console.log('🆕 PDFForm NOVA LÓGICA - fileData recebido:', fileData);
    
    // Extrair dados usando a nova função
    const dadosExtraidos = extractDataFromFileData(fileData);
    
    // Garantir que o nome do arquivo seja preenchido
    if (!dadosExtraidos.NOME_PDF && fileData?.name) {
      dadosExtraidos.NOME_PDF = fileData.name.replace('.pdf', '').toUpperCase();
    }
    
    console.log('🎯 PDFForm NOVA LÓGICA - Dados extraídos final:', dadosExtraidos);
    
    // Atualizar formulário diretamente
    setFormData({
      DATA_ARQ: dadosExtraidos.DATA_ARQ,
      VALOR_PFD: dadosExtraidos.VALOR_PFD,
      CNPJ_CLIENTE: dadosExtraidos.CNPJ_CLIENTE,
      NOME_CLIENTE: dadosExtraidos.NOME_CLIENTE,
      NOME_PDF: dadosExtraidos.NOME_PDF,
      HASH: dadosExtraidos.HASH,
      CNPJ_CURTO: dadosExtraidos.CNPJ_CURTO,
    });
    
    console.log('✅ PDFForm NOVA LÓGICA - FormData atualizado!');
    
    // Validação do CNPJ
    if (dadosExtraidos.CNPJ_CLIENTE && dadosExtraidos.CNPJ_CLIENTE.length > 14) {
      setClientValidated(true);
    }
  }, [fileData]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clientValidated, setClientValidated] = useState(false);
  const [correctionStartTime] = useState(Date.now()); // Tempo de início da correção
  const [newDocumentType, setNewDocumentType] = useState('');
  const [newDocumentKeywords, setNewDocumentKeywords] = useState('');
  const [customDocType, setCustomDocType] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  
  // Verifica e preenche o CNPJ_CURTO se o CNPJ_CLIENTE estiver presente
  useEffect(() => {
    if (formData.CNPJ_CLIENTE && !formData.CNPJ_CURTO) {
      const cnpjNumeros = formData.CNPJ_CLIENTE.replace(/\D/g, '');
      if (cnpjNumeros.length >= 6) {
        setFormData(prev => ({
          ...prev,
          CNPJ_CURTO: cnpjNumeros.substring(0, 6)
        }));
      }
    }
    
    // Verifica se já temos CNPJ válido para marcar como validado
    if (formData.CNPJ_CLIENTE && formData.CNPJ_CLIENTE.length > 14) {
      setClientValidated(true);
    }
  }, [formData.CNPJ_CLIENTE]);
  
  // Função para formatar CNPJ automaticamente
  const formatCNPJ = (value) => {
    // Remove todos os caracteres não numéricos
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 14 dígitos
    const limitedNumbers = numbers.substring(0, 14);
    
    // Aplica a formatação XX.XXX.XXX/XXXX-XX
    if (limitedNumbers.length <= 2) {
      return limitedNumbers;
    } else if (limitedNumbers.length <= 5) {
      return limitedNumbers.replace(/(\d{2})(\d+)/, '$1.$2');
    } else if (limitedNumbers.length <= 8) {
      return limitedNumbers.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
    } else if (limitedNumbers.length <= 12) {
      return limitedNumbers.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
    } else {
      return limitedNumbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    let processedValue = value;
    
    // Aplica formatação específica para CNPJ
    if (name === 'CNPJ_CLIENTE') {
      processedValue = formatCNPJ(value);
      setClientValidated(false);
      
      // Atualiza CNPJ_CURTO automaticamente
      const numbers = processedValue.replace(/\D/g, '');
      const cnpjCurto = numbers.substring(0, 6);
      
      setFormData(prev => ({
        ...prev,
        [name]: processedValue,
        CNPJ_CURTO: cnpjCurto
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };
  
  const handleDocumentTypeSelect = (type) => {
    if (type === 'CUSTOM') {
      setShowCustomInput(true);
      setFormData(prev => ({
        ...prev,
        NOME_PDF: ''
      }));
    } else {
      setShowCustomInput(false);
      setCustomDocType('');
      setFormData(prev => ({
        ...prev,
        NOME_PDF: type
      }));
    }
  };
  
  const handleCustomDocTypeChange = (e) => {
    const value = e.target.value.toUpperCase();
    setCustomDocType(value);
    setFormData(prev => ({
      ...prev,
      NOME_PDF: value
    }));
  };
  
  const validateCNPJ = async () => {
    if (!formData.CNPJ_CLIENTE) {
      setError('CNPJ do cliente é obrigatório.');
      return false;
    }
    
    setLoading(true);
    const { valid, cliente, error } = await validateClient(formData.CNPJ_CLIENTE);
    setLoading(false);
    
    if (error) {
      setError(`Erro ao validar cliente: ${error.message}`);
      return false;
    }
    
    if (!valid) {
      setError('Cliente não encontrado no sistema.');
      return false;
    }
    
    // Preenche nome do cliente se estiver vazio
    if (!formData.NOME_CLIENTE && cliente.NOME_CLIENTE) {
      setFormData(prev => ({
        ...prev,
        NOME_CLIENTE: cliente.NOME_CLIENTE
      }));
    }
    
    setClientValidated(true);
    setError(null);
    return true;
  };
  
  const handleSaveNewDocumentType = async () => {
    if (!newDocumentType) {
      setError('O nome do tipo de documento é obrigatório.');
      return;
    }
    
    setLoading(true);
    try {
      // Extrai palavras-chave do nome se não fornecidas
      const keywords = newDocumentKeywords || newDocumentType.split(' ').join(',');
      
      // Salva o novo tipo no banco
      const result = await saveNewDocumentType(
        newDocumentType,
        keywords,
        extractedData.rawText
      );
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Atualiza o tipo do documento atual
      handleDocumentTypeSelect(newDocumentType);
      
      // Limpa os campos
      setNewDocumentType('');
      setNewDocumentKeywords('');
      
      // Mostra mensagem de sucesso
      setError(null);
    } catch (err) {
      console.error('Erro ao salvar novo tipo de documento:', err);
      setError(`Erro ao salvar tipo de documento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Função para salvar log de correção manual
  const saveCorrectionLog = async (aiData, correctedData) => {
    try {
      // Só salva log se não for apenas visualização
      if (fileData?.isViewing) {
        console.log('📝 Modo visualização - não salvando log de correção');
        return;
      }

      const { user } = await auth.getCurrentUser();
      if (!user) {
        console.log('❌ Usuário não autenticado - não salvando log');
        return;
      }

      // Identificar campos que foram corrigidos
      const fieldsCorrectied = correctionLogsAPI.identifyCorrectiedFields(aiData, correctedData);
      
      if (fieldsCorrectied.length === 0) {
        console.log('📝 Nenhum campo foi corrigido - não salvando log');
        return;
      }

      // Calcular tempo de correção em segundos
      const correctionTimeSeconds = Math.floor((Date.now() - correctionStartTime) / 1000);

      // Determinar motivo da correção
      let correctionReason = 'Dados extraídos pela IA necessitaram correção manual';
      if (fieldsCorrectied.includes('DATA_ARQ')) {
        correctionReason = 'Data do documento inválida ou não identificada';
      } else if (fieldsCorrectied.includes('VALOR_PFD')) {
        correctionReason = 'Valor do documento não identificado corretamente';
      } else if (fieldsCorrectied.includes('CNPJ_CLIENTE')) {
        correctionReason = 'CNPJ do cliente não identificado';
      }

      const logData = {
        user_id: user.id,
        document_name: fileData.name || fileData.fullName || 'Documento desconhecido',
        document_url: fileData.url || null,
        ai_extracted_data: aiData,
        manually_corrected_data: correctedData,
        fields_corrected: fieldsCorrectied,
        correction_reason: correctionReason,
        correction_time_seconds: correctionTimeSeconds,
        processing_session_id: correctionLogsAPI.generateSessionId(),
        document_type: correctedData.NOME_PDF || 'DESCONHECIDO'
      };

      console.log('📝 Salvando log de correção:', logData);
      
      const result = await correctionLogsAPI.saveCorrectionLog(logData);
      if (result.success) {
        console.log('✅ Log de correção salvo com sucesso');
      } else {
        console.error('❌ Erro ao salvar log de correção:', result.error);
      }
    } catch (error) {
      console.error('❌ Erro ao processar log de correção:', error);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Valida campos obrigatórios
    if (!formData.DATA_ARQ) {
      setError('Data do arquivo é obrigatória.');
      return;
    }
    
    // NOVA VALIDAÇÃO: Verificar data do documento (exceto para 1 TAXA ENCERRAMENTO ANUAL que não tem vencimento)
    if (formData.NOME_PDF !== '1 TAXA ENCERRAMENTO ANUAL') {
      try {
        const [day, month, year] = formData.DATA_ARQ.split('/').map(Number);
        const documentDate = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Formata as datas para exibição
        const formatDate = (date) => {
          const d = date.getDate().toString().padStart(2, '0');
          const m = (date.getMonth() + 1).toString().padStart(2, '0');
          const y = date.getFullYear();
          return `${d}/${m}/${y}`;
        };

        if (documentDate < today) {
          setError(`⚠️ Data do documento (${formatDate(documentDate)}) é anterior à data atual (${formatDate(today)}). Por favor, verifique e corrija a data.`);
          return;
        }
      } catch (error) {
        setError('Data inválida. Use o formato DD/MM/YYYY.');
        return;
      }
    }
    
    if (!formData.VALOR_PFD) {
      setError('Valor do documento é obrigatório.');
      return;
    }
    
    if (!formData.NOME_PDF || formData.NOME_PDF === 'DESCONHECIDO') {
      setError('Tipo de documento é obrigatório.');
      return;
    }
    
    if (!clientValidated) {
      const isValid = await validateCNPJ();
      if (!isValid) return;
    }
    
    setLoading(true);
    try {
      // Salvar log de correção ANTES de salvar os dados (assíncrono)
      const aiExtractedData = extractDataFromFileData(fileData);
      saveCorrectionLog(aiExtractedData, formData); // Não aguarda, executa em background
      
      const result = await saveManualData(fileData, formData);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      onSubmit(result.data);
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      setError(`Erro ao salvar dados: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="pdf-form-overlay">
      <div className="pdf-form-container">
        <div className="pdf-form-header">
          <h2>Preenchimento Manual</h2>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>
        
        <div className="pdf-form-content">
          <div className="file-info">
            <div className="file-info-header">
              <div>
                <strong>Arquivo:</strong> {fileData.name}
              </div>
              <button
                type="button"
                className="view-pdf-button"
                onClick={() => setShowPDFViewer(true)}
                title="Visualizar documento PDF"
                disabled={!fileData.data && !fileData.originalFileData}
              >
                👁️ Visualizar PDF
              </button>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className={`form-group ${missingFields.DATA_ARQ ? 'missing' : ''}`}>
                <label htmlFor="DATA_ARQ">Data do Documento:</label>
                <input
                  id="DATA_ARQ"
                  name="DATA_ARQ"
                  type="text"
                  placeholder="DD/MM/AAAA"
                  value={formData.DATA_ARQ}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className={`form-group ${missingFields.VALOR_PFD ? 'missing' : ''}`}>
                <label htmlFor="VALOR_PFD">Valor (R$):</label>
                <input
                  id="VALOR_PFD"
                  name="VALOR_PFD"
                  type="text"
                  placeholder="0.000,00"
                  value={formData.VALOR_PFD}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className={`form-group ${missingFields.CNPJ_CLIENTE ? 'missing' : ''}`}>
                <label htmlFor="CNPJ_CLIENTE">CNPJ do Cliente:</label>
                <div className="input-with-button">
                  <input
                    id="CNPJ_CLIENTE"
                    name="CNPJ_CLIENTE"
                    type="text"
                    placeholder="XX.XXX.XXX/XXXX-XX"
                    value={formData.CNPJ_CLIENTE}
                    onChange={handleInputChange}
                    maxLength="18"
                    title="Digite apenas números - a formatação será aplicada automaticamente"
                    required
                  />
                  <button 
                    type="button" 
                    className="validate-button"
                    onClick={validateCNPJ}
                    disabled={loading || !formData.CNPJ_CLIENTE}
                  >
                    Validar
                  </button>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="CNPJ_CURTO">CNPJ Curto:</label>
                <input
                  id="CNPJ_CURTO"
                  name="CNPJ_CURTO"
                  type="text"
                  placeholder="6 primeiros dígitos"
                  value={formData.CNPJ_CURTO}
                  onChange={handleInputChange}
                  readOnly
                />
              </div>
            </div>
            
            <div className={`form-group ${missingFields.NOME_CLIENTE ? 'missing' : ''}`}>
              <label htmlFor="NOME_CLIENTE">Nome do Cliente:</label>
              <input
                id="NOME_CLIENTE"
                name="NOME_CLIENTE"
                type="text"
                placeholder="Nome do cliente"
                value={formData.NOME_CLIENTE}
                onChange={handleInputChange}
                required
              />
            </div>
            
            {formData.NOME_PDF === 'DESCONHECIDO' ? (
              <div className="form-group new-doc-type missing">
                <label>Novo Tipo de Documento:</label>
                <div className="new-type-inputs">
                  <input
                    type="text"
                    placeholder="Nome do tipo de documento (ex: IPTU)"
                    value={newDocumentType}
                    onChange={(e) => setNewDocumentType(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Palavras-chave separadas por vírgula (opcional)"
                    value={newDocumentKeywords}
                    onChange={(e) => setNewDocumentKeywords(e.target.value)}
                  />
                  <button
                    type="button"
                    className="save-type-button"
                    onClick={handleSaveNewDocumentType}
                    disabled={loading || !newDocumentType}
                  >
                    Salvar Tipo
                  </button>
                </div>
                <p className="help-text">
                  Este documento não foi reconhecido automaticamente. 
                  Por favor, nomeie este tipo de documento e adicione palavras-chave 
                  para ajudar o sistema a reconhecer documentos semelhantes no futuro.
                </p>
              </div>
            ) : (
              <div className={`form-group doc-type ${missingFields.NOME_PDF ? 'missing' : ''}`}>
                <label>Tipo de Documento:</label>
                <div className="doc-type-options">
                  {['DARF', 'FGTS', 'GPS', 'HOLERITE', 'NOTA FISCAL', 'PARCELAMENTO', 'RECIBO parcela 13  SALARIO', '1 TAXA ENCERRAMENTO ANUAL'].map(type => (
                    <button
                      key={type}
                      type="button"
                      className={`doc-type-button ${formData.NOME_PDF === type ? 'selected' : ''}`}
                      onClick={() => handleDocumentTypeSelect(type)}
                    >
                      {type}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`doc-type-button custom ${showCustomInput ? 'selected' : ''}`}
                    onClick={() => handleDocumentTypeSelect('CUSTOM')}
                  >
                    📝 Personalizado
                  </button>
                </div>
                
                {showCustomInput && (
                  <div className="custom-doc-type-input">
                    <input
                      type="text"
                      placeholder="Digite o tipo de documento (ex: IPTU, IPVA, etc.)"
                      value={customDocType}
                      onChange={handleCustomDocTypeChange}
                      className="custom-type-field"
                      autoFocus
                    />
                    <p className="help-text">
                      Digite o nome do tipo de documento em maiúsculas
                    </p>
                  </div>
                )}
                
                {formData.NOME_PDF && !['DARF', 'FGTS', 'GPS', 'HOLERITE', 'NOTA FISCAL', 'PARCELAMENTO', 'RECIBO parcela 13  SALARIO', '1 TAXA ENCERRAMENTO ANUAL'].includes(formData.NOME_PDF) && !showCustomInput && (
                  <div className="detected-type-info">
                    <p>Tipo detectado: <strong>{formData.NOME_PDF}</strong></p>
                    <button
                      type="button"
                      className="doc-type-button selected"
                      onClick={() => handleDocumentTypeSelect(formData.NOME_PDF)}
                    >
                      Manter "{formData.NOME_PDF}"
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={onCancel}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
        
        {/* Visualizador de PDF */}
        {showPDFViewer && (
          <PDFViewer
            pdfData={fileData.originalFileData || fileData.data}
            fileName={fileData.name}
            onClose={() => setShowPDFViewer(false)}
          />
        )}
      </div>
    </div>
  );
};

export default PDFForm; 