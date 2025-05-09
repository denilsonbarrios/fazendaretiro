import { useState, useEffect } from 'react';

// Interfaces ajustadas com base nas mudanças no backend
interface Carregamento {
  id: string;
  data: number;
  talhao_id: string;
  qtde_plantas: number;
  variedade: string;
  motorista: string;
  placa: string;
  qte_caixa: number;
  total: number;
  semana: number;
  semana_colheita: number;
  safra_id: string;
}

interface Motorista {
  id: string;
  nome: string;
}

interface PrevRealizado {
  id: string;
  talhao: string;
  variedade: string;
  qtde_plantas: number;
  cx_pe_prev: number;
  cx_pe_realizado: number;
  total_cx_prev: number;
  total_cx_realizado: number;
  safra_id: string;
}

interface Previsao {
  id: string;
  talhao_id: string;
  safra_id: string;
  talhao_nome: string;
  variedade: string;
  data_de_plantio: string;
  idade: number;
  qtde_plantas: number;
  qtde_caixas_prev_pe: number;
}

interface SemanaColheita {
  id: string;
  semana_ano: number;
  semana_colheita: number;
  safra_id: string;
}

interface Safra {
  id: string;
  nome: string;
  is_active: boolean;
  data_inicial_colheita: number | null;
}

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

interface DinamicaData {
  talhaoId: string;
  talhaoNome: string;
  variedade: string;
  totalCaixas: number;
  qtdePlantas: number;
  mediaCaixasPorPlanta: number;
}

interface CarregamentoFormData {
  id?: string;
  data: string;
  talhao_id: string;
  motorista: string;
  placa: string;
  qteCaixa: number | string; // Permitir string para lidar com valores vazios
}

interface ColheitaPageProps {
  safraId: string | null;
}

export function ColheitaPage({ safraId }: ColheitaPageProps) {
  const [activeSubTab, setActiveSubTab] = useState<string>('carregamentos');
  const [carregamentos, setCarregamentos] = useState<Carregamento[]>([]);
  const [prevRealizado, setPrevRealizado] = useState<PrevRealizado[]>([]);
  const [previsoes, setPrevisoes] = useState<Previsao[]>([]);
  const [semanasColheita, setSemanasColheita] = useState<SemanaColheita[]>([]);
  const [safras, setSafras] = useState<Safra[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [message, setMessage] = useState<string>('');
  const [showCarregamentoForm, setShowCarregamentoForm] = useState<boolean>(false);
  const [carregamentoFormData, setCarregamentoFormData] = useState<CarregamentoFormData | null>(null);
  const [motoristaInput, setMotoristaInput] = useState<string>('');
  const [talhaoWarning, setTalhaoWarning] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [previsaoFormData, setPrevisaoFormData] = useState<{ [talhaoId: string]: { safraId: string; qtdeCaixasPrevPe: number } }>({});

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

  const generateId = (): string => {
    return Math.random().toString(36).substr(2, 9);
  };

  const fetchCarregamentosData = async () => {
    if (!safraId) return;
    try {
      const response = await fetch(`${BASE_URL}/carregamentos`);
      if (!response.ok) throw new Error('Erro ao buscar carregamentos');
      const records = await response.json();
      const filteredRecords = records.filter((carregamento: Carregamento) => carregamento.safra_id === safraId);
      console.log('Carregamentos carregados:', filteredRecords);
      setCarregamentos(filteredRecords);
    } catch (error) {
      setMessage('Erro ao carregar carregamentos: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const fetchPrevRealizadoData = async () => {
    if (!safraId) return;
    try {
      const response = await fetch(`${BASE_URL}/prev_realizado`);
      if (!response.ok) throw new Error('Erro ao buscar PREV-REALIZADO');
      const records = await response.json();
      const filteredRecords = records.filter((item: PrevRealizado) => item.safra_id === safraId);
      const enrichedRecords = filteredRecords.map((item: PrevRealizado) => {
        const talhao = talhoes.find((t) => t.TalhaoID === item.talhao);
        return {
          ...item,
          variedade: talhao ? talhao.VARIEDADE : item.variedade,
          qtde_plantas: talhao ? talhao.qtde_plantas : item.qtde_plantas,
        };
      });
      setPrevRealizado(enrichedRecords);
    } catch (error) {
      setMessage('Erro ao carregar PREV-REALIZADO: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const fetchPrevisoesData = async () => {
    try {
      const response = await fetch(`${BASE_URL}/previsoes`);
      if (!response.ok) throw new Error('Erro ao buscar previsões');
      const records = await response.json();
      const filteredRecords = safraId ? records.filter((previsao: Previsao) => previsao.safra_id === safraId) : records;
      setPrevisoes(filteredRecords);

      const initialFormData: { [talhaoId: string]: { safraId: string; qtdeCaixasPrevPe: number } } = {};
      talhoes.forEach((talhao) => {
        const previsao = filteredRecords.find((p: Previsao) => p.talhao_id === talhao.id);
        initialFormData[talhao.id] = {
          safraId: previsao?.safra_id || safraId || '',
          qtdeCaixasPrevPe: previsao?.qtde_caixas_prev_pe || 0,
        };
      });
      console.log('Inicializando previsaoFormData:', initialFormData);
      setPrevisaoFormData(initialFormData);
    } catch (error) {
      setMessage('Erro ao carregar previsões: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const fetchSemanasColheitaData = async () => {
    if (!safraId) return;
    try {
      const response = await fetch(`${BASE_URL}/safras/${safraId}/semanas`);
      if (!response.ok) throw new Error('Erro ao buscar semanas de colheita');
      const records = await response.json();
      setSemanasColheita(records);
    } catch (error) {
      setMessage('Erro ao carregar semanas de colheita: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const fetchSafrasData = async () => {
    try {
      const response = await fetch(`${BASE_URL}/safras`);
      if (!response.ok) throw new Error('Erro ao buscar safras');
      const records = await response.json();
      setSafras(records);
    } catch (error) {
      setMessage('Erro ao carregar safras: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const fetchTalhoesData = async () => {
    try {
      const response = await fetch(`${BASE_URL}/talhoes`);
      if (!response.ok) throw new Error('Erro ao buscar talhões');
      const records = await response.json();
      console.log('Talhões carregados:', records);
      const filteredTalhoes = records.filter((talhao: Talhao) => talhao.TIPO === 'TALHAO');
      console.log('Talhões filtrados (tipo TALHAO):', filteredTalhoes);
      setTalhoes(filteredTalhoes);
    } catch (error) {
      setMessage('Erro ao carregar talhões: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const fetchMotoristas = async (searchTerm: string) => {
    try {
      const response = await fetch(`${BASE_URL}/motoristas?search=${searchTerm}`);
      if (!response.ok) throw new Error('Erro ao buscar motoristas');
      const records = await response.json();
      setMotoristas(records);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
    }
  };

  useEffect(() => {
    fetchCarregamentosData();
    fetchPrevRealizadoData();
    fetchPrevisoesData();
    fetchSemanasColheitaData();
    fetchSafrasData();
    fetchTalhoesData();
  }, [safraId]);

  const calculateDinamica = (): DinamicaData[] => {
    const dinamicaMap: { [key: string]: DinamicaData } = {};

    carregamentos.forEach((carregamento) => {
      const talhao = talhoes.find((t) => t.id === carregamento.talhao_id);
      const talhaoNome = talhao ? talhao.NOME : 'Desconhecido';
      const qtdePlantas = carregamento.qtde_plantas || 0;
      const key = `${carregamento.talhao_id}-${carregamento.variedade}`;

      if (!dinamicaMap[key]) {
        dinamicaMap[key] = {
          talhaoId: carregamento.talhao_id,
          talhaoNome: talhaoNome,
          variedade: carregamento.variedade || 'Desconhecida',
          totalCaixas: 0,
          qtdePlantas: qtdePlantas,
          mediaCaixasPorPlanta: 0,
        };
      }

      dinamicaMap[key].totalCaixas += carregamento.qte_caixa;
    });

    Object.values(dinamicaMap).forEach((item) => {
      item.mediaCaixasPorPlanta = item.qtdePlantas > 0 ? item.totalCaixas / item.qtdePlantas : 0;
    });

    return Object.values(dinamicaMap);
  };

  const dinamicaData = calculateDinamica();

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

  const calculatePrevRealizado = () => {
    const carregamentosPorTalhao: { [talhaoId: string]: { totalCaixas: number; qtdePlantas: number } } = {};
    carregamentos.forEach((carregamento) => {
      if (!carregamentosPorTalhao[carregamento.talhao_id]) {
        carregamentosPorTalhao[carregamento.talhao_id] = {
          totalCaixas: 0,
          qtdePlantas: carregamento.qtde_plantas || 0,
        };
      }
      carregamentosPorTalhao[carregamento.talhao_id].totalCaixas += carregamento.qte_caixa;
    });

    const sortedTalhoes = [...talhoes].sort((a, b) => {
      const parsedA = parseTalhaoName(a.NOME);
      const parsedB = parseTalhaoName(b.NOME);

      if (parsedA.number !== parsedB.number) {
        return parsedA.number - parsedB.number;
      }

      return parsedA.suffix.localeCompare(parsedB.suffix);
    });

    const enrichedPrevRealizado = sortedTalhoes.map((talhao) => {
      const prevEntry = prevRealizado.find((pr) => pr.talhao === talhao.TalhaoID) || {
        id: generateId(),
        talhao: talhao.NOME,
        variedade: talhao.VARIEDADE || 'Desconhecida',
        qtde_plantas: talhao.qtde_plantas || 0,
        cx_pe_prev: 0,
        cx_pe_realizado: 0,
        total_cx_prev: 0,
        total_cx_realizado: 0,
        safra_id: safraId || '',
      };

      const carregamentoTalhao = carregamentosPorTalhao[talhao.id] || { totalCaixas: 0, qtdePlantas: talhao.qtde_plantas || 0 };
      const totalCaixas = carregamentoTalhao.totalCaixas;
      const qtdePlantas = talhao.qtde_plantas || 0;
      const cxPeRealizado = qtdePlantas > 0 ? totalCaixas / qtdePlantas : 0;

      const previsao = previsoes.find((p) => p.talhao_id === talhao.id && p.safra_id === safraId);
      const cxPePrev = previsao ? previsao.qtde_caixas_prev_pe : prevEntry.cx_pe_prev;
      const totalCxPrev = qtdePlantas * (cxPePrev || 0);
      const totalCxRealizado = totalCaixas;

      return {
        ...prevEntry,
        talhao: talhao.NOME,
        variedade: talhao.VARIEDADE || 'Desconhecida',
        qtde_plantas: qtdePlantas,
        cx_pe_prev: cxPePrev,
        cx_pe_realizado: cxPeRealizado,
        total_cx_prev: totalCxPrev,
        total_cx_realizado: totalCxRealizado,
      };
    });

    return enrichedPrevRealizado;
  };

  const enrichedPrevRealizado = calculatePrevRealizado();

  const calculateResumoGeral = () => {
    const resumo: { [variedade: string]: { previsto: number; realizado: number; proporcao: number } } = {};
    enrichedPrevRealizado.forEach((item) => {
      if (!resumo[item.variedade]) {
        resumo[item.variedade] = { previsto: 0, realizado: 0, proporcao: 0 };
      }
      resumo[item.variedade].previsto += item.total_cx_prev;
      resumo[item.variedade].realizado += item.total_cx_realizado;
    });
    Object.keys(resumo).forEach((variedade) => {
      resumo[variedade].proporcao = resumo[variedade].previsto ? (resumo[variedade].realizado / resumo[variedade].previsto) * 100 : 0;
    });
    return resumo;
  };

  const resumoGeral = calculateResumoGeral();

  const handleAddCarregamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carregamentoFormData || !safraId) return;

    const selectedTalhao = talhoes.find((t) => t.id === carregamentoFormData.talhao_id);
    if (!selectedTalhao) {
      setMessage('Erro: Talhão não encontrado.');
      return;
    }

    if (selectedTalhao.qtde_plantas === undefined || selectedTalhao.qtde_plantas === null) {
      setMessage('Erro: O talhão selecionado não tem a quantidade de plantas preenchida. Por favor, atualize o talhão.');
      return;
    }

    if (!selectedTalhao.VARIEDADE) {
      setMessage('Erro: O talhão selecionado não tem a variedade preenchida. Por favor, atualize o talhão.');
      return;
    }

    try {
      const data = new Date(carregamentoFormData.data).getTime();
      const qteCaixa = typeof carregamentoFormData.qteCaixa === 'string' ? parseFloat(carregamentoFormData.qteCaixa) || 0 : carregamentoFormData.qteCaixa;
      const carregamento = {
        data,
        talhao_id: carregamentoFormData.talhao_id,
        motorista: carregamentoFormData.motorista,
        placa: carregamentoFormData.placa,
        qte_caixa: qteCaixa,
        safra_id: safraId,
      };

      const url = isEditing ? `${BASE_URL}/carregamentos/${carregamentoFormData.id}` : `${BASE_URL}/carregamentos`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(carregamento),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ao ${isEditing ? 'atualizar' : 'adicionar'} carregamento`);
      }

      setCarregamentoFormData(null);
      setShowCarregamentoForm(false);
      setMotoristaInput('');
      setMotoristas([]);
      setIsEditing(false);
      await fetchCarregamentosData();
      setMessage(`Carregamento ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
    } catch (error) {
      setMessage(`Erro ao ${isEditing ? 'atualizar' : 'adicionar'} carregamento: ` + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleEditCarregamento = (carregamento: Carregamento) => {
    const dataFormatada = new Date(carregamento.data).toISOString().split('T')[0];
    setCarregamentoFormData({
      id: carregamento.id,
      data: dataFormatada,
      talhao_id: carregamento.talhao_id,
      motorista: carregamento.motorista,
      placa: carregamento.placa,
      qteCaixa: carregamento.qte_caixa,
    });
    setMotoristaInput(carregamento.motorista);
    setIsEditing(true);
    setShowCarregamentoForm(true);
  };

  const handleDeleteCarregamento = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este carregamento?')) return;

    try {
      const response = await fetch(`${BASE_URL}/carregamentos/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir carregamento');
      }
      await fetchCarregamentosData();
      setMessage('Carregamento excluído com sucesso!');
    } catch (error) {
      setMessage('Erro ao excluir carregamento: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleCancelCarregamento = () => {
    setCarregamentoFormData(null);
    setShowCarregamentoForm(false);
    setMotoristaInput('');
    setMotoristas([]);
    setTalhaoWarning('');
    setIsEditing(false);
  };

  const handleMotoristaChange = (value: string) => {
    const upperCaseValue = value.toUpperCase();
    setMotoristaInput(upperCaseValue);
    if (carregamentoFormData) {
      setCarregamentoFormData({ ...carregamentoFormData, motorista: upperCaseValue });
    }
    if (upperCaseValue) {
      fetchMotoristas(upperCaseValue);
    } else {
      setMotoristas([]);
    }
  };

  const handleMotoristaSelect = (motorista: string) => {
    setMotoristaInput(motorista);
    if (carregamentoFormData) {
      setCarregamentoFormData({ ...carregamentoFormData, motorista });
    }
    setMotoristas([]);
  };

  const handleTalhaoChange = (talhaoId: string) => {
    setCarregamentoFormData({ ...carregamentoFormData!, talhao_id: talhaoId });
    const selectedTalhao = talhoes.find((t) => t.id === talhaoId);
    if (selectedTalhao) {
      if (selectedTalhao.qtde_plantas === undefined || selectedTalhao.qtde_plantas === null) {
        setTalhaoWarning('Atenção: Este talhão não tem a quantidade de plantas preenchida.');
      } else if (!selectedTalhao.VARIEDADE) {
        setTalhaoWarning('Atenção: Este talhão não tem a variedade preenchida.');
      } else {
        setTalhaoWarning('');
      }
    }
  };

  const getProgressColor = (proporcao: number) => {
    if (proporcao > 100) return 'blue';
    if (proporcao >= 67) return 'green';
    if (proporcao >= 34) return 'yellow';
    return 'red';
  };

  const handlePrevisaoChange = (talhaoId: string, field: 'safraId' | 'qtdeCaixasPrevPe', value: string | number) => {
    setPrevisaoFormData((prev) => {
      const current = prev[talhaoId] || { safraId: safraId || '', qtdeCaixasPrevPe: 0 };
      return {
        ...prev,
        [talhaoId]: {
          safraId: field === 'safraId' ? String(value) : current.safraId,
          qtdeCaixasPrevPe: field === 'qtdeCaixasPrevPe' ? Number(value) : current.qtdeCaixasPrevPe,
        },
      };
    });
  };

  const handleSavePrevisao = async (talhaoId: string) => {
    const previsao = previsaoFormData[talhaoId];
    console.log('Salvando previsão para talhaoId:', talhaoId, 'Dados:', previsao);
    if (!previsao || !previsao.safraId || previsao.qtdeCaixasPrevPe === undefined) {
      setMessage('Erro: Selecione uma safra e preencha a quantidade de caixas previstas por pé.');
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/previsoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          talhao_id: talhaoId,
          safra_id: previsao.safraId,
          qtde_caixas_prev_pe: previsao.qtdeCaixasPrevPe,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar previsão');
      }

      await fetchPrevisoesData();
      setMessage('Previsão salva com sucesso!');
    } catch (error) {
      setMessage('Erro ao salvar previsão: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '1400px',
      margin: '0 auto',
    }}>
      <h2 style={{
        fontSize: '24px',
        color: '#333',
        marginBottom: '20px',
      }}>Colheita</h2>
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #ddd',
        marginBottom: '20px',
      }}>
        {['carregamentos', 'dinamica', 'prevRealizado', 'previsao', 'parametros'].map((tab) => (
          <div
            key={tab}
            style={{
              padding: '10px 20px',
              cursor: 'pointer',
              borderBottom: activeSubTab === tab ? '2px solid #2196F3' : 'none',
              color: activeSubTab === tab ? '#2196F3' : '#666',
              fontWeight: activeSubTab === tab ? 'bold' : 'normal',
              transition: 'all 0.3s',
            }}
            onClick={() => setActiveSubTab(tab)}
          >
            {tab === 'carregamentos' ? 'Carregamentos' :
             tab === 'dinamica' ? 'Dinâmica' :
             tab === 'prevRealizado' ? 'PREV-REALIZADO' :
             tab === 'previsao' ? 'Previsão' :
             'Parâmetros'}
          </div>
        ))}
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

      {activeSubTab === 'carregamentos' && (
        <div>
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
            }}>Carregamentos</h3>
            {safraId && (
              <button
                className="primary"
                onClick={() => {
                  setShowCarregamentoForm(true);
                  setCarregamentoFormData({
                    data: '',
                    talhao_id: '',
                    motorista: '',
                    placa: '',
                    qteCaixa: '',
                  });
                  setIsEditing(false);
                }}
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
                Adicionar Carregamento
              </button>
            )}
          </div>

          {safraId ? (
            <>
              {showCarregamentoForm && carregamentoFormData && (
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
                    width: '400px',
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
                      }}>{isEditing ? 'Editar Carregamento' : 'Adicionar Carregamento'}</h3>
                      <button style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                        color: '#666',
                      }} onClick={handleCancelCarregamento}>×</button>
                    </div>
                    <form onSubmit={handleAddCarregamento}>
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '5px',
                        }}>Data</label>
                        <input
                          type="date"
                          value={carregamentoFormData.data}
                          onChange={(e) => setCarregamentoFormData({ ...carregamentoFormData, data: e.target.value })}
                          required
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
                        }}>Talhão</label>
                        <select
                          value={carregamentoFormData.talhao_id}
                          onChange={(e) => handleTalhaoChange(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ccc',
                            borderRadius: '5px',
                            fontSize: '16px',
                          }}
                        >
                          <option value="">Selecione um Talhão</option>
                          {talhoes.map((talhao) => (
                            <option key={talhao.id} value={talhao.id}>
                              {talhao.NOME}
                            </option>
                          ))}
                        </select>
                        {talhaoWarning && (
                          <p style={{
                            color: 'red',
                            fontSize: '12px',
                            marginTop: '5px',
                            marginBottom: 0,
                          }}>{talhaoWarning}</p>
                        )}
                      </div>
                      <div style={{ marginBottom: '15px', position: 'relative' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '5px',
                        }}>Motorista</label>
                        <input
                          type="text"
                          value={motoristaInput}
                          onChange={(e) => handleMotoristaChange(e.target.value)}
                          required
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ccc',
                            borderRadius: '5px',
                            fontSize: '16px',
                          }}
                        />
                        {motoristas.length > 0 && (
                          <ul style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 1,
                            backgroundColor: 'white',
                            border: '1px solid #ccc',
                            borderRadius: '5px',
                            listStyle: 'none',
                            padding: '5px 0',
                            margin: '2px 0 0 0',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                          }}>
                            {motoristas.map((motorista) => (
                              <li
                                key={motorista.id}
                                onClick={() => handleMotoristaSelect(motorista.nome)}
                                style={{
                                  padding: '8px 10px',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  color: '#333',
                                  transition: 'background-color 0.3s',
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                              >
                                {motorista.nome}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '5px',
                        }}>Placa</label>
                        <input
                          type="text"
                          value={carregamentoFormData.placa}
                          onChange={(e) => setCarregamentoFormData({ ...carregamentoFormData, placa: e.target.value })}
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
                        }}>Quantidade de Caixa</label>
                        <input
                          type="number"
                          value={carregamentoFormData.qteCaixa}
                          onChange={(e) => {
                            const value = e.target.value;
                            setCarregamentoFormData({
                              ...carregamentoFormData,
                              qteCaixa: value === '' ? '' : Number(value),
                            });
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              setCarregamentoFormData({
                                ...carregamentoFormData,
                                qteCaixa: 0,
                              });
                            }
                          }}
                          required
                          step="0.01"
                          min="0"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ccc',
                            borderRadius: '5px',
                            fontSize: '16px',
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
                          disabled={!!talhaoWarning}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: !!talhaoWarning ? '#ccc' : '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: !!talhaoWarning ? 'not-allowed' : 'pointer',
                            fontSize: '16px',
                            transition: 'background-color 0.3s',
                          }}
                          onMouseOver={(e) => {
                            if (!talhaoWarning) e.currentTarget.style.backgroundColor = '#45a049';
                          }}
                          onMouseOut={(e) => {
                            if (!talhaoWarning) e.currentTarget.style.backgroundColor = '#4CAF50';
                          }}
                        >
                          {isEditing ? 'Salvar' : 'Adicionar'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelCarregamento}
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
                      <th style={{
                        padding: '15px',
                        backgroundColor: '#f4f4f4',
                        color: '#333',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        textAlign: 'left',
                        borderBottom: '1px solid #ddd',
                      }}>Data</th>
                      <th style={{
                        padding: '15px',
                        backgroundColor: '#f4f4f4',
                        color: '#333',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        textAlign: 'left',
                        borderBottom: '1px solid #ddd',
                      }}>Talhão</th>
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
                      }}>Variedade</th>
                      <th style={{
                        padding: '15px',
                        backgroundColor: '#f4f4f4',
                        color: '#333',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        textAlign: 'left',
                        borderBottom: '1px solid #ddd',
                      }}>Motorista</th>
                      <th style={{
                        padding: '15px',
                        backgroundColor: '#f4f4f4',
                        color: '#333',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        textAlign: 'left',
                        borderBottom: '1px solid #ddd',
                      }}>Placa</th>
                      <th style={{
                        padding: '15px',
                        backgroundColor: '#f4f4f4',
                        color: '#333',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        textAlign: 'left',
                        borderBottom: '1px solid #ddd',
                      }}>Qte de Caixa</th>
                      <th style={{
                        padding: '15px',
                        backgroundColor: '#f4f4f4',
                        color: '#333',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        textAlign: 'left',
                        borderBottom: '1px solid #ddd',
                      }}>Total</th>
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
                    {carregamentos.map((carregamento) => {
                      const talhao = talhoes.find((t) => t.id === carregamento.talhao_id);
                      console.log(`Carregamento talhao_id: ${carregamento.talhao_id}, Talhão encontrado:`, talhao);
                      return (
                        <tr key={carregamento.id} style={{
                          backgroundColor: carregamentos.indexOf(carregamento) % 2 === 0 ? '#fafafa' : 'white',
                          transition: 'background-color 0.3s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = carregamentos.indexOf(carregamento) % 2 === 0 ? '#fafafa' : 'white'}
                        >
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                            {carregamento.data ? new Date(carregamento.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não definida'}
                          </td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                            {talhao ? talhao.NOME : 'Desconhecido'}
                          </td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                            {carregamento.qtde_plantas || '-'}
                          </td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                            {carregamento.variedade || '-'}
                          </td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                            {carregamento.motorista}
                          </td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                            {carregamento.placa}
                          </td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                            {carregamento.qte_caixa.toFixed(2)}
                          </td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                            {carregamento.total.toFixed(2)}
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
                                onClick={() => handleEditCarregamento(carregamento)}
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
                                onClick={() => handleDeleteCarregamento(carregamento.id)}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#da190b'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f44336'}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p style={{
              fontSize: '16px',
              color: '#666',
              textAlign: 'center',
              marginTop: '20px',
            }}>Selecione uma safra para visualizar os carregamentos.</p>
          )}
        </div>
      )}

      {activeSubTab === 'dinamica' && (
        <div>
          <h3 style={{
            fontSize: '20px',
            color: '#333',
            marginBottom: '20px',
          }}>Dinâmica</h3>
          {safraId ? (
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
                    <th style={{
                      padding: '15px',
                      backgroundColor: '#f4f4f4',
                      color: '#333',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      textAlign: 'left',
                      borderBottom: '1px solid #ddd',
                    }}>Talhão</th>
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
                    }}>Total de Caixas</th>
                    <th style={{
                      padding: '15px',
                      backgroundColor: '#f4f4f4',
                      color: '#333',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      textAlign: 'left',
                      borderBottom: '1px solid #ddd',
                    }}>Média de Caixas por Planta</th>
                  </tr>
                </thead>
                <tbody>
                  {dinamicaData.map((item, index) => (
                    <tr key={index} style={{
                      backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                      transition: 'background-color 0.3s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fafafa' : 'white'}
                    >
                      <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{item.talhaoNome}</td>
                      <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{item.variedade}</td>
                      <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{item.totalCaixas.toFixed(2)}</td>
                      <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{item.mediaCaixasPorPlanta.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{
              fontSize: '16px',
              color: '#666',
              textAlign: 'center',
              marginTop: '20px',
            }}>Selecione uma safra para visualizar a dinâmica.</p>
          )}
        </div>
      )}

      {activeSubTab === 'prevRealizado' && (
        <div>
          <h3 style={{
            fontSize: '20px',
            color: '#333',
            marginBottom: '20px',
          }}>PREV-REALIZADO</h3>
          {safraId ? (
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{
                  fontSize: '18px',
                  color: '#333',
                  marginBottom: '10px',
                }}>Resumo por Talhão</h4>
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
                        <th style={{
                          padding: '15px',
                          backgroundColor: '#f4f4f4',
                          color: '#333',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'left',
                          borderBottom: '1px solid #ddd',
                        }}>Talhão</th>
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
                        }}>Qtde Plantas</th>
                        <th style={{
                          padding: '15px',
                          backgroundColor: '#f4f4f4',
                          color: '#333',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'left',
                          borderBottom: '1px solid #ddd',
                        }}>Cx/Pé Prev</th>
                        <th style={{
                          padding: '15px',
                          backgroundColor: '#f4f4f4',
                          color: '#333',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'left',
                          borderBottom: '1px solid #ddd',
                        }}>Cx/Pé Realizado</th>
                        <th style={{
                          padding: '15px',
                          backgroundColor: '#f4f4f4',
                          color: '#333',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'left',
                          borderBottom: '1px solid #ddd',
                        }}>Total Cx Prev</th>
                        <th style={{
                          padding: '15px',
                          backgroundColor: '#f4f4f4',
                          color: '#333',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'left',
                          borderBottom: '1px solid #ddd',
                        }}>Total Cx Realizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrichedPrevRealizado.map((item) => (
                        <tr key={item.id} style={{
                          backgroundColor: enrichedPrevRealizado.indexOf(item) % 2 === 0 ? '#fafafa' : 'white',
                          transition: 'background-color 0.3s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = enrichedPrevRealizado.indexOf(item) % 2 === 0 ? '#fafafa' : 'white'}
                        >
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{item.talhao}</td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{item.variedade}</td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{item.qtde_plantas}</td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{item.cx_pe_prev.toFixed(2)}</td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{item.cx_pe_realizado.toFixed(2)}</td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{item.total_cx_prev.toFixed(2)}</td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{item.total_cx_realizado.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <h4 style={{
                  fontSize: '18px',
                  color: '#333',
                  marginBottom: '10px',
                }}>Resumo Geral</h4>
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
                        <th colSpan={2} style={{
                          padding: '15px',
                          backgroundColor: '#f4f4f4',
                          color: '#333',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'center',
                          borderBottom: '1px solid #ddd',
                        }}>PREV</th>
                        <th colSpan={2} style={{
                          padding: '15px',
                          backgroundColor: '#f4f4f4',
                          color: '#333',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'center',
                          borderBottom: '1px solid #ddd',
                        }}>REALIZADO</th>
                      </tr>
                      <tr>
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
                        }}>Total Previsto</th>
                        <th style={{
                          padding: '15px',
                          backgroundColor: '#f4f4f4',
                          color: '#333',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'left',
                          borderBottom: '1px solid #ddd',
                        }}>Total Realizado</th>
                        <th style={{
                          padding: '15px',
                          backgroundColor: '#f4f4f4',
                          color: '#333',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          textAlign: 'left',
                          borderBottom: '1px solid #ddd',
                        }}>% Realizada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(resumoGeral).map(([variedade, data]) => {
                        const proporcao = data.proporcao;
                        const progressColor = getProgressColor(proporcao);
                        return (
                          <tr key={variedade} style={{
                            backgroundColor: Object.keys(resumoGeral).indexOf(variedade) % 2 === 0 ? '#fafafa' : 'white',
                            transition: 'background-color 0.3s',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = Object.keys(resumoGeral).indexOf(variedade) % 2 === 0 ? '#fafafa' : 'white'}
                          >
                            <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{variedade}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{data.previsto.toFixed(2)}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{data.realizado.toFixed(2)}</td>
                            <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                              <div style={{ position: 'relative', width: '100px' }}>
                                <div
                                  style={{
                                    backgroundColor: progressColor,
                                    height: '20px',
                                    width: `${Math.min(proporcao, 100)}%`,
                                    borderRadius: '4px',
                                  }}
                                />
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '-20px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '12px',
                                    color: '#333',
                                  }}
                                >
                                  {proporcao.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p style={{
              fontSize: '16px',
              color: '#666',
              textAlign: 'center',
              marginTop: '20px',
            }}>Selecione uma safra para visualizar os dados PREV-REALIZADO.</p>
          )}
        </div>
      )}

      {activeSubTab === 'previsao' && (
        <div>
          <h3 style={{
            fontSize: '20px',
            color: '#333',
            marginBottom: '20px',
          }}>Previsão</h3>
          {safraId ? (
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
                    <th style={{
                      padding: '15px',
                      backgroundColor: '#f4f4f4',
                      color: '#333',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      textAlign: 'left',
                      borderBottom: '1px solid #ddd',
                    }}>Nome</th>
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
                    }}>Qtde/Pés</th>
                    <th style={{
                      padding: '15px',
                      backgroundColor: '#f4f4f4',
                      color: '#333',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      textAlign: 'left',
                      borderBottom: '1px solid #ddd',
                    }}>Safra</th>
                    <th style={{
                      padding: '15px',
                      backgroundColor: '#f4f4f4',
                      color: '#333',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      textAlign: 'left',
                      borderBottom: '1px solid #ddd',
                    }}>Qtde Caixas Previstas/Pé</th>
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
                  {[...talhoes]
                    .sort((a, b) => {
                      const parsedA = parseTalhaoName(a.NOME);
                      const parsedB = parseTalhaoName(b.NOME);

                      if (parsedA.number !== parsedB.number) {
                        return parsedA.number - parsedB.number;
                      }

                      return parsedA.suffix.localeCompare(parsedB.suffix);
                    })
                    .map((talhao) => {
                      const previsao = previsoes.find((p) => p.talhao_id === talhao.id);
                      const formData = previsaoFormData[talhao.id] || { safraId: safraId || '', qtdeCaixasPrevPe: previsao?.qtde_caixas_prev_pe || 0 };

                      return (
                        <tr key={talhao.id} style={{
                          backgroundColor: talhoes.indexOf(talhao) % 2 === 0 ? '#fafafa' : 'white',
                          transition: 'background-color 0.3s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = talhoes.indexOf(talhao) % 2 === 0 ? '#fafafa' : 'white'}
                        >
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.NOME}</td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.VARIEDADE || '-'}</td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.DATA_DE_PLANTIO || '-'}</td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.IDADE || 0}</td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{talhao.qtde_plantas || 0}</td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                            <select
                              value={formData.safraId}
                              onChange={(e) => handlePrevisaoChange(talhao.id, 'safraId', e.target.value)}
                              style={{
                                padding: '8px',
                                border: '1px solid #ccc',
                                borderRadius: '5px',
                                fontSize: '14px',
                              }}
                            >
                              <option value="">Selecione uma Safra</option>
                              {safras.map((safra) => (
                                <option key={safra.id} value={safra.id}>
                                  {safra.nome}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                            <input
                              type="number"
                              value={formData.qtdeCaixasPrevPe}
                              onChange={(e) => handlePrevisaoChange(talhao.id, 'qtdeCaixasPrevPe', e.target.value)}
                              step="0.01"
                              style={{
                                width: '100px',
                                padding: '8px',
                                border: '1px solid #ccc',
                                borderRadius: '5px',
                                fontSize: '14px',
                              }}
                            />
                          </td>
                          <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                            <button
                              style={{
                                padding: '8px 15px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'background-color 0.3s',
                              }}
                              onClick={() => handleSavePrevisao(talhao.id)}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196F3'}
                            >
                              Salvar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{
              fontSize: '16px',
              color: '#666',
              textAlign: 'center',
              marginTop: '20px',
            }}>Selecione uma safra para visualizar as previsões.</p>
          )}
        </div>
      )}

      {activeSubTab === 'parametros' && (
        <div>
          <h3 style={{
            fontSize: '20px',
            color: '#333',
            marginBottom: '20px',
          }}>Parâmetros</h3>
          {safraId ? (
            <>
              <h4 style={{
                fontSize: '18px',
                color: '#333',
                marginBottom: '10px',
              }}>Semanas de Colheita</h4>
              <div style={{
                overflowX: 'auto',
                borderRadius: '10px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                marginBottom: '20px',
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
                      <th style={{
                        padding: '15px',
                        backgroundColor: '#f4f4f4',
                        color: '#333',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        textAlign: 'left',
                        borderBottom: '1px solid #ddd',
                      }}>Semana do Ano</th>
                      <th style={{
                        padding: '15px',
                        backgroundColor: '#f4f4f4',
                        color: '#333',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        textAlign: 'left',
                        borderBottom: '1px solid #ddd',
                      }}>Semana de Colheita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semanasColheita.map((semana) => (
                      <tr key={semana.id} style={{
                        backgroundColor: semanasColheita.indexOf(semana) % 2 === 0 ? '#fafafa' : 'white',
                        transition: 'background-color 0.3s',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = semanasColheita.indexOf(semana) % 2 === 0 ? '#fafafa' : 'white'}
                      >
                        <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{semana.semana_ano}</td>
                        <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{semana.semana_colheita}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 style={{
                fontSize: '18px',
                color: '#333',
                marginBottom: '10px',
              }}>Data Inicial de Colheita</h4>
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
                      <th style={{
                        padding: '15px',
                        backgroundColor: '#f4f4f4',
                        color: '#333',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        textAlign: 'left',
                        borderBottom: '1px solid #ddd',
                      }}>Nome</th>
                      <th style={{
                        padding: '15px',
                        backgroundColor: '#f4f4f4',
                        color: '#333',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        textAlign: 'left',
                        borderBottom: '1px solid #ddd',
                      }}>Data Inicial de Colheita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safras.filter((safra) => safra.id === safraId).map((safra) => (
                      <tr key={safra.id} style={{
                        backgroundColor: safras.indexOf(safra) % 2 === 0 ? '#fafafa' : 'white',
                        transition: 'background-color 0.3s',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = safras.indexOf(safra) % 2 === 0 ? '#fafafa' : 'white'}
                      >
                        <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{safra.nome}</td>
                        <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                          {safra.data_inicial_colheita ? new Date(safra.data_inicial_colheita).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não definida'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p style={{
              fontSize: '16px',
              color: '#666',
              textAlign: 'center',
              marginTop: '20px',
            }}>Selecione uma safra para visualizar os parâmetros.</p>
          )}
        </div>
      )}
    </div>
  );
}