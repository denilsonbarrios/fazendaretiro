import { MapContainer, TileLayer, Polygon, useMap, LayersControl, Marker, Popup } from 'react-leaflet';
import { useEffect, useState, useRef } from 'react';
import { useMapData } from '../hooks/useMapData';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Interface para Talhao
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
  ativo: boolean;
}

interface MapPageProps {
  safraId?: string | null;
}

export function MapPage({ safraId }: MapPageProps) {
  const { talhoes, error, fetchData } = useMapData();
  const [selectedTalhao, setSelectedTalhao] = useState<Talhao | null>(null);
  const [producaoCaixa, setProducaoCaixa] = useState<number>(0);
  const mapRef = useRef<L.Map | null>(null);
  const initialZoomRef = useRef<number>(13);
  const hasSetBoundsRef = useRef<boolean>(false);

  const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

  // Função para buscar a produção de caixas do talhão selecionado
  const fetchProducaoCaixa = async (talhaoId: string) => {
    if (!safraId) return;
    try {
      const response = await fetch(`${BASE_URL}/talhoes/${talhaoId}/producao_caixa?safra_id=${safraId}`);
      if (!response.ok) throw new Error('Erro ao buscar produção de caixas');
      const data = await response.json();
      setProducaoCaixa(data.totalCaixas);
    } catch (error) {
      console.error('Erro ao carregar produção de caixas:', error);
      setProducaoCaixa(0);
    }
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
                            <strong>Idade:</strong> {talhao.IDADE}
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
        {/* Legenda de Variedades */}
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

        {/* Informações Gerais da Fazenda */}
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

        {/* Detalhes do Talhão Selecionado */}
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
                  }}>{selectedTalhao.DATA_DE_PLANTIO}</td>
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
    </div>
  );
}