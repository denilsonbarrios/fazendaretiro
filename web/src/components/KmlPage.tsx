import { useState, useEffect } from 'react';

// Interface para KmlFile, definida localmente
interface KmlFile {
  id: string;
  name: string;
  content: string;
}

export function KmlPage() {
  const [kmls, setKmls] = useState<KmlFile[]>([]);
  const [message, setMessage] = useState<string>('');

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

  const fetchKmls = async () => {
    try {
      // Carregar os KMLs
      const kmlResponse = await fetch(`${BASE_URL}/kml_files`);
      if (!kmlResponse.ok) throw new Error('Erro ao buscar KMLs');
      const kmlRecords = await kmlResponse.json();
      console.log('KmlPage: KMLs carregados:', kmlRecords);
      setKmls(kmlRecords);

      // Verificar se há pelo menos um KML para processar
      if (kmlRecords.length === 0) {
        setMessage('Nenhum KML encontrado para atualizar os polígonos.');
        return;
      }

      // Buscar todos os talhões
      const talhoesResponse = await fetch(`${BASE_URL}/talhoes`);
      if (!talhoesResponse.ok) throw new Error('Erro ao buscar talhões');
      const talhoes = await talhoesResponse.json();
      console.log('KmlPage: Talhões carregados:', talhoes);

      // Atualizar as coordenadas de cada talhão
      for (const talhao of talhoes) {
        try {
          // Buscar as coordenadas atualizadas do KML
          const coordsResponse = await fetch(`${BASE_URL}/talhoes/${talhao.id}/coordinates`);
          if (!coordsResponse.ok) {
            console.warn(`Coordenadas não encontradas para o talhão ${talhao.id}:`, await coordsResponse.text());
            continue;
          }
          const { coordinates } = await coordsResponse.json();
          console.log(`Coordenadas recuperadas para o talhão ${talhao.id}:`, coordinates);

          // Atualizar apenas as coordenadas do talhão usando o novo endpoint
          const updateResponse = await fetch(`${BASE_URL}/talhoes/${talhao.id}/coordinates`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates }),
          });

          if (!updateResponse.ok) {
            console.warn(`Erro ao atualizar as coordenadas do talhão ${talhao.id}:`, await updateResponse.text());
            continue;
          }

          console.log(`Coordenadas do talhão ${talhao.id} atualizadas com sucesso.`);
        } catch (error) {
          console.error(`Erro ao atualizar as coordenadas do talhão ${talhao.id}:`, error);
        }
      }

      setMessage('Polígonos atualizados com sucesso!');
    } catch (error) {
      setMessage('Erro ao atualizar polígonos: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      console.error('Erro ao atualizar polígonos:', error);
    }
  };

  useEffect(() => {
    fetchKmls();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('Nenhum arquivo selecionado');
      setMessage('Nenhum arquivo selecionado');
      return;
    }

    try {
      console.log('Iniciando upload do arquivo:', {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      // Excluir qualquer KML existente antes de adicionar o novo
      for (const kml of kmls) {
        console.log(`Excluindo KML existente: ${kml.id}`);
        const response = await fetch(`${BASE_URL}/kml_files/${kml.id}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro ao excluir KML existente: ${response.status} ${errorText}`);
        }
      }
      console.log('KmlPage: KMLs existentes excluídos');

      // Enviar o arquivo KML para o backend
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
      setMessage('Erro ao carregar arquivo KML: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      console.error('Erro ao carregar arquivo KML:', error);
    }
  };

  const handleDelete = async (id: string) => {
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
      setMessage('Erro ao excluir KML: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      console.error('Erro ao excluir KML:', error);
    }
  };

  return (
    <div>
      <h2>Gerenciamento de KML</h2>
      {message && (
        <p className={`message ${message.includes('Erro') ? 'error' : 'success'}`}>
          {message}
        </p>
      )}
      <input type="file" accept=".kml" onChange={handleFileUpload} />
      <button className="primary" onClick={() => fetchKmls()}>
        Atualizar Polígonos
      </button>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {kmls.map((kml) => (
            <tr key={kml.id}>
              <td>{kml.name}</td>
              <td>
                <button className="danger" onClick={() => handleDelete(kml.id)}>
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}