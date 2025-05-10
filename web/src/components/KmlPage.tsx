import { useState, useEffect, useCallback } from 'react';

// Interface para KmlFile
interface KmlFile {
  id: string;
  name: string;
  content: string;
}

// Interface para Talhao (simplificada para este componente)
interface Talhao {
  id: string;
  TalhaoID?: string;
  NOME: string;
  ativo: boolean;
}

export function KmlPage() {
  const [kmls, setKmls] = useState<KmlFile[]>([]);
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

  // Função para buscar KMLs
  const fetchKmlsData = useCallback(async () => {
    try {
      console.log(`[${new Date().toISOString()}] KmlPage: Buscando KMLs`);
      const response = await fetch(`${BASE_URL}/kml_files`);
      if (!response.ok) {
        throw new Error(`Erro ao buscar KMLs: ${response.status} ${response.statusText}`);
      }
      const kmlRecords: KmlFile[] = await response.json();
      console.log('KmlPage: KMLs carregados:', kmlRecords);
      setKmls(kmlRecords);
      return kmlRecords;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar KMLs';
      throw new Error(errorMessage);
    }
  }, []);

  // Função para buscar talhões
  const fetchTalhoesData = useCallback(async () => {
    try {
      console.log(`[${new Date().toISOString()}] KmlPage: Buscando talhões`);
      const response = await fetch(`${BASE_URL}/talhoes`);
      if (!response.ok) {
        throw new Error(`Erro ao buscar talhões: ${response.status} ${response.statusText}`);
      }
      const talhoes: Talhao[] = await response.json();
      console.log('KmlPage: Talhões carregados:', talhoes);
      return talhoes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar talhões';
      throw new Error(errorMessage);
    }
  }, []);

  // Função para atualizar as coordenadas de um talhão
  const updateTalhaoCoordinates = async (talhao: Talhao): Promise<void> => {
    try {
      if (!talhao.ativo) {
        console.log(`Talhão ${talhao.NOME} está inativo, pulando atualização de coordenadas`);
        return;
      }

      console.log(`Buscando coordenadas para o talhão ${talhao.id}`);
      const coordsResponse = await fetch(`${BASE_URL}/talhoes/${talhao.id}/coordinates`);
      if (!coordsResponse.ok) {
        const errorText = await coordsResponse.text();
        console.warn(`Coordenadas não encontradas para o talhão ${talhao.id}: ${errorText}`);
        return;
      }
      const { coordinates } = await coordsResponse.json();
      console.log(`Coordenadas recuperadas para o talhão ${talhao.id}:`, coordinates);

      const updateResponse = await fetch(`${BASE_URL}/talhoes/${talhao.id}/coordinates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Erro ao atualizar as coordenadas do talhão ${talhao.id}: ${errorText}`);
      }

      console.log(`Coordenadas do talhão ${talhao.id} atualizadas com sucesso.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new Error(`Falha ao atualizar coordenadas do talhão ${talhao.id}: ${errorMessage}`);
    }
  };

  // Função principal para atualizar os polígonos
  const fetchKmls = useCallback(async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const kmlRecords = await fetchKmlsData();

      if (kmlRecords.length === 0) {
        setMessage('Nenhum KML encontrado para atualizar os polígonos.');
        return;
      }

      const talhoes = await fetchTalhoesData();

      const updatePromises = talhoes.map((talhao) =>
        updateTalhaoCoordinates(talhao).catch((error) => {
          console.error(error.message);
          return null; // Retorna null para erros parciais
        })
      );

      await Promise.all(updatePromises);

      setMessage('Polígonos atualizados com sucesso!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao atualizar polígonos';
      setMessage(errorMessage);
      console.error('KmlPage: Erro ao atualizar polígonos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchKmlsData, fetchTalhoesData]);

  // Carrega os KMLs ao montar o componente
  useEffect(() => {
    fetchKmlsData();
  }, [fetchKmlsData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setMessage('Nenhum arquivo selecionado');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      console.log('Iniciando upload do arquivo:', {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      // Excluir KMLs existentes
      const deletePromises = kmls.map((kml) =>
        fetch(`${BASE_URL}/kml_files/${kml.id}`, { method: 'DELETE' })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Erro ao excluir KML ${kml.id}: ${response.status}`);
            }
            console.log(`KML ${kml.id} excluído com sucesso`);
          })
          .catch((error) => {
            console.error(`Erro ao excluir KML ${kml.id}:`, error);
            throw error;
          })
      );

      await Promise.all(deletePromises);
      console.log('KmlPage: Todos os KMLs existentes foram excluídos');

      // Enviar o novo arquivo KML
      const formData = new FormData();
      formData.append('kmlFile', file);
      console.log('Enviando requisição para /kml/upload');
      const response = await fetch(`${BASE_URL}/kml/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao enviar KML: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('KmlPage: KML processado pelo backend:', result);

      await fetchKmls();
      setMessage('Arquivo KML carregado e processado com sucesso!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao carregar arquivo KML';
      setMessage(errorMessage);
      console.error('KmlPage: Erro ao carregar arquivo KML:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsLoading(true);
    setMessage('');

    try {
      console.log(`Excluindo KML: ${id}`);
      const response = await fetch(`${BASE_URL}/kml_files/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao excluir KML: ${response.status} ${errorText}`);
      }
      await fetchKmls();
      setMessage('KML excluído com sucesso!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao excluir KML';
      setMessage(errorMessage);
      console.error('KmlPage: Erro ao excluir KML:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '24px', color: '#333', marginBottom: '20px' }}>Gerenciamento de KML</h2>

      {message && (
        <p
          style={{
            padding: '10px',
            backgroundColor: message.includes('Erro') ? '#f8d7da' : '#d4edda',
            color: message.includes('Erro') ? '#721c24' : '#155724',
            border: `1px solid ${message.includes('Erro') ? '#f5c6cb' : '#c3e6cb'}`,
            borderRadius: '5px',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          {message}
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        <input
          type="file"
          accept=".kml"
          onChange={handleFileUpload}
          disabled={isLoading}
          style={{
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        />
        <button
          onClick={fetchKmls}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: isLoading ? '#a0a0a0' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            transition: 'background-color 0.3s',
          }}
          onMouseOver={(e) => {
            if (!isLoading) e.currentTarget.style.backgroundColor = '#1e88e5';
          }}
          onMouseOut={(e) => {
            if (!isLoading) e.currentTarget.style.backgroundColor = '#2196F3';
          }}
        >
          {isLoading ? 'Carregando...' : 'Atualizar Polígonos'}
        </button>
      </div>

      {kmls.length > 0 ? (
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
                }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {kmls.map((kml, index) => (
                <tr
                  key={kml.id}
                  style={{
                    backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fafafa' : 'white'}
                >
                  <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>{kml.name}</td>
                  <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                    <button
                      onClick={() => handleDelete(kml.id)}
                      disabled={isLoading}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: isLoading ? '#a0a0a0' : '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        transition: 'background-color 0.3s',
                      }}
                      onMouseOver={(e) => {
                        if (!isLoading) e.currentTarget.style.backgroundColor = '#da190b';
                      }}
                      onMouseOut={(e) => {
                        if (!isLoading) e.currentTarget.style.backgroundColor = '#f44336';
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ textAlign: 'center', color: '#666', fontSize: '16px' }}>
          Nenhum arquivo KML encontrado.
        </p>
      )}
    </div>
  );
}