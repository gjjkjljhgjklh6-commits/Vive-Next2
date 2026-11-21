export type PackageTier = 'base' | 'emprendedor' | 'elite';

export type RankId =
  | 'consultor_elite'
  | 'bronce'
  | 'plata'
  | 'oro'
  | 'platino'
  | 'rubi'
  | 'diamante'
  | 'doble_diamante'
  | 'triple_diamante'
  | 'diamante_corona'
  | 'corona_universal';

export type PartnerStatus = 'activo' | 'pendiente' | 'inactivo';
export type UserRole = 'socio' | 'lider' | 'admin';
export type BinaryLeg = 'left' | 'right' | 'root';
export type PaymentMethod = 'efectivo' | 'qr' | 'transferencia';
export type PaymentStatus = 'pendiente' | 'validado' | 'rechazado';

export type BonusType =
  | 'B1_VENTA_DIRECTA'
  | 'B2_INICIO_RAPIDO'
  | 'B3_UNILEVEL'
  | 'B4_BINARIO'
  | 'B5_BINARIO_PROGRESIVO'
  | 'B6_MATCHING'
  | 'B7_LIDERAZGO'
  | 'B8_PISCINA'
  | 'B9_ESTILO_VIDA';

export type CommissionStatus = 'pendiente' | 'disponible' | 'pagada' | 'anulada';
export type WithdrawalMethod = 'qr_bolivia' | 'transferencia_bancaria' | 'efectivo_oficina';
export type WithdrawalStatus = 'pendiente' | 'aprobado' | 'rechazado';

export interface Partner {
  id: string;
  ownerUid: string;
  fullName: string;
  referralCode: string;
  sponsorId: string;
  binaryParentId: string;
  binaryLeg: BinaryLeg;
  packageTier: PackageTier;
  rankId: RankId;
  status: PartnerStatus;
  role: UserRole;
  personalPv: number;
  personalCv: number;
  leftBranchCv: number;
  rightBranchCv: number;
  teamCv: number;
  directCount: number;
  activeLines: number;
  firstWeekPurchase: boolean;
  uplineUids: string[];
  pinHash?: string;
  joinedAt: unknown;
  updatedAt: unknown;
}

export interface AffiliatePin {
  id: string;
  pinCode: string;
  partnerId: string;
  partnerName: string;
  referralCode: string;
  active: boolean;
  claimedByUid: string;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PartnerPrivateInfo {
  partnerId: string;
  ownerUid: string;
  email: string;
  phone: string;
  ciNumber: string;
  city: string;
  bankName: string;
  bankAccount: string;
  updatedAt: unknown;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  isPackage: boolean;
  packageTier: 'none' | PackageTier;
  retailPriceBs: number;
  wholesalePriceBs: number;
  firstPurchaseSurchargeBs: number;
  pv: number;
  cv: number;
  stock: number;
  active: boolean;
  imageUrl: string;
  description: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitWholesaleBs: number;
  unitRetailBs: number;
  unitSurchargeBs: number;
  unitPv: number;
  unitCv: number;
  isPackage: boolean;
  packageTier: 'none' | PackageTier;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerUid: string;
  partnerId: string;
  partnerName: string;
  sponsorId: string;
  isFirstPurchase: boolean;
  items: OrderItem[];
  subtotalBs: number;
  surchargeBs: number;
  totalBs: number;
  totalPv: number;
  totalCv: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  receiptNote: string;
  paymentStatus: PaymentStatus;
  validatedBy: string;
  pinProof?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Commission {
  id: string;
  partnerId: string;
  partnerUid: string;
  partnerName: string;
  sourceOrderId: string;
  bonusType: BonusType;
  level: number;
  baseCv: number;
  ratePercent: number;
  amountBs: number;
  status: CommissionStatus;
  periodMonth: string;
  description: string;
  createdAt: unknown;
}

export interface Withdrawal {
  id: string;
  partnerId: string;
  partnerUid: string;
  partnerName: string;
  amountBs: number;
  method: WithdrawalMethod;
  destinationAccount: string;
  status: WithdrawalStatus;
  reviewedBy: string;
  reviewNote: string;
  pinProof?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PlanConfig {
  id: string;
  cvToBsRate: number;
  minMonthlyPv: number;
  maxPayoutRatioPercent: number;
  binaryEquilibriumPercent: number;
  minRealConsumptionBs: number;
  accumulationMaxDays: number;
  firstWeekEndDay: number;
  updatedBy: string;
  updatedAt: unknown;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetCollection: string;
  targetId: string;
  summary: string;
  createdAt: unknown;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
