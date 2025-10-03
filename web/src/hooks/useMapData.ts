import { useState, useCallback, useEffect } from 'react';
import { fetchTalhoes, fetchTalhoesSafra, fetchKmlFiles } from '../api';

// Interface para Talhao, definida localmente para compatibilidade
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
  FALHAS: number;
  ESP: string;
  COR: string;
  qtde_plantas?: number;
  coordinates?: string;
  talhao_kml_id?: string;
  ativo: boolean;
}

interface KmlFile {
  id: string;
  name: string;
  content: string;
}

interface MapData {
  talhoes: Talhao[];
  kmlFiles: KmlFile[];
  error: string | null;
  fetchData: () => Promise<void>;
}

export function useMapData(safraId?: string): MapData {
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [kmlFiles, setKmlFiles] = useState<KmlFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      console.log(`[${new Date().toISOString()}] useMapData: Buscando dados${safraId ? ` para safra ${safraId}` : ''}`);
      
      let talhoesData: any[];
      
      if (safraId) {
        // Se safra foi fornecida, busca talhões com dados de safra (incluindo coordenadas)
        talhoesData = await fetchTalhoesSafra(safraId);
      } else {
        // Senão, busca talhões normais
        talhoesData = await fetchTalhoes();
      }

      console.log(`[${new Date().toISOString()}] useMapData: Buscando kml_files`);
      const kmlFilesData = await fetchKmlFiles();

      setTalhoes(talhoesData);
      setKmlFiles(kmlFilesData);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Erro no useMapData:', errorMessage);
    }
  }, [safraId]); // Dependência de safraId para recarregar quando mudar

  // Carrega os dados automaticamente ao montar o hook ou quando safraId mudar
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { talhoes, kmlFiles, error, fetchData };
}