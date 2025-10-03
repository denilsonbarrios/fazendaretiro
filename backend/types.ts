// Tipos TypeScript para o backend

export interface Talhao {
  id: string;
  TalhaoID?: string;
  NOME: string;
  AREA: string;
  coordinates?: string;
  TIPO: string;
  PORTAENXERTO: string;
  DATA_DE_PLANTIO: string;
  COR: string;
  OBS?: string;
  ativo: number; // SQLite usa INTEGER (0/1)
  created_at?: number;
  updated_at?: number;
}

export interface TalhaoSafra {
  id: string;
  talhao_id: string;
  safra_id: string;
  VARIEDADE?: string;
  qtde_plantas?: number;
  IDADE?: number;
  FALHAS?: number;
  ESP?: string;
  qtde_caixas_prev_pe?: number;
  total_cx_prev?: number;
  total_cx_realizado?: number;
  created_at?: number;
  updated_at?: number;
}

export interface TalhaoCompleto extends Talhao {
  safra_data?: TalhaoSafra;
  // Campos compatibilidade (dados da safra nivelados)
  VARIEDADE?: string;
  qtde_plantas?: number;
  IDADE?: number;
  FALHAS?: number;
  ESP?: string;
  qtde_caixas_prev_pe?: number;
  total_cx_prev?: number;
  total_cx_realizado?: number;
}

export interface Safra {
  id: string;
  nome: string;
  is_active: boolean;
  data_inicial_colheita?: number;
}

export interface Carregamento {
  id: string;
  data: number;
  talhao_id: string;
  qtde_plantas: number;
  variedade: string;
  motorista: string;
  placa: string;
  qte_caixa: number;
  semana: number;
  semana_colheita: number;
  safra_id: string;
}

// Tipos para API requests/responses
export interface CreateTalhaoRequest {
  TalhaoID?: string;
  NOME: string;
  AREA?: string;
  coordinates?: string;
  TIPO?: string;
  PORTAENXERTO?: string;
  DATA_DE_PLANTIO?: string;
  COR?: string;
  OBS?: string;
  ativo?: boolean;
}

export interface CreateTalhaoSafraRequest {
  talhao_id: string;
  safra_id: string;
  VARIEDADE?: string;
  qtde_plantas?: number;
  IDADE?: number;
  FALHAS?: number;
  ESP?: string;
  qtde_caixas_prev_pe?: number;
}

export interface UpdateTalhaoSafraRequest extends Partial<CreateTalhaoSafraRequest> {
  id: string;
}