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
  OBS?: string;
  ativo: boolean;
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

export interface Motorista {
  id: string;
  nome: string;
}

export interface PrevRealizado {
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

export interface Previsao {
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

export interface SemanaColheita {
  id: string;
  semana_ano: number;
  semana_colheita: number;
  safra_id: string;
}

export interface Safra {
  id: string;
  nome: string;
  is_active: boolean;
  data_inicial_colheita: number | null;
}

export interface DinamicaData {
  talhaoId: string;
  talhaoNome: string;
  variedade: string;
  totalCaixas: number;
  qtdePlantas: number;
  mediaCaixasPorPlanta: number;
}

export interface CarregamentoFormData {
  id?: string;
  data: string;
  talhao_id: string;
  motorista: string;
  placa: string;
  qteCaixa: number | string;
}

export interface KmlFile {
  id: string;
  name: string;
  content: string;
}