import React, { useState, useEffect } from 'react';
import { auth } from '../utils/supabaseClient';
import '../styles/Login.css';

const Login = ({ onLogin }) => {
  const [cnpj, setCnpj] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    // Verifica se já está logado ao carregar
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    setLoading(true);
    const { user, error } = await auth.getCurrentUser();
    setLoading(false);
    
    if (user) {
      setLoggedInUser(user);
      onLogin(user);
    }
  };

  // Função para formatar CNPJ
  const formatCNPJ = (value) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    
    // Aplica a máscara XX.XXX.XXX/XXXX-XX
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return numbers.replace(/(\d{2})(\d+)/, '$1.$2');
    if (numbers.length <= 8) return numbers.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
    if (numbers.length <= 12) return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
  };

  // Função para converter CNPJ em email
  const cnpjToEmail = (cnpj) => {
    return `${cnpj}@gmail.com`;
  };

  const handleCnpjChange = (e) => {
    const value = e.target.value;
    const formatted = formatCNPJ(value);
    setCnpj(formatted);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!cnpj || !password) {
      setError('Por favor, preencha todos os campos.');
      setLoading(false);
      return;
    }

    // Validação básica de CNPJ (14 dígitos)
    const numbersOnly = cnpj.replace(/\D/g, '');
    if (numbersOnly.length !== 14) {
      setError('CNPJ deve conter 14 dígitos.');
      setLoading(false);
      return;
    }

    try {
      // Converte CNPJ para email
      const email = cnpjToEmail(cnpj);
      
      const { data, error } = await auth.login(email, password);
      
      if (error) {
        throw error;
      }
      
      if (data?.user) {
        setLoggedInUser(data.user);
        onLogin(data.user);
      }
    } catch (err) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
      console.error('Erro de login:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    const { error } = await auth.logout();
    
    if (error) {
      console.error('Erro ao fazer logout:', error);
    } else {
      setLoggedInUser(null);
    }
    
    setLoading(false);
  };

  // Se já estiver logado, mostra um botão de logout
  if (loggedInUser) {
    return (
      <div className="login-container logged-in">
        <div className="user-info">
          <h2>Bem-vindo!</h2>
          <p>{loggedInUser.email}</p>
        </div>
        <button 
          className="logout-button" 
          onClick={handleLogout} 
          disabled={loading}
        >
          {loading ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>EnvioDocsAPI</h2>
        <form onSubmit={handleLogin}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="cnpj">CNPJ</label>
            <input
              id="cnpj"
              type="text"
              value={cnpj}
              onChange={handleCnpjChange}
              placeholder="00.000.000/0000-00"
              maxLength="18"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="login-button" 
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login; 