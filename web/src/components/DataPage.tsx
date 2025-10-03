import { useState, useEffect } from 'react';
import { toast } from 'react-toastify'; // Importar o toast
import { fetchSafras, Safra, fetchTalhoesKml, linkTalhaoToKml, TalhaoKml, importTalhoesFromCsv, BASE_URL, authFetch } from '../api';

// Interfaces definidas localmente com base nos dados retornados pelo backend
interface Talhao {
  safra_id: string;
  id: string;
  talhao_id?: string; // ID do talhão base (presente quando vem de talhao_safra)
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
  talhao_kml_id?: string; // Nova referência para talhoes_kml
}

interface TalhaoFormData {
  talhao_id?: string; // ID do talhão base, necessário para criar/atualizar talhao_safra
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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'base' | 'safra' | null>(null);
  const [safras, setSafras] = useState<Safra[]>([]);
  const [safraOrigemId, setSafraOrigemId] = useState<string | null>(null);  const [importLoading, setImportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'safra' | 'base'>('safra');
  const [talhoesBase, setTalhoesBase] = useState<Talhao[]>([]);
  
  // Estados para vinculação manual de KML
  const [talhoesKml, setTalhoesKml] = useState<TalhaoKml[]>([]);
  const [linkingTalhaoId, setLinkingTalhaoId] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      const tipoResponse = await authFetch(`${BASE_URL}/tipo_configs`);
      if (!tipoResponse.ok) throw new Error('Erro ao buscar tipos');
      const tipoRecords = await tipoResponse.json();

      const variedadeResponse = await authFetch(`${BASE_URL}/variedade_configs`);
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

  // Busca talhões vinculados à safra selecionada
  const fetchTalhoes = async () => {
    if (!safraId) {
      setTalhoes([]);
      return;
    }
    try {
      const response = await authFetch(`${BASE_URL}/talhao_safra?safra_id=${safraId}`);
      if (!response.ok) throw new Error('Erro ao buscar talhões da safra');
      const talhaoRecords = await response.json();
      setTalhoes(talhaoRecords);
    } catch (error) {
      toast.error('Erro ao carregar talhões: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      setTalhoes([]);
    }
  };

  // Busca talhões base (sem vínculo de safra)
  const fetchTalhoesBase = async () => {
    try {
      const response = await authFetch(`${BASE_URL}/talhoes`);
      if (!response.ok) throw new Error('Erro ao buscar talhões base');
      const talhaoRecords = await response.json();
      setTalhoesBase(talhaoRecords);
    } catch (error) {
      toast.error('Erro ao carregar talhões base: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      setTalhoesBase([]);
    }
  };

  // Busca talhões KML disponíveis
  const fetchTalhoesKmlData = async () => {
    try {
      const kmlRecords = await fetchTalhoesKml();
      setTalhoesKml(kmlRecords);
    } catch (error) {
      toast.error('Erro ao carregar talhões KML: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      setTalhoesKml([]);
    }
  };

  const fetchProducaoCaixas = async () => {
    if (!safraId) return;
    const producao: { [talhaoId: string]: number } = {};
    for (const talhao of talhoes) {
      try {
        const response = await authFetch(`${BASE_URL}/talhoes/${talhao.id}/producao_caixa?safra_id=${safraId}`);
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
  // Busca talhões KML
  const fetchKmlTalhoes = async () => {
    if (!safraId) return;
    try {
      const response = await authFetch(`${BASE_URL}/talhao_safra/kml?safra_id=${safraId}`);
      if (!response.ok) throw new Error('Erro ao buscar talhões KML');
      const kmlRecords = await response.json();
      setTalhoesKml(kmlRecords);
    } catch (error) {
      toast.error('Erro ao carregar talhões KML: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      setTalhoesKml([]);
    }
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
  useEffect(() => {
    if (activeTab === 'base') {
      fetchTalhoesBase();
      fetchTalhoesKmlData();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTalhoes();
    setFilteredTalhoes([]); // Limpa os talhões filtrados ao trocar de safra
    setFilterText('');
    setFilterType('Todos');
    setFilterStatus('Ativos');
  }, [safraId]);

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

  // Criação/edição de talhão por safra
  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) {
      toast.error('Preencha os dados do talhão.');
      return;
    }
    
    try {
      // Se estamos na aba BASE, editar/criar talhão base
      if (activeTab === 'base') {
        const talhaoBaseData = {
          TalhaoID: formData.TalhaoID,
          TIPO: formData.TIPO,
          NOME: formData.NOME,
          AREA: formData.AREA,
          VARIEDADE: formData.VARIEDADE,
          PORTAENXERTO: formData.PORTAENXERTO,
          DATA_DE_PLANTIO: formData.DATA_DE_PLANTIO,
          IDADE: formData.IDADE,
          FALHAS: formData.FALHAS,
          ESP: formData.ESP,
          COR: formData.COR,
          qtde_plantas: formData.QTDE_PLANTAS,
          OBS: formData.OBS,
          ativo: formData.ativo
        };
        
        if (editingId) {
          // Atualizar talhão base existente
          const response = await authFetch(`${BASE_URL}/talhoes/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(talhaoBaseData),
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao atualizar talhão base');
          }
          toast.success('Talhão base atualizado com sucesso!');
        } else {
          // Criar novo talhão base
          const response = await authFetch(`${BASE_URL}/talhoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(talhaoBaseData),
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao criar talhão base');
          }
          toast.success('Talhão base criado com sucesso!');
        }
        
        setFormData(null);
        setEditingId(null);
        await fetchTalhoesBase();
        return;
      }
      
      // Se estamos na aba SAFRA, editar/criar talhão safra
      if (!safraId) {
        toast.error('Selecione uma safra antes de cadastrar ou editar talhão.');
        return;
      }
      
      // O talhao_id deve vir do formData (armazenado durante handleEdit)
      // Se não tiver, busca do talhão sendo editado
      let talhao_id_backend = formData.talhao_id;
      
      if (!talhao_id_backend && editingId) {
        const talhao = talhoes.find(t => t.id === editingId);
        // Se o talhão tem talhao_id, usa ele (é um override de safra)
        // Se não, usa o próprio id (é um talhão base)
        talhao_id_backend = talhao?.talhao_id || talhao?.id;
      }
      
      if (!talhao_id_backend) {
        toast.error('Erro: não foi possível identificar o talhão base.');
        return;
      }
      
      // Verifica se já existe vínculo para este talhao_id + safraId
      const existingVinculo = talhoes.find(t => 
        t.talhao_id === talhao_id_backend && 
        t.safra_id === safraId && 
        t.id !== undefined && 
        t.id !== null && 
        t.id !== ''
      );
      
      // Mapear os campos do formData (uppercase) para os nomes esperados pelo backend (lowercase)
      const talhaoSafraData = {
        talhao_id: talhao_id_backend,
        safra_id: safraId,
        area: formData.AREA,
        variedade: formData.VARIEDADE,
        qtde_plantas: formData.QTDE_PLANTAS,
        porta_enxerto: formData.PORTAENXERTO,
        data_de_plantio: formData.DATA_DE_PLANTIO,
        idade: formData.IDADE,
        falhas: formData.FALHAS,
        esp: formData.ESP,
        obs: formData.OBS,
        ativo: formData.ativo
      };
      
      if (existingVinculo) {
        // Atualiza registro existente em talhao_safra
        const response = await authFetch(`${BASE_URL}/talhao_safra/${existingVinculo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(talhaoSafraData),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao atualizar talhão');
        }
        toast.success('Talhão atualizado com sucesso!');
      } else {
        // Cria novo vínculo em talhao_safra
        const response = await authFetch(`${BASE_URL}/talhao_safra`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(talhaoSafraData),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao adicionar talhão');
        }
        toast.success('Talhão adicionado/atualizado para a safra!');
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
      talhao_id: talhao.talhao_id || talhao.id, // Preserva o talhao_id ou usa o id se for talhão base
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
      const response = await authFetch(`${BASE_URL}/talhoes/${id}`, { method: 'DELETE' });
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

  // Sincronizar talhão safra com dados do talhão base
  const handleSyncWithBase = async (talhao: Talhao) => {
    try {
      // Buscar talhão base correspondente
      const talhaoBaseId = (talhao as any).talhao_id || talhao.id;
      const responseBase = await authFetch(`${BASE_URL}/talhoes`);
      if (!responseBase.ok) throw new Error('Erro ao buscar talhões base');
      
      const talhoesBase = await responseBase.json();
      const talhaoBase = talhoesBase.find((t: any) => t.id === talhaoBaseId);
      
      if (!talhaoBase) {
        toast.error('Talhão base não encontrado');
        return;
      }

      // Atualizar talhão safra com dados do base
      const updateData = {
        area: talhaoBase.AREA,
        variedade: talhaoBase.VARIEDADE,
        qtde_plantas: talhaoBase.qtde_plantas,
        porta_enxerto: talhaoBase.PORTAENXERTO,
        data_de_plantio: talhaoBase.DATA_DE_PLANTIO,
        idade: talhaoBase.IDADE,
        falhas: talhaoBase.FALHAS,
        esp: talhaoBase.ESP,
        obs: talhaoBase.OBS,
        ativo: talhaoBase.ativo
      };

      const response = await authFetch(`${BASE_URL}/talhao_safra/${talhao.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) throw new Error('Erro ao sincronizar com talhão base');
      
      await fetchTalhoes();
      toast.success(`Dados sincronizados com talhão base "${talhaoBase.NOME}"!`);
    } catch (error) {
      toast.error('Erro ao sincronizar: ' + (error instanceof Error ? error.message : 'Desconhecido'));
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

  const handleOpenImportModal = async () => {
    setImportModalOpen(true);
    setImportType(null);
    setSafraOrigemId(null);
    // Fetch safras only if needed (when user selects 'safra')
  };

  const handleImportTypeChange = async (type: 'base' | 'safra') => {
    setImportType(type);
    if (type === 'safra') {
      try {
        const allSafras = await fetchSafras();
        setSafras(allSafras.filter(s => s.id !== safraId)); // Exclude current safra
      } catch (e) {
        toast.error('Erro ao buscar safras para importação');
      }
    }
  };

  const handleImportTalhoes = async () => {
    if (!safraId) {
      toast.error('Selecione uma safra para importar talhões.');
      return;
    }
    setImportLoading(true);
    try {
      let body: any = { safra_id: safraId };
      if (importType === 'safra') {
        if (!safraOrigemId) {
          toast.error('Selecione a safra de origem.');
          setImportLoading(false);
          return;
        }
        body.origem = 'safra';
        body.safra_origem_id = safraOrigemId;
      } else {
        body.origem = 'base';
      }
      const response = await authFetch(`${BASE_URL}/talhao_safra/importar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao importar talhões');
      }
      toast.success('Talhões importados com sucesso!');
      setImportModalOpen(false);
      await fetchTalhoes();
    } catch (error) {
      toast.error('Erro ao importar talhões: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    } finally {
      setImportLoading(false);
    }
  };

  // Vincular talhão a KML
  const handleLinkTalhaoToKml = async (talhaoId: string, kmlId: string) => {
    try {
      setLinkingTalhaoId(talhaoId);
      await linkTalhaoToKml(talhaoId, kmlId);
      toast.success('Talhão vinculado ao KML com sucesso!');
      await fetchTalhoesBase();
      await fetchTalhoesKmlData();
    } catch (error) {
      toast.error('Erro ao vincular talhão ao KML: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    } finally {
      setLinkingTalhaoId(null);
    }
  };

  // Desvincular talhão de KML
  const handleUnlinkTalhaoFromKml = async (talhaoId: string) => {
    try {
      setLinkingTalhaoId(talhaoId);
      await linkTalhaoToKml(talhaoId, ''); // Enviar string vazia para desvincular
      toast.success('Talhão desvinculado do KML com sucesso!');
      await fetchTalhoesBase();
      await fetchTalhoesKmlData();
    } catch (error) {
      toast.error('Erro ao desvincular talhão do KML: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    } finally {
      setLinkingTalhaoId(null);
    }
  };

  // Altera a fonte de dados conforme a aba
  const talhoesToShow = activeTab === 'base' ? talhoesBase : talhoes;

  // Aplica filtros e ordenação apenas sobre a fonte de dados da aba ativa
  const filteredTalhoesToShow = (() => {
    const filtered = talhoesToShow.filter((talhao) => {
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
    if (sortConfig.direction) {
      return sortTalhoes(filtered, sortConfig.key, sortConfig.direction);
    }
    return filtered;
  })();

  return (
    <div style={{
      padding: '15px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '100%',
      margin: '0 auto',
      fontSize: '13px',
    }}>
      {/* Abas de navegação */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('safra')}
          style={{
            padding: '8px 24px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'safra' ? '#4CAF50' : '#e0e0e0',
            color: activeTab === 'safra' ? 'white' : '#333',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            borderBottom: activeTab === 'safra' ? '2px solid #4CAF50' : '2px solid #e0e0e0',
          }}
        >
          Talhão Safra
        </button>
        <button
          onClick={() => setActiveTab('base')}
          style={{
            padding: '8px 24px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'base' ? '#4CAF50' : '#e0e0e0',
            color: activeTab === 'base' ? 'white' : '#333',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            borderBottom: activeTab === 'base' ? '2px solid #4CAF50' : '2px solid #e0e0e0',
          }}
        >
          Talhão Base
        </button>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        <h2 style={{
          fontSize: '20px',
          color: '#333',
          margin: 0,
        }}>Talhões</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Botão Atualizar removido - atualização automática após cada ação */}
          {/* Botão Importar oculto - mantido apenas para inicialização de safra */}
          <button
            className="primary"
            onClick={handleOpenImportModal}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'background-color 0.3s',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fb8c00'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff9800'}
            disabled={!safraId}
            title="Vincular talhões da base ou de outra safra a esta safra"
          >
            Inicializar Safra
          </button>
          {!editingId && (
            <button
              className="primary"
              onClick={() => {
                if (!safraId) {
                  toast.error('Selecione uma safra antes de cadastrar talhão.');
                  return;
                }
                setFormData({
                  TalhaoID: null,
                  TIPO: tipoOptions[0]?.name || 'Talhao',
                  NOME: '',
                  AREA: 0,
                  VARIEDADE: variedadeOptions[0]?.name || '',
                  PORTAENXERTO: '',
                  DATA_DE_PLANTIO: '',
                  IDADE: 0,
                  FALHAS: 0,
                  ESP: '',
                  COR: tipoOptions[0]?.default_color || '#00FF00',
                  QTDE_PLANTAS: 0,
                  OBS: '',
                  ativo: true,
                });
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
              disabled={!safraId}
            >
              Novo Talhão
            </button>
          )}
        </div>
      </div>
      {/* Import Modal */}
      {importModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            minWidth: '350px',
            maxWidth: '90vw',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ marginTop: 0, fontSize: '18px' }}>Inicializar Safra - Vincular Talhões</h3>
            <p style={{ fontSize: '13px' }}>De onde deseja vincular os talhões para esta safra?</p>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: importType === 'base' ? '#4CAF50' : '#e0e0e0',
                  color: importType === 'base' ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px',
                }}
                onClick={() => handleImportTypeChange('base')}
              >
                Da Base Geral
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: importType === 'safra' ? '#4CAF50' : '#e0e0e0',
                  color: importType === 'safra' ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px',
                }}
                onClick={() => handleImportTypeChange('safra')}
              >
                De Outra Safra
              </button>
            </div>
            {importType === 'safra' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px' }}>Safra de Origem:</label>
                <select
                  value={safraOrigemId || ''}
                  onChange={e => setSafraOrigemId(e.target.value)}
                  style={{ marginLeft: '10px', padding: '5px', borderRadius: '5px', fontSize: '13px' }}
                >
                  <option value="">Selecione...</option>
                  {safras.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setImportModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '5px', border: 'none', background: '#ccc', color: '#333', fontSize: '13px' }}
                disabled={importLoading}
              >Cancelar</button>
              <button
                onClick={handleImportTalhoes}
                style={{ padding: '8px 16px', borderRadius: '5px', border: 'none', background: '#4CAF50', color: 'white', fontWeight: 'bold', fontSize: '13px' }}
                disabled={importLoading || !importType || (importType === 'safra' && !safraOrigemId)}
              >{importLoading ? 'Vinculando...' : 'Vincular Talhões'}</button>
            </div>
          </div>
        </div>
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
              padding: '8px 8px 8px 35px',
              border: '1px solid #ccc',
              borderRadius: '20px',
              fontSize: '13px',
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
            <tr style={{
              backgroundColor: '#f2f2f2',
              color: '#333',
              fontWeight: 'bold',
              fontSize: '16px',
              height: '50px',
            }}>
              <th
                style={{
                  padding: '8px',
                  borderBottom: '2px solid #ddd',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
                onClick={() => handleSort('TalhaoID')}
              >
                Talhão ID {sortConfig.key === 'TalhaoID' && (sortConfig.direction === 'asc' ? '▲' : sortConfig.direction === 'desc' ? '▼' : '')}
              </th>
              <th
                style={{
                  padding: '8px',
                  borderBottom: '2px solid #ddd',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
                onClick={() => handleSort('NOME')}
              >
                Nome {sortConfig.key === 'NOME' && (sortConfig.direction === 'asc' ? '▲' : sortConfig.direction === 'desc' ? '▼' : '')}
              </th>
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Tipo</th>
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Área (ha)</th>
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Variedade</th>
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Portaenxerto</th>
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Data de Plantio</th>
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Idade</th>
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Quantidade de Plantas</th>
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Falhas</th>
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Esp.</th>
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Observações</th>
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Cor</th>              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Situação</th>
              {activeTab === 'base' && (
                <th style={{
                  padding: '8px',
                  borderBottom: '2px solid #ddd',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}>Vinculação KML</th>
              )}
              <th style={{
                padding: '8px',
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTalhoesToShow.map((talhao, index) => (
              <tr key={talhao.id} style={{
                backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                transition: 'background-color 0.3s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fafafa' : 'white'}
              >
                <td style={{
                  padding: '6px 8px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '12px',
                  color: '#333',
                }}>{talhao.TalhaoID}</td>
                <td style={{
                  padding: '6px 8px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '12px',
                  color: '#333',
                }}>{talhao.NOME}</td>
                <td style={{
                  padding: '6px 8px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '12px',
                  color: '#333',
                }}>{talhao.TIPO}</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>{talhao.AREA}</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>{talhao.VARIEDADE}</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>{talhao.PORTAENXERTO}</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>{formatBrazilianDate(talhao.DATA_DE_PLANTIO)}</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>{talhao.IDADE}</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>{talhao.qtde_plantas}</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>{talhao.FALHAS}</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>{talhao.ESP}</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>{talhao.OBS}</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: talhao.COR,
                    margin: '0 auto',
                  }}></div>
                </td>                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>{talhao.ativo ? 'Ativo' : 'Inativo'}</td>
                {activeTab === 'base' && (
                  <td style={{
                    padding: '10px',
                    borderBottom: '1px solid #ddd',
                    fontSize: '14px',
                    color: '#333',
                  }}>
                    {talhao.talhao_kml_id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#4CAF50',
                          fontWeight: 'bold' 
                        }}>
                          Vinculado: {talhoesKml.find(k => k.id === talhao.talhao_kml_id)?.placemark_name || 'KML não encontrado'}
                        </div>
                        <button
                          onClick={() => handleUnlinkTalhaoFromKml(talhao.id)}
                          disabled={linkingTalhaoId === talhao.id}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          {linkingTalhaoId === talhao.id ? 'Desvinculando...' : 'Desvincular'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleLinkTalhaoToKml(talhao.id, e.target.value);
                              e.target.value = ''; // Reset select
                            }
                          }}
                          disabled={linkingTalhaoId === talhao.id}
                          style={{
                            padding: '4px',
                            border: '1px solid #ccc',
                            borderRadius: '3px',
                            fontSize: '11px',
                          }}
                        >
                          <option value="">Selecionar KML...</option>
                          {talhoesKml
                            .filter(k => k.ativo === 1) // Apenas KMLs ativos
                            .filter(k => !talhoesBase.some(t => t.talhao_kml_id === k.id)) // Apenas KMLs não vinculados
                            .map(kml => (
                              <option key={kml.id} value={kml.id}>
                                {kml.placemark_name}
                              </option>
                            ))}
                        </select>
                        {linkingTalhaoId === talhao.id && (
                          <div style={{ fontSize: '11px', color: '#666' }}>
                            Vinculando...
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                )}
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                    {activeTab === 'safra' && (
                      <button
                        onClick={() => handleSyncWithBase(talhao)}
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#ff9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          transition: 'background-color 0.3s',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Sincronizar com Talhão Base (importar área, variedade, qtd plantas, etc.)"
                        aria-label="Sincronizar com Base"
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#fb8c00'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = '#ff9800'}
                      >
                        <span role="img" aria-label="Sincronizar">🔄</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(talhao)}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        transition: 'background-color 0.3s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Editar"
                      aria-label="Editar"
                      onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e88e5'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = '#2196F3'}
                    >
                      <span role="img" aria-label="Editar">✏️</span>
                    </button>
                    <button
                      onClick={() => handleDelete(talhao.id)}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        transition: 'background-color 0.3s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Excluir"
                      aria-label="Excluir"
                      onMouseOver={e => e.currentTarget.style.backgroundColor = '#da190b'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = '#f44336'}
                    >
                      <span role="img" aria-label="Excluir">🗑️</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>        </table>
      </div>
    </div>
  );
}

export default DataPage;