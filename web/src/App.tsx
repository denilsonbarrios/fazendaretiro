import { useState, useEffect, Suspense, lazy } from 'react';
import './styles/main.scss';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';

// Carregar componentes de forma assíncrona
const MapPage = lazy(() => import('./components/MapPage'));
const KmlPage = lazy(() => import('./components/KmlPage'));
const DataPage = lazy(() => import('./components/DataPage'));
const ConfigPage = lazy(() => import('./components/ConfigPage'));
const ColheitaPage = lazy(() => import('./components/ColheitaPage'));

// Interface para Safra
interface Safra {
  id: string;
  nome: string;
  is_active: boolean;
  data_inicial_colheita: number | null;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, login, logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('map');
  const [safras, setSafras] = useState<Safra[]>([]);
  const [selectedSafra, setSelectedSafra] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewSafraModal, setShowNewSafraModal] = useState<boolean>(false);
  const [newSafraName, setNewSafraName] = useState<string>('');
  const [newSafraDataInicial, setNewSafraDataInicial] = useState<string>('');

  const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Helper para obter headers com autenticação
  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchSafras = async () => {
    try {
      const response = await fetch(`${BASE_URL}/safras`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Erro ao buscar safras');
      const records = await response.json();
      setSafras(records);
      if (!selectedSafra && records.length > 0) {
        setSelectedSafra(records[records.length - 1].id);
      }
    } catch (error) {
      console.error('Erro ao carregar safras:', error);
      setError('Erro ao carregar safras. Tente recarregar a página.');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchSafras();
    }
  }, [isAuthenticated]);

  const handleSafraChange = (safraId: string) => {
    setSelectedSafra(safraId);
  };

  const handleCreateSafra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSafraName) {
      setError('Por favor, informe o nome da safra.');
      return;
    }

    try {
      const dataInicial = newSafraDataInicial ? new Date(newSafraDataInicial).getTime() : null;

      const response = await fetch(`${BASE_URL}/safras`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          nome: newSafraName,
          is_active: true,
          data_inicial_colheita: dataInicial,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar safra');
      }

      const newSafra = await response.json();

      setNewSafraName('');
      setNewSafraDataInicial('');
      setShowNewSafraModal(false);
      await fetchSafras();
      setSelectedSafra(newSafra.id);
    } catch (error) {
      setError('Erro ao criar safra: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleCancelNewSafra = () => {
    setNewSafraName('');
    setNewSafraDataInicial('');
    setShowNewSafraModal(false);
  };

  if (error) {
    return <div>{error}</div>;
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={login} />;
  }

  return (
    <div className="app-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
        <div className="tabs">
          <div
            className={`tab ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            Mapa
          </div>
          <div
            className={`tab ${activeTab === 'colheita' ? 'active' : ''}`}
            onClick={() => setActiveTab('colheita')}
          >
            Colheita
          </div>
          <div
            className={`tab ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            Talhões
          </div>
          <div
            className={`tab ${activeTab === 'kml' ? 'active' : ''}`}
            onClick={() => setActiveTab('kml')}
          >
            Gerenciamento de KMLs
          </div>
          <div
            className={`tab ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            Configurações
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            Olá, <strong>{user?.nome || user?.username}</strong>
          </span>
          <label>Safra: </label>
          <select value={selectedSafra || ''} onChange={(e) => handleSafraChange(e.target.value)}>
            {safras.map((safra) => (
              <option key={safra.id} value={safra.id}>
                {safra.nome}
              </option>
            ))}
          </select>
          <button
            className="primary"
            onClick={() => setShowNewSafraModal(true)}
            style={{
              padding: '5px 10px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Nova Safra
          </button>
          <button
            onClick={logout}
            style={{
              padding: '5px 10px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </div>
      </div>

      {showNewSafraModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Criar Nova Safra</h3>
              <button className="close-button" onClick={handleCancelNewSafra}>×</button>
            </div>
            <form onSubmit={handleCreateSafra}>
              <div className="form-group">
                <label>Nome da Safra</label>
                <input
                  type="text"
                  value={newSafraName}
                  onChange={(e) => setNewSafraName(e.target.value)}
                  placeholder="Ex.: Safra 2025"
                  required
                />
              </div>
              <div className="form-group">
                <label>Data Inicial de Colheita (opcional)</label>
                <input
                  type="date"
                  value={newSafraDataInicial}
                  onChange={(e) => setNewSafraDataInicial(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button type="submit" className="primary">
                  Criar
                </button>
                <button type="button" className="danger" onClick={handleCancelNewSafra}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page">
        <Suspense fallback={<div>Carregando...</div>}>
          {activeTab === 'map' && <MapPage safraId={selectedSafra} />}
          {activeTab === 'colheita' && <ColheitaPage safraId={selectedSafra} />}
          {activeTab === 'data' && <DataPage safraId={selectedSafra} />}
          {activeTab === 'kml' && <KmlPage />}
          {activeTab === 'config' && <ConfigPage onSafraChange={fetchSafras} />}
        </Suspense>
      </div>

      {/* Adicionar o ToastContainer para exibir notificações */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
}