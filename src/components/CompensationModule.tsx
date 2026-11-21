import React, { useMemo, useState } from 'react';
import { Award, Calculator, Shield, Sparkles } from 'lucide-react';
import {
  AFFILIATION_PACKAGES,
  RANK_LADDER,
  RANK_MAP,
  SOLID_GROWTH_GUARANTEES,
  calculateCompensationSimulation,
} from '../data/compensationPlan';
import type { PackageTier, Partner, PlanConfig, RankId } from '../types/vivenext';

interface CompensationModuleProps {
  currentPartner: Partner;
  planConfig: PlanConfig | null;
}

export const CompensationModule: React.FC<CompensationModuleProps> = ({
  currentPartner,
  planConfig,
}) => {
  const cvRate = planConfig?.cvToBsRate ?? 5;

  const [simPackage, setSimPackage] = useState<PackageTier>(currentPartner.packageTier);
  const [simRank, setSimRank] = useState<RankId>(currentPartner.rankId);
  const [wholesaleSalesBs, setWholesaleSalesBs] = useState(1500);
  const [directElites, setDirectElites] = useState(2);
  const [level2Elites, setLevel2Elites] = useState(2);
  const [level3Elites, setLevel3Elites] = useState(3);
  const [unilevelLines, setUnilevelLines] = useState(4);
  const [avgCvPerLine, setAvgCvPerLine] = useState(1200);
  const [leftBranchCv, setLeftBranchCv] = useState(currentPartner.leftBranchCv || 3200);
  const [rightBranchCv, setRightBranchCv] = useState(currentPartner.rightBranchCv || 2400);
  const [week1Purchase, setWeek1Purchase] = useState(true);
  const [week1Pv, setWeek1Pv] = useState(300);
  const [directsBinaryBs, setDirectsBinaryBs] = useState(1800);

  const simResult = useMemo(
    () =>
      calculateCompensationSimulation({
        packageTier: simPackage,
        rankId: simRank,
        personalWholesaleSalesBs: wholesaleSalesBs,
        newDirectRecruitsElite: directElites,
        newLevel2RecruitsElite: level2Elites,
        newLevel3RecruitsElite: level3Elites,
        unilevelDirectLines: unilevelLines,
        avgCvPerLine,
        leftBranchCv,
        rightBranchCv,
        boughtInFirstWeek: week1Purchase,
        personalWeek1Pv: week1Pv,
        directsBinaryTotalBs: directsBinaryBs,
        globalMonthlyCv: 120000,
        cvToBsRate: cvRate,
      }),
    [
      simPackage,
      simRank,
      wholesaleSalesBs,
      directElites,
      level2Elites,
      level3Elites,
      unilevelLines,
      avgCvPerLine,
      leftBranchCv,
      rightBranchCv,
      week1Purchase,
      week1Pv,
      directsBinaryBs,
      cvRate,
    ]
  );

  const currentRankObj = RANK_MAP[currentPartner.rankId];
  const nextRankObj = RANK_LADDER.find((r) => r.order === currentRankObj.order + 1);
  const teamCvProgress = nextRankObj
    ? Math.min(100, Math.round((currentPartner.teamCv / nextRankObj.requiredTeamCv) * 100))
    : 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rangos y Plan de Compensación</h1>
          <p className="text-sm text-slate-500">
            Escalera oficial Vive Next 2026 · Tasa fija{' '}
            <span className="font-mono-num font-semibold text-slate-800">1 CV = {cvRate} Bs</span> · 9 fuentes de ingreso.
          </p>
        </div>
        <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-4 py-2">
          Rango actual: <strong className="text-slate-900">{currentRankObj.name}</strong> ·{' '}
          <span className="font-mono-num">{currentPartner.personalPv} PV</span> ·{' '}
          <span className="font-mono-num">{currentPartner.teamCv.toLocaleString('es-BO')} CV</span>
        </div>
      </div>

      {/* Progreso hacia Siguiente Rango */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5 text-[#8B1E24]" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {nextRankObj
                  ? `Progreso hacia ${nextRankObj.name}`
                  : 'Has alcanzado el Máximo Rango Corporativo'}
              </h2>
              <p className="text-xs text-slate-500">
                {nextRankObj
                  ? `Meta: ${nextRankObj.requiredPvMonthly} PV personales y ${nextRankObj.requiredTeamCv.toLocaleString('es-BO')} CV de equipo`
                  : currentRankObj.associatedBenefits}
              </p>
            </div>
          </div>
          {nextRankObj && (
            <div className="text-right font-mono-num">
              <div className="text-lg font-bold text-slate-900">{teamCvProgress}%</div>
              <div className="text-xs text-slate-500">
                {currentPartner.teamCv.toLocaleString('es-BO')} /{' '}
                {nextRankObj.requiredTeamCv.toLocaleString('es-BO')} CV
              </div>
            </div>
          )}
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#8B1E24] transition-all duration-300"
            style={{ width: `${teamCvProgress}%` }}
          />
        </div>
      </div>

      {/* Calculadora & Simulador Interactivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#8B1E24]" />
            <h2 className="text-base font-semibold text-slate-900">
              Calculadora de Bonos e Ingresos (Plan 1 al 9)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Paquete de Afiliación</label>
              <select
                value={simPackage}
                onChange={(e) => setSimPackage(e.target.value as PackageTier)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="base">Distribuidor Base (Solo B1 y B2)</option>
                <option value="emprendedor">Emprendedor (B1, B2 y Unilevel)</option>
                <option value="elite">Emprendedor Élite (Bonos 1 al 9)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Rango Calificado</label>
              <select
                value={simRank}
                onChange={(e) => setSimRank(e.target.value as RankId)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {RANK_LADDER.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (Binario {r.binaryPercent}% · Límite {r.unilevelLineLimitCv.toLocaleString('es-BO')} CV)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Compra Mayorista para Venta Directa (Bs)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={wholesaleSalesBs}
                onChange={(e) => setWholesaleSalesBs(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Afiliados Élite Directos N1 (750 Bs c/u)
              </label>
              <input
                type="number"
                min={0}
                value={directElites}
                onChange={(e) => setDirectElites(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Afiliados Élite N2 (90 Bs) / N3 (60 Bs)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={level2Elites}
                  onChange={(e) => setLevel2Elites(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                  aria-label="Afiliados Nivel 2"
                />
                <input
                  type="number"
                  min={0}
                  value={level3Elites}
                  onChange={(e) => setLevel3Elites(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                  aria-label="Afiliados Nivel 3"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Líneas Unilevel / CV Promedio por Línea
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={unilevelLines}
                  onChange={(e) => setUnilevelLines(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                />
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={avgCvPerLine}
                  onChange={(e) => setAvgCvPerLine(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">CV Rama Izquierda</label>
              <input
                type="number"
                min={0}
                step={100}
                value={leftBranchCv}
                onChange={(e) => setLeftBranchCv(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">CV Rama Derecha</label>
              <input
                type="number"
                min={0}
                step={100}
                value={rightBranchCv}
                onChange={(e) => setRightBranchCv(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Binario Total de tus Directos N1 (Bs)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={directsBinaryBs}
                onChange={(e) => setDirectsBinaryBs(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Recompra Días 1–7 (PV Personal)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={week1Purchase}
                  onChange={(e) => setWeek1Purchase(e.target.checked)}
                  className="w-4 h-4 accent-[#8B1E24]"
                />
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={week1Pv}
                  onChange={(e) => setWeek1Pv(Number(e.target.value) || 0)}
                  disabled={!week1Purchase}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
            {AFFILIATION_PACKAGES[simPackage].accessSummary}
          </div>
        </div>

        {/* Resultado Desglosado */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <div className="text-xs font-medium text-slate-500">Proyección Mensual Estimada</div>
            <div className="text-3xl font-bold text-slate-900 font-mono-num mt-1">
              {simResult.totalEstimatedBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Rama menor: <span className="font-mono-num font-medium">{simResult.minorBranchCv.toLocaleString('es-BO')} CV</span> ·{' '}
              Equilibrio binario:{' '}
              <span className={`font-mono-num font-semibold ${simResult.binaryEquilibriumMet ? 'text-[#15803D]' : 'text-[#B45309]'}`}>
                {simResult.binaryEquilibriumRatio}%
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-sm">
            {[
              { label: 'Bono 1 · Venta Directa (50%)', val: simResult.bono1DirectSalesBs },
              { label: 'Bono 2 · Inicio Rápido (30%)', val: simResult.bono2FastStartBs },
              { label: 'Bono 3 · Unilevel Residual (20% fijo)', val: simResult.bono3UnilevelBs },
              { label: `Bono 4 · Binario Híbrido (${RANK_MAP[simRank].binaryPercent}%)`, val: simResult.bono4BinaryBs },
              { label: 'Bono 5 · Binario Progresivo (+5% 1ª sem)', val: simResult.bono5ProgressiveBinaryBs },
              { label: 'Bono 6 · Matching Bonus (50% N1)', val: simResult.bono6MatchingBs },
              { label: 'Bono 7 · Fondo de Liderazgo (4%)', val: simResult.bono7LeadershipBs },
              { label: 'Bono 8 · Piscinas Globales (2%)', val: simResult.bono8GlobalPoolBs },
            ].map((row) => (
              <div key={row.label} className="py-2 flex items-center justify-between">
                <span className="text-slate-600 text-xs">{row.label}</span>
                <span className="font-mono-num font-semibold text-slate-900">
                  {row.val.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
                </span>
              </div>
            ))}
          </div>

          {simResult.protectorCapApplied && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              Se aplicó el Tope Protector (Garantía G) correspondiente al rango {RANK_MAP[simRank].name}.
            </div>
          )}
          {!simResult.binaryEquilibriumMet && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              Alerta Garantía C: la rama menor ({simResult.binaryEquilibriumRatio}%) está por debajo del 30% de la rama mayor.
            </div>
          )}
        </div>
      </div>

      {/* Escalera de Rangos Oficial */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-[#8B1E24]" />
          <h2 className="text-base font-semibold text-slate-900">Escalera de Rangos — Carrera del Emprendedor Élite</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-3">Rango</th>
                <th className="py-2.5 px-3 text-right">PV Mensual</th>
                <th className="py-2.5 px-3 text-right">CV Equipo</th>
                <th className="py-2.5 px-3 text-right">Límite CV/Línea</th>
                <th className="py-2.5 px-3 text-right">% Binario</th>
                <th className="py-2.5 px-3 text-right">Tope Binario</th>
                <th className="py-2.5 px-3">Bonos y Reconocimientos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {RANK_LADDER.map((r) => {
                const isCurrent = r.id === currentPartner.rankId;
                return (
                  <tr key={r.id} className={isCurrent ? 'bg-red-50/60 font-medium' : 'hover:bg-slate-50'}>
                    <td className="py-2.5 px-3 text-slate-900 font-semibold whitespace-nowrap">
                      {r.order}. {r.name} {isCurrent && '· Actual'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">{r.requiredPvMonthly} PV</td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-900">
                      {r.requiredTeamCv.toLocaleString('es-BO')} CV
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                      {r.unilevelLineLimitCv.toLocaleString('es-BO')} CV
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-[#8B1E24] font-semibold">
                      {r.binaryPercent}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                      {r.binaryMonthlyCapBs.toLocaleString('es-BO')} Bs
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{r.associatedBenefits}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7 Garantías de Estabilidad */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-[#8B1E24]" />
          <h2 className="text-base font-semibold text-slate-900">Las 7 Garantías de Crecimiento Sólido</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SOLID_GROWTH_GUARANTEES.map((g) => (
            <div key={g.code} className="p-4 border border-slate-200 rounded-lg bg-slate-50/50">
              <div className="text-xs font-semibold text-[#8B1E24]">Garantía {g.code} · {g.title}</div>
              <div className="text-sm font-semibold text-slate-900 mt-1">{g.rule}</div>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{g.meaning}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
