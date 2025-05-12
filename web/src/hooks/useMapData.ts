import { useState, useCallback, useEffect } from 'react';

// Interface para Talhao, definida localmente
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

export function useMapData(): MapData {
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [kmlFiles, setKmlFiles] = useState<KmlFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

  const fetchData = useCallback(async () => {
    try {
      console.log(`[${new Date().toISOString()}] useMapData: Buscando talhoes`);
      const talhoesResponse = await fetch(`${BASE_URL}/talhoes`);
      if (!talhoesResponse.ok) throw new Error('Erro ao buscar talhões');
      const talhoesData: Talhao[] = await talhoesResponse.json();

      console.log(`[${new Date().toISOString()}] useMapData: Buscando kml_files`);
      const kmlFilesResponse = await fetch(`${BASE_URL}/kml_files`);
      if (!kmlFilesResponse.ok) throw new Error('Erro ao buscar arquivos KML');
      const kmlFilesData: KmlFile[] = await kmlFilesResponse.json();

      setTalhoes(talhoesData);
      setKmlFiles(kmlFilesData);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Erro no useMapData:', errorMessage);
    }
  }, [BASE_URL]); // Dependência apenas de BASE_URL, que não muda

  // Carrega os dados automaticamente ao montar o hook
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { talhoes, kmlFiles, error, fetchData };
}