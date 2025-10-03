// Parser KML simplificado para frontend
// Converte KML para GeoJSON

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

export interface Feature {
  type: 'Feature';
  geometry: Polygon | MultiPolygon;
  properties: {
    name: string;
    description?: string;
    [key: string]: any;
  };
}

export interface Polygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface MultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

// Parser KML simplificado - extrai apenas placemarks com polígonos
export function parseKMLSimple(kmlContent: string): FeatureCollection {
  const features: Feature[] = [];

  // Regex para encontrar Placemarks
  const placemarkRegex = /<Placemark[^>]*>(.*?)<\/Placemark>/gs;
  const nameRegex = /<name[^>]*>(.*?)<\/name>/s;
  const coordsRegex = /<coordinates[^>]*>(.*?)<\/coordinates>/gs;

  let placemarkMatch;
  while ((placemarkMatch = placemarkRegex.exec(kmlContent)) !== null) {
    const placemarkContent = placemarkMatch[1];

    // Extrair nome
    const nameMatch = placemarkContent.match(nameRegex);
    const name = nameMatch ? nameMatch[1].trim() : 'Unnamed';

    // Extrair coordenadas
    const coordsMatch = placemarkContent.match(coordsRegex);
    if (coordsMatch) {
      for (const coordMatch of coordsMatch) {
        const coords = coordMatch.replace(/<\/?coordinates[^>]*>/g, '').trim();
        const coordinateArrays = parseCoordinates(coords);

        if (coordinateArrays.length > 0) {
          // Criar feature
          const feature: Feature = {
            type: 'Feature',
            geometry: {
              type: coordinateArrays.length === 1 ? 'Polygon' : 'MultiPolygon',
              coordinates: coordinateArrays.length === 1 ? coordinateArrays : [coordinateArrays]
            } as Polygon | MultiPolygon,
            properties: {
              name: name
            }
          };
          features.push(feature);
        }
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

// Converte string de coordenadas KML para arrays numéricos
function parseCoordinates(coordsString: string): number[][][] {
  const polygons: number[][][] = [];
  let currentPolygon: number[][] = [];

  // Dividir por espaços (cada linha é um anel)
  const lines = coordsString.split(/\s+/);

  for (const line of lines) {
    if (line.trim()) {
      // Dividir por vírgulas: longitude,latitude,altitude
      const parts = line.split(',');
      if (parts.length >= 2) {
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);

        if (!isNaN(lon) && !isNaN(lat)) {
          currentPolygon.push([lon, lat]);
        }
      }
    } else if (currentPolygon.length > 0) {
      // Linha vazia indica fim de um polígono
      polygons.push(currentPolygon);
      currentPolygon = [];
    }
  }

  // Adicionar último polígono se existir
  if (currentPolygon.length > 0) {
    polygons.push(currentPolygon);
  }

  return polygons;
}