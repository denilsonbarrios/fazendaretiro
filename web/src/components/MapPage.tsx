import { MapContainer, TileLayer, Polygon, useMap, LayersControl, Marker, Popup } from 'react-leaflet';
import { useEffect, useState, useRef } from 'react';
import { useMapData } from '../hooks/useMapData';
import { BASE_URL, authFetch } from '../api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-toastify';
import { Talhao } from '../types'; // Importar a interface Talhao do types.ts

interface TalhaoFormData {
  TalhaoID: string | null;
  TIPO: string;
  NOME: string;
  AREA: number;
  VARIEDADE: string;
  PORTAENXERTO: string;
  DATA_DE_PLANTIO: string;
  IDADE: number;
  FALHAS: number;
  ESP: string;
  COR: string;
  QTDE_PLANTAS: number;
  OBS: string;
  ativo: boolean;
}

interface MapPageProps {
  safraId?: string | null;
}

interface ConfigOption {
  id: string;
  name: string;
  default_color: string;
}

function MapPage({ safraId }: MapPageProps) {
  const { talhoes, error, fetchData } = useMapData(safraId || undefined);
  const [selectedTalhao, setSelectedTalhao] = useState<Talhao | null>(null);
  const [producaoCaixa, setProducaoCaixa] = useState<number>(0);
  const mapRef = useRef<L.Map | null>(null);
  const initialZoomRef = useRef<number>(13);
  const hasSetBoundsRef = useRef<boolean>(false);
  const [showEditForm, setShowEditForm] = useState<boolean>(false);
  const [formData, setFormData] = useState<TalhaoFormData | null>(null);
  const [editingTalhao, setEditingTalhao] = useState<Talhao | null>(null);
  const [tipoOptions, setTipoOptions] = useState<ConfigOption[]>([]);
  const [variedadeOptions, setVariedadeOptions] = useState<ConfigOption[]>([]);

  const fetchProducaoCaixa = async (talhaoId: string) => {
    if (!safraId) return;
    try {
      const response = await authFetch(`${BASE_URL}/talhoes/${talhaoId}/producao_caixa?safra_id=${safraId}`);
      if (!response.ok) throw new Error('Erro ao buscar produção de caixas');
      const data = await response.json();
      setProducaoCaixa(data.totalCaixas);
    } catch (error) {
      console.error('Erro ao carregar produção de caixas:', error);
      setProducaoCaixa(0);
    }
  };

  const fetchConfigs = async () => {
    try {
      const tipoResponse = await authFetch(`${BASE_URL}/tipo_configs`);
      if (!tipoResponse.ok) throw new Error('Erro ao buscar tipos');
      const tipoRecords = await tipoResponse.json();

      const variedadeResponse = await authFetch(`${BASE_URL}/variedade_configs`);
      if (!variedadeResponse.ok) throw new Error('Erro ao buscar variedades');
      const variedadeRecords = await variedadeResponse.json();

      setTipoOptions(tipoRecords);
      setVariedadeOptions(variedadeRecords);
    } catch (error) {
      toast.error('Erro ao carregar configurações: ' + (error instanceof Error ? error.message : 'Desconhecido'));
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const calculateAge = (plantingDate: string): number => {
    if (!plantingDate) return 0;
    const today = new Date();
    const planting = new Date(plantingDate);
    let age = today.getFullYear() - planting.getFullYear();
    const monthDiff = today.getMonth() - planting.getMonth();
    const dayDiff = today.getDate() - planting.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }
    return age < 0 ? 0 : age;
  };

  const handleEditTalhao = (talhao: Talhao) => {
    const newFormData: TalhaoFormData = {
      TalhaoID: talhao.TalhaoID ?? null,
      TIPO: talhao.TIPO,
      NOME: talhao.NOME,
      AREA: parseFloat(talhao.AREA) || 0,
      VARIEDADE: talhao.VARIEDADE ?? '',
      PORTAENXERTO: talhao.PORTAENXERTO ?? '',
      DATA_DE_PLANTIO: talhao.DATA_DE_PLANTIO ?? '',
      IDADE: calculateAge(talhao.DATA_DE_PLANTIO ?? ''),
      FALHAS: talhao.FALHAS ?? 0,
      ESP: talhao.ESP ?? '',
      COR: talhao.COR ?? '',
      QTDE_PLANTAS: talhao.qtde_plantas || 0,
      OBS: talhao.OBS || '',
      ativo: talhao.ativo,
    };
    setFormData(newFormData);
    setEditingTalhao(talhao);
    setShowEditForm(true);
  };

  const handleCancelEdit = () => {
    setShowEditForm(false);
    setFormData(null);
    setEditingTalhao(null);
  };

  const handleUpdateTalhao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !editingTalhao) return;

    try {
      const talhaoData = {
        TalhaoID: formData.TalhaoID,
        TIPO: formData.TIPO,
        NOME: formData.NOME,
        AREA: `${formData.AREA} ha`,
        VARIEDADE: formData.VARIEDADE,
        PORTAENXERTO: formData.PORTAENXERTO,
        DATA_DE_PLANTIO: formData.DATA_DE_PLANTIO,
        IDADE: formData.IDADE,
        FALHAS: formData.FALHAS,
        ESP: formData.ESP,
        COR: formData.COR,
        qtde_plantas: formData.QTDE_PLANTAS,
        OBS: formData.OBS,
        ativo: formData.ativo,
      };

      const response = await authFetch(`${BASE_URL}/talhoes/${editingTalhao.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(talhaoData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar talhão');
      }

      setShowEditForm(false);
      setFormData(null);
      setEditingTalhao(null);
      await fetchData();
      toast.success('Talhão atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar talhão: ' + (error instanceof Error ? error.message : 'Desconhecido'));
    }
  };

  const handlePlantingDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setFormData((prev) => prev ? {
      ...prev,
      DATA_DE_PLANTIO: newDate,
      IDADE: calculateAge(newDate),
    } : prev);
  };

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTipo = e.target.value;
    const selectedOption = tipoOptions.find((option) => option.name === newTipo);
    const newColor = selectedOption ? selectedOption.default_color : '#FF0000';
    setFormData((prev) => prev ? {
      ...prev,
      TIPO: newTipo,
      COR: newColor,
    } : prev);
  };

  const handleVariedadeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVariedade = e.target.value;
    const selectedOption = variedadeOptions.find((option) => option.name === newVariedade);
    const newColor = selectedOption ? selectedOption.default_color : '#FF0000';
    setFormData((prev) => prev ? {
      ...prev,
      VARIEDADE: newVariedade,
      COR: newColor,
    } : prev);
  };

  function MapBounds() {
    const map = useMap();
    mapRef.current = map;

    useEffect(() => {
      if (talhoes.length === 0 || hasSetBoundsRef.current) return;

      const bounds = L.latLngBounds([]);

      talhoes.forEach((talhao) => {
        if (talhao.coordinates && talhao.ativo) {
          try {
            const coordinates = JSON.parse(talhao.coordinates);
            const feature: GeoJSON.Feature<GeoJSON.Polygon> = {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: coordinates,
              },
              properties: { name: talhao.TalhaoID },
            };
            const featureBounds = L.geoJSON(feature).getBounds();
            bounds.extend(featureBounds);
          } catch (error) {
            console.error('Erro ao calcular limites para talhão', talhao.TalhaoID, ':', error);
          }
        }
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
        hasSetBoundsRef.current = true;
      }
    }, [map, talhoes]);

    useEffect(() => {
      const updateZoom = () => {
        initialZoomRef.current = map.getZoom();
      };
      map.on('zoomend', updateZoom);
      return () => {
        map.off('zoomend', updateZoom);
      };
    }, [map]);

    return null;
  }

  useEffect(() => {
    fetchData();
    fetchConfigs();
  }, [safraId]);

  useEffect(() => {
    if (selectedTalhao && safraId) {
      fetchProducaoCaixa(selectedTalhao.id);
    }
  }, [selectedTalhao, safraId]);

  const getStyle = (talhao: Talhao) => {
    return {
      color: talhao.COR || '#FF0000',
      weight: 2,
      fillOpacity: 0.5,
    };
  };

  const calculateFarmStats = () => {
    const activeTalhoes = talhoes.filter((talhao) => talhao.ativo);
    const totalPlants = activeTalhoes.reduce((sum, talhao) => sum + (talhao.qtde_plantas || 0), 0);
    const totalArea = activeTalhoes.reduce((sum, talhao) => sum + (parseFloat(talhao.AREA) || 0), 0);
    const averageAge = activeTalhoes.length > 0
      ? activeTalhoes.reduce((sum, talhao) => sum + talhao.IDADE, 0) / activeTalhoes.length
      : 0;
    const totalTalhoes = activeTalhoes.length;

    return {
      totalPlants,
      totalArea: totalArea.toFixed(2),
      averageAge: averageAge.toFixed(1),
      totalTalhoes,
    };
  };

  const getVarietiesLegend = () => {
    const varietiesMap = new Map<string, string>();
    talhoes.forEach((talhao) => {
      if (talhao.ativo && talhao.VARIEDADE && talhao.COR && !varietiesMap.has(talhao.VARIEDADE)) {
        varietiesMap.set(talhao.VARIEDADE, talhao.COR);
      }
    });
    return Array.from(varietiesMap.entries());
  };

  const formatBrazilianDate = (dateString: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const farmStats = calculateFarmStats();
  const varietiesLegend = getVarietiesLegend();

  if (error) {
    return <div>Erro ao carregar os dados: {error}</div>;
  }

  return (
    <div style={{
      display: 'flex',
      height: '85vh',
      width: '100%',
      position: 'relative',
    }}>
      <div style={{
        flex: 1,
        position: 'relative',
      }}>
        <div className="map-container">
          <MapContainer
            center={[-22.11931875750912, -47.22271926886833]}
            zoom={initialZoomRef.current}
            style={{ height: '85vh', width: '100%' }}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="OpenStreetMap">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Esri World Imagery">
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution='Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                />
              </LayersControl.BaseLayer>
            </LayersControl>
            {talhoes.length > 0 ? (
              talhoes.map((talhao, index) => {
                if (!talhao.ativo) {
                  console.log(`Talhão ${talhao.NOME} está inativo, não será exibido no mapa`);
                  return null;
                }
                if (!talhao.coordinates) {
                  console.warn('MapPage: Talhão sem coordenadas:', talhao.TalhaoID);
                  return null;
                }
                try {
                  const coordinates = JSON.parse(talhao.coordinates);
                  const positions = coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
                  const feature: GeoJSON.Feature<GeoJSON.Polygon> = {
                    type: 'Feature',
                    geometry: {
                      type: 'Polygon',
                      coordinates: coordinates,
                    },
                    properties: { name: talhao.TalhaoID },
                  };
                  const center = L.geoJSON(feature).getBounds().getCenter();
                  return (
                    <div key={index}>
                      <Polygon
                        positions={positions}
                        pathOptions={getStyle(talhao)}
                        eventHandlers={{
                          click: () => {
                            setSelectedTalhao(talhao);
                            if (mapRef.current) {
                              const currentZoom = mapRef.current.getZoom();
                              mapRef.current.setZoom(currentZoom, { animate: false });
                            }
                          },
                        }}
                      >
                        <Popup>
                          <div>
                            <strong>Nome:</strong> {talhao.NOME}<br />
                            <strong>Área:</strong> {talhao.AREA}<br />
                            <strong>Variedade:</strong> {talhao.VARIEDADE}<br />
                            <strong>Data de Plantio:</strong> {formatBrazilianDate(talhao.DATA_DE_PLANTIO ?? '')}<br />
                            <strong>Idade:</strong> {talhao.IDADE}
                            <button
                              onClick={() => handleEditTalhao(talhao)}
                              style={{
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: '16px',
                                marginLeft: '10px',
                              }}
                              title="Editar Talhão"
                            >
                              ✏️
                            </button>
                          </div>
                        </Popup>
                      </Polygon>
                      <Marker
                        position={center}
                        icon={L.divIcon({
                          className: 'polygon-label',
                          html: `<div>${talhao.NOME}<br/>${talhao.AREA}</div>`,
                          iconAnchor: [0, 0],
                        })}
                      />
                    </div>
                  );
                } catch (error) {
                  console.error('Erro ao processar coordenadas do talhão', talhao.TalhaoID, ':', error);
                  return null;
                }
              })
            ) : (
              <p style={{ position: 'absolute', top: '50px', left: '10px', background: 'white', padding: '5px', zIndex: 1000 }}>
                Nenhum talhão carregado. Por favor, adicione um KML na aba "Gerenciamento de KML".
              </p>
            )}
            <MapBounds />
          </MapContainer>
        </div>
      </div>
      <div style={{
        width: '300px',
        backgroundColor: '#f9f9f9',
        borderLeft: '1px solid #ddd',
        padding: '20px',
        overflowY: 'auto',
        height: '85vh',
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', color: '#333', margin: '0 0 10px 0' }}>Legenda de Variedades</h3>
          {varietiesLegend.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {varietiesLegend.map(([variedade, cor]) => (
                <li key={variedade} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: cor,
                    marginRight: '10px',
                    borderRadius: '3px',
                  }}></div>
                  <span style={{ fontSize: '14px', color: '#666' }}>{variedade}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '14px', color: '#666' }}>Nenhuma variedade disponível.</p>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', color: '#333', margin: '0 0 10px 0' }}>Informações Gerais</h3>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            borderRadius: '5px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          }}>
            <tbody>
              <tr>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#666',
                }}>Total de Plantas</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                  textAlign: 'right',
                }}>{farmStats.totalPlants}</td>
              </tr>
              <tr>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#666',
                }}>Área Total (ha)</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                  textAlign: 'right',
                }}>{farmStats.totalArea}</td>
              </tr>
              <tr>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#666',
                }}>Idade Média (anos)</td>
                <td style={{
                  padding: '10px',
                  borderBottom: '1px solid #ddd',
                  fontSize: '14px',
                  color: '#333',
                  textAlign: 'right',
                }}>{farmStats.averageAge}</td>
              </tr>
              <tr>
                <td style={{
                  padding: '10px',
                  fontSize: '14px',
                  color: '#666',
                }}>Número de Talhões</td>
                <td style={{
                  padding: '10px',
                  fontSize: '14px',
                  color: '#333',
                  textAlign: 'right',
                }}>{farmStats.totalTalhoes}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {selectedTalhao && (
          <div>
            <h3 style={{ fontSize: '18px', color: '#333', margin: '0 0 10px 0' }}>Detalhes do Talhão</h3>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: 'white',
              borderRadius: '5px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            }}>
              <thead>
                <tr>
                  <th style={{
                    padding: '10px',
                    backgroundColor: '#f4f4f4',
                    color: '#333',
                    fontSize: '14px',
                    textAlign: 'left',
                    borderBottom: '1px solid #ddd',
                  }}>Propriedade</th>
                  <th style={{
                    padding: '10px',
                    backgroundColor: '#f4f4f4',
                    color: '#333',
                    fontSize: '14px',
                    textAlign: 'left',
                    borderBottom: '1px solid #ddd',
                  }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{
                    padding: '10px',
                    borderBottom: '1px solid #ddd',
                    fontSize: '14px',
                    color: '#666',
                  }}>Data de Plantio</td>
                  <td style={{
                    padding: '10px',
                    borderBottom: '1px solid #ddd',
                    fontSize: '14px',
                    color: '#333',
                  }}>{formatBrazilianDate(selectedTalhao.DATA_DE_PLANTIO ?? '')}</td>
                </tr>
                <tr>
                  <td style={{
                    padding: '10px',
                    borderBottom: '1px solid #ddd',
                    fontSize: '14px',
                    color: '#666',
                  }}>Portaenxerto</td>
                  <td style={{
                    padding: '10px',
                    borderBottom: '1px solid #ddd',
                    fontSize: '14px',
                    color: '#333',
                  }}>{selectedTalhao.PORTAENXERTO}</td>
                </tr>
                <tr>
                  <td style={{
                    padding: '10px',
                    borderBottom: '1px solid #ddd',
                    fontSize: '14px',
                    color: '#666',
                  }}>Quantidade de Plantas</td>
                  <td style={{
                    padding: '10px',
                    borderBottom: '1px solid #ddd',
                    fontSize: '14px',
                    color: '#333',
                  }}>{selectedTalhao.qtde_plantas || 0}</td>
                </tr>
                <tr>
                  <td style={{
                    padding: '10px',
                    borderBottom: '1px solid #ddd',
                    fontSize: '14px',
                    color: '#666',
                  }}>Produção Caixa</td>
                  <td style={{
                    padding: '10px',
                    borderBottom: '1px solid #ddd',
                    fontSize: '14px',
                    color: '#333',
                  }}>{producaoCaixa.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{
                    padding: '10px',
                    fontSize: '14px',
                    color: '#666',
                  }}>Produção Caixa/Hectare</td>
                  <td style={{
                    padding: '10px',
                    fontSize: '14px',
                    color: '#333',
                  }}>
                    {selectedTalhao.AREA && parseFloat(selectedTalhao.AREA) > 0
                      ? (producaoCaixa / parseFloat(selectedTalhao.AREA)).toFixed(2)
                      : 'N/A'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditForm && formData && editingTalhao && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            width: '500px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h3 style={{
                fontSize: '20px',
                color: '#333',
                margin: 0,
              }}>Editar Talhão</h3>
              <button style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
              }} onClick={handleCancelEdit}>×</button>
            </div>
            <form onSubmit={handleUpdateTalhao}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Talhão ID</label>
                <input
                  type="text"
                  value={formData.TalhaoID ?? ''}
                  onChange={(e) => setFormData({ ...formData, TalhaoID: e.target.value || null })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Nome</label>
                <input
                  type="text"
                  value={formData.NOME}
                  onChange={(e) => setFormData({ ...formData, NOME: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Tipo</label>
                <select
                  value={formData.TIPO}
                  onChange={handleTipoChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                >
                  {tipoOptions.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Área (ha)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    value={formData.AREA}
                    onChange={(e) => setFormData({ ...formData, AREA: Number(e.target.value) })}
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ccc',
                      borderRadius: '5px',
                      fontSize: '16px',
                    }}
                  />
                  <span style={{ fontSize: '16px', color: '#666' }}>ha</span>
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Variedade</label>
                <select
                  value={formData.VARIEDADE}
                  onChange={handleVariedadeChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                >
                  {variedadeOptions.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Portaenxerto</label>
                <input
                  type="text"
                  value={formData.PORTAENXERTO}
                  onChange={(e) => setFormData({ ...formData, PORTAENXERTO: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Data de Plantio</label>
                <input
                  type="date"
                  value={formData.DATA_DE_PLANTIO}
                  onChange={handlePlantingDateChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Idade</label>
                <input
                  type="number"
                  value={formData.IDADE}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                    backgroundColor: '#f0f0f0',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Quantidade de Plantas</label>
                <input
                  type="number"
                  value={formData.QTDE_PLANTAS}
                  onChange={(e) => setFormData({ ...formData, QTDE_PLANTAS: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Falhas</label>
                <input
                  type="number"
                  value={formData.FALHAS}
                  onChange={(e) => setFormData({ ...formData, FALHAS: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Esp.</label>
                <input
                  type="text"
                  value={formData.ESP}
                  onChange={(e) => setFormData({ ...formData, ESP: String(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Observações</label>
                <textarea
                  value={formData.OBS}
                  onChange={(e) => setFormData({ ...formData, OBS: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                    minHeight: '100px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Cor</label>
                <input
                  type="color"
                  value={formData.COR}
                  onChange={(e) => setFormData({ ...formData, COR: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '5px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    height: '40px',
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                }}>Situação</label>
                <select
                  value={formData.ativo ? 'Ativo' : 'Inativo'}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.value === 'Ativo' })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    fontSize: '16px',
                  }}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#45a049'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'}
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'background-color 0.3s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#da190b'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f44336'}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapPage;