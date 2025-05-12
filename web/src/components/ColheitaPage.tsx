import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ColheitaDashboard } from './ColheitaDashboard';
import { toast } from 'react-toastify';
import { Talhao, Carregamento, Motorista, PrevRealizado, Previsao, SemanaColheita, Safra, DinamicaData, CarregamentoFormData } from '../types';

interface ColheitaPageProps {
  safraId: string | null;
}

function ColheitaPage({ safraId }: ColheitaPageProps) {
  const [activeSubTab, setActiveSubTab] = useState<string>('carregamentos');
  const [carregamentos, setCarregamentos] = useState<Carregamento[]>([]);
  const [prevRealizado, setPrevRealizado] = useState<PrevRealizado[]>([]);
  const [dinamicaData, setDinamicaData] = useState<DinamicaData[]>([]);
  const [dinamicaFilters, setDinamicaFilters] = useState({
    talhaoNome: '',
    variedade: '',
    totalCaixas: '',
    mediaCaixasPorPlanta: '',
  });
  const [enrichedPrevRealizado, setEnrichedPrevRealizado] = useState<PrevRealizado[]>([]);
  const [resumoGeral, setResumoGeral] = useState<{
    data: { [variedade: string]: { previsto: number; realizado: number; proporcao: number } };
    totalPrevisto: number;
    totalRealizado: number;
  }>({ data: {}, totalPrevisto: 0, totalRealizado: 0 });
  const [previsoes, setPrevisoes] = useState<Previsao[]>([]);
  const [semanasColheita, setSemanasColheita] = useState<SemanaColheita[]>([]);
  const [safras, setSafras] = useState<Safra[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [showCarregamentoForm, setShowCarregamentoForm] = useState<boolean>(false);
  const [carregamentoFormData, setCarregamentoFormData] = useState<CarregamentoFormData | null>(null);
  const [motoristaInput, setMotoristaInput] = useState<string>('');
  const [talhaoWarning, setTalhaoWarning] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [previsaoFormData, setPrevisaoFormData] = useState<{ [talhaoId: string]: { safraId: string; qtdeCaixasPrevPe: number } }>({});
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

  const generateId = (): string => {
    return Math.random().toString(36).substr(2, 9);
  };

  const formatNumber = (value: number, decimals: number = 2): string => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
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
      toast.error('Erro ao carregar carregamentos: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const fetchPrevRealizadoData = async () => {
    if (!safraId) return;
    try {
      const response = await fetch(`${BASE_URL}/prev_realizado`);
      if (!response.ok) throw new Error('Erro ao buscar RESUMO');
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
      toast.error('Erro ao carregar RESUMO: ' + (error instanceof Error ? error.message : 'Desconhecido'));
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
      toast.error('Erro ao carregar previsões: ' + (error instanceof Error ? error.message : 'Desconhecido'));
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
      toast.error('Erro ao carregar semanas de colheita: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const fetchSafrasData = async () => {
    try {
      const response = await fetch(`${BASE_URL}/safras`);
      if (!response.ok) throw new Error('Erro ao buscar safras');
      const records = await response.json();
      setSafras(records);
    } catch (error) {
      toast.error('Erro ao carregar safras: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const fetchTalhoesData = async () => {
    try {
      const response = await fetch(`${BASE_URL}/talhoes`);
      if (!response.ok) throw new Error('Erro ao buscar talhões');
      const records = await response.json();
      console.log('Talhões carregados:', records);
      const filteredTalhoes = records.filter((talhao: Talhao) => {
        if (!talhao.NOME) {
          console.warn('Talhão sem NOME encontrado:', talhao);
          return false;
        }
        if (!talhao.id) {
          console.warn('Talhão sem ID encontrado:', talhao);
          return false;
        }
        return talhao.TIPO === 'TALHAO';
      });
      console.log('Talhões filtrados (tipo TALHAO e com NOME):', filteredTalhoes);
      setTalhoes(filteredTalhoes);
    } catch (error) {
      toast.error('Erro ao carregar talhões: ' + (error instanceof Error ? error.message : 'Desconhecido'));
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
      toast.error('Erro ao carregar motoristas: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  useEffect(() => {
    if (!safraId) return;
    console.log(`[${new Date().toISOString()}] useEffect disparado com safraId: ${safraId}`);
    fetchCarregamentosData();
    fetchPrevRealizadoData();
    fetchPrevisoesData();
    fetchSemanasColheitaData();
    fetchSafrasData();
    fetchTalhoesData();
  }, [safraId]);

  const calculateDinamica = (): DinamicaData[] => {
    console.log('Calculando Dinâmica - Talhões:', talhoes, 'Carregamentos:', carregamentos);
    const dinamicaMap: { [key: string]: DinamicaData } = {};

    carregamentos.forEach((carregamento) => {
      const talhao = talhoes.find((t) => t.id === carregamento.talhao_id);
      if (!talhao || !talhao.ativo) return; // Ignorar talhões inativos
      const talhaoNome = talhao ? talhao.NOME : 'Desconhecido';
      const qtdePlantas = carregamento.qtde_plantas || 0;
      const key = `${carregamento.talhao_id}-${carregamento.variedade || talhao.VARIEDADE || 'Desconhecida'}`;

      if (!dinamicaMap[key]) {
        dinamicaMap[key] = {
          talhaoId: carregamento.talhao_id,
          talhaoNome: talhaoNome,
          variedade: carregamento.variedade || talhao.VARIEDADE || 'Desconhecida',
          totalCaixas: 0,
          qtdePlantas: qtdePlantas,
          mediaCaixasPorPlanta: 0,
        };
      }

      dinamicaMap[key].totalCaixas += carregamento.qte_caixa;
    });

    const result = Object.values(dinamicaMap);
    result.forEach((item) => {
      item.mediaCaixasPorPlanta = item.qtdePlantas > 0 ? item.totalCaixas / item.qtdePlantas : 0;
    });

    console.log('Dados da Dinâmica calculados:', result);
    return result;
  };

  const filterDinamicaData = (data: DinamicaData[]): DinamicaData[] => {
    return data.filter((item) => {
      const matchesTalhaoNome = dinamicaFilters.talhaoNome
        ? item.talhaoNome.toLowerCase().includes(dinamicaFilters.talhaoNome.toLowerCase())
        : true;
      const matchesVariedade = dinamicaFilters.variedade
        ? item.variedade.toLowerCase().includes(dinamicaFilters.variedade.toLowerCase())
        : true;
      const matchesTotalCaixas = dinamicaFilters.totalCaixas
        ? item.totalCaixas >= Number(dinamicaFilters.totalCaixas)
        : true;
      const matchesMediaCaixas = dinamicaFilters.mediaCaixasPorPlanta
        ? item.mediaCaixasPorPlanta >= Number(dinamicaFilters.mediaCaixasPorPlanta)
        : true;

      return matchesTalhaoNome && matchesVariedade && matchesTotalCaixas && matchesMediaCaixas;
    });
  };

  const parseTalhaoName = (nome: string | undefined | null): { number: number; suffix: string } => {
    if (!nome) {
      console.warn('Nome do talhão é undefined ou null, retornando valores padrão');
      return { number: 0, suffix: '' };
    }
    const match = nome.match(/^(\d+)([A-Za-z]*)$/);
    if (match) {
      return {
        number: parseInt(match[1], 10),
        suffix: match[2] || '',
      };
    }
    return { number: 0, suffix: nome };
  };

  const calculatePrevRealizado = (): PrevRealizado[] => {
    console.log('Calculando PREV-REALIZADO - Talhões:', talhoes, 'Carregamentos:', carregamentos, 'Previsões:', previsoes);
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

    const sortedTalhoes = [...talhoes].filter(talhao => talhao.NOME).sort((a, b) => {
      const parsedA = parseTalhaoName(a.NOME);
      const parsedB = parseTalhaoName(b.NOME);

      if (parsedA.number !== parsedB.number) {
        return parsedA.number - parsedB.number;
      }

      return parsedA.suffix.localeCompare(parsedB.suffix);
    });

    const enrichedPrevRealizado = sortedTalhoes
      .map((talhao) => {
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
      })
      .filter((item) => item.total_cx_prev > 0 || item.total_cx_realizado > 0);

    console.log('Dados do PREV-REALIZADO calculados (filtrados):', enrichedPrevRealizado);
    return enrichedPrevRealizado;
  };

  const calculateResumoGeral = (prevRealizadoData: PrevRealizado[]) => {
    const resumo: { [variedade: string]: { previsto: number; realizado: number; proporcao: number } } = {};
    let totalPrevisto = 0;
    let totalRealizado = 0;

    prevRealizadoData.forEach((item) => {
      if (!resumo[item.variedade]) {
        resumo[item.variedade] = { previsto: 0, realizado: 0, proporcao: 0 };
      }
      resumo[item.variedade].previsto += item.total_cx_prev;
      resumo[item.variedade].realizado += item.total_cx_realizado;

      totalPrevisto += item.total_cx_prev;
      totalRealizado += item.total_cx_realizado;
    });

    Object.keys(resumo).forEach((variedade) => {
      if (resumo[variedade].previsto === 0 && resumo[variedade].realizado === 0) {
        delete resumo[variedade];
      } else {
        resumo[variedade].proporcao = resumo[variedade].previsto ? (resumo[variedade].realizado / resumo[variedade].previsto) * 100 : 0;
      }
    });

    console.log('Resumo Geral calculado (filtrado):', { data: resumo, totalPrevisto, totalRealizado });
    return { data: resumo, totalPrevisto, totalRealizado };
  };

  useEffect(() => {
    const newDinamicaData = calculateDinamica();
    setDinamicaData(newDinamicaData);

    const newEnrichedPrevRealizado = calculatePrevRealizado();
    setEnrichedPrevRealizado(newEnrichedPrevRealizado);

    const newResumoGeral = calculateResumoGeral(newEnrichedPrevRealizado);
    setResumoGeral(newResumoGeral);
  }, [talhoes, carregamentos, previsoes, prevRealizado, safraId]);

  const handleAddCarregamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carregamentoFormData || !safraId) return;

    const selectedTalhao = talhoes.find((t) => t.id === carregamentoFormData.talhao_id);
    if (!selectedTalhao) {
      toast.error('Erro: Talhão não encontrado.');
      return;
    }

    if (!selectedTalhao.ativo) {
      toast.error(`Erro: O talhão ${selectedTalhao.NOME} está inativo e não pode ser usado para carregamentos.`);
      return;
    }

    if (selectedTalhao.qtde_plantas === undefined || selectedTalhao.qtde_plantas === null) {
      toast.error(`Erro: O talhão ${selectedTalhao.NOME} não tem a quantidade de plantas preenchida. Por favor, atualize o talhão.`);
      return;
    }

    if (!selectedTalhao.VARIEDADE) {
      toast.error(`Erro: O talhão ${selectedTalhao.NOME} não tem a variedade preenchida. Por favor, atualize o talhão.`);
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
      toast.success(`Carregamento ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
    } catch (error) {
      toast.error(`Erro ao ${isEditing ? 'atualizar' : 'adicionar'} carregamento: ` + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handleEditCarregamento = (carregamento: Carregamento) => {
    const talhao = talhoes.find((t) => t.id === carregamento.talhao_id);
    if (talhao && !talhao.ativo) {
      toast.error(`Erro: O talhão ${talhao.NOME} está inativo e não pode ser editado.`);
      return;
    }

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
      toast.success('Carregamento excluído com sucesso!');
    } catch (error) {
      toast.error('Erro ao excluir carregamento: ' + (error instanceof Error ? error.message : 'Desconhecido'));
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
      if (!selectedTalhao.ativo) {
        setTalhaoWarning(`Atenção: O talhão ${selectedTalhao.NOME} está inativo e não pode ser usado.`);
      } else if (selectedTalhao.qtde_plantas === undefined || selectedTalhao.qtde_plantas === null) {
        setTalhaoWarning(`Atenção: O talhão ${selectedTalhao.NOME} não tem a quantidade de plantas preenchida.`);
      } else if (!selectedTalhao.VARIEDADE) {
        setTalhaoWarning(`Atenção: O talhão ${selectedTalhao.NOME} não tem a variedade preenchida.`);
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

  const getTextColorForProgressBar = (backgroundColor: string) => {
    return backgroundColor === 'green' || backgroundColor === 'blue' ? '#fff' : '#000';
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
      toast.error('Erro: Selecione uma safra e preencha a quantidade de caixas previstas por pé.');
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
      toast.success('Previsão salva com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar previsão: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const downloadExcelTemplate = () => {
    const templateData = [
      {
        'Data (DD/MM/AAAA)': '01/05/2025',
        'Talhao Nome': '1A',
        'Motorista': 'João Silva',
        'Placa': 'ABC1234',
        'Quantidade de Caixas': 500,
        'Safra ID': safraId || 'Insira o ID da safra',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Carregamentos');
    XLSX.writeFile(wb, 'modelo_carregamentos.xlsx');
  };

  const cadastrarMotorista = async (nome: string): Promise<Motorista> => {
    try {
      const motoristaNome = nome.toUpperCase();
      const response = await fetch(`${BASE_URL}/motoristas?search=${motoristaNome}`);
      if (!response.ok) {
        throw new Error(`Erro ao buscar motorista ${motoristaNome}: ${response.status} ${response.statusText}`);
      }

      const motoristas: Motorista[] = await response.json();
      const motoristaExistente = motoristas.find((m) => m.nome === motoristaNome);

      if (motoristaExistente) {
        console.log(`Motorista ${motoristaNome} já existe, usando registro existente:`, motoristaExistente);
        return motoristaExistente;
      }

      const createResponse = await fetch(`${BASE_URL}/motoristas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: motoristaNome }),
      });

      if (!createResponse.ok) {
        let errorData;
        try {
          errorData = await createResponse.json();
        } catch (parseError) {
          throw new Error(`Erro ao cadastrar motorista ${motoristaNome}: Resposta do servidor não é JSON válido - ${createResponse.status} ${createResponse.statusText}`);
        }
        throw new Error(errorData.error || `Erro ao cadastrar motorista - ${createResponse.status} ${createResponse.statusText}`);
      }

      const motorista: Motorista = await createResponse.json();
      return motorista;
    } catch (error) {
      throw new Error(`Erro ao cadastrar motorista ${nome}: ` + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const cadastrarTalhao = async (nome: string): Promise<Talhao> => {
    try {
      const existingTalhao = talhoes.find((t) => t.NOME === nome);
      if (existingTalhao) {
        if (!existingTalhao.ativo) {
          const updatedTalhao = { ...existingTalhao, ativo: true };
          const response = await fetch(`${BASE_URL}/talhoes/${existingTalhao.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedTalhao),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erro ao atualizar talhão ${nome} para ativo`);
          }

          console.log(`Talhão "${nome}" (ID: ${existingTalhao.id}) atualizado para ativo`);
          await fetchTalhoesData();
          return updatedTalhao;
        }
        return existingTalhao;
      }

      const talhaoData = {
        TalhaoID: null,
        TIPO: 'TALHAO',
        NOME: nome,
        AREA: '0 ha',
        VARIEDADE: '',
        PORTAENXERTO: '',
        DATA_DE_PLANTIO: '',
        IDADE: 0,
        FALHAS: 0,
        ESP: 0,
        COR: '#00FF00',
        qtde_plantas: 0,
        OBS: '',
        ativo: true,
      };

      const response = await fetch(`${BASE_URL}/talhoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(talhaoData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao cadastrar talhão');
      }

      const talhao: Talhao = await response.json();
      console.log(`Talhão "${nome}" criado com ID ${talhao.id}`);
      return talhao;
    } catch (error) {
      throw new Error(`Erro ao cadastrar talhão ${nome}: ` + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const parseBrazilianDate = (dateInput: string | number): number => {
    if (typeof dateInput === 'number') {
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (dateInput - 1) * 24 * 60 * 60 * 1000);
      if (dateInput < 60) {
        date.setDate(date.getDate() - 1);
      }
      if (isNaN(date.getTime())) {
        throw new Error(`Data inválida: ${dateInput}. Não foi possível converter o número de dias.`);
      }
      return date.getTime();
    }

    const [day, month, year] = dateInput.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) {
      throw new Error(`Data inválida: ${dateInput}. Use o formato DD/MM/AAAA.`);
    }
    return date.getTime();
  };

  const handleImportCarregamentos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      const carregamentosToImport: any[] = [];
      for (const row of jsonData) {
        const data = parseBrazilianDate(row['Data (DD/MM/AAAA)']);
        const talhaoNome = String(row['Talhao Nome']).trim();
        if (!talhaoNome) {
          throw new Error('Nome do talhão não pode estar vazio na linha do Excel.');
        }

        let talhao = talhoes.find((t) => t.NOME === talhaoNome);
        if (!talhao) {
          talhao = await cadastrarTalhao(talhaoNome);
          setTalhoes((prev) => [...prev, talhao!]);
        }

        if (!talhao.ativo) {
          throw new Error(`Talhão ${talhao.NOME} está inativo e não pode ser usado para carregamentos.`);
        }

        if (talhao.qtde_plantas === undefined || talhao.qtde_plantas === null) {
          throw new Error(`Talhão ${talhao.NOME} não tem a quantidade de plantas preenchida.`);
        }

        if (!talhao.VARIEDADE) {
          throw new Error(`Talhão ${talhao.NOME} não tem a variedade preenchida.`);
        }

        const motoristaNome = String(row['Motorista']).toUpperCase();
        let motorista = motoristas.find((m) => m.nome === motoristaNome);
        if (!motorista) {
          motorista = await cadastrarMotorista(motoristaNome);
          setMotoristas((prev) => [...prev, motorista!]);
        }

        const carregamento = {
          data,
          talhao_id: talhao.id,
          motorista: motoristaNome,
          placa: String(row['Placa']),
          qte_caixa: Number(row['Quantidade de Caixas']),
          safra_id: safraId!,
        };

        carregamentosToImport.push(carregamento);
      }

      for (const carregamento of carregamentosToImport) {
        const response = await fetch(`${BASE_URL}/carregamentos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(carregamento),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao importar carregamento');
        }
      }

      await fetchCarregamentosData();
      toast.success(`Foram importados ${carregamentosToImport.length} carregamentos com sucesso!`);
    } catch (error) {
      toast.error('Erro ao importar carregamentos: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const exportToExcel = () => {
    const exportData = carregamentos.map((carregamento) => {
      const talhao = talhoes.find((t) => t.id === carregamento.talhao_id);
      return {
        'Data': carregamento.data ? new Date(carregamento.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não definida',
        'Talhao': talhao ? talhao.NOME : 'Desconhecido',
        'Ativo': talhao ? (talhao.ativo ? 'Sim' : 'Não') : '-',
        'Quantidade Plantas': carregamento.qtde_plantas || '-',
        'Variedade': carregamento.variedade || '-',
        'Motorista': carregamento.motorista,
        'Placa': carregamento.placa,
        'Quantidade de Caixas': formatNumber(carregamento.qte_caixa),
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Carregamentos');
    XLSX.writeFile(wb, 'carregamentos_exportados.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ['Data', 'Talhão', 'Ativo', 'Qtde Plantas', 'Variedade', 'Motorista', 'Placa', 'Qte de Caixa'];
    const tableRows: any[] = [];

    carregamentos.forEach((carregamento) => {
      const talhao = talhoes.find((t) => t.id === carregamento.talhao_id);
      const rowData = [
        carregamento.data ? new Date(carregamento.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não definida',
        talhao ? talhao.NOME : 'Desconhecido',
        talhao ? (talhao.ativo ? 'Sim' : 'Não') : '-',
        carregamento.qtde_plantas || '-',
        carregamento.variedade || '-',
        carregamento.motorista,
        carregamento.placa,
        formatNumber(carregamento.qte_caixa),
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [46, 125, 50] },
    });

    doc.save('carregamentos_exportados.pdf');
  };

  return (
    <div className="page">
      <div className="header-section">
        <h2>Colheita</h2>
      </div>
      <div className="tabs">
        {['dashboard', 'carregamentos', 'dinamica', 'prevRealizado', 'previsao', 'parametros'].map((tab) => (
          <div
            key={tab}
            className={`tab ${activeSubTab === tab ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab)}
          >
            {tab === 'dashboard' ? 'Dashboard' :
             tab === 'carregamentos' ? 'Carregamentos' :
             tab === 'dinamica' ? 'Dinâmica' :
             tab === 'prevRealizado' ? 'Resumo' :
             tab === 'previsao' ? 'Previsão' :
             'Parâmetros'}
          </div>
        ))}
      </div>

      {activeSubTab === 'dashboard' && (
        <div>
          {safraId ? (
            <ColheitaDashboard
              dinamicaData={dinamicaData}
              carregamentos={carregamentos}
              talhoes={talhoes}
              resumoGeral={resumoGeral}
            />
          ) : (
            <p className="message">Selecione uma safra para visualizar o dashboard.</p>
          )}
        </div>
      )}

      {activeSubTab === 'carregamentos' && (
        <div>
          <div className="header-section">
            <h3>Carregamentos</h3>
            {safraId && (
              <div className="button-group">
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
                >
                  Adicionar Carregamento
                </button>
                <button className="excel" onClick={downloadExcelTemplate}>
                  Modelo Excel
                </button>
                <label className="import">
                  <span>Importar</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleImportCarregamentos}
                    ref={fileInputRef}
                  />
                </label>
                <div className="dropdown">
                  <button
                    className="dropdown-toggle"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                  >
                    Exportar
                  </button>
                  {showExportMenu && (
                    <div className="dropdown-menu">
                      <button onClick={() => { exportToExcel(); setShowExportMenu(false); }}>
                        Excel
                      </button>
                      <button onClick={() => { exportToPDF(); setShowExportMenu(false); }}>
                        PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {safraId ? (
            <>
              {showCarregamentoForm && carregamentoFormData && (
                <div className="modal-overlay">
                  <div className="modal">
                    <div className="modal-header">
                      <h3>{isEditing ? 'Editar Carregamento' : 'Adicionar Carregamento'}</h3>
                      <button className="close-button" onClick={handleCancelCarregamento}>×</button>
                    </div>
                    <form onSubmit={handleAddCarregamento}>
                      <div className="form-group">
                        <label>Data</label>
                        <input
                          type="date"
                          value={carregamentoFormData.data}
                          onChange={(e) => setCarregamentoFormData({ ...carregamentoFormData, data: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Talhão</label>
                        <select
                          value={carregamentoFormData.talhao_id}
                          onChange={(e) => handleTalhaoChange(e.target.value)}
                          required
                        >
                          <option value="">Selecione um Talhão</option>
                          {talhoes.map((talhao) => (
                            <option key={talhao.id} value={talhao.id}>
                              {talhao.NOME}
                            </option>
                          ))}
                        </select>
                        {talhaoWarning && (
                          <p className="warning-message">{talhaoWarning}</p>
                        )}
                      </div>
                      <div className="form-group" style={{ position: 'relative' }}>
                        <label>Motorista</label>
                        <input
                          type="text"
                          value={motoristaInput}
                          onChange={(e) => handleMotoristaChange(e.target.value)}
                          required
                        />
                        {motoristas.length > 0 && (
                          <ul className="autocomplete-list">
                            {motoristas.map((motorista) => (
                              <li
                                key={motorista.id}
                                onClick={() => handleMotoristaSelect(motorista.nome)}
                              >
                                {motorista.nome}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="form-group">
                        <label>Placa</label>
                        <input
                          type="text"
                          value={carregamentoFormData.placa}
                          onChange={(e) => setCarregamentoFormData({ ...carregamentoFormData, placa: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Quantidade de Caixa</label>
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
                        />
                      </div>
                      <div className="modal-footer">
                        <button
                          type="submit"
                          className="primary"
                          disabled={!!talhaoWarning}
                        >
                          {isEditing ? 'Salvar' : 'Adicionar'}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={handleCancelCarregamento}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Talhão</th>
                    <th>Ativo</th>
                    <th>Qtde Plantas</th>
                    <th>Variedade</th>
                    <th>Motorista</th>
                    <th>Placa</th>
                    <th>Qte de Caixa</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {carregamentos.map((carregamento) => {
                    const talhao = talhoes.find((t) => t.id === carregamento.talhao_id);
                    console.log(`Carregamento talhao_id: ${carregamento.talhao_id}, Talhão encontrado:`, talhao);
                    return (
                      <tr key={carregamento.id}>
                        <td>{carregamento.data ? new Date(carregamento.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não definida'}</td>
                        <td>{talhao ? talhao.NOME : 'Desconhecido'}</td>
                        <td>{talhao ? (talhao.ativo ? 'Sim' : 'Não') : '-'}</td>
                        <td>{carregamento.qtde_plantas ? formatNumber(carregamento.qtde_plantas, 0) : '-'}</td>
                        <td>{carregamento.variedade || '-'}</td>
                        <td>{carregamento.motorista}</td>
                        <td>{carregamento.placa}</td>
                        <td>{formatNumber(carregamento.qte_caixa)}</td>
                        <td style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
                          <button
                            className="primary icon-button"
                            title="Editar"
                            onClick={() => handleEditCarregamento(carregamento)}
                            style={{
                              padding: '8px',
                              backgroundColor: '#2196F3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              width: '40px',
                              height: '40px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background-color 0.3s',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196F3'}
                          >
                            ✏️
                          </button>
                          <button
                            className="danger icon-button"
                            title="Excluir"
                            onClick={() => handleDeleteCarregamento(carregamento.id)}
                            style={{
                              padding: '8px',
                              backgroundColor: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              width: '40px',
                              height: '40px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background-color 0.3s',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#da190b'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f44336'}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <p className="message">Selecione uma safra para visualizar os carregamentos.</p>
          )}
        </div>
      )}

      {activeSubTab === 'dinamica' && (
        <div>
          <div className="header-section">
            <h3>Dinâmica</h3>
          </div>
          {safraId ? (
            <>
              <table>
                <thead>
                  <tr>
                    <th>
                      Talhão
                      <input
                        type="text"
                        placeholder="Filtrar..."
                        value={dinamicaFilters.talhaoNome}
                        onChange={(e) => setDinamicaFilters({ ...dinamicaFilters, talhaoNome: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '5px',
                          marginTop: '5px',
                          boxSizing: 'border-box',
                          fontSize: '14px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                        }}
                      />
                    </th>
                    <th>
                      Variedade
                      <input
                        type="text"
                        placeholder="Filtrar..."
                        value={dinamicaFilters.variedade}
                        onChange={(e) => setDinamicaFilters({ ...dinamicaFilters, variedade: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '5px',
                          marginTop: '5px',
                          boxSizing: 'border-box',
                          fontSize: '14px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                        }}
                      />
                    </th>
                    <th>
                      Total de Caixas
                      <input
                        type="number"
                        placeholder="Min..."
                        value={dinamicaFilters.totalCaixas}
                        onChange={(e) => setDinamicaFilters({ ...dinamicaFilters, totalCaixas: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '5px',
                          marginTop: '5px',
                          boxSizing: 'border-box',
                          fontSize: '14px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                        }}
                      />
                    </th>
                    <th>
                      Média de Caixas por Planta
                      <input
                        type="number"
                        placeholder="Min..."
                        value={dinamicaFilters.mediaCaixasPorPlanta}
                        onChange={(e) => setDinamicaFilters({ ...dinamicaFilters, mediaCaixasPorPlanta: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '5px',
                          marginTop: '5px',
                          boxSizing: 'border-box',
                          fontSize: '14px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                        }}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filterDinamicaData(dinamicaData).map((item) => (
                    <tr key={`${item.talhaoId}-${item.variedade}`}>
                      <td>{item.talhaoNome}</td>
                      <td>{item.variedade}</td>
                      <td>{formatNumber(item.totalCaixas)}</td>
                      <td>{formatNumber(item.mediaCaixasPorPlanta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filterDinamicaData(dinamicaData).length === 0 && (
                <p style={{ textAlign: 'center', color: '#666', marginTop: '10px' }}>
                  Nenhum dado encontrado para os filtros aplicados.
                </p>
              )}
            </>
          ) : (
            <p className="message">Selecione uma safra para visualizar a dinâmica.</p>
          )}
        </div>
      )}

      {activeSubTab === 'prevRealizado' && (
        <div>
          <div className="header-section">
            <h3>Resumo</h3>
          </div>
          {safraId ? (
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <h4>Resumo por Talhão</h4>
                {enrichedPrevRealizado.length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Talhão</th>
                        <th>Variedade</th>
                        <th>Qtde Plantas</th>
                        <th>Cx/Pé Prev</th>
                        <th>Cx/Pé Realizado</th>
                        <th>Total Cx Prev</th>
                        <th>Total Cx Realizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrichedPrevRealizado.map((item) => (
                        <tr key={item.id}>
                          <td>{item.talhao}</td>
                          <td>{item.variedade}</td>
                          <td>{formatNumber(item.qtde_plantas, 0)}</td>
                          <td>{formatNumber(item.cx_pe_prev)}</td>
                          <td>{formatNumber(item.cx_pe_realizado)}</td>
                          <td>{formatNumber(item.total_cx_prev)}</td>
                          <td>{formatNumber(item.total_cx_realizado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ textAlign: 'center', color: '#666', marginTop: '10px' }}>
                    Nenhum dado disponível para o Resumo por Talhão.
                  </p>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <h4>Resumo Geral</h4>
                {Object.keys(resumoGeral.data).length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th colSpan={2}>PREVISÃO</th>
                        <th colSpan={2}>REALIZADO</th>
                      </tr>
                      <tr>
                        <th>Variedade</th>
                        <th>Total Previsto</th>
                        <th>Total Realizado</th>
                        <th>% Realizada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(resumoGeral.data).map(([variedade, data]) => {
                        const proporcao = data.proporcao;
                        const progressColor = getProgressColor(proporcao);
                        const textColor = getTextColorForProgressBar(progressColor);
                        return (
                          <tr key={variedade}>
                            <td>{variedade}</td>
                            <td>{formatNumber(data.previsto)}</td>
                            <td>{formatNumber(data.realizado)}</td>
                            <td>
                              <div style={{ position: 'relative', width: '100px' }}>
                                <div
                                  style={{
                                    backgroundColor: progressColor,
                                    height: '20px',
                                    width: `${Math.min(proporcao, 100)}%`,
                                    borderRadius: '4px',
                                  }}
                                >
                                  <span
                                    style={{
                                      position: 'absolute',
                                      top: '50%',
                                      left: '50%',
                                      transform: 'translate(-50%, -50%)',
                                      fontSize: '12px',
                                      color: textColor,
                                    }}
                                  >
                                    {proporcao.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ fontWeight: 'bold', borderTop: '2px solid #ccc' }}>
                        <td>Total</td>
                        <td>{formatNumber(resumoGeral.totalPrevisto)}</td>
                        <td>{formatNumber(resumoGeral.totalRealizado)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <p style={{ textAlign: 'center', color: '#666', marginTop: '10px' }}>
                    Nenhum dado disponível para o Resumo Geral.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="message">Selecione uma safra para visualizar os dados RESUMO.</p>
          )}
        </div>
      )}

      {activeSubTab === 'previsao' && (
        <div>
          <div className="header-section">
            <h3>Previsão</h3>
          </div>
          {safraId ? (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Variedade</th>
                  <th>Data de Plantio</th>
                  <th>Idade</th>
                  <th>Qtde/Pés</th>
                  <th>Safra</th>
                  <th>Qtde Caixas Previstas/Pé</th>
                  <th>Ações</th>
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
                      <tr key={talhao.id}>
                        <td>{talhao.NOME}</td>
                        <td>{talhao.VARIEDADE || '-'}</td>
                        <td>{talhao.DATA_DE_PLANTIO || '-'}</td>
                        <td>{talhao.IDADE || 0}</td>
                        <td>{talhao.qtde_plantas ? formatNumber(talhao.qtde_plantas, 0) : 0}</td>
                        <td>
                          <select
                            value={formData.safraId}
                            onChange={(e) => handlePrevisaoChange(talhao.id, 'safraId', e.target.value)}
                          >
                            <option value="">Selecione uma Safra</option>
                            {safras.map((safra) => (
                              <option key={safra.id} value={safra.id}>
                                {safra.nome}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            value={formData.qtdeCaixasPrevPe}
                            onChange={(e) => handlePrevisaoChange(talhao.id, 'qtdeCaixasPrevPe', e.target.value)}
                            step="0.01"
                            style={{ width: '100px' }}
                          />
                        </td>
                        <td>
                          <button
                            className="primary"
                            onClick={() => handleSavePrevisao(talhao.id)}
                          >
                            Salvar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          ) : (
            <p className="message">Selecione uma safra para visualizar as previsões.</p>
          )}
        </div>
      )}

      {activeSubTab === 'parametros' && (
        <div>
          <div className="header-section">
            <h3>Parâmetros</h3>
          </div>
          {safraId ? (
            <>
              <h4>Semanas de Colheita</h4>
              <table>
                <thead>
                  <tr>
                    <th>Semana do Ano</th>
                    <th>Semana de Colheita</th>
                  </tr>
                </thead>
                <tbody>
                  {semanasColheita.map((semana) => (
                    <tr key={semana.id}>
                      <td>{semana.semana_ano}</td>
                      <td>{semana.semana_colheita}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4>Data Inicial de Colheita</h4>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Data Inicial de Colheita</th>
                  </tr>
                </thead>
                <tbody>
                  {safras.filter((safra) => safra.id === safraId).map((safra) => (
                    <tr key={safra.id}>
                      <td>{safra.nome}</td>
                      <td>{safra.data_inicial_colheita ? new Date(safra.data_inicial_colheita).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não definida'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="message">Selecione uma safra para visualizar os parâmetros.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default ColheitaPage;