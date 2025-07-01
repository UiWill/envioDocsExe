import React, { useState, useEffect } from 'react';
import { saveManualData, validateClient } from '../utils/fileManager';
import { saveNewDocumentType } from '../utils/pdfProcessor';
import PDFViewer from './PDFViewer';
import '../styles/PDFForm.css';

const PDFForm = ({ fileData, onSubmit, onCancel }) => {
  // Verificar estrutura de dados recebida
  console.log('PDFForm - Dados recebidos:', JSON.stringify(fileData, null, 2));
  
  // Acessar os dados de forma mais robusta - pode vir em diferentes estruturas
  const { result } = fileData || {};
  let extractedData = result?.data || {};
  
  // Se não encontrou dados em result.data, tenta outras possibilidades
  if (!extractedData || Object.keys(extractedData).length === 0) {
    // Verifica se os dados estão diretamente no fileData
    if (fileData && fileData.DATA_ARQ) {
      extractedData = fileData;
    }
    // Verifica se os dados estão em fileData.data
    else if (fileData?.data && typeof fileData.data === 'object') {
      extractedData = fileData.data;
    }
  }
  
  const missingFields = result?.missingFields || {};
  
  // Debug para verificar se os dados estão estruturados corretamente
  console.log('PDFForm - extractedData final:', extractedData);
  console.log('PDFForm - Valor da data:', extractedData.DATA_ARQ);
  console.log('PDFForm - Valor do CNPJ:', extractedData.CNPJ_CLIENTE);
  console.log('PDFForm - Nome do cliente:', extractedData.NOME_CLIENTE);
  console.log('PDFForm - Valor:', extractedData.VALOR_PFD);
  console.log('PDFForm - Nome PDF:', extractedData.NOME_PDF);
  
  // Inicialização do state garantindo valores iniciais corretos
  const [formData, setFormData] = useState({
    DATA_ARQ: extractedData.DATA_ARQ || '',
    VALOR_PFD: extractedData.VALOR_PFD || '',
    CNPJ_CLIENTE: extractedData.CNPJ_CLIENTE || '',
    NOME_CLIENTE: extractedData.NOME_CLIENTE || '',
    NOME_PDF: extractedData.NOME_PDF || '',
    HASH: extractedData.HASH || '',
    CNPJ_CURTO: extractedData.CNPJ_CURTO || '',
  });
  
  // Debug do estado inicial do formulário
  console.log('PDFForm - Estado inicial do formulário:', formData);
  
  // Efeito para atualizar o formulário quando recebermos novos dados
  useEffect(() => {
    // Reprocessa os dados sempre que fileData mudar
    const { result } = fileData || {};
    let newExtractedData = result?.data || {};
    
    // Se não encontrou dados em result.data, tenta outras possibilidades
    if (!newExtractedData || Object.keys(newExtractedData).length === 0) {
      if (fileData && fileData.DATA_ARQ) {
        newExtractedData = fileData;
      } else if (fileData?.data && typeof fileData.data === 'object') {
        newExtractedData = fileData.data;
      }
    }
    
    console.log('PDFForm - useEffect - Atualizando dados:', newExtractedData);
    
    // Este efeito garante que os dados sejam atualizados se o componente
    // for remontado com dados diferentes
    setFormData({
      DATA_ARQ: newExtractedData.DATA_ARQ || '',
      VALOR_PFD: newExtractedData.VALOR_PFD || '',
      CNPJ_CLIENTE: newExtractedData.CNPJ_CLIENTE || '',
      NOME_CLIENTE: newExtractedData.NOME_CLIENTE || '',
      NOME_PDF: newExtractedData.NOME_PDF || '',
      HASH: newExtractedData.HASH || '',
      CNPJ_CURTO: newExtractedData.CNPJ_CURTO || '',
    });
    
    // Atualizamos o status de validação do cliente
    if (newExtractedData.CNPJ_CLIENTE && newExtractedData.CNPJ_CLIENTE.length > 14) {
      setClientValidated(true);
    }
  }, [fileData]); // Dependência do efeito mudou para fileData completo
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clientValidated, setClientValidated] = useState(false);
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
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Valida campos obrigatórios
    if (!formData.DATA_ARQ) {
      setError('Data do arquivo é obrigatória.');
      return;
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
                  {['DARF', 'FGTS', 'GPS', 'HOLERITE', 'NOTA FISCAL', 'PARCELAMENTO'].map(type => (
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
                
                {formData.NOME_PDF && !['DARF', 'FGTS', 'GPS', 'HOLERITE', 'NOTA FISCAL', 'PARCELAMENTO'].includes(formData.NOME_PDF) && !showCustomInput && (
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
            pdfData={fileData.data}
            fileName={fileData.name}
            onClose={() => setShowPDFViewer(false)}
          />
        )}
      </div>
    </div>
  );
};

export default PDFForm; 