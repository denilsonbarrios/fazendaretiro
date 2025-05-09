import { useState, useEffect } from 'react';

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
  PRODUCAO_CAIXA: number;
  PRODUCAO_HECTARE: number;
  COR: string;
  qtde_plantas?: number;
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
  PRODUCAO_CAIXA: number;
  PRODUCAO_HECTARE: number;
  COR: string;
  QTDE_PLANTAS: number;
}

interface ConfigOption {
  id: string;
  name: string;
  default_color: string;
}

export function DataPage() {
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [filteredTalhoes, setFilteredTalhoes] = useState<Talhao[]>([]);
  const [formData, setFormData] = useState<TalhaoFormData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('Talhões criados a partir de KMLs precisam ter suas informações completadas aqui.');
  const [tipoOptions, setTipoOptions] = useState<ConfigOption[]>([]);
  const [variedadeOptions, setVariedadeOptions] = useState<ConfigOption[]>([]);
  const [filterText, setFilterText] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('Todos');
  const [sortConfig, setSortConfig] = useState<{ key: 'NOME' | 'TalhaoID'; direction: 'asc' | 'desc' | null }>({ key: 'NOME', direction: null });

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
      setMessage('Erro ao carregar configurações: ' + (error instanceof Error ? error.message : 'Desconhecido'));
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
      })));
      setTalhoes(updatedTalhoes);
    } catch (error) {
      setMessage('Erro ao carregar talhões: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      console.error('Erro ao carregar talhões:', error);
    }
  };

  useEffect(() => {
    fetchTalhoes();
    fetchConfigs();
  }, []);

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
      return matchesText && matchesType;
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

  useEffect(() => {
    applyFiltersAndSort();
  }, [filterText, filterType, talhoes]);

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
        PRODUCAO_CAIXA: formData.PRODUCAO_CAIXA,
        PRODUCAO_HECTARE: formData.PRODUCAO_HECTARE,
        COR: formData.COR,
        qtde_plantas: formData.QTDE_PLANTAS,
      };

      if (editingId) {
        const response = await fetch(`${BASE_URL}/talhoes/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(talhaoData),
        });
        if (!response.ok) throw new Error('Erro ao atualizar talhão');
      } else {
        const response = await fetch(`${BASE_URL}/talhoes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(talhaoData),
        });
        if (!response.ok) throw new Error('Erro ao adicionar talhão');
      }

      setFormData(null);
      setEditingId(null);
      setFilterText('');
      setFilterType('Todos');
      await fetchTalhoes();
      setMessage(editingId ? 'Talhão atualizado com sucesso!' : 'Talhão adicionado com sucesso!');
    } catch (error) {
      setMessage('Erro ao salvar talhão: ' + (error instanceof Error ? error.message : 'Desconhecido'));
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
      PRODUCAO_CAIXA: talhao.PRODUCAO_CAIXA,
      PRODUCAO_HECTARE: talhao.PRODUCAO_HECTARE,
      COR: talhao.COR,
      QTDE_PLANTAS: talhao.qtde_plantas || 0,
    };
    setFormData(newFormData);
    setEditingId(talhao.id);
    setMessage('');
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/talhoes/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir talhão');
      setFilterText('');
      setFilterType('Todos');
      await fetchTalhoes();
      setMessage('Talhão excluído com sucesso!');
    } catch (error) {
      setMessage('Erro ao excluir talhão: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleCancel = () => {
    setFormData(null);
    setEditingId(null);
    setMessage('');
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
                PRODUCAO_CAIXA: 0,
                PRODUCAO_HECTARE: 0,
                COR: tipoOptions[0]?.default_color || '#00FF00',
                QTDE_PLANTAS: 0,
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

      {message && (
        <p style={{
          padding: '10px',
          backgroundColor: message.includes('Erro') ? '#f8d7da' : '#d4edda',
          color: message.includes('Erro') ? '#721c24' : '#155724',
          border: `1px solid ${message.includes('Erro') ? '#f5c6cb' : '#c3e6cb'}`,
          borderRadius: '5px',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          {message}
        </p>
      )}

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
                  disabled={!!editingId}
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
                }}>Produção Caixa</label>
                <input
                  type="number"
                  value={formData.PRODUCAO_CAIXA}
                  onChange={(e) => setFormData({ ...formData, PRODUCAO_CAIXA: Number(e.target.value) })}
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
                }}>Produção Hectare</label>
                <input
                  type="number"
                  value={formData.PRODUCAO_HECTARE}
                  onChange={(e) => setFormData({ ...formData, PRODUCAO_HECTARE: Number(e.target.value) })}
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
                fontSize: '14px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
                cursor: 'pointer',
                transition: 'background-color 0.3s',
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
                fontSize: '14px',
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
                fontSize: '14px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Área</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Variedade</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Portaenxerto</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Data de Plantio</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Idade</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Qtde Plantas</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Produção Caixa</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Produção Hectare</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '14px',
                textAlign: 'left',
                borderBottom: '1px solid #ddd',
              }}>Cor</th>
              <th style={{
                padding: '15px',
                backgroundColor: '#f4f4f4',
                color: '#333',
                fontWeight: 'bold',
                fontSize: '14px',
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
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.TalhaoID ?? 'N/A'}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.NOME}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.AREA}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.VARIEDADE}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.PORTAENXERTO}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.DATA_DE_PLANTIO}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.IDADE}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.qtde_plantas ?? 'N/A'}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.PRODUCAO_CAIXA}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.PRODUCAO_HECTARE}</td>
                <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                  <div style={{ backgroundColor: talhao.COR, width: '20px', height: '20px', display: 'inline-block', borderRadius: '3px', marginRight: '5px' }}></div>
                  {talhao.COR}
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