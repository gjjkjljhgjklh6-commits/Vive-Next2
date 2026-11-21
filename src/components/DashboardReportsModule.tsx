import React, { useMemo, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, FileText, TrendingUp } from 'lucide-react';
import { AFFILIATION_PACKAGES, BONUS_LABELS, RANK_MAP } from '../data/compensationPlan';
import { exportToExcel, exportToPdf, type ExportColumn } from '../services/exportService';
import type { Commission, Order, Partner, PlanConfig } from '../types/vivenext';

interface DashboardReportsModuleProps {
  currentPartner: Partner;
  partners: Partner[];
  orders: Order[];
  commissions: Commission[];
  planConfig: PlanConfig | null;
  onNavigate: (tab: 'network' | 'compensation' | 'wallet' | 'store' | 'admin') => void;
}

type ReportDataset = 'ventas' | 'socios' | 'comisiones' | 'pedidos';

export const DashboardReportsModule: React.FC<DashboardReportsModuleProps> = ({
  currentPartner,
  partners,
  orders,
  commissions,
  planConfig,
  onNavigate,
}) => {
  const [dataset, setDataset] = useState<ReportDataset>('ventas');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  const metrics = useMemo(() => {
    const validatedOrders = orders.filter((o) => o.paymentStatus === 'validado');
    const pendingOrders = orders.filter((o) => o.paymentStatus === 'pendiente');
    const totalSalesBs = validatedOrders.reduce((s, o) => s + o.totalBs, 0);
    const totalOrdersCv = validatedOrders.reduce((s, o) => s + o.totalCv, 0);
    const networkTeamCv = partners.reduce((s, p) => s + p.personalCv, 0) + totalOrdersCv;
    const cvRate = planConfig?.cvToBsRate ?? 5;
    const globalCvValueBs = Math.max(networkTeamCv * cvRate, 1);

    const totalCommissionsBs = commissions
      .filter((c) => c.status !== 'anulada')
      .reduce((s, c) => s + c.amountBs, 0);

    const payoutRatio = Math.min(100, Math.round((totalCommissionsBs / globalCvValueBs) * 1000) / 10);
    const activePartners = partners.filter((p) => p.status === 'activo').length;

    return {
      totalSalesBs,
      pendingOrdersCount: pendingOrders.length,
      validatedOrdersCount: validatedOrders.length,
      activePartners,
      totalPartners: partners.length,
      networkTeamCv,
      totalCommissionsBs,
      payoutRatio,
    };
  }, [orders, partners, commissions, planConfig]);

  const bonusDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    commissions.forEach((c) => {
      if (c.status === 'anulada') return;
      map[c.bonusType] = (map[c.bonusType] || 0) + c.amountBs;
    });
    const entries = Object.entries(map).map(([k, v]) => ({
      key: k,
      label: BONUS_LABELS[k as keyof typeof BONUS_LABELS] || k,
      amountBs: v,
    }));
    const max = Math.max(...entries.map((e) => e.amountBs), 1);
    return entries.map((e) => ({ ...e, widthPct: Math.round((e.amountBs / max) * 100) }));
  }, [commissions]);

  const packageBreakdown = useMemo(() => {
    const counts = { base: 0, emprendedor: 0, elite: 0 };
    partners.forEach((p) => {
      counts[p.packageTier] = (counts[p.packageTier] || 0) + 1;
    });
    return [
      { label: 'Distribuidor Base', count: counts.base, color: '#64748B' },
      { label: 'Emprendedor', count: counts.emprendedor, color: '#0F172A' },
      { label: 'Emprendedor Élite', count: counts.elite, color: '#8B1E24' },
    ];
  }, [partners]);

  const reportData = useMemo<{
    title: string;
    columns: ExportColumn[];
    rows: Record<string, string | number>[];
  }>(() => {
    if (dataset === 'ventas' || dataset === 'pedidos') {
      const columns: ExportColumn[] = [
        { header: 'Nº Pedido', key: 'orderNumber' },
        { header: 'Socio', key: 'partnerName' },
        { header: 'Método', key: 'paymentMethod' },
        { header: 'PV', key: 'totalPv' },
        { header: 'CV', key: 'totalCv' },
        { header: 'Total (Bs)', key: 'totalBs' },
        { header: 'Estado', key: 'paymentStatus' },
      ];
      const filtered = orders.filter((o) => {
        if (dataset === 'ventas' && statusFilter === 'todos') return o.paymentStatus === 'validado';
        if (statusFilter === 'todos') return true;
        return o.paymentStatus === statusFilter;
      });
      const rows = filtered.map((o) => ({
        orderNumber: o.orderNumber,
        partnerName: o.partnerName,
        paymentMethod: o.paymentMethod.toUpperCase(),
        totalPv: o.totalPv,
        totalCv: o.totalCv,
        totalBs: Number(o.totalBs.toFixed(2)),
        paymentStatus: o.paymentStatus.toUpperCase(),
      }));
      return {
        title: dataset === 'ventas' ? 'Reporte Oficial de Ventas' : 'Reporte Detallado de Pedidos',
        columns,
        rows,
      };
    }

    if (dataset === 'socios') {
      const columns: ExportColumn[] = [
        { header: 'Socio', key: 'fullName' },
        { header: 'Código', key: 'referralCode' },
        { header: 'Paquete', key: 'packageTier' },
        { header: 'Rango', key: 'rankName' },
        { header: 'PV Mes', key: 'personalPv' },
        { header: 'CV Equipo', key: 'teamCv' },
        { header: 'Estado', key: 'status' },
      ];
      const filtered = partners.filter((p) =>
        statusFilter === 'todos' ? true : p.status === statusFilter
      );
      const rows = filtered.map((p) => ({
        fullName: p.fullName,
        referralCode: p.referralCode,
        packageTier: AFFILIATION_PACKAGES[p.packageTier].name,
        rankName: RANK_MAP[p.rankId]?.name || p.rankId,
        personalPv: p.personalPv,
        teamCv: p.teamCv,
        status: p.status.toUpperCase(),
      }));
      return { title: 'Padrón de Socios y Crecimiento de Red', columns, rows };
    }

    const columns: ExportColumn[] = [
      { header: 'Socio', key: 'partnerName' },
      { header: 'Bono', key: 'bonusLabel' },
      { header: 'Nivel', key: 'level' },
      { header: 'Base CV', key: 'baseCv' },
      { header: '%', key: 'ratePercent' },
      { header: 'Monto (Bs)', key: 'amountBs' },
      { header: 'Estado', key: 'status' },
    ];
    const filtered = commissions.filter((c) =>
      statusFilter === 'todos' ? true : c.status === statusFilter
    );
    const rows = filtered.map((c) => ({
      partnerName: c.partnerName,
      bonusLabel: BONUS_LABELS[c.bonusType],
      level: c.level,
      baseCv: c.baseCv,
      ratePercent: c.ratePercent,
      amountBs: Number(c.amountBs.toFixed(2)),
      status: c.status.toUpperCase(),
    }));
    return { title: 'Liquidación de Comisiones (Bonos 1 al 9)', columns, rows };
  }, [dataset, statusFilter, orders, partners, commissions]);

  const maxPkgCount = Math.max(...packageBreakdown.map((b) => b.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard Ejecutivo y Reportes
          </h1>
          <p className="text-sm text-slate-500">
            Bienvenido, <strong className="text-slate-800">{currentPartner.fullName}</strong> ·{' '}
            {RANK_MAP[currentPartner.rankId]?.name} · {AFFILIATION_PACKAGES[currentPartner.packageTier].name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('store')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Nuevo Pedido
          </button>
          <button
            type="button"
            onClick={() => onNavigate('compensation')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#8B1E24] rounded-lg hover:bg-[#73181D] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Simulador de Bonos
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Ventas Validadas</div>
          <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
            {metrics.totalSalesBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics.validatedOrdersCount} validados · {metrics.pendingOrdersCount} pendientes
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Crecimiento de Red</div>
          <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
            {metrics.totalPartners} socios
          </div>
          <div className="text-xs text-[#15803D] font-medium mt-1">
            {metrics.activePartners} activos este ciclo
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Comisiones Emitidas</div>
          <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
            {metrics.totalCommissionsBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
          </div>
          <div className="text-xs text-slate-500 mt-1">
            CV de red: <span className="font-mono-num">{metrics.networkTeamCv.toLocaleString('es-BO')} CV</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Ratio Reparto (Garantía A ≤ 48%)</div>
          <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
            {metrics.payoutRatio}%
          </div>
          <div
            className={`text-xs font-medium mt-1 ${
              metrics.payoutRatio <= (planConfig?.maxPayoutRatioPercent ?? 48)
                ? 'text-[#15803D]'
                : 'text-[#B45309]'
            }`}
          >
            {metrics.payoutRatio <= (planConfig?.maxPayoutRatioPercent ?? 48)
              ? 'Dentro del límite sostenible'
              : 'Revisar tope financiero'}
          </div>
        </div>
      </div>

      {/* Analytics Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#8B1E24]" />
            <h2 className="text-base font-semibold text-slate-900">Distribución de Comisiones por Bono</h2>
          </div>
          {bonusDistribution.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Aún no hay comisiones emitidas para graficar.
            </div>
          ) : (
            <div className="space-y-3">
              {bonusDistribution.map((b) => (
                <div key={b.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-700 font-medium">{b.label}</span>
                    <span className="font-mono-num font-semibold text-slate-900">
                      {b.amountBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8B1E24] rounded-full"
                      style={{ width: `${b.widthPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#8B1E24]" />
            <h2 className="text-base font-semibold text-slate-900">Socios por Nivel de Paquete</h2>
          </div>
          <div className="space-y-4">
            {packageBreakdown.map((item) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 font-medium">{item.label}</span>
                  <span className="font-mono-num font-semibold text-slate-900">{item.count} socios</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((item.count / maxPkgCount) * 100)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
            Tasa oficial activa: <strong className="font-mono-num text-slate-800">1 CV = {planConfig?.cvToBsRate ?? 5} Bs</strong> ·
            Recompra mínima: <strong className="font-mono-num text-slate-800">{planConfig?.minMonthlyPv ?? 75} PV/mes</strong>
          </div>
        </div>
      </div>

      {/* Centro de Reportes y Exportación PDF / Excel */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[#8B1E24]" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Centro de Reportes (PDF / Excel)</h2>
              <p className="text-xs text-slate-500">
                Genera y descarga informes auditables en formato PDF corporativo o hoja de cálculo Excel (.xlsx).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dataset}
              onChange={(e) => {
                setDataset(e.target.value as ReportDataset);
                setStatusFilter('todos');
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="ventas">Reporte de Ventas</option>
              <option value="socios">Reporte de Socios y Red</option>
              <option value="comisiones">Reporte de Comisiones</option>
              <option value="pedidos">Reporte de Pedidos</option>
            </select>

            <button
              type="button"
              onClick={() =>
                exportToPdf(
                  `vivenext_${dataset}`,
                  reportData.title,
                  'Vive Next Bolivia · Plan de Prosperidad 2026',
                  reportData.columns,
                  reportData.rows
                )
              }
              disabled={reportData.rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Exportar PDF
            </button>

            <button
              type="button"
              onClick={() =>
                exportToExcel(
                  `vivenext_${dataset}`,
                  dataset.toUpperCase(),
                  reportData.columns,
                  reportData.rows
                )
              }
              disabled={reportData.rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Vista previa tabular */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                {reportData.columns.map((c) => (
                  <th key={c.key} className="py-2.5 px-3">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {reportData.rows.length === 0 ? (
                <tr>
                  <td colSpan={reportData.columns.length} className="py-8 text-center text-slate-500">
                    No existen registros disponibles para este reporte.
                  </td>
                </tr>
              ) : (
                reportData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {reportData.columns.map((c) => (
                      <td key={c.key} className="py-2.5 px-3 font-mono-num text-slate-800">
                        {String(row[c.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
