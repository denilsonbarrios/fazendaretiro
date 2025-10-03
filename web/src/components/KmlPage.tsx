import { useState, useEffect, useCallback } from 'react';
import {
  fetchKmlFiles,
  uploadKmlData,
  deleteKmlFile,
  fetchTalhoesKml,
  fetchTalhoesKmlSemVinculo
} from '../api';
import { parseKMLSimple } from '../kmlParser';
import { TalhaoKml } from '../types';

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

function KmlPage() {
  // Estados para controle de abas
  const [activeTab, setActiveTab] = useState<'kml' | 'talhoes'>('kml');
  
  // Estados para KML Files
  const [kmls, setKmls] = useState<KmlFile[]>([]);
  
  // Estados para Talhões KML
  const [talhoesKml, setTalhoesKml] = useState<TalhaoKml[]>([]);
  const [talhoesKmlSemVinculo, setTalhoesKmlSemVinculo] = useState<TalhaoKml[]>([]);
  
  // Estados gerais
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Função para buscar KMLs
  const fetchKmlsData = useCallback(async () => {
    try {
      console.log(`[${new Date().toISOString()}] KmlPage: Buscando KMLs`);
      const kmlRecords = await fetchKmlFiles();
      console.log('KmlPage: KMLs carregados:', kmlRecords);
      setKmls(kmlRecords);
      return kmlRecords;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar KMLs';
      throw new Error(errorMessage);
    }
  }, []);

  // Função para buscar talhões KML
  const fetchTalhoesKmlData = useCallback(async () => {
    try {
      console.log(`[${new Date().toISOString()}] KmlPage: Buscando talhões KML`);
      const talhoesKmlRecords = await fetchTalhoesKml();
      console.log('KmlPage: Talhões KML carregados:', talhoesKmlRecords);
      setTalhoesKml(talhoesKmlRecords);
      
      const talhoesKmlSemVinculoRecords = await fetchTalhoesKmlSemVinculo();
      console.log('KmlPage: Talhões KML sem vínculo carregados:', talhoesKmlSemVinculoRecords);
      setTalhoesKmlSemVinculo(talhoesKmlSemVinculoRecords);
      
      return talhoesKmlRecords;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar talhões KML';
          throw new Error(errorMessage);
    }
  }, []);

  // Função principal para atualizar os dados
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setMessage('');

    try {
      if (activeTab === 'kml') {
        await fetchKmlsData();
      } else {
        await fetchTalhoesKmlData();
      }
      setMessage('Dados atualizados com sucesso!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao atualizar dados';
      setMessage(errorMessage);
      console.error('KmlPage: Erro ao atualizar dados:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, fetchKmlsData, fetchTalhoesKmlData]);

  // Carregar dados iniciais ao montar o componente ou mudar aba
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setMessage('Nenhum arquivo selecionado');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      console.log('Iniciando processamento do arquivo:', {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      // Ler o conteúdo do arquivo
      const kmlContent = await file.text();
      console.log('Arquivo KML lido, tamanho:', kmlContent.length);

      // Parsear KML localmente
      const geojson = parseKMLSimple(kmlContent);
      console.log('KML parseado localmente:', geojson);

      if (!geojson.features || geojson.features.length === 0) {
        throw new Error('Nenhum polígono encontrado no arquivo KML');
      }

      // Enviar dados parseados para o backend
      const result = await uploadKmlData({
        fileName: file.name,
        geojson: geojson
      });
      console.log('KmlPage: Dados KML processados pelo backend:', result);

      // Atualizar a lista de dados
      await fetchData();
      
      // Construir mensagem detalhada
      let detailedMessage = result.message;
      if (result.removedKmlTalhoes && result.removedKmlTalhoes > 0) {
        detailedMessage += ` Foram removidos ${result.removedKmlTalhoes} talhão(ões) KML que não estavam presentes no novo arquivo.`;
      }
      if (result.unlinkedTalhoes && result.unlinkedTalhoes > 0) {
        detailedMessage += ` ${result.unlinkedTalhoes} talhão(ões) foi(ram) desvinculado(s).`;
      }
      
      setMessage(detailedMessage);
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
      await deleteKmlFile(id);
      await fetchData();
      setMessage('KML excluído com sucesso!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao excluir KML';
      setMessage(errorMessage);
      console.error('KmlPage: Erro ao excluir KML:', error);
    } finally {
      setIsLoading(false);
    }
  };
  // Renderizar conteúdo da aba KML Files
  const renderKmlFilesTab = () => (
    <>
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
          onClick={fetchData}
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
          {isLoading ? 'Carregando...' : 'Atualizar'}
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
                }}>Nome do Arquivo</th>
                <th style={{
                  padding: '15px',
                  backgroundColor: '#f4f4f4',
                  color: '#333',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  textAlign: 'left',
                  borderBottom: '1px solid #ddd',
                }}>ID</th>
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
                  <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px', color: '#666' }}>{kml.id}</td>
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
    </>
  );

  // Renderizar conteúdo da aba Talhões KML
  const renderTalhoesKmlTab = () => (
    <>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        <button
          onClick={fetchData}
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
          {isLoading ? 'Carregando...' : 'Atualizar'}
        </button>
        <div style={{ 
          padding: '10px 15px', 
          backgroundColor: '#e8f5e8', 
          border: '1px solid #4caf50', 
          borderRadius: '5px',
          fontSize: '14px'
        }}>
          Total: {talhoesKml.length} talhões KML | Sem vínculo: {talhoesKmlSemVinculo.length}
        </div>
      </div>

      {talhoesKml.length > 0 ? (
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
                }}>Nome do Placemark</th>
                <th style={{
                  padding: '15px',
                  backgroundColor: '#f4f4f4',
                  color: '#333',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  textAlign: 'left',
                  borderBottom: '1px solid #ddd',
                }}>Tipo de Geometria</th>
                <th style={{
                  padding: '15px',
                  backgroundColor: '#f4f4f4',
                  color: '#333',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  textAlign: 'left',
                  borderBottom: '1px solid #ddd',
                }}>Status</th>
                <th style={{
                  padding: '15px',
                  backgroundColor: '#f4f4f4',
                  color: '#333',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  textAlign: 'left',
                  borderBottom: '1px solid #ddd',
                }}>ID</th>
              </tr>
            </thead>
            <tbody>
              {talhoesKml.map((talhaoKml, index) => {
                const temVinculo = !talhoesKmlSemVinculo.some(t => t.id === talhaoKml.id);
                return (
                  <tr
                    key={talhaoKml.id}
                    style={{
                      backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                      transition: 'background-color 0.3s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fafafa' : 'white'}
                  >
                    <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>
                      {talhaoKml.placemark_name}
                    </td>
                    <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                      {talhaoKml.geometry_type}
                    </td>
                    <td style={{ padding: '15px', borderBottom: '1px solid #ddd' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'white',
                        backgroundColor: temVinculo ? '#4caf50' : '#ff9800'
                      }}>
                        {temVinculo ? 'Vinculado' : 'Sem vínculo'}
                      </span>
                    </td>
                    <td style={{ padding: '15px', borderBottom: '1px solid #ddd', fontSize: '12px', color: '#666' }}>
                      {talhaoKml.id}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ textAlign: 'center', color: '#666', fontSize: '16px' }}>
          Nenhum talhão KML encontrado.
        </p>
      )}
    </>
  );

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

      {/* Navegação por abas */}
      <div style={{ marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
        <button
          onClick={() => setActiveTab('kml')}
          style={{
            padding: '12px 24px',
            marginRight: '8px',
            backgroundColor: activeTab === 'kml' ? '#2196F3' : 'transparent',
            color: activeTab === 'kml' ? 'white' : '#666',
            border: 'none',
            borderBottom: activeTab === 'kml' ? '3px solid #2196F3' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'kml' ? 'bold' : 'normal',
            transition: 'all 0.3s ease',
          }}
        >
          Arquivos KML
        </button>
        <button
          onClick={() => setActiveTab('talhoes')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'talhoes' ? '#2196F3' : 'transparent',
            color: activeTab === 'talhoes' ? 'white' : '#666',
            border: 'none',
            borderBottom: activeTab === 'talhoes' ? '3px solid #2196F3' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'talhoes' ? 'bold' : 'normal',
            transition: 'all 0.3s ease',
          }}
        >
          Talhões KML
        </button>
      </div>

      {/* Conteúdo da aba ativa */}
      {activeTab === 'kml' ? renderKmlFilesTab() : renderTalhoesKmlTab()}
    </div>
  );
}

export default KmlPage;