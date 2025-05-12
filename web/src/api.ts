const BASE_URL = 'http://localhost:3000';

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
  ESP: number;
  COR: string;
  qtde_plantas?: number;
  coordinates?: string; // Nova propriedade para as coordenadas
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
  const response = await fetch(`${BASE_URL}/safras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(safra),
  });
  return handleResponse(response);
};

export const fetchSafras = async (): Promise<Safra[]> => {
  const response = await fetch(`${BASE_URL}/safras`);
  return handleResponse(response);
};

export const fetchSafraById = async (id: string): Promise<Safra> => {
  const response = await fetch(`${BASE_URL}/safras/${id}`);
  return handleResponse(response);
};

export const updateSafra = async (id: string, safra: Omit<Safra, 'id'>): Promise<Safra> => {
  const response = await fetch(`${BASE_URL}/safras/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(safra),
  });
  return handleResponse(response);
};

export const deleteSafra = async (id: string): Promise<{ message: string }> => {
  const response = await fetch(`${BASE_URL}/safras/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// APIs para kml_files
export const createKmlFile = async (kmlFile: Omit<KmlFile, 'id'>): Promise<KmlFile> => {
  const response = await fetch(`${BASE_URL}/kml_files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(kmlFile),
  });
  return handleResponse(response);
};

export const fetchKmlFiles = async (): Promise<KmlFile[]> => {
  const response = await fetch(`${BASE_URL}/kml_files`);
  return handleResponse(response);
};

export const fetchKmlFileById = async (id: string): Promise<KmlFile> => {
  const response = await fetch(`${BASE_URL}/kml_files/${id}`);
  return handleResponse(response);
};

export const deleteKmlFile = async (id: string): Promise<{ message: string }> => {
  const response = await fetch(`${BASE_URL}/kml_files/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// Novo endpoint para upload de KML (confirmado que está exportado)
export const uploadKmlFile = async (kmlFile: File): Promise<{ message: string; kmlId: string }> => {
  const formData = new FormData();
  formData.append('kmlFile', kmlFile);

  const response = await fetch(`${BASE_URL}/kml/upload`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(response);
};

// APIs para talhoes
export const createTalhao = async (talhao: Omit<Talhao, 'id'>): Promise<Talhao> => {
  const response = await fetch(`${BASE_URL}/talhoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(talhao),
  });
  return handleResponse(response);
};

export const fetchTalhoes = async (): Promise<Talhao[]> => {
  const response = await fetch(`${BASE_URL}/talhoes`);
  return handleResponse(response);
};

export const fetchTalhaoById = async (id: string): Promise<Talhao> => {
  const response = await fetch(`${BASE_URL}/talhoes/${id}`);
  return handleResponse(response);
};

export const updateTalhao = async (id: string, talhao: Omit<Talhao, 'id'>): Promise<Talhao> => {
  const response = await fetch(`${BASE_URL}/talhoes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(talhao),
  });
  return handleResponse(response);
};

export const deleteTalhao = async (id: string): Promise<{ message: string }> => {
  const response = await fetch(`${BASE_URL}/talhoes/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// APIs para tipo_configs
export const createTipoConfig = async (tipoConfig: Omit<ConfigOption, 'id'>): Promise<ConfigOption> => {
  const response = await fetch(`${BASE_URL}/tipo_configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tipoConfig),
  });
  return handleResponse(response);
};

export const fetchTipoConfigs = async (): Promise<ConfigOption[]> => {
  const response = await fetch(`${BASE_URL}/tipo_configs`);
  return handleResponse(response);
};

export const fetchTipoConfigById = async (id: string): Promise<ConfigOption> => {
  const response = await fetch(`${BASE_URL}/tipo_configs/${id}`);
  return handleResponse(response);
};

export const updateTipoConfig = async (id: string, tipoConfig: Omit<ConfigOption, 'id'>): Promise<ConfigOption> => {
  const response = await fetch(`${BASE_URL}/tipo_configs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tipoConfig),
  });
  return handleResponse(response);
};

export const deleteTipoConfig = async (id: string): Promise<{ message: string }> => {
  const response = await fetch(`${BASE_URL}/tipo_configs/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// APIs para variedade_configs
export const createVariedadeConfig = async (variedadeConfig: Omit<ConfigOption, 'id'>): Promise<ConfigOption> => {
  const response = await fetch(`${BASE_URL}/variedade_configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(variedadeConfig),
  });
  return handleResponse(response);
};

export const fetchVariedadeConfigs = async (): Promise<ConfigOption[]> => {
  const response = await fetch(`${BASE_URL}/variedade_configs`);
  return handleResponse(response);
};

export const fetchVariedadeConfigById = async (id: string): Promise<ConfigOption> => {
  const response = await fetch(`${BASE_URL}/variedade_configs/${id}`);
  return handleResponse(response);
};

export const updateVariedadeConfig = async (id: string, variedadeConfig: Omit<ConfigOption, 'id'>): Promise<ConfigOption> => {
  const response = await fetch(`${BASE_URL}/variedade_configs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(variedadeConfig),
  });
  return handleResponse(response);
};

export const deleteVariedadeConfig = async (id: string): Promise<{ message: string }> => {
  const response = await fetch(`${BASE_URL}/variedade_configs/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// APIs para carregamentos
export const createCarregamento = async (carregamento: Omit<Carregamento, 'id'>): Promise<Carregamento> => {
  const response = await fetch(`${BASE_URL}/carregamentos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(carregamento),
  });
  return handleResponse(response);
};

export const fetchCarregamentos = async (safraId?: string): Promise<Carregamento[]> => {
  const url = safraId ? `${BASE_URL}/carregamentos?safra_id=${safraId}` : `${BASE_URL}/carregamentos`;
  const response = await fetch(url);
  return handleResponse(response);
};

export const fetchCarregamentoById = async (id: string): Promise<Carregamento> => {
  const response = await fetch(`${BASE_URL}/carregamentos/${id}`);
  return handleResponse(response);
};

export const updateCarregamento = async (id: string, carregamento: Omit<Carregamento, 'id'>): Promise<Carregamento> => {
  const response = await fetch(`${BASE_URL}/carregamentos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(carregamento),
  });
  return handleResponse(response);
};

export const deleteCarregamento = async (id: string): Promise<{ message: string }> => {
  const response = await fetch(`${BASE_URL}/carregamentos/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// APIs para prev_realizado
export const createPrevRealizado = async (prevRealizado: Omit<PrevRealizado, 'id'>): Promise<PrevRealizado> => {
  const response = await fetch(`${BASE_URL}/prev_realizado`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prevRealizado),
  });
  return handleResponse(response);
};

export const fetchPrevRealizados = async (safraId?: string): Promise<PrevRealizado[]> => {
  const url = safraId ? `${BASE_URL}/prev_realizado?safra_id=${safraId}` : `${BASE_URL}/prev_realizado`;
  const response = await fetch(url);
  return handleResponse(response);
};

export const fetchPrevRealizadoById = async (id: string): Promise<PrevRealizado> => {
  const response = await fetch(`${BASE_URL}/prev_realizado/${id}`);
  return handleResponse(response);
};

export const updatePrevRealizado = async (id: string, prevRealizado: Omit<PrevRealizado, 'id'>): Promise<PrevRealizado> => {
  const response = await fetch(`${BASE_URL}/prev_realizado/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prevRealizado),
  });
  return handleResponse(response);
};

export const deletePrevRealizado = async (id: string): Promise<{ message: string }> => {
  const response = await fetch(`${BASE_URL}/prev_realizado/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};

// APIs para semanas_colheita
export const createSemanaColheita = async (semanaColheita: Omit<SemanaColheita, 'id'>): Promise<SemanaColheita> => {
  const response = await fetch(`${BASE_URL}/semanas_colheita`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(semanaColheita),
  });
  return handleResponse(response);
};

export const fetchSemanasColheita = async (safraId?: string): Promise<SemanaColheita[]> => {
  const url = safraId ? `${BASE_URL}/semanas_colheita?safra_id=${safraId}` : `${BASE_URL}/semanas_colheita`;
  const response = await fetch(url);
  return handleResponse(response);
};

export const fetchSemanaColheitaById = async (id: string): Promise<SemanaColheita> => {
  const response = await fetch(`${BASE_URL}/semanas_colheita/${id}`);
  return handleResponse(response);
};

export const updateSemanaColheita = async (id: string, semanaColheita: Omit<SemanaColheita, 'id'>): Promise<SemanaColheita> => {
  const response = await fetch(`${BASE_URL}/semanas_colheita/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(semanaColheita),
  });
  return handleResponse(response);
};

export const deleteSemanaColheita = async (id: string): Promise<{ message: string }> => {
  const response = await fetch(`${BASE_URL}/semanas_colheita/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
};