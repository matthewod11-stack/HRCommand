/**
 * AnalyticsChart Component (V2.3.2)
 *
 * Renders chart data from analytics requests using Recharts.
 * Supports Bar, Pie, Line, and HorizontalBar chart types.
 */

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { ChartData, ChartType } from '../../lib/analytics-types';
import { FilterCaption } from './FilterCaption';

// Design tokens matching Tailwind config
const CHART_COLORS = [
  '#7c3aed', // primary-600
  '#a78bfa', // primary-400
  '#c4b5fd', // primary-300
  '#8b5cf6', // primary-500
  '#78716c', // stone-500
  '#a8a29e', // stone-400
  '#d6d3d1', // stone-300
  '#57534e', // stone-600
];

interface AnalyticsChartProps {
  data: ChartData;
}

export function AnalyticsChart({ data }: AnalyticsChartProps) {
  // Transform data for Recharts (needs 'name' key for labels)
  const chartData = data.data.map((point) => ({
    name: point.label,
    value: point.value,
    percentage: point.percentage ?? 0,
  }));

  return (
    <div className="mt-4 p-4 bg-white rounded-xl border border-stone-200/60 shadow-sm">
      <h4 className="text-sm font-semibold text-stone-900 mb-3">{data.title}</h4>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(data.chart_type, chartData, data)}
        </ResponsiveContainer>
      </div>

      <FilterCaption filters={data.filters_applied} total={data.total} />
    </div>
  );
}

interface ChartDataItem {
  name: string;
  value: number;
  percentage: number;
  [key: string]: string | number; // Index signature for Recharts compatibility
}

function renderChart(chartType: ChartType, chartData: ChartDataItem[], data: ChartData) {
  switch (chartType) {
    case 'pie':
      return renderPieChart(chartData);

    case 'bar':
      return renderBarChart(chartData, data, 'vertical');

    case 'horizontal_bar':
      return renderBarChart(chartData, data, 'horizontal');

    case 'line':
      return renderLineChart(chartData, data);

    default:
      return renderBarChart(chartData, data, 'vertical');
  }
}

function renderPieChart(chartData: ChartDataItem[]) {
  return (
    <PieChart>
      <Pie
        data={chartData}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        outerRadius={80}
        label={({ name, payload }) => `${name} (${payload?.percentage ?? 0}%)`}
        labelLine={{ stroke: '#78716c', strokeWidth: 1 }}
      >
        {chartData.map((_, index) => (
          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
        ))}
      </Pie>
      <Tooltip
        formatter={(value) => {
          const numValue = typeof value === 'number' ? value : 0;
          return [`${numValue}`, 'Count'];
        }}
        contentStyle={{
          backgroundColor: 'white',
          border: '1px solid #e7e5e4',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      />
      <Legend
        wrapperStyle={{ fontSize: '12px' }}
        formatter={(value) => <span className="text-stone-700">{value}</span>}
      />
    </PieChart>
  );
}

function renderBarChart(
  chartData: ChartDataItem[],
  data: ChartData,
  layout: 'vertical' | 'horizontal'
) {
  const isHorizontal = layout === 'horizontal';

  return (
    <BarChart
      data={chartData}
      layout={isHorizontal ? 'vertical' : 'horizontal'}
      margin={{ top: 5, right: 30, left: isHorizontal ? 80 : 20, bottom: 5 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
      {isHorizontal ? (
        <>
          <XAxis type="number" tick={{ fontSize: 11, fill: '#78716c' }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#78716c' }}
            width={70}
          />
        </>
      ) : (
        <>
          <XAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#78716c' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis type="number" tick={{ fontSize: 11, fill: '#78716c' }} />
        </>
      )}
      <Tooltip
        formatter={(value) => {
          const numValue = typeof value === 'number' ? value : 0;
          return [`${numValue}`, data.y_label || 'Count'];
        }}
        contentStyle={{
          backgroundColor: 'white',
          border: '1px solid #e7e5e4',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      />
      <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]}>
        {chartData.map((_, index) => (
          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
        ))}
      </Bar>
    </BarChart>
  );
}

function renderLineChart(chartData: ChartDataItem[], data: ChartData) {
  return (
    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} />
      <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
      <Tooltip
        formatter={(value) => {
          const numValue = typeof value === 'number' ? value : 0;
          return [numValue, data.y_label || 'Count'];
        }}
        contentStyle={{
          backgroundColor: 'white',
          border: '1px solid #e7e5e4',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      />
      <Line
        type="monotone"
        dataKey="value"
        stroke={CHART_COLORS[0]}
        strokeWidth={2}
        dot={{ fill: CHART_COLORS[0], strokeWidth: 2 }}
        activeDot={{ r: 6 }}
      />
    </LineChart>
  );
}

export default AnalyticsChart;
