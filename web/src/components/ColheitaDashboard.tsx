import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';

// Registrar os elementos do Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

// Interfaces para os dados recebidos como props
interface DinamicaData {
  talhaoId: string;
  talhaoNome: string;
  variedade: string;
  totalCaixas: number;
  qtdePlantas: number;
  mediaCaixasPorPlanta: number;
}

interface Carregamento {
  id: string;
  data: number;
  talhao_id: string;
  qtde_plantas: number;
  variedade: string;
  motorista: string;
  placa: string;
  qte_caixa: number;
  semana: number;
  semana_colheita: number;
  safra_id: string;
}

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
  ativo: boolean;
  OBS?: string;
}

interface ColheitaDashboardProps {
  dinamicaData: DinamicaData[];
  carregamentos: Carregamento[];
  talhoes: Talhao[];
  resumoGeral: {
    data: { [variedade: string]: { previsto: number; realizado: number; proporcao: number } };
    totalPrevisto: number;
    totalRealizado: number;
  };
}

// Função auxiliar para formatar números no padrão brasileiro
const formatNumber = (value: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export function ColheitaDashboard({ dinamicaData, carregamentos, talhoes, resumoGeral }: ColheitaDashboardProps) {
  // Calcular métricas principais
  const totalCaixasColhidas = carregamentos.reduce((sum, c) => sum + c.qte_caixa, 0);
  const totalTalhoesAtivos = talhoes.filter((t) => t.ativo === true).length;
  const mediaCaixasPorPlanta = dinamicaData.length > 0
    ? dinamicaData.reduce((sum, d) => sum + d.mediaCaixasPorPlanta, 0) / dinamicaData.length
    : 0;
  const proporcaoGeralRealizada = Object.values(resumoGeral.data).length > 0
    ? Object.values(resumoGeral.data).reduce((sum, v) => sum + v.proporcao, 0) / Object.values(resumoGeral.data).length
    : 0;

  // Gráfico 1: Caixas Colhidas por Semana (Gráfico de Linha)
  const semanasData: { [semana: number]: number } = {};
  carregamentos.forEach((c) => {
    const semana = c.semana_colheita;
    if (!semanasData[semana]) {
      semanasData[semana] = 0;
    }
    semanasData[semana] += c.qte_caixa;
  });

  const semanasLabels = Object.keys(semanasData).map((s) => `Semana ${s}`).sort();
  const semanasValues = semanasLabels.map((label) => {
    const semana = parseInt(label.split(' ')[1]);
    return semanasData[semana] || 0;
  });

  const lineData = {
    labels: semanasLabels,
    datasets: [
      {
        label: 'Caixas Colhidas',
        data: semanasValues,
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        fill: true,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: 'Caixas Colhidas por Semana' },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Caixas' } },
      x: { title: { display: true, text: 'Semana' } },
    },
  };

  // Gráfico 2: Previsto vs. Realizado por Variedade (Gráfico de Barras)
  const variedadesLabels = Object.keys(resumoGeral.data);
  const previstoData = variedadesLabels.map((v) => resumoGeral.data[v].previsto);
  const realizadoData = variedadesLabels.map((v) => resumoGeral.data[v].realizado);

  const barData = {
    labels: variedadesLabels,
    datasets: [
      {
        label: 'Previsto',
        data: previstoData,
        backgroundColor: '#4CAF50',
      },
      {
        label: 'Realizado',
        data: realizadoData,
        backgroundColor: '#2196F3',
      },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: 'Previsto vs. Realizado por Variedade' },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Caixas' } },
      x: { title: { display: true, text: 'Variedade' } },
    },
  };

  // Gráfico 3: Distribuição de Caixas por Talhão (Gráfico de Pizza)
  const talhoesLabels = dinamicaData.map((d) => d.talhaoNome);
  const talhoesValues = dinamicaData.map((d) => d.totalCaixas);
  const talhoesColors = dinamicaData.map((_, index) => `hsl(${(index * 360) / dinamicaData.length}, 70%, 50%)`);

  const pieData = {
    labels: talhoesLabels,
    datasets: [
      {
        label: 'Caixas',
        data: talhoesValues,
        backgroundColor: talhoesColors,
        borderWidth: 1,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'right' as const },
      title: { display: true, text: 'Distribuição de Caixas por Talhão' },
    },
  };

  // Tabela: Top 5 Talhões Mais Produtivos
  const topTalhoes = [...dinamicaData]
    .sort((a, b) => b.totalCaixas - a.totalCaixas)
    .slice(0, 5);

  return (
    <div style={{ padding: '20px' }}>
      {/* Cards de Métricas Principais */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div style={{
          flex: '1 1 200px',
          backgroundColor: '#f5f5f5',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Total de Caixas Colhidas</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>{formatNumber(totalCaixasColhidas)}</p>
        </div>
        <div style={{
          flex: '1 1 200px',
          backgroundColor: '#f5f5f5',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Talhões Ativos</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>{formatNumber(totalTalhoesAtivos, 0)}</p>
        </div>
        <div style={{
          flex: '1 1 200px',
          backgroundColor: '#f5f5f5',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Média de Caixas por Planta</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF9800' }}>{formatNumber(mediaCaixasPorPlanta)}</p>
        </div>
        <div style={{
          flex: '1 1 200px',
          backgroundColor: '#f5f5f5',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Proporção Geral Realizada</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#F44336' }}>{proporcaoGeralRealizada.toFixed(1)}%</p>
        </div>
      </div>

      {/* Gráficos */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
          <Line data={lineData} options={lineOptions} />
        </div>
        <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
          <Bar data={barData} options={barOptions} />
        </div>
      </div>

      {/* Tabela de Top 5 Talhões */}
      <div>
        <h4 style={{ marginBottom: '10px' }}>Top 5 Talhões Mais Produtivos</h4>
        {topTalhoes.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>Talhão</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>Variedade</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>Total de Caixas</th>
              </tr>
            </thead>
            <tbody>
              {topTalhoes.map((talhao) => (
                <tr key={talhao.talhaoId}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{talhao.talhaoNome}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{talhao.variedade}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formatNumber(talhao.totalCaixas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ textAlign: 'center', color: '#666' }}>Nenhum dado disponível.</p>
        )}
      </div>
    </div>
  );
}