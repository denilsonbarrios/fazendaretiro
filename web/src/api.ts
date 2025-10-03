export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper para adicionar token aos headers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Wrapper para fetch que sempre adiciona autenticação
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const defaultOptions: RequestInit = {
    headers: getAuthHeaders(),
  };
  
  // Merge options
  const mergedOptions: RequestInit = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };
  
  return fetch(url, mergedOptions);
}

// Tipos para as entidades
export interface Safra {
  id: string;
  nome: string;
  is_active: boolean;
  data_inicial_colheita: number | null;
}

export interface KmlFile {
  id: string;
  name: string;
  content: string;
}

export interface TalhaoKml {
  id: string;
  placemark_name: string;
  coordinates: string;
  geometry_type: string;
  kml_file_id?: string;
  data_importacao?: number;
  ativo: number;
}

export interface Talhao {
  id: string;
  TalhaoID?: string;
  TIPO: string;
  NOME: string;
  AREA: string;
  VARIEDADE: string;
  PORTAENXERTO: string;
  DATA_DE_PLANTIO: string;
  IDADE: number;
  FALHAS: number;
  ESP: string; // Alinhando com types.ts
  COR: string;
  qtde_plantas?: number;
  coordinates?: string; // Para compatibilidade - agora vem via talhao_kml_id
  talhao_kml_id?: string; // Nova referência para talhoes_kml
  ativo?: number;
  OBS?: string;
}

export interface ConfigOption {
  id: string;
  name: string;
  default_color: string;
}

export interface Carregamento {
  id: string;
  data: number;
  talhao: string;
  talhao_n: number;
  qtde_plantas: number;
  variedade: string;
  motorista: string;
  placa: string;
  qte_caixa: number;
  total: number;
  media: number;
  semana: number;
  safra_id: string;
}

export interface PrevRealizado {
  id: string;
  talhao: string;
  variedade: string;
  total_pes: number;
  cx_pe_prev: number;
  cx_pe_realizado: number;
  total_cx_prev: number;
  total_cx_realizado: number;
  safra_id: string;
}

export interface SemanaColheita {
  id: string;
  semana_ano: number;
  semana_colheita: number;
  safra_id: string;
}

// Função auxiliar para tratar erros
const handleResponse = async (response: Response): Promise<any> => {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro na requisição');
  }
  return response.json();
};

// APIs para safras
export const createSafra = async (safra: Omit<Safra, 'id'>): Promise<Safra> => {
  const response = await authFetch(`${BASE_URL}/safras`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(safra),
  });
  return handleResponse(response);
};

export const fetchSafras = async (): Promise<Safra[]> => {
  const response = await authFetch(`${BASE_URL}/safras`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const fetchSafraById = async (id: string): Promise<Safra> => {
  const response = await authFetch(`${BASE_URL}/safras/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const updateSafra = async (id: string, safra: Omit<Safra, 'id'>): Promise<Safra> => {
  const response = await authFetch(`${BASE_URL}/safras/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(safra),
  });
  return handleResponse(response);
};

export const deleteSafra = async (id: string): Promise<{ message: string }> => {
  const response = await authFetch(`${BASE_URL}/safras/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// APIs para kml_files
export const createKmlFile = async (kmlFile: Omit<KmlFile, 'id'>): Promise<KmlFile> => {
  const response = await authFetch(`${BASE_URL}/kml_files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(kmlFile),
  });
  return handleResponse(response);
};

export const fetchKmlFiles = async (): Promise<KmlFile[]> => {
  const response = await authFetch(`${BASE_URL}/kml_files`);
  return handleResponse(response);
};

export const fetchKmlFileById = async (id: string): Promise<KmlFile> => {
  const response = await authFetch(`${BASE_URL}/kml_files/${id}`);
  return handleResponse(response);
};

export const deleteKmlFile = async (id: string): Promise<{ message: string }> => {
  const response = await authFetch(`${BASE_URL}/kml_files/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// Novo endpoint para upload de KML (confirmado que está exportado)
export const uploadKmlFile = async (kmlFile: File): Promise<{ 
  message: string; 
  kmlId: string; 
  createdKmlTalhoes: number;
  updatedKmlTalhoes: number;
  removedKmlTalhoes?: number;
  unlinkedTalhoes?: number;
}> => {
  const formData = new FormData();
  formData.append('kmlFile', kmlFile);

  const response = await authFetch(`${BASE_URL}/kml/upload`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(response);
};

// APIs para talhoes
export const createTalhao = async (talhao: Omit<Talhao, 'id'>): Promise<Talhao> => {
  const response = await authFetch(`${BASE_URL}/talhoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(talhao),
  });
  return handleResponse(response);
};

export const fetchTalhoes = async (): Promise<Talhao[]> => {
  const response = await authFetch(`${BASE_URL}/talhoes`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const fetchTalhaoById = async (id: string): Promise<Talhao> => {
  const response = await authFetch(`${BASE_URL}/talhoes/${id}`);
  return handleResponse(response);
};

export const updateTalhao = async (id: string, talhao: Omit<Talhao, 'id'>): Promise<Talhao> => {
  const response = await authFetch(`${BASE_URL}/talhoes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(talhao),
  });
  return handleResponse(response);
};

export const deleteTalhao = async (id: string): Promise<{ message: string }> => {
  const response = await authFetch(`${BASE_URL}/talhoes/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// APIs para tipo_configs
export const createTipoConfig = async (tipoConfig: Omit<ConfigOption, 'id'>): Promise<ConfigOption> => {
  const response = await authFetch(`${BASE_URL}/tipo_configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tipoConfig),
  });
  return handleResponse(response);
};

export const fetchTipoConfigs = async (): Promise<ConfigOption[]> => {
  const response = await authFetch(`${BASE_URL}/tipo_configs`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const fetchTipoConfigById = async (id: string): Promise<ConfigOption> => {
  const response = await authFetch(`${BASE_URL}/tipo_configs/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const updateTipoConfig = async (id: string, tipoConfig: Omit<ConfigOption, 'id'>): Promise<ConfigOption> => {
  const response = await authFetch(`${BASE_URL}/tipo_configs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tipoConfig),
  });
  return handleResponse(response);
};

export const deleteTipoConfig = async (id: string): Promise<{ message: string }> => {
  const response = await authFetch(`${BASE_URL}/tipo_configs/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// APIs para variedade_configs
export const createVariedadeConfig = async (variedadeConfig: Omit<ConfigOption, 'id'>): Promise<ConfigOption> => {
  const response = await authFetch(`${BASE_URL}/variedade_configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(variedadeConfig),
  });
  return handleResponse(response);
};

export const fetchVariedadeConfigs = async (): Promise<ConfigOption[]> => {
  const response = await authFetch(`${BASE_URL}/variedade_configs`);
  return handleResponse(response);
};

export const fetchVariedadeConfigById = async (id: string): Promise<ConfigOption> => {
  const response = await authFetch(`${BASE_URL}/variedade_configs/${id}`);
  return handleResponse(response);
};

export const updateVariedadeConfig = async (id: string, variedadeConfig: Omit<ConfigOption, 'id'>): Promise<ConfigOption> => {
  const response = await authFetch(`${BASE_URL}/variedade_configs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(variedadeConfig),
  });
  return handleResponse(response);
};

export const deleteVariedadeConfig = async (id: string): Promise<{ message: string }> => {
  const response = await authFetch(`${BASE_URL}/variedade_configs/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// APIs para carregamentos
export const createCarregamento = async (carregamento: Omit<Carregamento, 'id'>): Promise<Carregamento> => {
  const response = await authFetch(`${BASE_URL}/carregamentos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(carregamento),
  });
  return handleResponse(response);
};

export const fetchCarregamentos = async (safraId?: string): Promise<Carregamento[]> => {
  const url = safraId ? `${BASE_URL}/carregamentos?safra_id=${safraId}` : `${BASE_URL}/carregamentos`;
  const response = await authFetch(url);
  return handleResponse(response);
};

export const fetchCarregamentoById = async (id: string): Promise<Carregamento> => {
  const response = await authFetch(`${BASE_URL}/carregamentos/${id}`);
  return handleResponse(response);
};

export const updateCarregamento = async (id: string, carregamento: Omit<Carregamento, 'id'>): Promise<Carregamento> => {
  const response = await authFetch(`${BASE_URL}/carregamentos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(carregamento),
  });
  return handleResponse(response);
};

export const deleteCarregamento = async (id: string): Promise<{ message: string }> => {
  const response = await authFetch(`${BASE_URL}/carregamentos/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// APIs para prev_realizado
export const createPrevRealizado = async (prevRealizado: Omit<PrevRealizado, 'id'>): Promise<PrevRealizado> => {
  const response = await authFetch(`${BASE_URL}/prev_realizado`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prevRealizado),
  });
  return handleResponse(response);
};

export const fetchPrevRealizados = async (safraId?: string): Promise<PrevRealizado[]> => {
  const url = safraId ? `${BASE_URL}/prev_realizado?safra_id=${safraId}` : `${BASE_URL}/prev_realizado`;
  const response = await authFetch(url);
  return handleResponse(response);
};

export const fetchPrevRealizadoById = async (id: string): Promise<PrevRealizado> => {
  const response = await authFetch(`${BASE_URL}/prev_realizado/${id}`);
  return handleResponse(response);
};

export const updatePrevRealizado = async (id: string, prevRealizado: Omit<PrevRealizado, 'id'>): Promise<PrevRealizado> => {
  const response = await authFetch(`${BASE_URL}/prev_realizado/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prevRealizado),
  });
  return handleResponse(response);
};

export const deletePrevRealizado = async (id: string): Promise<{ message: string }> => {
  const response = await authFetch(`${BASE_URL}/prev_realizado/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// APIs para semanas_colheita
export const createSemanaColheita = async (semanaColheita: Omit<SemanaColheita, 'id'>): Promise<SemanaColheita> => {
  const response = await authFetch(`${BASE_URL}/semanas_colheita`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(semanaColheita),
  });
  return handleResponse(response);
};

export const fetchSemanasColheita = async (safraId?: string): Promise<SemanaColheita[]> => {
  const url = safraId ? `${BASE_URL}/semanas_colheita?safra_id=${safraId}` : `${BASE_URL}/semanas_colheita`;
  const response = await authFetch(url);
  return handleResponse(response);
};

export const fetchSemanaColheitaById = async (id: string): Promise<SemanaColheita> => {
  const response = await authFetch(`${BASE_URL}/semanas_colheita/${id}`);
  return handleResponse(response);
};

export const updateSemanaColheita = async (id: string, semanaColheita: Omit<SemanaColheita, 'id'>): Promise<SemanaColheita> => {
  const response = await authFetch(`${BASE_URL}/semanas_colheita/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(semanaColheita),
  });
  return handleResponse(response);
};

export const deleteSemanaColheita = async (id: string): Promise<{ message: string }> => {
  const response = await authFetch(`${BASE_URL}/semanas_colheita/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// =============================
// APIs para a nova estrutura separada (KML + Talhões)
// =============================

// APIs para talhoes_kml
export const fetchTalhoesKml = async (): Promise<TalhaoKml[]> => {
  const response = await authFetch(`${BASE_URL}/talhoes_kml`);
  return handleResponse(response);
};

export const fetchTalhoesKmlSemVinculo = async (): Promise<TalhaoKml[]> => {
  const response = await authFetch(`${BASE_URL}/talhoes_kml/sem-vinculo`);
  return handleResponse(response);
};

export const fetchTalhoesSemKml = async (): Promise<Talhao[]> => {
  const response = await authFetch(`${BASE_URL}/talhoes/sem-kml`);
  return handleResponse(response);
};

// API para buscar coordenadas de um talhão
export const fetchTalhaoCoordinates = async (talhaoId: string): Promise<{ coordinates: any }> => {
  const response = await authFetch(`${BASE_URL}/talhoes/${talhaoId}/coordinates`);
  return handleResponse(response);
};

// API para vincular talhão a talhão KML
export const linkTalhaoToKml = async (talhaoId: string, talhaoKmlId: string): Promise<{ message: string }> => {
  const response = await authFetch(`${BASE_URL}/talhoes/${talhaoId}/link-kml`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ talhao_kml_id: talhaoKmlId }),
  });
  return handleResponse(response);
};

// API para buscar talhões com dados de safra (incluindo coordenadas)
export const fetchTalhoesSafra = async (safraId: string): Promise<any[]> => {
  const response = await authFetch(`${BASE_URL}/talhao_safra?safra_id=${safraId}`);
  return handleResponse(response);
};

// API para importar talhões base do CSV
export const importTalhoesFromCsv = async (): Promise<{ message: string; imported: number; updated: number; errors: string[] }> => {
  const response = await authFetch(`${BASE_URL}/import-talhoes-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse(response);
};

// APIs para associação de variedades
export const fetchTalhoesComVariedadesConfigs = async (): Promise<any[]> => {
  const response = await authFetch(`${BASE_URL}/talhoes/com-variedades-configs`);
  return handleResponse(response);
};

export const fetchEstatisticasVariedades = async (): Promise<any[]> => {
  const response = await authFetch(`${BASE_URL}/variedades/estatisticas`);
  return handleResponse(response);
};

export const aplicarCoresVariedades = async (): Promise<{message: string, atualizados: number, detalhes: any[]}> => {
  const response = await authFetch(`${BASE_URL}/talhoes/aplicar-cores-variedades`, {
    method: 'PUT',
  });
  return handleResponse(response);
};
