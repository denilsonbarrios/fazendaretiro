import { useState, useEffect } from 'react';

// Interfaces definidas localmente com base nos dados retornados pelo backend
interface ConfigOption {
  id: string;
  name: string;
  default_color: string;
}

interface Safra {
  id: string;
  nome: string;
  is_active: boolean;
  data_inicial_colheita: number | null;
}

interface SafraFormData {
  id?: string;
  nome: string;
  dataInicialColheita: string; // Será uma string no formato YYYY-MM-DD vinda do input type="date"
}

interface ConfigPageProps {
  onSafraChange?: () => void; // Callback para notificar mudanças nas safras
}

function ConfigPage({ onSafraChange }: ConfigPageProps) {
  const [tipoConfigs, setTipoConfigs] = useState<ConfigOption[]>([]);
  const [variedadeConfigs, setVariedadeConfigs] = useState<ConfigOption[]>([]);
  const [safras, setSafras] = useState<Safra[]>([]);
  const [tipoFormData, setTipoFormData] = useState<{ name: string; defaultColor: string; editingId?: string } | null>(null);
  const [variedadeFormData, setVariedadeFormData] = useState<{ name: string; defaultColor: string; editingId?: string } | null>(null);
  const [safraFormData, setSafraFormData] = useState<SafraFormData | null>(null);
  const [message, setMessage] = useState<string>('');

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

  const fetchConfigs = async () => {
    try {
      const tipoResponse = await fetch(`${BASE_URL}/tipo_configs`);
      if (!tipoResponse.ok) throw new Error('Erro ao buscar tipos');
      const tipoRecords = await tipoResponse.json();

      const variedadeResponse = await fetch(`${BASE_URL}/variedade_configs`);
      if (!variedadeResponse.ok) throw new Error('Erro ao buscar variedades');
      const variedadeRecords = await variedadeResponse.json();

      setTipoConfigs(tipoRecords);
      setVariedadeConfigs(variedadeRecords);
    } catch (error) {
      setMessage('Erro ao carregar configurações: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const fetchSafrasData = async () => {
    try {
      const response = await fetch(`${BASE_URL}/safras`);
      if (!response.ok) throw new Error('Erro ao buscar safras');
      const records = await response.json();
      console.log('ConfigPage: Safras carregadas:', JSON.stringify(records, null, 2));
      setSafras(records);
    } catch (error) {
      setMessage('Erro ao carregar safras: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchSafrasData();
  }, []);

  const handleCreateOrUpdateTipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoFormData) return;

    try {
      const configData = {
        name: tipoFormData.name,
        default_color: tipoFormData.defaultColor,
      };
      if (tipoFormData.editingId) {
        const response = await fetch(`${BASE_URL}/tipo_configs/${tipoFormData.editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData),
        });
        if (!response.ok) throw new Error('Erro ao atualizar tipo');
      } else {
        const response = await fetch(`${BASE_URL}/tipo_configs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData),
        });
        if (!response.ok) throw new Error('Erro ao adicionar tipo');
      }
      setTipoFormData(null);
      await fetchConfigs();
      setMessage(tipoFormData.editingId ? 'Tipo atualizado com sucesso!' : 'Tipo adicionado com sucesso!');
    } catch (error) {
      setMessage('Erro ao salvar tipo: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleCreateOrUpdateVariedade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variedadeFormData) return;

    try {
      const configData = {
        name: variedadeFormData.name,
        default_color: variedadeFormData.defaultColor,
      };
      if (variedadeFormData.editingId) {
        const response = await fetch(`${BASE_URL}/variedade_configs/${variedadeFormData.editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData),
        });
        if (!response.ok) throw new Error('Erro ao atualizar variedade');
      } else {
        const response = await fetch(`${BASE_URL}/variedade_configs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData),
        });
        if (!response.ok) throw new Error('Erro ao adicionar variedade');
      }
      setVariedadeFormData(null);
      await fetchConfigs();
      setMessage(variedadeFormData.editingId ? 'Variedade atualizada com sucesso!' : 'Variedade adicionada com sucesso!');
    } catch (error) {
      setMessage('Erro ao salvar variedade: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleCreateOrUpdateSafra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safraFormData || !safraFormData.dataInicialColheita) {
      setMessage('Por favor, preencha todos os campos.');
      return;
    }

    try {
      const [year, month, day] = safraFormData.dataInicialColheita.split('-').map(Number);
      const dataInicialColheita = new Date(Date.UTC(year, month - 1, day));
      const timestamp = dataInicialColheita.getTime();
      console.log('ConfigPage: Antes de salvar safra:', {
        nome: safraFormData.nome,
        dataInicialColheitaInput: safraFormData.dataInicialColheita,
        dataInicialColheita: dataInicialColheita.toISOString(),
        dataInicialColheitaTimestamp: timestamp,
      });

      const safraData = {
        nome: safraFormData.nome,
        is_active: false,
        data_inicial_colheita: timestamp,
      };

      if (safraFormData.id) {
        const response = await fetch(`${BASE_URL}/safras/${safraFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(safraData),
        });
        if (!response.ok) throw new Error('Erro ao atualizar safra');
      } else {
        const response = await fetch(`${BASE_URL}/safras`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(safraData),
        });
        if (!response.ok) throw new Error('Erro ao criar safra');
      }

      setSafraFormData(null);
      await fetchSafrasData();
      if (onSafraChange) {
        onSafraChange();
      }
      setMessage(safraFormData.id ? 'Safra atualizada com sucesso!' : 'Safra criada com sucesso!');
    } catch (error) {
      setMessage('Erro ao criar/atualizar safra: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      console.error('Erro ao criar/atualizar safra:', error);
    }
  };

  const handleEditTipo = (config: ConfigOption) => {
    setTipoFormData({
      name: config.name,
      defaultColor: config.default_color,
      editingId: config.id,
    });
    setMessage('');
  };

  const handleEditVariedade = (config: ConfigOption) => {
    setVariedadeFormData({
      name: config.name,
      defaultColor: config.default_color,
      editingId: config.id,
    });
    setMessage('');
  };

  const handleEditSafra = (safra: Safra) => {
    setSafraFormData({
      id: safra.id,
      nome: safra.nome,
      dataInicialColheita: safra.data_inicial_colheita ? new Date(safra.data_inicial_colheita).toISOString().split('T')[0] : '',
    });
    setMessage('');
  };

  const handleDeleteTipo = async (id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/tipo_configs/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir tipo');
      await fetchConfigs();
      setMessage('Tipo excluído com sucesso!');
    } catch (error) {
      setMessage('Erro ao excluir tipo: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleDeleteVariedade = async (id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/variedade_configs/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir variedade');
      await fetchConfigs();
      setMessage('Variedade excluída com sucesso!');
    } catch (error) {
      setMessage('Erro ao excluir variedade: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleDeleteSafra = async (id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/safras/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir safra');
      await fetchSafrasData();
      if (onSafraChange) {
        onSafraChange();
      }
      setMessage('Safra excluída com sucesso!');
    } catch (error) {
      setMessage('Erro ao excluir safra: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleCancelTipo = () => {
    setTipoFormData(null);
    setMessage('');
  };

  const handleCancelVariedade = () => {
    setVariedadeFormData(null);
    setMessage('');
  };

  const handleCancelSafra = () => {
    setSafraFormData(null);
    setMessage('');
  };

  return (
    <div>
      <h2>Configurações</h2>
      {message && (
        <p className={`message ${message.includes('Erro') ? 'error' : 'success'}`}>
          {message}
        </p>
      )}

      {/* Configuração de Tipos */}
      <h3>Tipos</h3>
      {tipoFormData ? (
        <form onSubmit={handleCreateOrUpdateTipo}>
          <input
            type="text"
            placeholder="Nome do Tipo"
            value={tipoFormData.name}
            onChange={(e) => setTipoFormData({ ...tipoFormData, name: e.target.value })}
            required
          />
          <input
            type="color"
            value={tipoFormData.defaultColor}
            onChange={(e) => setTipoFormData({ ...tipoFormData, defaultColor: e.target.value })}
            required
          />
          <div>
            <button className="primary" type="submit">
              {tipoFormData.editingId ? 'Atualizar' : 'Adicionar'}
            </button>
            <button className="danger" type="button" onClick={handleCancelTipo} style={{ marginLeft: '10px' }}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          className="primary"
          onClick={() => setTipoFormData({ name: '', defaultColor: '#FF0000' })}
        >
          Novo Tipo
        </button>
      )}

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Cor Padrão</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {tipoConfigs.map((config) => (
            <tr key={config.id}>
              <td>{config.name}</td>
              <td>
                <div style={{ backgroundColor: config.default_color, width: '20px', height: '20px', display: 'inline-block' }}></div> {config.default_color}
              </td>
              <td>
                <button className="primary" onClick={() => handleEditTipo(config)}>
                  Editar
                </button>
                <button className="danger" onClick={() => handleDeleteTipo(config.id)} style={{ marginLeft: '10px' }}>
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Configuração de Variedades */}
      <h3>Variedades</h3>
      {variedadeFormData ? (
        <form onSubmit={handleCreateOrUpdateVariedade}>
          <input
            type="text"
            placeholder="Nome da Variedade"
            value={variedadeFormData.name}
            onChange={(e) => setVariedadeFormData({ ...variedadeFormData, name: e.target.value })}
            required
          />
          <input
            type="color"
            value={variedadeFormData.defaultColor}
            onChange={(e) => setVariedadeFormData({ ...variedadeFormData, defaultColor: e.target.value })}
            required
          />
          <div>
            <button className="primary" type="submit">
              {variedadeFormData.editingId ? 'Atualizar' : 'Adicionar'}
            </button>
            <button className="danger" type="button" onClick={handleCancelVariedade} style={{ marginLeft: '10px' }}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          className="primary"
          onClick={() => setVariedadeFormData({ name: '', defaultColor: '#FF0000' })}
        >
          Nova Variedade
        </button>
      )}

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Cor Padrão</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {variedadeConfigs.map((config) => (
            <tr key={config.id}>
              <td>{config.name}</td>
              <td>
                <div style={{ backgroundColor: config.default_color, width: '20px', height: '20px', display: 'inline-block' }}></div> {config.default_color}
              </td>
              <td>
                <button className="primary" onClick={() => handleEditVariedade(config)}>
                  Editar
                </button>
                <button className="danger" onClick={() => handleDeleteVariedade(config.id)} style={{ marginLeft: '10px' }}>
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Configuração de Safras */}
      <h3>Safras</h3>
      {safraFormData ? (
        <form onSubmit={handleCreateOrUpdateSafra}>
          <input
            type="text"
            placeholder="Nome da Safra (ex.: Safra 2025)"
            value={safraFormData.nome}
            onChange={(e) => setSafraFormData({ ...safraFormData, nome: e.target.value })}
            required
          />
          <input
            type="date"
            placeholder="Data Inicial de Colheita"
            value={safraFormData.dataInicialColheita}
            onChange={(e) => setSafraFormData({ ...safraFormData, dataInicialColheita: e.target.value })}
            required
          />
          <div>
            <button className="primary" type="submit">
              {safraFormData.id ? 'Atualizar' : 'Adicionar'}
            </button>
            <button className="danger" type="button" onClick={handleCancelSafra} style={{ marginLeft: '10px' }}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          className="primary"
          onClick={() => setSafraFormData({ nome: '', dataInicialColheita: '' })}
        >
          Nova Safra
        </button>
      )}

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Ativa</th>
            <th>Data Inicial de Colheita</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {safras.map((safra) => (
            <tr key={safra.id}>
              <td>{safra.nome}</td>
              <td>{safra.is_active ? 'Sim' : 'Não'}</td>
              <td>{safra.data_inicial_colheita ? new Date(safra.data_inicial_colheita).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não definida'}</td>
              <td>
                <button className="primary" onClick={() => handleEditSafra(safra)}>
                  Editar
                </button>
                <button className="danger" onClick={() => handleDeleteSafra(safra.id)} style={{ marginLeft: '10px' }}>
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ConfigPage;