import { useState, useEffect } from 'react';
import { MapPage } from './components/MapPage';
import { KmlPage } from './components/KmlPage';
import { DataPage } from './components/DataPage';
import { ConfigPage } from './components/ConfigPage';
import { ColheitaPage } from './components/ColheitaPage';
import './styles/main.scss';

// Interface para Safra, definida localmente com base nos dados retornados pelo backend
interface Safra {
  id: string;
  nome: string;
  is_active: boolean;
  data_inicial_colheita: number | null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('map');
  const [safras, setSafras] = useState<Safra[]>([]);
  const [selectedSafra, setSelectedSafra] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

  const fetchSafras = async () => {
    try {
      const response = await fetch(`${BASE_URL}/safras`);
      if (!response.ok) throw new Error('Erro ao buscar safras');
      const records = await response.json();
      setSafras(records);
      const activeSafra = records.find((safra: Safra) => safra.is_active);
      setSelectedSafra(activeSafra ? activeSafra.id : records.length > 0 ? records[0].id : null);
    } catch (error) {
      console.error('Erro ao carregar safras:', error);
      setError('Erro ao carregar safras. Tente recarregar a página.');
    }
  };

  useEffect(() => {
    fetchSafras();
  }, []);

  const handleSafraChange = async (safraId: string) => {
    try {
      // Atualizar o status is_active de todas as safras
      const updatedSafras = safras.map((safra) => ({
        ...safra,
        is_active: safra.id === safraId,
      }));

      // Enviar atualizações para o backend
      await Promise.all(
        updatedSafras.map(async (safra) => {
          const response = await fetch(`${BASE_URL}/safras/${safra.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nome: safra.nome,
              is_active: safra.is_active,
              data_inicial_colheita: safra.data_inicial_colheita,
            }),
          });
          if (!response.ok) throw new Error(`Erro ao atualizar safra ${safra.id}`);
        })
      );

      setSelectedSafra(safraId);
      await fetchSafras(); // Atualiza a lista de safras após a mudança
    } catch (error) {
      setError('Erro ao atualizar safra: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  if (error) {
    return <div>{error}</div>;
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
        <div>
          <label>Safra: </label>
          <select value={selectedSafra || ''} onChange={(e) => handleSafraChange(e.target.value)}>
            {safras.map((safra) => (
              <option key={safra.id} value={safra.id}>
                {safra.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="page">
        {activeTab === 'map' && <MapPage safraId={selectedSafra} />}
        {activeTab === 'colheita' && <ColheitaPage safraId={selectedSafra} />}
        {activeTab === 'data' && <DataPage />}
        {activeTab === 'kml' && <KmlPage />}
        {activeTab === 'config' && <ConfigPage onSafraChange={fetchSafras} />}
      </div>
    </div>
  );
}