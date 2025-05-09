import { useState, useEffect } from 'react';

// Interface para KmlFile, definida localmente
interface KmlFile {
  id: string;
  name: string;
  content: string;
}

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
  PRODUCAO_CAIXA: number;
  PRODUCAO_HECTARE: number;
  COR: string;
  qtde_plantas?: number;
  coordinates?: string;
}

export function useMapData() {
  const [kmls, setKmls] = useState<KmlFile[]>([]); // Não será mais usado no MapPage
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [error, setError] = useState<string | null>(null);

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

  const fetchData = async () => {
    try {
      // Buscar KMLs (não será mais usado, mas mantido para compatibilidade com outros componentes)
      const kmlResponse = await fetch(`${BASE_URL}/kml_files`);
      if (!kmlResponse.ok) {
        throw new Error('Erro ao buscar KMLs');
      }
      const kmlData = await kmlResponse.json();
      setKmls(kmlData);

      // Buscar talhões
      const talhaoResponse = await fetch(`${BASE_URL}/talhoes`);
      if (!talhaoResponse.ok) {
        throw new Error('Erro ao buscar talhões');
      }
      const talhaoData = await talhaoResponse.json();
      setTalhoes(talhaoData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Erro ao buscar dados:', errorMessage);
    }
  };

  return { kmls, talhoes, error, fetchData };
}