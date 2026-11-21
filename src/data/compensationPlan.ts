import type { BonusType, PackageTier, RankId } from '../types/vivenext';

export const CV_TO_BS_DEFAULT = 5;

export interface PackageSpec {
  id: PackageTier;
  name: string;
  wholesaleBs: number;
  surchargeBs: number;
  firstPurchaseTotalBs: number;
  pv: number;
  cv: number;
  fastStartPoolBs: number;
  fastStartL1Bs: number;
  fastStartL2Bs: number;
  fastStartL3Bs: number;
  accessSummary: string;
  allowsUnilevel: boolean;
  allowsBinaryAndPrizes: boolean;
}

export const AFFILIATION_PACKAGES: Record<PackageTier, PackageSpec> = {
  base: {
    id: 'base',
    name: 'Distribuidor Base',
    wholesaleBs: 750,
    surchargeBs: 225,
    firstPurchaseTotalBs: 975,
    pv: 75,
    cv: 60,
    fastStartPoolBs: 225,
    fastStartL1Bs: 187.5,
    fastStartL2Bs: 22.5,
    fastStartL3Bs: 15,
    accessSummary: 'Venta Directa (50%) + Inicio Rápido (30%) · Sin Red Residual ni Binario',
    allowsUnilevel: false,
    allowsBinaryAndPrizes: false,
  },
  emprendedor: {
    id: 'emprendedor',
    name: 'Emprendedor',
    wholesaleBs: 1500,
    surchargeBs: 450,
    firstPurchaseTotalBs: 1950,
    pv: 150,
    cv: 120,
    fastStartPoolBs: 450,
    fastStartL1Bs: 375,
    fastStartL2Bs: 45,
    fastStartL3Bs: 30,
    accessSummary: 'Ventas + Inicio Rápido + Unilevel Residual (20%) · Sin Binario ni Premios',
    allowsUnilevel: true,
    allowsBinaryAndPrizes: false,
  },
  elite: {
    id: 'elite',
    name: 'Emprendedor Élite',
    wholesaleBs: 3000,
    surchargeBs: 900,
    firstPurchaseTotalBs: 3900,
    pv: 300,
    cv: 240,
    fastStartPoolBs: 900,
    fastStartL1Bs: 750,
    fastStartL2Bs: 90,
    fastStartL3Bs: 60,
    accessSummary: 'Todos los Bonos (1 al 9) · Red Completa + Rangos + Binario + Premios',
    allowsUnilevel: true,
    allowsBinaryAndPrizes: true,
  },
};

export interface RankSpec {
  id: RankId;
  order: number;
  name: string;
  estimatedTime: string;
  requiredPvMonthly: number;
  requiredTeamCv: number;
  unilevelLineLimitCv: number;
  unilevelMaxGainPerLineBs: number;
  binaryPercent: number;
  binaryMonthlyCapBs: number;
  progressiveWeek1Pv: number;
  progressiveWeek1Cv: number;
  protectorCapBs: number | null;
  matchingUnlockLevels: number[];
  leadershipPoolEligible: boolean;
  globalPool: 'none' | 'A' | 'B';
  associatedBenefits: string;
}

export const RANK_LADDER: RankSpec[] = [
  {
    id: 'consultor_elite',
    order: 1,
    name: 'Consultor Élite',
    estimatedTime: '1–2 meses',
    requiredPvMonthly: 75,
    requiredTeamCv: 600,
    unilevelLineLimitCv: 600,
    unilevelMaxGainPerLineBs: 600,
    binaryPercent: 10,
    binaryMonthlyCapBs: 1500,
    progressiveWeek1Pv: 150,
    progressiveWeek1Cv: 120,
    protectorCapBs: 5000,
    matchingUnlockLevels: [1],
    leadershipPoolEligible: false,
    globalPool: 'none',
    associatedBenefits: 'Unilevel 20% + Binario 10% + Matching Nivel 1 (50%)',
  },
  {
    id: 'bronce',
    order: 2,
    name: 'Bronce',
    estimatedTime: '2–3 meses',
    requiredPvMonthly: 75,
    requiredTeamCv: 1500,
    unilevelLineLimitCv: 1500,
    unilevelMaxGainPerLineBs: 1500,
    binaryPercent: 11,
    binaryMonthlyCapBs: 2500,
    progressiveWeek1Pv: 150,
    progressiveWeek1Cv: 120,
    protectorCapBs: 15000,
    matchingUnlockLevels: [1, 2],
    leadershipPoolEligible: false,
    globalPool: 'none',
    associatedBenefits: 'Viaje Nacional (meta) + Binario 11% + Matching N1–N2',
  },
  {
    id: 'plata',
    order: 3,
    name: 'Plata',
    estimatedTime: '3–5 meses',
    requiredPvMonthly: 75,
    requiredTeamCv: 3000,
    unilevelLineLimitCv: 3000,
    unilevelMaxGainPerLineBs: 3000,
    binaryPercent: 12,
    binaryMonthlyCapBs: 5000,
    progressiveWeek1Pv: 150,
    progressiveWeek1Cv: 120,
    protectorCapBs: 30000,
    matchingUnlockLevels: [1, 2, 3],
    leadershipPoolEligible: true,
    globalPool: 'none',
    associatedBenefits: 'Viaje Nacional e Internacional + Fondo Liderazgo 4% + Binario 12%',
  },
  {
    id: 'oro',
    order: 4,
    name: 'Oro',
    estimatedTime: '5–8 meses',
    requiredPvMonthly: 150,
    requiredTeamCv: 4500,
    unilevelLineLimitCv: 4500,
    unilevelMaxGainPerLineBs: 4500,
    binaryPercent: 13,
    binaryMonthlyCapBs: 12500,
    progressiveWeek1Pv: 300,
    progressiveWeek1Cv: 240,
    protectorCapBs: 60000,
    matchingUnlockLevels: [1, 2, 3, 4],
    leadershipPoolEligible: true,
    globalPool: 'none',
    associatedBenefits: 'Celular 2.500 Bs (3m) + Viajes + Fondo Liderazgo + Binario 13%',
  },
  {
    id: 'platino',
    order: 5,
    name: 'Platino',
    estimatedTime: '6–10 meses',
    requiredPvMonthly: 150,
    requiredTeamCv: 10000,
    unilevelLineLimitCv: 10000,
    unilevelMaxGainPerLineBs: 10000,
    binaryPercent: 14,
    binaryMonthlyCapBs: 25000,
    progressiveWeek1Pv: 300,
    progressiveWeek1Cv: 240,
    protectorCapBs: 80000,
    matchingUnlockLevels: [1, 2, 3, 4, 5],
    leadershipPoolEligible: true,
    globalPool: 'none',
    associatedBenefits: 'Celular + Viajes + Fondo Liderazgo + Binario 14% + Matching N5',
  },
  {
    id: 'rubi',
    order: 6,
    name: 'Rubí',
    estimatedTime: '8–12 meses',
    requiredPvMonthly: 200,
    requiredTeamCv: 20000,
    unilevelLineLimitCv: 20000,
    unilevelMaxGainPerLineBs: 20000,
    binaryPercent: 15,
    binaryMonthlyCapBs: 35000,
    progressiveWeek1Pv: 400,
    progressiveWeek1Cv: 320,
    protectorCapBs: 120000,
    matchingUnlockLevels: [1, 2, 3, 4, 5],
    leadershipPoolEligible: true,
    globalPool: 'none',
    associatedBenefits: 'Bono Auto 200.000 Bs (anual) + Fondo Liderazgo + Binario 15%',
  },
  {
    id: 'diamante',
    order: 7,
    name: 'Diamante',
    estimatedTime: '12+ meses',
    requiredPvMonthly: 250,
    requiredTeamCv: 50000,
    unilevelLineLimitCv: 50000,
    unilevelMaxGainPerLineBs: 50000,
    binaryPercent: 16,
    binaryMonthlyCapBs: 50000,
    progressiveWeek1Pv: 500,
    progressiveWeek1Cv: 400,
    protectorCapBs: null,
    matchingUnlockLevels: [1, 2, 3, 4, 5, 6],
    leadershipPoolEligible: true,
    globalPool: 'A',
    associatedBenefits: 'Sin Tope Protector + Piscina A (1%) + Auto + Viajes + Matching N6',
  },
  {
    id: 'doble_diamante',
    order: 8,
    name: 'Doble Diamante',
    estimatedTime: 'Carrera Élite',
    requiredPvMonthly: 250,
    requiredTeamCv: 100000,
    unilevelLineLimitCv: 100000,
    unilevelMaxGainPerLineBs: 100000,
    binaryPercent: 17,
    binaryMonthlyCapBs: 50000,
    progressiveWeek1Pv: 500,
    progressiveWeek1Cv: 400,
    protectorCapBs: null,
    matchingUnlockLevels: [1, 2, 3, 4, 5, 6],
    leadershipPoolEligible: true,
    globalPool: 'A',
    associatedBenefits: 'Binario 17% + Piscina A (1%) + Auto + Viajes + Fondo Liderazgo',
  },
  {
    id: 'triple_diamante',
    order: 9,
    name: 'Triple Diamante',
    estimatedTime: 'Carrera Élite',
    requiredPvMonthly: 300,
    requiredTeamCv: 200000,
    unilevelLineLimitCv: 200000,
    unilevelMaxGainPerLineBs: 200000,
    binaryPercent: 18,
    binaryMonthlyCapBs: 50000,
    progressiveWeek1Pv: 600,
    progressiveWeek1Cv: 480,
    protectorCapBs: null,
    matchingUnlockLevels: [1, 2, 3, 4, 5, 6],
    leadershipPoolEligible: true,
    globalPool: 'A',
    associatedBenefits: 'Binario 18% + Piscina A (1%) + Auto + Viajes + Fondo Liderazgo',
  },
  {
    id: 'diamante_corona',
    order: 10,
    name: 'Diamante Corona',
    estimatedTime: 'Carrera Élite',
    requiredPvMonthly: 300,
    requiredTeamCv: 500000,
    unilevelLineLimitCv: 500000,
    unilevelMaxGainPerLineBs: 500000,
    binaryPercent: 19,
    binaryMonthlyCapBs: 50000,
    progressiveWeek1Pv: 600,
    progressiveWeek1Cv: 480,
    protectorCapBs: null,
    matchingUnlockLevels: [1, 2, 3, 4, 5, 6],
    leadershipPoolEligible: true,
    globalPool: 'B',
    associatedBenefits: 'Bono Casa 400.000 Bs + Auto + Piscina B (1%) + Binario 19%',
  },
  {
    id: 'corona_universal',
    order: 11,
    name: 'Corona Universal',
    estimatedTime: 'Máximo Rango',
    requiredPvMonthly: 300,
    requiredTeamCv: 1000000,
    unilevelLineLimitCv: 1000000,
    unilevelMaxGainPerLineBs: 1000000,
    binaryPercent: 20,
    binaryMonthlyCapBs: 50000,
    progressiveWeek1Pv: 600,
    progressiveWeek1Cv: 480,
    protectorCapBs: null,
    matchingUnlockLevels: [1, 2, 3, 4, 5, 6],
    leadershipPoolEligible: true,
    globalPool: 'B',
    associatedBenefits: 'Máximo Rango Corporativo · Todos los Bonos del 1 al 9 al 100%',
  },
];

export const RANK_MAP: Record<RankId, RankSpec> = RANK_LADDER.reduce(
  (acc, rank) => {
    acc[rank.id] = rank;
    return acc;
  },
  {} as Record<RankId, RankSpec>
);

export const BONUS_LABELS: Record<BonusType, string> = {
  B1_VENTA_DIRECTA: 'Bono 1 · Venta Directa (50%)',
  B2_INICIO_RAPIDO: 'Bono 2 · Inicio Rápido (30%)',
  B3_UNILEVEL: 'Bono 3 · Unilevel Residual (20%)',
  B4_BINARIO: 'Bono 4 · Binario Híbrido',
  B5_BINARIO_PROGRESIVO: 'Bono 5 · Binario Progresivo (+5%)',
  B6_MATCHING: 'Bono 6 · Igualación / Matching (54%)',
  B7_LIDERAZGO: 'Bono 7 · Fondo de Liderazgo (4%)',
  B8_PISCINA: 'Bono 8 · Piscinas Globales (2%)',
  B9_ESTILO_VIDA: 'Bono 9 · Estilo de Vida y Premios',
};

export const SOLID_GROWTH_GUARANTEES = [
  {
    code: 'A',
    title: 'Límite de Reparto',
    rule: 'Pago total ≤ 48% del CV global',
    meaning: 'Sostenibilidad matemática garantizada para el pago puntual de todas las comisiones.',
  },
  {
    code: 'B',
    title: 'Consumo Real',
    rule: 'Mínimo 350 Bs/mes en clientes',
    meaning: 'Respaldo en ventas y consumo real de productos, no únicamente en registros.',
  },
  {
    code: 'C',
    title: 'Equilibrio Binario',
    rule: 'Rama menor ≥ 30% de la rama mayor',
    meaning: 'Fomenta el desarrollo equilibrado de ambos equipos sin depender de una sola línea.',
  },
  {
    code: 'D',
    title: 'Acumulación Controlada',
    rule: 'Volumen acumulado máx. 30 días',
    meaning: 'Evita pasivos financieros acumulados y protege la liquidez a largo plazo.',
  },
  {
    code: 'E',
    title: 'Rango Activo',
    rule: '2 meses sin cumplir → recategorización',
    meaning: 'Premia el liderazgo activo y la producción sostenida de los equipos.',
  },
  {
    code: 'F',
    title: 'Solo Activos Cobran',
    rule: 'Compresión dinámica (75 PV/mes)',
    meaning: 'Las comisiones de socios inactivos suben al siguiente líder activo calificado.',
  },
  {
    code: 'G',
    title: 'Tope Protector',
    rule: 'Élite 5k / Bronce 15k / Plata 30k / Oro 60k',
    meaning: 'Protección financiera en rangos iniciales; desde Diamante operan sin tope.',
  },
];

export interface SimulationInput {
  packageTier: PackageTier;
  rankId: RankId;
  personalWholesaleSalesBs: number;
  newDirectRecruitsElite: number;
  newLevel2RecruitsElite: number;
  newLevel3RecruitsElite: number;
  unilevelDirectLines: number;
  avgCvPerLine: number;
  leftBranchCv: number;
  rightBranchCv: number;
  boughtInFirstWeek: boolean;
  personalWeek1Pv: number;
  directsBinaryTotalBs: number;
  globalMonthlyCv: number;
  cvToBsRate?: number;
}

export interface SimulationResult {
  bono1DirectSalesBs: number;
  bono2FastStartBs: number;
  bono3UnilevelBs: number;
  bono4BinaryBs: number;
  bono5ProgressiveBinaryBs: number;
  bono6MatchingBs: number;
  bono7LeadershipBs: number;
  bono8GlobalPoolBs: number;
  totalEstimatedBs: number;
  minorBranchCv: number;
  majorBranchCv: number;
  binaryEquilibriumRatio: number;
  binaryEquilibriumMet: boolean;
  progressiveUnlocked: boolean;
  protectorCapApplied: boolean;
}

export function calculateCompensationSimulation(input: SimulationInput): SimulationResult {
  const rate = input.cvToBsRate ?? CV_TO_BS_DEFAULT;
  const pkg = AFFILIATION_PACKAGES[input.packageTier];
  const rank = RANK_MAP[input.rankId];

  // Bono 1: Venta Directa (50% sobre precio mayorista en todos los paquetes)
  const bono1DirectSalesBs = Math.round(input.personalWholesaleSalesBs * 0.5 * 100) / 100;

  // Bono 2: Inicio Rápido (todos los paquetes, ejemplo base sobre ingresos Élite o Emprendedor)
  const bono2FastStartBs =
    input.newDirectRecruitsElite * 750 +
    input.newLevel2RecruitsElite * 90 +
    input.newLevel3RecruitsElite * 60;

  // Bono 3: Unilevel Residual 20% fijo (solo Emprendedor y Élite), tope CV por línea según rango
  let bono3UnilevelBs = 0;
  if (pkg.allowsUnilevel) {
    const capturableCvPerLine = Math.min(input.avgCvPerLine, rank.unilevelLineLimitCv);
    bono3UnilevelBs = input.unilevelDirectLines * capturableCvPerLine * 0.2 * rate;
  }

  // Bono 4: Binario Híbrido (exclusivo Emprendedor Élite)
  const minorBranchCv = Math.min(input.leftBranchCv, input.rightBranchCv);
  const majorBranchCv = Math.max(input.leftBranchCv, input.rightBranchCv);
  const binaryEquilibriumRatio = majorBranchCv > 0 ? (minorBranchCv / majorBranchCv) * 100 : 100;
  const binaryEquilibriumMet = majorBranchCv === 0 || binaryEquilibriumRatio >= 30;

  let bono4BinaryBs = 0;
  let bono5ProgressiveBinaryBs = 0;
  let progressiveUnlocked = false;

  if (pkg.allowsBinaryAndPrizes && minorBranchCv > 0) {
    const rawBinary = minorBranchCv * (rank.binaryPercent / 100) * rate;
    bono4BinaryBs = Math.min(rawBinary, rank.binaryMonthlyCapBs);

    // Bono 5: Binario Progresivo (+5% extra en 1a semana si cumple PV requerido)
    if (input.boughtInFirstWeek && input.personalWeek1Pv >= rank.progressiveWeek1Pv) {
      progressiveUnlocked = true;
      bono5ProgressiveBinaryBs = minorBranchCv * 0.05 * rate;
    }
  }

  // Bono 6: Matching Bonus (50% nivel 1 para Consultor Élite+, exclusivo Élite)
  const bono6MatchingBs = pkg.allowsBinaryAndPrizes ? input.directsBinaryTotalBs * 0.5 : 0;

  // Bono 7: Fondo Liderazgo (4% del CV global prorrateado, estimado referencial desde Plata)
  const bono7LeadershipBs =
    pkg.allowsBinaryAndPrizes && rank.leadershipPoolEligible
      ? Math.round(input.globalMonthlyCv * 0.04 * 0.02 * rate * 100) / 100
      : 0;

  // Bono 8: Piscinas Globales (1% Piscina A o B, estimado referencial desde Diamante)
  const bono8GlobalPoolBs =
    pkg.allowsBinaryAndPrizes && rank.globalPool !== 'none'
      ? Math.round(input.globalMonthlyCv * 0.01 * 0.05 * rate * 100) / 100
      : 0;

  let totalEstimatedBs =
    bono1DirectSalesBs +
    bono2FastStartBs +
    bono3UnilevelBs +
    bono4BinaryBs +
    bono5ProgressiveBinaryBs +
    bono6MatchingBs +
    bono7LeadershipBs +
    bono8GlobalPoolBs;

  let protectorCapApplied = false;
  if (rank.protectorCapBs !== null && totalEstimatedBs > rank.protectorCapBs) {
    totalEstimatedBs = rank.protectorCapBs;
    protectorCapApplied = true;
  }

  return {
    bono1DirectSalesBs,
    bono2FastStartBs,
    bono3UnilevelBs,
    bono4BinaryBs,
    bono5ProgressiveBinaryBs,
    bono6MatchingBs,
    bono7LeadershipBs,
    bono8GlobalPoolBs,
    totalEstimatedBs: Math.round(totalEstimatedBs * 100) / 100,
    minorBranchCv,
    majorBranchCv,
    binaryEquilibriumRatio: Math.round(binaryEquilibriumRatio * 10) / 10,
    binaryEquilibriumMet,
    progressiveUnlocked,
    protectorCapApplied,
  };
}

export function determineQualifiedRank(personalPv: number, teamCv: number, currentRank: RankId): RankId {
  let qualified: RankId = 'consultor_elite';
  for (const r of RANK_LADDER) {
    if (personalPv >= r.requiredPvMonthly && teamCv >= r.requiredTeamCv) {
      qualified = r.id;
    }
  }
  const currentOrder = RANK_MAP[currentRank]?.order ?? 1;
  const newOrder = RANK_MAP[qualified]?.order ?? 1;
  return newOrder > currentOrder ? qualified : currentRank;
}
