import { DOMParser } from 'xmldom';
import * as toGeoJSON from '@tmcw/togeojson';
import type { FeatureCollection } from 'geojson';

export function parseKML(kmlContent: string): FeatureCollection {
  try {
    // Valida se o conteúdo é uma string não vazia
    if (!kmlContent || typeof kmlContent !== 'string' || kmlContent.trim() === '') {
      throw new Error('Conteúdo do KML é vazio ou inválido');
    }

    // Tenta parsear o conteúdo como XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');

    // Verifica se o documento XML é válido
    if (!xmlDoc || !xmlDoc.documentElement || xmlDoc.documentElement.nodeName === 'parsererror') {
      throw new Error('Erro ao parsear o XML do KML: documento inválido');
    }

    // Verifica se o KML contém Placemarks
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    if (!placemarks || placemarks.length === 0) {
      throw new Error('O KML não contém Placemarks válidos');
    }

    // Converte o XML para GeoJSON
    const geojson = toGeoJSON.kml(xmlDoc);

    // Valida se o GeoJSON contém features
    if (!geojson.features || geojson.features.length === 0) {
      throw new Error('Nenhuma feature válida encontrada no KML');
    }

    // Verifica se há polígonos
    const hasPolygons = geojson.features.some(
      (feature) => feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon'
    );
    if (!hasPolygons) {
      throw new Error('O KML não contém polígonos válidos');
    }

    return geojson as FeatureCollection;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao processar KML';
    console.error('[parseKML] Erro:', errorMessage, 'Conteúdo:', kmlContent);
    throw new Error(errorMessage);
  }
}