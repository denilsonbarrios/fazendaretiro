import { useState, useEffect } from 'react';
import { toast } from 'react-toastify'; // Importar o toast

// Interfaces definidas localmente com base nos dados retornados pelo backend
interface Talhao {
  id: string;
  TalhaoID?: string;
  TIPO: string;
  NOME: string;
  AREA: string;
  VARIEDADE: string;
  PORTAENXERTO: string;
  DATA_DE_PLANTIO: string;
  IDADE: number;
  FALHAS: number; // Renomeado de PRODUCAO_CAIXA
  ESP: string; // Renomeado de PRODUCAO_HECTARE
  COR: string;
  qtde_plantas?: number;
  OBS?: string; // Novo campo OBS
  ativo: boolean;
}

interface TalhaoFormData {
  TalhaoID: string | null;
  TIPO: string;
  NOME: string;
  AREA: number;
  VARIEDADE: string;
  PORTAENXERTO: string;
  DATA_DE_PLANTIO: string;
  IDADE: number;
  FALHAS: number; // Renomeado de PRODUCAO_CAIXA
  ESP: string; // Renomeado de PRODUCAO_HECTARE
  COR: string;
  QTDE_PLANTAS: number;
  OBS: string; // Novo campo OBS
  ativo: boolean;
}

interface ConfigOption {
  id: string;
  name: string;
  default_color: string;
}

interface DataPageProps {
  safraId?: string | null;
}

function DataPage({ safraId }: DataPageProps) {
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [filteredTalhoes, setFilteredTalhoes] = useState<Talhao[]>([]);
  const [formData, setFormData] = useState<TalhaoFormData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipoOptions, setTipoOptions] = useState<ConfigOption[]>([]);
  const [variedadeOptions, setVariedadeOptions] = useState<ConfigOption[]>([]);
  const [filterText, setFilterText] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('Todos');
  const [filterStatus, setFilterStatus] = useState<string>('Ativos');
  const [sortConfig, setSortConfig] = useState<{ key: 'NOME' | 'TalhaoID'; direction: 'asc' | 'desc' | null }>({ key: 'NOME', direction: null });
  const [producaoCaixas, setProducaoCaixas] = useState<{ [talhaoId: string]: number }>({});

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

  const fetchConfigs = async () => {
    try {
      const tipoResponse = await fetch(`${BASE_URL}/tipo_configs`);
      if (!tipoResponse.ok) throw new Error('Erro ao buscar tipos');
      const tipoRecords = await tipoResponse.json();

      const variedadeResponse = await fetch(`${BASE_URL}/variedade_configs`);
      if (!variedadeResponse.ok) throw new Error('Erro ao buscar variedades');
      const variedadeRecords = await variedadeResponse.json();

      setTipoOptions(tipoRecords);
      setVariedadeOptions(variedadeRecords);
    } catch (error) {
      toast.error('Erro ao carregar configurações: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const calculateAge = (plantingDate: string): number => {
    if (!plantingDate) return 0;
    const today = new Date();
    const planting = new Date(plantingDate);
    let age = today.getFullYear() - planting.getFullYear();
    const monthDiff = today.getMonth() - planting.getMonth();
    const dayDiff = today.getDate() - planting.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }
    return age < 0 ? 0 : age;
  };

  const fetchTalhoes = async () => {
    try {
      const response = await fetch(`${BASE_URL}/talhoes`);
      if (!response.ok) throw new Error('Erro ao buscar talhões');
      const talhaoRecords = await response.json();

      const updatedTalhoes = await Promise.all(
        talhaoRecords.map(async (talhao: Talhao) => {
          if (talhao.DATA_DE_PLANTIO) {
            const currentAge = calculateAge(talhao.DATA_DE_PLANTIO);
            if (currentAge !== talhao.IDADE) {
              const updatedTalhao = { ...talhao, IDADE: currentAge };
              const updateResponse = await fetch(`${BASE_URL}/talhoes/${talhao.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTalhao),
              });
              if (!updateResponse.ok) throw new Error('Erro ao atualizar idade do talhão');
              return { ...talhao, IDADE: currentAge };
            }
          }
          return talhao;
        })
      );

      console.log('Talhões carregados em DataPage:', updatedTalhoes.map((t: Talhao) => ({
        id: t.id,
        TalhaoID: t.TalhaoID,
        NOME: t.NOME,
        AREA: t.AREA,
        COR: t.COR,
        DATA_DE_PLANTIO: t.DATA_DE_PLANTIO,
        IDADE: t.IDADE,
        qtde_plantas: t.qtde_plantas,
        OBS: t.OBS,
        ativo: t.ativo,
      })));
      setTalhoes(updatedTalhoes);
    } catch (error) {
      toast.error('Erro ao carregar talhões: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      console.error('Erro ao carregar talhões:', error);
    }
  };

  const fetchProducaoCaixas = async () => {
    if (!safraId) return;
    const producao: { [talhaoId: string]: number } = {};
    for (const talhao of talhoes) {
      try {
        const response = await fetch(`${BASE_URL}/talhoes/${talhao.id}/producao_caixa?safra_id=${safraId}`);
        if (!response.ok) throw new Error(`Erro ao buscar produção de caixas para talhão ${talhao.id}`);
        const data = await response.json();
        producao[talhao.id] = data.totalCaixas;
      } catch (error) {
        console.error(`Erro ao buscar produção de caixas para talhão ${talhao.id}:`, error);
        producao[talhao.id] = 0;
      }
    }
    setProducaoCaixas(producao);
  };

  useEffect(() => {
    fetchTalhoes();
    fetchConfigs();
    // Exibir mensagem inicial como toast
//    toast.info('Talhões criados a partir de KMLs precisam ter suas informações completadas aqui.');
  }, []);

  useEffect(() => {
    if (safraId && talhoes.length > 0) {
      fetchProducaoCaixas();
    }
  }, [safraId, talhoes]);

  const parseTalhaoName = (nome: string): { number: number; suffix: string } => {
    const match = nome.match(/^(\d+)([A-Za-z]*)$/);
    if (match) {
      return {
        number: parseInt(match[1], 10),
        suffix: match[2] || '',
      };
    }
    return { number: 0, suffix: nome };
  };

  const sortTalhoes = (talhoesToSort: Talhao[], key: 'NOME' | 'TalhaoID', direction: 'asc' | 'desc') => {
    return [...talhoesToSort].sort((a, b) => {
      if (key === 'NOME') {
        const parsedA = parseTalhaoName(a.NOME);
        const parsedB = parseTalhaoName(b.NOME);

        if (parsedA.number !== parsedB.number) {
          return direction === 'asc' ? parsedA.number - parsedB.number : parsedB.number - parsedA.number;
        }

        return direction === 'asc'
          ? parsedA.suffix.localeCompare(parsedB.suffix)
          : parsedB.suffix.localeCompare(parsedA.suffix);
      } else {
        const idA = a.TalhaoID ?? '';
        const idB = b.TalhaoID ?? '';
        return direction === 'asc' ? idA.localeCompare(idB) : idB.localeCompare(idA);
      }
    });
  };

  const handleSort = (key: 'NOME' | 'TalhaoID') => {
    const newDirection = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction: newDirection });
    const sortedTalhoes = sortTalhoes(filteredTalhoes, key, newDirection);
    setFilteredTalhoes(sortedTalhoes);
  };

  const applyFiltersAndSort = () => {
    const filtered = talhoes.filter((talhao) => {
      const talhaoId = (talhao.TalhaoID ?? '').toLowerCase();
      const nome = talhao.NOME.toLowerCase();
      const matchesText = talhaoId.includes(filterText.toLowerCase()) || nome.includes(filterText.toLowerCase());
      const matchesType = filterType === 'Todos' || talhao.TIPO === filterType;
      const matchesStatus =
        filterStatus === 'Todos' ||
        (filterStatus === 'Ativos' && talhao.ativo) ||
        (filterStatus === 'Inativos' && !talhao.ativo);
      return matchesText && matchesType && matchesStatus;
    });

    let updatedTalhoes = filtered;

    if (sortConfig.direction) {
      updatedTalhoes = sortTalhoes(filtered, sortConfig.key, sortConfig.direction);
    }

    setFilteredTalhoes(updatedTalhoes);
  };

  const handleFilterText = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterText(e.target.value);
  };

  const handleFilterType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterType(e.target.value);
  };

  const handleFilterStatus = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterStatus(e.target.value);
  };

  useEffect(() => {
    applyFiltersAndSort();
  }, [filterText, filterType, filterStatus, talhoes]);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    try {
      const talhaoData = {
        TalhaoID: formData.TalhaoID,
        TIPO: formData.TIPO,
        NOME: formData.NOME,
        AREA: `${formData.AREA} ha`,
        VARIEDADE: formData.VARIEDADE,
        PORTAENXERTO: formData.PORTAENXERTO,
        DATA_DE_PLANTIO: formData.DATA_DE_PLANTIO,
        IDADE: formData.IDADE,
        FALHAS: formData.FALHAS, // Renomeado de PRODUCAO_CAIXA
        ESP: formData.ESP, // Renomeado de PRODUCAO_HECTARE
        COR: formData.COR,
        qtde_plantas: formData.QTDE_PLANTAS,
        OBS: formData.OBS, // Novo campo OBS
        ativo: formData.ativo,
      };

      if (editingId) {
        const response = await fetch(`${BASE_URL}/talhoes/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(talhaoData),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao atualizar talhão');
        }
        toast.success('Talhão atualizado com sucesso!');
      } else {
        const response = await fetch(`${BASE_URL}/talhoes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(talhaoData),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao adicionar talhão');
        }
        toast.success('Talhão adicionado com sucesso!');
      }

      setFormData(null);
      setEditingId(null);
      setFilterText('');
      setFilterType('Todos');
      setFilterStatus('Ativos');
      await fetchTalhoes();
    } catch (error) {
      toast.error('Erro ao salvar talhão: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleEdit = (talhao: Talhao) => {
    const newFormData: TalhaoFormData = {
      TalhaoID: talhao.TalhaoID ?? null,
      TIPO: talhao.TIPO,
      NOME: talhao.NOME,
      AREA: parseFloat(talhao.AREA) || 0,
      VARIEDADE: talhao.VARIEDADE,
      PORTAENXERTO: talhao.PORTAENXERTO,
      DATA_DE_PLANTIO: talhao.DATA_DE_PLANTIO,
      IDADE: calculateAge(talhao.DATA_DE_PLANTIO),
      FALHAS: talhao.FALHAS, // Renomeado de PRODUCAO_CAIXA
      ESP: talhao.ESP, // Renomeado de PRODUCAO_HECTARE
      COR: talhao.COR,
      QTDE_PLANTAS: talhao.qtde_plantas || 0,
      OBS: talhao.OBS || '', // Novo campo OBS
      ativo: talhao.ativo,
    };
    setFormData(newFormData);
    setEditingId(talhao.id);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/talhoes/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir talhão');
      setFilterText('');
      setFilterType('Todos');
      setFilterStatus('Ativos');
      await fetchTalhoes();
      toast.success('Talhão excluído com sucesso!');
    } catch (error) {
      toast.error('Erro ao excluir talhão: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleCancel = () => {
    setFormData(null);
    setEditingId(null);
  };

  const handlePlantingDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setFormData((prev) => prev ? {
      ...prev,
      DATA_DE_PLANTIO: newDate,
      IDADE: calculateAge(newDate),
    } : prev);
  };

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTipo = e.target.value;
    const selectedOption = tipoOptions.find((option) => option.name === newTipo);
    const newColor = selectedOption ? selectedOption.default_color : '#FF0000';
    setFormData((prev) => prev ? {
      ...prev,
      TIPO: newTipo,
      COR: newColor,
    } : prev);
  };

  const handleVariedadeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVariedade = e.target.value;
    const selectedOption = variedadeOptions.find((option) => option.name === newVariedade);
    const newColor = selectedOption ? selectedOption.default_color : '#FF0000';
    setFormData((prev) => prev ? {
      ...prev,
      VARIEDADE: newVariedade,
      COR: newColor,
    } : prev);
  };

  const formatBrazilianDate = (dateString: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '1400px',
      margin: '0 auto',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        <h2 style={{
          fontSize: '24px',
          color: '#333',
          margin: 0,
        }}>Talhões</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="primary"
            onClick={fetchTalhoes}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              transition: 'background-color 0.3s',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#45a049'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'}
          >
            Atualizar Talhões
          </button>
          {!editingId && (
            <button
              className="primary"
              onClick={() => setFormData({
                TalhaoID: null,
                TIPO: tipoOptions[0]?.name || 'Talhao',
                NOME: '',
                AREA: 0,
                VARIEDADE: variedadeOptions[0]?.name || '',
                PORTAENXERTO: '',
                DATA_DE_PLANTIO: '',
                IDADE: 0,
                FALHAS: 0, // Renomeado de PRODUCAO_CAIXA
                ESP: '', // Renomeado de PRODUCAO_HECTARE
                COR: tipoOptions[0]?.default_color || '#00FF00',
                QTDE_PLANTAS: 0,
                OBS: '', // Novo campo OBS
                ativo: true,
              })}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196F3'}
            >
              Novo Talhão
            </button>
          )}
        </div>
      </div>

      {formData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            width: '500px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h3 style={{
                fontSize: '20px',
                color: '#333',
                margin: 0,
              }}>{editingId ? 'Editar Talhão' : 'Adicionar Talhão'}</h3>
              <button style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
              }} onClick={handleCancel}>×</button>
            </div>
            <form onSubmit={handleCreateOrUpdate}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Talhão ID</label>
                <input
                  type="text"
                  value={formData.TalhaoID ?? ''}
                  onChange={(e) => setFormData({ ...formData, TalhaoID: e.target.value || null })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Nome</label>
                <input
                  type="text"
                  value={formData.NOME}
                  onChange={(e) => setFormData({ ...formData, NOME: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Tipo</label>
                <select
                  value={formData.TIPO}
                  onChange={handleTipoChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                >
                  {tipoOptions.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Área (ha)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    value={formData.AREA}
                    onChange={(e) => setFormData({ ...formData, AREA: Number(e.target.value) })}
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ccc',
                      borderRadius: '5px',
                      fontSize: '16px',
                    }}
                  />
                  <span style={{ fontSize: '16px', color: '#666' }}>ha</span>
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Variedade</label>
                <select
                  value={formData.VARIEDADE}
                  onChange={handleVariedadeChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                >
                  {variedadeOptions.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Portaenxerto</label>
                <input
                  type="text"
                  value={formData.PORTAENXERTO}
                  onChange={(e) => setFormData({ ...formData, PORTAENXERTO: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Data de Plantio</label>
                <input
                  type="date"
                  value={formData.DATA_DE_PLANTIO}
                  onChange={handlePlantingDateChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Idade</label>
                <input
                  type="number"
                  value={formData.IDADE}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                    backgroundColor: '#f0f0f0',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Quantidade de Plantas</label>
                <input
                  type="number"
                  value={formData.QTDE_PLANTAS}
                  onChange={(e) => setFormData({ ...formData, QTDE_PLANTAS: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Falhas</label>
                <input
                  type="number"
                  value={formData.FALHAS}
                  onChange={(e) => setFormData({ ...formData, FALHAS: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Esp.</label>
                <input
                  type="text"
                  value={formData.ESP}
                  onChange={(e) => setFormData({ ...formData, ESP: String(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Observações</label>
                <textarea
                  value={formData.OBS}
                  onChange={(e) => setFormData({ ...formData, OBS: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                    minHeight: '100px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Cor</label>
                <input
                  type="color"
                  value={formData.COR}
                  onChange={(e) => setFormData({ ...formData, COR: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '5px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    height: '40px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Situação</label>
                <select
                  value={formData.ativo ? 'Ativo' : 'Inativo'}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.value === 'Ativo' })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#45a049'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'}
                >
                  {editingId ? 'Atualizar' : 'Adicionar'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#da190b'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f44336'}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        alignItems: 'center',
      }}>
        <div style={{
          position: 'relative',
          width: '300px',
        }}>
          <input
            type="text"
            placeholder="Filtrar por Talhão ID ou Nome"
            value={filterText}
            onChange={handleFilterText}
            style={{
              width: '100%',
              padding: '10px 10px 10px 40px',
              border: '1px solid #ccc',
              borderRadius: '25px',
              fontSize: '16px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              outline: 'none',
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#4CAF50';
              e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#ccc';
              e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }}
          />
          <span style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '20px',
            color: '#666',
          }}>🔍</span>
        </div>
        <select
          value={filterType}
          onChange={handleFilterType}
          style={{
            padding: '10px',
            width: '200px',
            border: '1px solid #ccc',
            borderRadius: '25px',
            fontSize: '16px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            outline: 'none',
            transition: 'border-color 0.3s, box-shadow 0.3s',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#4CAF50';
            e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#ccc';
            e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
          }}
        >
          <option value="Todos">Todos</option>
          {tipoOptions.map((option) => (
            <option key={option.name} value={option.name}>
              {option.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={handleFilterStatus}
          style={{
            padding: '10px',
            width: '200px',
            border: '1px solid #ccc',
            borderRadius: '25px',
            fontSize: '16px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            outline: 'none',
            transition: 'border-color 0.3s, box-shadow 0.3s',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#4CAF50';
            e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#ccc';
            e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
          }}
        >
          <option value="Ativos">Ativos</option>
          <option value="Inativos">Inativos</option>
          <option value="Todos">Todos</option>
        </select>
      </div>

      <div style={{
        overflowX: 'auto',
        borderRadius: '10px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          borderRadius: '10px',
          overflow: 'hidden',
        }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('TalhaoID')} style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
                cursor: 'pointer',
                transition: 'background-color 0.3s',
                width: 'fit-content',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f4f4f4'}
              >
                Talhão ID
                {sortConfig.key === 'TalhaoID' && sortConfig.direction === 'asc' && ' ↑'}
                {sortConfig.key === 'TalhaoID' && sortConfig.direction === 'desc' && ' ↓'}
              </th>
              <th onClick={() => handleSort('NOME')} style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
                cursor: 'pointer',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f4f4f4'}
              >
                Nome
                {sortConfig.key === 'NOME' && sortConfig.direction === 'asc' && ' ↑'}
                {sortConfig.key === 'NOME' && sortConfig.direction === 'desc' && ' ↓'}
              </th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Área</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Variedade</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Portaenxerto</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Data de Plantio</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Idade</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Qtde Plantas</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Falhas</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Esp.</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Produção Caixa (Safra)</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Produção Caixa/Hectare</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Cor</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Situação</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Observações</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '12px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTalhoes.map((talhao, index) => (
              <tr key={talhao.id} style={{
                backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fafafa' : 'white'}
              >
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px', width: 'fit-content' }}>{talhao.TalhaoID ?? 'N/A'}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>{talhao.NOME}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>{talhao.AREA}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>{talhao.VARIEDADE}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>{talhao.PORTAENXERTO}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>{formatBrazilianDate(talhao.DATA_DE_PLANTIO)}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>{talhao.IDADE}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>{talhao.qtde_plantas ?? 'N/A'}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>{talhao.FALHAS}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>{talhao.ESP}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>
                  {producaoCaixas[talhao.id]?.toFixed(2) ?? '0.00'}
                </td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>
                  {talhao.AREA && parseFloat(talhao.AREA) > 0
                    ? (producaoCaixas[talhao.id] / parseFloat(talhao.AREA)).toFixed(2)
                    : 'N/A'}
                </td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>
                  <div style={{ backgroundColor: talhao.COR, width: '20px', height: '20px', display: 'inline-block', borderRadius: '3px' }}></div>
                </td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>
                  {talhao.ativo ? 'Ativo' : 'Inativo'}
                </td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>
                  {talhao.OBS || '-'}
                </td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd', display: 'flex', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <button
                      title="Editar"
                      style={{
                        padding: '8px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        transition: 'background-color 0.3s',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={() => handleEdit(talhao)}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196F3'}
                    >
                      ✏️
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <button
                      title="Excluir"
                      style={{
                        padding: '8px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        transition: 'background-color 0.3s',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={() => handleDelete(talhao.id)}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#da190b'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f44336'}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataPage;