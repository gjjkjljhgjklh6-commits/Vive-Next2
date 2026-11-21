import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Copy,
  Edit3,
  ImagePlus,
  KeyRound,
  LockOpen,
  PackagePlus,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { AFFILIATION_PACKAGES, BONUS_LABELS, RANK_LADDER, RANK_MAP } from '../data/compensationPlan';
import {
  adminAssignAffiliatePin,
  adminCreateManualCommission,
  adminCreatePartner,
  adminDeleteCommission,
  adminDeleteOrder,
  adminDeletePartner,
  adminResetAffiliatePinClaim,
  adminToggleAffiliatePin,
  adminUpdateCommissionStatus,
  adminUpdatePartner,
  adminUpdatePartnerPrivateEmail,
  compressProductImage,
  deleteProduct,
  fetchPartnerPrivateInfo,
  generateRandomAffiliatePin,
  purgeAllFirestoreData,
  reviewWithdrawal,
  runMonthlyCompensationCycle,
  saveProduct,
  updatePlanConfig,
  validateOrderAndGenerateBonuses,
} from '../services/firestoreService';
import type {
  AffiliatePin,
  AuditLog,
  BinaryLeg,
  BonusType,
  Commission,
  CommissionStatus,
  Order,
  PackageTier,
  Partner,
  PartnerStatus,
  PlanConfig,
  Product,
  RankId,
  UserRole,
  Withdrawal,
} from '../types/vivenext';

export type AdminSection =
  | 'resumen'
  | 'productos'
  | 'pedidos'
  | 'comisiones'
  | 'socios'
  | 'crear_afiliado'
  | 'config'
  | 'auditoria';

interface AdminModuleProps {
  activeSection: AdminSection;
  onChangeSection: (section: AdminSection) => void;
  partners: Partner[];
  affiliatePins: AffiliatePin[];
  products: Product[];
  orders: Order[];
  commissions: Commission[];
  withdrawals: Withdrawal[];
  planConfig: PlanConfig | null;
  auditLogs: AuditLog[];
  adminUser: {
    uid: string;
    email: string;
    name: string;
  };
}

const STUDIO_IMAGES = [
  { label: 'Elixir Botánico', url: '/src/assets/images/product_elixir_vital_1794920091552.jpg' },
  { label: 'Colágeno Next', url: '/src/assets/images/product_colageno_next_1794920093968.jpg' },
  { label: 'Matcha Energía', url: '/src/assets/images/product_energia_matcha_1794920092488.jpg' },
  { label: 'Omega-3 Pure', url: '/src/assets/images/product_omega_pure_1794920093366.jpg' },
];

export const AdminModule: React.FC<AdminModuleProps> = ({
  activeSection,
  onChangeSection,
  partners,
  affiliatePins,
  products,
  orders,
  commissions,
  withdrawals,
  planConfig,
  auditLogs,
  adminUser,
}) => {
  const [busyId, setBusyId] = useState<string>('');
  const [banner, setBanner] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [confirmPurgeDb, setConfirmPurgeDb] = useState(false);
  const [copiedPinId, setCopiedPinId] = useState<string>('');
  const [pinEditorPartner, setPinEditorPartner] = useState<Partner | null>(null);
  const [customPinInput, setCustomPinInput] = useState<string>('');

  // Minipanel Productos state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDeleteProdId, setConfirmDeleteProdId] = useState<string | null>(null);
  const [prodForm, setProdForm] = useState({
    sku: `VN-PROD-${Math.floor(100 + Math.random() * 899)}`,
    name: '',
    category: 'Bienestar Celular',
    wholesalePriceBs: 240,
    retailPriceBs: 360,
    pv: 45,
    cv: 36,
    stock: 100,
    active: true,
    isPackage: false,
    packageTier: 'none' as 'none' | PackageTier,
    description: '',
    imageUrl: STUDIO_IMAGES[0].url,
  });

  // Partner detailed edit modal
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [confirmDeletePartnerId, setConfirmDeletePartnerId] = useState<string | null>(null);
  const [partnerEditEmail, setPartnerEditEmail] = useState('');
  const [partnerEditForm, setPartnerEditForm] = useState({
    fullName: '',
    role: 'socio' as UserRole,
    status: 'activo' as PartnerStatus,
    packageTier: 'base' as PackageTier,
    rankId: 'consultor_elite' as RankId,
    personalPv: 0,
    personalCv: 0,
    leftBranchCv: 0,
    rightBranchCv: 0,
    teamCv: 0,
    sponsorId: '',
    firstWeekPurchase: false,
  });

  // Create Affiliate Form
  const [newPartnerForm, setNewPartnerForm] = useState(() => ({
    fullName: '',
    referralCode: '',
    accessPin: generateRandomAffiliatePin(),
    sponsorId: partners[0]?.id || 'vn_root',
    binaryParentId: partners[0]?.id || 'vn_root',
    binaryLeg: 'left' as BinaryLeg,
    packageTier: 'emprendedor' as PackageTier,
    rankId: 'consultor_elite' as RankId,
    role: 'socio' as UserRole,
    status: 'activo' as PartnerStatus,
    personalPv: 0,
    personalCv: 0,
    firstWeekPurchase: false,
    ownerUid: '',
    email: '',
    phone: '+591 ',
    ciNumber: '',
    city: 'Santa Cruz de la Sierra',
    bankName: 'Banco Mercantil Santa Cruz',
    bankAccount: '',
  }));

  // Manual Commission modal/form
  const [manualComForm, setManualComForm] = useState({
    partnerId: partners[0]?.id || 'vn_root',
    bonusType: 'B9_ESTILO_VIDA' as BonusType,
    amountBs: 500,
    baseCv: 100,
    ratePercent: 10,
    description: 'Bono administrativo acreditado por Dirección Vive Next',
  });

  // Plan Config Form
  const [cfgForm, setCfgForm] = useState({
    cvToBsRate: planConfig?.cvToBsRate ?? 5,
    minMonthlyPv: planConfig?.minMonthlyPv ?? 75,
    maxPayoutRatioPercent: planConfig?.maxPayoutRatioPercent ?? 48,
    binaryEquilibriumPercent: planConfig?.binaryEquilibriumPercent ?? 30,
    minRealConsumptionBs: planConfig?.minRealConsumptionBs ?? 350,
    accumulationMaxDays: planConfig?.accumulationMaxDays ?? 30,
    firstWeekEndDay: planConfig?.firstWeekEndDay ?? 7,
  });

  useEffect(() => {
    if (planConfig) {
      setCfgForm({
        cvToBsRate: planConfig.cvToBsRate,
        minMonthlyPv: planConfig.minMonthlyPv,
        maxPayoutRatioPercent: planConfig.maxPayoutRatioPercent,
        binaryEquilibriumPercent: planConfig.binaryEquilibriumPercent,
        minRealConsumptionBs: planConfig.minRealConsumptionBs,
        accumulationMaxDays: planConfig.accumulationMaxDays,
        firstWeekEndDay: planConfig.firstWeekEndDay,
      });
    }
  }, [planConfig]);

  useEffect(() => {
    if (partners.length > 0 && !partners.some((p) => p.id === manualComForm.partnerId)) {
      setManualComForm((prev) => ({ ...prev, partnerId: partners[0].id }));
    }
    if (partners.length > 0 && !partners.some((p) => p.id === newPartnerForm.sponsorId)) {
      const rootId = partners.find((p) => p.id === 'vn_root')?.id || partners[0].id;
      setNewPartnerForm((prev) => ({ ...prev, sponsorId: rootId, binaryParentId: rootId }));
    }
  }, [partners, manualComForm.partnerId, newPartnerForm.sponsorId]);

  const adminMetrics = useMemo(() => {
    const validatedBs = orders
      .filter((o) => o.paymentStatus === 'validado')
      .reduce((s, o) => s + o.totalBs, 0);
    const pendingOrders = orders.filter((o) => o.paymentStatus === 'pendiente').length;
    const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pendiente').length;
    const activeProducts = products.filter((p) => p.active).length;
    return { validatedBs, pendingOrders, pendingWithdrawals, activeProducts };
  }, [orders, withdrawals, products]);

  const resetProductForm = () => {
    setEditingProduct(null);
    setProdForm({
      sku: `VN-PROD-${Math.floor(100 + Math.random() * 899)}`,
      name: '',
      category: 'Bienestar Celular',
      wholesalePriceBs: 240,
      retailPriceBs: 360,
      pv: 45,
      cv: 36,
      stock: 100,
      active: true,
      isPackage: false,
      packageTier: 'none',
      description: '',
      imageUrl: STUDIO_IMAGES[0].url,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorBanner('');
    try {
      const compressed = await compressProductImage(file);
      setProdForm((prev) => ({ ...prev, imageUrl: compressed }));
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo cargar la imagen.');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prodForm.name.trim().length < 2) {
      setErrorBanner('Ingresa un nombre válido para el producto.');
      return;
    }
    setErrorBanner('');
    setBusyId('product');
    try {
      const isNew = !editingProduct;
      const id = editingProduct ? editingProduct.id : `prod_${Date.now()}`;
      await saveProduct(
        {
          id,
          sku: prodForm.sku.trim() || `VN-${Date.now().toString().slice(-4)}`,
          name: prodForm.name.trim(),
          category: prodForm.category.trim() || 'Bienestar Celular',
          isPackage: prodForm.isPackage,
          packageTier: prodForm.isPackage ? prodForm.packageTier : 'none',
          wholesalePriceBs: Number(prodForm.wholesalePriceBs),
          retailPriceBs: Number(prodForm.retailPriceBs),
          firstPurchaseSurchargeBs: editingProduct?.firstPurchaseSurchargeBs ?? 0,
          pv: Number(prodForm.pv),
          cv: Number(prodForm.cv),
          stock: Math.round(Number(prodForm.stock)),
          active: prodForm.active,
          imageUrl: prodForm.imageUrl,
          description: prodForm.description.trim() || 'Producto oficial Vive Next Bolivia.',
        },
        isNew
      );
      setBanner(
        isNew
          ? `Producto "${prodForm.name}" subido y publicado en la tienda de socios.`
          : `Producto "${prodForm.name}" actualizado correctamente.`
      );
      resetProductForm();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    } finally {
      setBusyId('');
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    setBusyId(p.id);
    setErrorBanner('');
    try {
      await deleteProduct(p.id, p.name);
      setConfirmDeleteProdId(null);
      if (editingProduct?.id === p.id) resetProductForm();
      setBanner(`Producto "${p.name}" eliminado permanentemente del catálogo.`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo borrar el producto.');
    } finally {
      setBusyId('');
    }
  };

  const openPartnerEdit = (p: Partner) => {
    setEditingPartner(p);
    setPartnerEditEmail('');
    setPartnerEditForm({
      fullName: p.fullName,
      role: p.role,
      status: p.status,
      packageTier: p.packageTier,
      rankId: p.rankId,
      personalPv: p.personalPv,
      personalCv: p.personalCv,
      leftBranchCv: p.leftBranchCv,
      rightBranchCv: p.rightBranchCv,
      teamCv: p.teamCv,
      sponsorId: p.sponsorId,
      firstWeekPurchase: p.firstWeekPurchase,
    });
    fetchPartnerPrivateInfo(p.id)
      .then((info) => {
        if (info?.email) setPartnerEditEmail(info.email);
      })
      .catch(() => {
        // Ignore if missing
      });
  };

  const handleSavePartnerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;
    setBusyId(editingPartner.id);
    try {
      await adminUpdatePartner(editingPartner.id, {
        ...partnerEditForm,
        personalPv: Number(partnerEditForm.personalPv),
        personalCv: Number(partnerEditForm.personalCv),
        leftBranchCv: Number(partnerEditForm.leftBranchCv),
        rightBranchCv: Number(partnerEditForm.rightBranchCv),
        teamCv: Number(partnerEditForm.teamCv),
      });
      if (partnerEditEmail.trim()) {
        await adminUpdatePartnerPrivateEmail(editingPartner, partnerEditEmail);
      }
      setBanner(`Socio "${partnerEditForm.fullName}" modificado correctamente.`);
      setEditingPartner(null);
    } finally {
      setBusyId('');
    }
  };

  const handleOrderDecision = async (order: Order, decision: 'validado' | 'rechazado') => {
    setBusyId(order.id);
    setBanner('');
    try {
      await validateOrderAndGenerateBonuses(order, decision, partners, planConfig?.cvToBsRate ?? 5);
      setBanner(
        decision === 'validado'
          ? `Pedido ${order.orderNumber} validado. Se actualizaron volúmenes PV/CV y se acreditaron bonos.`
          : `Pedido ${order.orderNumber} rechazado.`
      );
    } finally {
      setBusyId('');
    }
  };

  const handleCycleRun = async () => {
    if (!planConfig) return;
    setBusyId('cycle');
    setBanner('');
    try {
      const res = await runMonthlyCompensationCycle(partners, planConfig);
      setBanner(
        `Cierre de ciclo ejecutado: ${res.generatedCount} comisiones generadas por ${res.totalBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs.`
      );
    } finally {
      setBusyId('');
    }
  };

  const handleCreateManualCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = partners.find((p) => p.id === manualComForm.partnerId);
    if (!target) return;
    setBusyId('manual_com');
    try {
      await adminCreateManualCommission({
        partner: target,
        bonusType: manualComForm.bonusType,
        amountBs: Number(manualComForm.amountBs),
        baseCv: Number(manualComForm.baseCv),
        ratePercent: Number(manualComForm.ratePercent),
        description: manualComForm.description,
      });
      setBanner(`Comisión manual de ${manualComForm.amountBs} Bs acreditada a ${target.fullName}.`);
    } finally {
      setBusyId('');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyId('config');
    try {
      await updatePlanConfig({ id: 'default', ...cfgForm });
      setBanner('Parámetros oficiales del Plan de Prosperidad actualizados.');
    } finally {
      setBusyId('');
    }
  };

  const binarySlotOccupant = useMemo(() => {
    if (newPartnerForm.binaryLeg === 'root') return null;
    return (
      partners.find(
        (p) =>
          p.binaryParentId === newPartnerForm.binaryParentId &&
          p.binaryLeg === newPartnerForm.binaryLeg
      ) || null
    );
  }, [partners, newPartnerForm.binaryParentId, newPartnerForm.binaryLeg]);

  const findNextAvailableBinaryParent = (startParentId: string, leg: 'left' | 'right'): string => {
    let currentId = startParentId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const occupant = partners.find((p) => p.binaryParentId === currentId && p.binaryLeg === leg);
      if (!occupant) return currentId;
      currentId = occupant.id;
    }
    return startParentId;
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPartnerForm.fullName.trim().length < 2) {
      setErrorBanner('Ingresa el nombre completo del afiliado (mínimo 2 caracteres).');
      return;
    }
    setBusyId('create_partner');
    setErrorBanner('');
    setBanner('');
    try {
      const sponsorPartner = partners.find((p) => p.id === newPartnerForm.sponsorId) || null;
      const created = await adminCreatePartner({
        adminUid: adminUser.uid,
        fullName: newPartnerForm.fullName,
        referralCode: newPartnerForm.referralCode,
        accessPin: newPartnerForm.accessPin,
        sponsorId: newPartnerForm.sponsorId || 'vn_root',
        binaryParentId: newPartnerForm.binaryParentId || newPartnerForm.sponsorId || 'vn_root',
        binaryLeg: newPartnerForm.binaryLeg === 'root' ? 'left' : newPartnerForm.binaryLeg,
        packageTier: newPartnerForm.packageTier,
        rankId: newPartnerForm.rankId,
        role: newPartnerForm.role,
        status: newPartnerForm.status,
        personalPv: Number(newPartnerForm.personalPv),
        personalCv: Number(newPartnerForm.personalCv),
        firstWeekPurchase: newPartnerForm.firstWeekPurchase,
        ownerUid: newPartnerForm.ownerUid,
        email: newPartnerForm.email,
        phone: newPartnerForm.phone,
        ciNumber: newPartnerForm.ciNumber,
        city: newPartnerForm.city,
        bankName: newPartnerForm.bankName,
        bankAccount: newPartnerForm.bankAccount,
        sponsorPartner,
      });

      setBanner(
        `Afiliado "${created.fullName}" (${created.referralCode}) registrado.${created.plainPin ? ` PIN de acceso rápido: ${created.plainPin}` : ''}`
      );
      const rootId = partners.find((p) => p.id === 'vn_root')?.id || 'vn_root';
      setNewPartnerForm({
        fullName: '',
        referralCode: '',
        accessPin: generateRandomAffiliatePin(),
        sponsorId: rootId,
        binaryParentId: rootId,
        binaryLeg: 'left',
        packageTier: 'emprendedor',
        rankId: 'consultor_elite',
        role: 'socio',
        status: 'activo',
        personalPv: 0,
        personalCv: 0,
        firstWeekPurchase: false,
        ownerUid: '',
        email: '',
        phone: '+591 ',
        ciNumber: '',
        city: 'Santa Cruz de la Sierra',
        bankName: 'Banco Mercantil Santa Cruz',
        bankAccount: '',
      });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo crear el afiliado en la base de datos.');
    } finally {
      setBusyId('');
    }
  };

  const getPartnerPin = (partner: Partner): AffiliatePin | null => {
    return (
      affiliatePins.find((pin) => pin.id === partner.pinHash) ||
      affiliatePins.find((pin) => pin.partnerId === partner.id) ||
      null
    );
  };

  const handleCopyPin = async (pinCode: string, key: string) => {
    try {
      await navigator.clipboard.writeText(pinCode);
      setCopiedPinId(key);
      setTimeout(() => setCopiedPinId(''), 1800);
    } catch {
      setBanner(`PIN listo para compartir: ${pinCode}`);
    }
  };

  const handleAssignPin = async (partner: Partner, customPin?: string) => {
    setBusyId(`pin_${partner.id}`);
    setErrorBanner('');
    setBanner('');
    try {
      const created = await adminAssignAffiliatePin(partner, adminUser.uid, customPin);
      setPinEditorPartner(null);
      setCustomPinInput('');
      setBanner(`PIN ${created.pinCode} asignado a ${partner.fullName}. Compártelo para que ingrese rápido.`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo asignar el PIN.');
    } finally {
      setBusyId('');
    }
  };

  const handlePurgeDatabase = async () => {
    setBusyId('purge');
    setErrorBanner('');
    setBanner('');
    try {
      const res = await purgeAllFirestoreData(adminUser.uid, adminUser.email, adminUser.name);
      setConfirmPurgeDb(false);
      setBanner(
        `Base de datos limpiada (${res.deletedCount} registros eliminados). Sistema Vive Next reiniciado en limpio.`
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'No se pudo reiniciar la base de datos.');
    } finally {
      setBusyId('');
    }
  };

  const renderProductMiniPanel = () => (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <PackagePlus className="w-5 h-5 text-[#8B1E24]" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Minipanel del Marketplace (Subir / Modificar / Borrar Productos)
            </h2>
            <p className="text-xs text-slate-500">
              Solo el Administrador tiene acceso a este panel. Todo producto subido o borrado aquí se refleja al instante en la Landing y en el Marketplace de Afiliados.
            </p>
          </div>
        </div>
        {editingProduct && (
          <button
            type="button"
            onClick={resetProductForm}
            className="text-xs font-medium text-[#8B1E24] hover:underline whitespace-nowrap cursor-pointer"
          >
            Cancelar edición y subir nuevo
          </button>
        )}
      </div>

      {/* Upload / Edit Form */}
      <form onSubmit={handleSaveProduct} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Image preview + uploader */}
          <div className="lg:col-span-3 space-y-2.5">
            <div className="aspect-[4/3] bg-white border border-slate-200 rounded-lg overflow-hidden">
              <img
                src={prodForm.imageUrl}
                alt="Vista previa del producto"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <label className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">
              <ImagePlus className="w-3.5 h-3.5 text-[#8B1E24]" />
              <span>Subir foto del producto</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {STUDIO_IMAGES.map((img) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setProdForm((prev) => ({ ...prev, imageUrl: img.url }))}
                  className={`px-2 py-1 text-[11px] border rounded truncate cursor-pointer ${
                    prodForm.imageUrl === img.url
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                >
                  {img.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Nombre del producto</label>
              <input
                type="text"
                required
                value={prodForm.name}
                onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                placeholder="Ej. Café Ganoderma Vital"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">SKU</label>
              <input
                type="text"
                required
                value={prodForm.sku}
                onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono-num"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Categoría</label>
              <input
                type="text"
                required
                value={prodForm.category}
                onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Precio Mayorista (Bs)</label>
              <input
                type="number"
                min={1}
                required
                value={prodForm.wholesalePriceBs}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setProdForm({
                    ...prodForm,
                    wholesalePriceBs: val,
                    retailPriceBs: Math.round(val * 1.5),
                  });
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono-num"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Precio Público PVP (Bs)</label>
              <input
                type="number"
                min={1}
                required
                value={prodForm.retailPriceBs}
                onChange={(e) => setProdForm({ ...prodForm, retailPriceBs: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono-num"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">PV</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={prodForm.pv}
                  onChange={(e) => setProdForm({ ...prodForm, pv: Number(e.target.value) })}
                  className="w-full px-2 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono-num"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">CV</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={prodForm.cv}
                  onChange={(e) => setProdForm({ ...prodForm, cv: Number(e.target.value) })}
                  className="w-full px-2 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono-num"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Stock</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={prodForm.stock}
                  onChange={(e) => setProdForm({ ...prodForm, stock: Number(e.target.value) })}
                  className="w-full px-2 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono-num"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Descripción comercial</label>
              <input
                type="text"
                required
                value={prodForm.description}
                onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                placeholder="Beneficios, presentación y margen mayorista..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              />
            </div>

            <div className="flex items-end justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prodForm.active}
                  onChange={(e) => setProdForm({ ...prodForm, active: e.target.checked })}
                  className="accent-[#8B1E24]"
                />
                <span>Visible en tienda</span>
              </label>
              <button
                type="submit"
                disabled={busyId === 'product'}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {editingProduct ? 'Guardar Cambios' : 'Subir Producto'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Catalog List with Delete */}
      {products.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
          No hay productos cargados en el Marketplace todavía. Usa el formulario superior para subir el primer producto.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-3">Producto</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3 text-right">Mayorista / PVP</th>
                <th className="py-2.5 px-3 text-right">PV / CV</th>
                <th className="py-2.5 px-3 text-right">Stock</th>
                <th className="py-2.5 px-3 text-right">Estado</th>
                <th className="py-2.5 px-3 text-right">Acciones Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded object-cover border border-slate-200 shrink-0"
                      />
                      <div>
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-[11px] font-mono-num text-slate-500">{p.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{p.category}</td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-slate-900">
                    {p.wholesalePriceBs} / {p.retailPriceBs} Bs
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                    {p.pv} PV · {p.cv} CV
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-slate-900">{p.stock}</td>
                  <td className="py-2.5 px-3 text-right font-medium">
                    <span className={p.active ? 'text-[#15803D]' : 'text-slate-400'}>
                      {p.active ? 'Activo' : 'Oculto'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {confirmDeleteProdId === p.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => handleDeleteProduct(p)}
                          className="px-2.5 py-1 bg-red-600 text-white rounded text-[11px] font-semibold hover:bg-red-700 cursor-pointer"
                        >
                          Confirmar Borrar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteProdId(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[11px] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(p);
                            setProdForm({
                              sku: p.sku,
                              name: p.name,
                              category: p.category,
                              wholesalePriceBs: p.wholesalePriceBs,
                              retailPriceBs: p.retailPriceBs,
                              pv: p.pv,
                              cv: p.cv,
                              stock: p.stock,
                              active: p.active,
                              isPackage: p.isPackage,
                              packageTier: p.packageTier,
                              description: p.description,
                              imageUrl: p.imageUrl,
                            });
                          }}
                          className="inline-flex items-center gap-1 text-slate-700 hover:text-[#8B1E24] font-medium cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteProdId(p.id)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-medium cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Borrar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8B1E24] mb-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Panel Exclusivo del Administrador · Acceso Total</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Control General de Vive Next</h1>
          <p className="text-sm text-slate-500">
            Administra socios, modifica rangos y volúmenes, sube o borra productos, valida pagos y liquida comisiones.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCycleRun}
          disabled={busyId === 'cycle'}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          {busyId === 'cycle' ? 'Calculando ciclo...' : 'Ejecutar Cierre Binario y Matching'}
        </button>
      </div>

      {banner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
            <span>{banner}</span>
          </div>
          <button type="button" onClick={() => setBanner('')} className="text-emerald-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between gap-2">
          <span>{errorBanner}</span>
          <button type="button" onClick={() => setErrorBanner('')} className="text-red-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Vive Next Brand Bar */}
      <div className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#B80D0D] via-[#8B1E24] to-[#6B0F14] text-white border border-[#7F1D1D] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-bold tracking-wide text-white">
            VIVE NEXT
          </span>
          <span className="text-amber-200/80" aria-hidden="true">·</span>
          <span className="text-xs font-medium text-amber-100">
            Salud, Liderazgo y Libertad
          </span>
        </div>
        <div className="text-xs text-red-100 font-mono-num">
          Panel Administrativo · Plan de Prosperidad 2026
        </div>
      </div>

      {/* RESUMEN + MINIPANEL PRODUCTOS */}
      {activeSection === 'resumen' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Ventas Validadas</div>
              <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
                {adminMetrics.validatedBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
              </div>
              <div className="text-xs text-[#B45309] mt-1">{adminMetrics.pendingOrders} pedidos por validar</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Catálogo Publicado</div>
              <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
                {adminMetrics.activeProducts} / {products.length}
              </div>
              <div className="text-xs text-slate-500 mt-1">Productos activos en tienda</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Retiros por Aprobar</div>
              <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
                {adminMetrics.pendingWithdrawals}
              </div>
              <div className="text-xs text-slate-500 mt-1">Solicitudes en billetera</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Socios en Red</div>
              <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">{partners.length}</div>
              <div className="text-xs text-[#15803D] mt-1">
                {partners.filter((p) => p.status === 'activo').length} activos
              </div>
            </div>
          </div>

          {renderProductMiniPanel()}
        </div>
      )}

      {/* PRODUCTOS DEDICATED */}
      {activeSection === 'productos' && renderProductMiniPanel()}

      {/* PEDIDOS Y PAGOS */}
      {activeSection === 'pedidos' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Validación y Control de Pedidos</h2>
          {orders.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              No hay pedidos registrados todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-3">Pedido</th>
                    <th className="py-2.5 px-3">Socio</th>
                    <th className="py-2.5 px-3">Pago / Referencia</th>
                    <th className="py-2.5 px-3 text-right">PV / CV</th>
                    <th className="py-2.5 px-3 text-right">Total Bs</th>
                    <th className="py-2.5 px-3 text-right">Estado</th>
                    <th className="py-2.5 px-3 text-right">Acciones Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono-num font-semibold text-slate-900">{o.orderNumber}</td>
                      <td className="py-2.5 px-3 text-slate-800">{o.partnerName}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <span className="uppercase font-medium">{o.paymentMethod}</span> · {o.paymentReference}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num">
                        {o.totalPv} PV / {o.totalCv} CV
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">
                        {o.totalBs.toLocaleString('es-BO')} Bs
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium">
                        <span
                          className={
                            o.paymentStatus === 'validado'
                              ? 'text-[#15803D]'
                              : o.paymentStatus === 'pendiente'
                              ? 'text-[#B45309]'
                              : 'text-red-600'
                          }
                        >
                          {o.paymentStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {o.paymentStatus === 'pendiente' && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === o.id}
                                onClick={() => handleOrderDecision(o, 'validado')}
                                className="px-2.5 py-1 bg-[#15803D] text-white rounded font-medium hover:bg-emerald-800 cursor-pointer"
                              >
                                Validar
                              </button>
                              <button
                                type="button"
                                disabled={busyId === o.id}
                                onClick={() => handleOrderDecision(o, 'rechazado')}
                                className="px-2.5 py-1 bg-slate-200 text-slate-800 rounded font-medium hover:bg-slate-300 cursor-pointer"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              await adminDeleteOrder(o.id, o.orderNumber);
                              setBanner(`Pedido ${o.orderNumber} eliminado del registro.`);
                            }}
                            className="p-1 text-red-600 hover:text-red-800 cursor-pointer"
                            title="Eliminar pedido"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* COMISIONES Y RETIROS */}
      {activeSection === 'comisiones' && (
        <div className="space-y-6">
          {/* Acreditar Bono Manual */}
          <form onSubmit={handleCreateManualCommission} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#8B1E24]" />
              <h2 className="text-base font-semibold text-slate-900">Acreditar Bono / Comisión Manual</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <select
                value={manualComForm.partnerId}
                onChange={(e) => setManualComForm({ ...manualComForm, partnerId: e.target.value })}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
              <select
                value={manualComForm.bonusType}
                onChange={(e) => setManualComForm({ ...manualComForm, bonusType: e.target.value as BonusType })}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                {Object.entries(BONUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                step="0.01"
                value={manualComForm.amountBs}
                onChange={(e) => setManualComForm({ ...manualComForm, amountBs: Number(e.target.value) })}
                placeholder="Monto Bs"
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono-num"
              />
              <input
                type="text"
                value={manualComForm.description}
                onChange={(e) => setManualComForm({ ...manualComForm, description: e.target.value })}
                placeholder="Motivo del bono"
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
              <button
                type="submit"
                disabled={busyId === 'manual_com'}
                className="px-4 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] cursor-pointer"
              >
                Acreditar Bono
              </button>
            </div>
          </form>

          {/* Retiros Pendientes e Historial */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Aprobación de Retiros</h2>
            {withdrawals.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No existen solicitudes de retiro registradas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-3">Socio</th>
                      <th className="py-2.5 px-3">Método</th>
                      <th className="py-2.5 px-3">Destino</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                      <th className="py-2.5 px-3 text-right">Estado</th>
                      <th className="py-2.5 px-3 text-right">Decisión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium text-slate-900">{w.partnerName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{w.method}</td>
                        <td className="py-2.5 px-3 text-slate-600">{w.destinationAccount}</td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">
                          {w.amountBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          <span
                            className={
                              w.status === 'aprobado'
                                ? 'text-[#15803D]'
                                : w.status === 'pendiente'
                                ? 'text-[#B45309]'
                                : 'text-red-600'
                            }
                          >
                            {w.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {w.status === 'pendiente' ? (
                            <div className="inline-flex gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  await reviewWithdrawal(w, 'aprobado', 'Desembolso autorizado');
                                  setBanner(`Retiro de ${w.partnerName} por ${w.amountBs.toFixed(2)} Bs aprobado.`);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#15803D] text-white rounded font-medium cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Aprobar
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await reviewWithdrawal(w, 'rechazado', 'Cuenta observada');
                                  setBanner(`Retiro de ${w.partnerName} rechazado.`);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-800 rounded font-medium cursor-pointer"
                              >
                                <XCircle className="w-3 h-3" /> Rechazar
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400">{w.reviewedBy}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Todas las Comisiones */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Todas las Comisiones Emitidas</h2>
            {commissions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                Aún no hay comisiones emitidas en el sistema.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-3">Socio</th>
                      <th className="py-2.5 px-3">Bono</th>
                      <th className="py-2.5 px-3">Detalle</th>
                      <th className="py-2.5 px-3 text-right">Monto Bs</th>
                      <th className="py-2.5 px-3 text-right">Estado</th>
                      <th className="py-2.5 px-3 text-right">Borrar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {commissions.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-medium text-slate-900">{c.partnerName}</td>
                        <td className="py-2.5 px-3 text-slate-700">{BONUS_LABELS[c.bonusType]}</td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{c.description}</td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">
                          {c.amountBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <select
                            value={c.status}
                            onChange={async (e) => {
                              const status = e.target.value as CommissionStatus;
                              await adminUpdateCommissionStatus(c.id, status);
                              setBanner(`Comisión de ${c.partnerName} actualizada a "${status}".`);
                            }}
                            className="px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="disponible">Disponible</option>
                            <option value="pagada">Pagada</option>
                            <option value="anulada">Anulada</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              await adminDeleteCommission(c.id);
                              setBanner(`Comisión de ${c.partnerName} eliminada.`);
                            }}
                            className="p-1 text-red-600 hover:text-red-800 cursor-pointer"
                            title="Eliminar comisión"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GESTIÓN TOTAL DE SOCIOS */}
      {activeSection === 'socios' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#8B1E24]" />
              <h2 className="text-base font-semibold text-slate-900">
                Gestión Total de Socios (Roles, Rangos, Volúmenes PV/CV y Eliminación)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onChangeSection('crear_afiliado')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Crear Afiliado</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-3">Socio</th>
                  <th className="py-2.5 px-3">PIN Acceso</th>
                  <th className="py-2.5 px-3">Rol</th>
                  <th className="py-2.5 px-3">Paquete</th>
                  <th className="py-2.5 px-3">Rango</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">PV / CV Equipo</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {partners.map((p) => {
                  const pinDoc = getPartnerPin(p);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{p.fullName}</div>
                        <div className="text-[11px] font-mono-num text-slate-500">{p.referralCode}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {p.id === 'vn_root' ? (
                          <span className="text-[11px] text-slate-400">Cuenta raíz</span>
                        ) : pinDoc ? (
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className={`font-mono-num font-bold tracking-wider ${
                                  pinDoc.active ? 'text-slate-900' : 'text-slate-400 line-through'
                                }`}
                              >
                                {pinDoc.pinCode}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyPin(pinDoc.pinCode, p.id)}
                                className="text-slate-400 hover:text-[#8B1E24] cursor-pointer"
                                title="Copiar PIN"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {copiedPinId === p.id && (
                                <span className="text-[10px] font-semibold text-[#15803D]">Copiado</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px]">
                              <button
                                type="button"
                                onClick={() => {
                                  setPinEditorPartner(p);
                                  setCustomPinInput(pinDoc.pinCode);
                                }}
                                className="text-slate-600 hover:text-[#8B1E24] font-medium cursor-pointer"
                              >
                                Cambiar
                              </button>
                              <button
                                type="button"
                                onClick={() => adminToggleAffiliatePin(pinDoc, !pinDoc.active)}
                                className="text-slate-600 hover:text-[#8B1E24] font-medium cursor-pointer"
                              >
                                {pinDoc.active ? 'Desactivar' : 'Activar'}
                              </button>
                              {pinDoc.claimedByUid && (
                                <button
                                  type="button"
                                  onClick={() => adminResetAffiliatePinClaim(pinDoc)}
                                  className="inline-flex items-center gap-0.5 text-[#B45309] hover:underline font-medium cursor-pointer"
                                  title="Permitir vincular a otra cuenta de Google"
                                >
                                  <LockOpen className="w-2.5 h-2.5" />
                                  Liberar
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === `pin_${p.id}`}
                            onClick={() => handleAssignPin(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded-md text-[11px] font-medium text-slate-700 hover:border-[#8B1E24] hover:text-[#8B1E24] whitespace-nowrap cursor-pointer"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>{busyId === `pin_${p.id}` ? 'Creando...' : 'Generar PIN'}</span>
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={p.role}
                          onChange={(e) => adminUpdatePartner(p.id, { role: e.target.value as UserRole })}
                          className="px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                        >
                          <option value="socio">Socio</option>
                          <option value="lider">Líder</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={p.packageTier}
                          onChange={(e) => adminUpdatePartner(p.id, { packageTier: e.target.value as PackageTier })}
                          className="px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                        >
                          {Object.values(AFFILIATION_PACKAGES).map((pkg) => (
                            <option key={pkg.id} value={pkg.id}>
                              {pkg.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={p.rankId}
                          onChange={(e) => adminUpdatePartner(p.id, { rankId: e.target.value as RankId })}
                          className="px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                        >
                          {RANK_LADDER.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={p.status}
                          onChange={(e) => adminUpdatePartner(p.id, { status: e.target.value as PartnerStatus })}
                          className="px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                        >
                          <option value="activo">Activo</option>
                          <option value="pendiente">Pendiente</option>
                          <option value="inactivo">Inactivo</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-900">
                        {p.personalPv} PV · {p.teamCv.toLocaleString('es-BO')} CV
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {confirmDeletePartnerId === p.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await adminDeletePartner(p.id, p.fullName);
                                setConfirmDeletePartnerId(null);
                                setBanner(`Socio "${p.fullName}" eliminado de la red.`);
                              }}
                              className="px-2 py-1 bg-red-600 text-white rounded text-[11px] font-semibold cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePartnerId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[11px] cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openPartnerEdit(p)}
                              className="text-slate-700 hover:text-[#8B1E24] font-medium cursor-pointer"
                            >
                              Editar Todo
                            </button>
                            {p.id !== 'vn_root' && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePartnerId(p.id)}
                                className="text-red-600 hover:text-red-800 cursor-pointer"
                                title="Eliminar socio"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREAR AFILIADO EN BASE DE DATOS */}
      {activeSection === 'crear_afiliado' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-5 h-5 text-[#8B1E24]" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Crear Nuevo Afiliado en Base de Datos
                  </h2>
                  <p className="text-xs text-slate-500">
                    Registra afiliados directamente en Firestore con patrocinador, pierna binaria, paquete, rango e información privada.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChangeSection('socios')}
                className="px-3.5 py-2 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ver Lista de Afiliados ({partners.length})
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-6">
              {/* Bloque 1: Identidad, Correo de Google y Red */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-900">1. Identidad, Correo de Google y PIN de Acceso</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Nombre completo *</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      value={newPartnerForm.fullName}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, fullName: e.target.value })}
                      placeholder="Ej. Valeria Mendoza Rojas"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#8B1E24]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Correo de Google del afiliado *</label>
                    <input
                      type="email"
                      required
                      maxLength={200}
                      value={newPartnerForm.email}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, email: e.target.value })}
                      placeholder="afiliado@gmail.com"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#8B1E24]"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Se guarda en su ficha privada en Firestore.
                    </p>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      PIN de Acceso Directo *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        minLength={4}
                        maxLength={16}
                        value={newPartnerForm.accessPin}
                        onChange={(e) => setNewPartnerForm({ ...newPartnerForm, accessPin: e.target.value.toUpperCase() })}
                        placeholder="Ej. 482915"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono-num font-semibold tracking-wider focus:outline-none focus:border-[#8B1E24]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setNewPartnerForm((prev) => ({
                            ...prev,
                            accessPin: generateRandomAffiliatePin(),
                          }))
                        }
                        className="px-3 py-2 border border-slate-200 rounded-lg text-slate-700 hover:border-[#8B1E24] hover:text-[#8B1E24] whitespace-nowrap shrink-0 cursor-pointer"
                        title="Generar nuevo PIN"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      El afiliado entrará directo poniendo solo este PIN (sin abrir Google).
                    </p>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Código de Referido <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={newPartnerForm.referralCode}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, referralCode: e.target.value })}
                      placeholder="Auto-generado si se deja vacío"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono-num focus:outline-none focus:border-[#8B1E24]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Patrocinador Directo (Unilevel)</label>
                    <select
                      value={newPartnerForm.sponsorId}
                      onChange={(e) => {
                        const nextSponsor = e.target.value;
                        setNewPartnerForm((prev) => ({
                          ...prev,
                          sponsorId: nextSponsor,
                          binaryParentId: nextSponsor,
                        }));
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#8B1E24]"
                    >
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName} ({p.referralCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Nodo Padre Binario</label>
                    <select
                      value={newPartnerForm.binaryParentId}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, binaryParentId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#8B1E24]"
                    >
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName} ({p.referralCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Pierna Binaria</label>
                    <select
                      value={newPartnerForm.binaryLeg}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, binaryLeg: e.target.value as BinaryLeg })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#8B1E24]"
                    >
                      <option value="left">Rama Izquierda</option>
                      <option value="right">Rama Derecha</option>
                    </select>
                    {binarySlotOccupant ? (
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[#B45309]">
                        <span>Ocupada por {binarySlotOccupant.fullName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const leg = newPartnerForm.binaryLeg === 'right' ? 'right' : 'left';
                            const nextId = findNextAvailableBinaryParent(newPartnerForm.binaryParentId, leg);
                            setNewPartnerForm((prev) => ({ ...prev, binaryParentId: nextId }));
                          }}
                          className="font-semibold text-[#8B1E24] hover:underline whitespace-nowrap cursor-pointer"
                        >
                          Ir al nodo libre
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1.5 text-[11px] text-[#15803D]">Posición disponible</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bloque 2: Plan, Rango y Volúmenes */}
              <div className="pt-5 border-t border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-900">2. Paquete, Rango y Volúmenes Iniciales</div>
                  <button
                    type="button"
                    onClick={() => {
                      const pkg = AFFILIATION_PACKAGES[newPartnerForm.packageTier];
                      setNewPartnerForm((prev) => ({
                        ...prev,
                        personalPv: pkg.pv,
                        personalCv: pkg.cv,
                      }));
                    }}
                    className="text-xs font-medium text-[#8B1E24] hover:underline text-left cursor-pointer"
                  >
                    Cargar PV/CV del paquete seleccionado ({AFFILIATION_PACKAGES[newPartnerForm.packageTier].pv} PV /{' '}
                    {AFFILIATION_PACKAGES[newPartnerForm.packageTier].cv} CV)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Paquete de Afiliación</label>
                    <select
                      value={newPartnerForm.packageTier}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, packageTier: e.target.value as PackageTier })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#8B1E24]"
                    >
                      {Object.values(AFFILIATION_PACKAGES).map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} ({pkg.pv} PV)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Rango Inicial</label>
                    <select
                      value={newPartnerForm.rankId}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, rankId: e.target.value as RankId })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#8B1E24]"
                    >
                      {RANK_LADDER.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Rol</label>
                    <select
                      value={newPartnerForm.role}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, role: e.target.value as UserRole })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#8B1E24]"
                    >
                      <option value="socio">Socio</option>
                      <option value="lider">Líder</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Estado</label>
                    <select
                      value={newPartnerForm.status}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, status: e.target.value as PartnerStatus })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#8B1E24]"
                    >
                      <option value="activo">Activo</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">PV Personal</label>
                    <input
                      type="number"
                      min={0}
                      value={newPartnerForm.personalPv}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, personalPv: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">CV Personal</label>
                    <input
                      type="number"
                      min={0}
                      value={newPartnerForm.personalCv}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, personalCv: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono-num"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-end pb-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPartnerForm.firstWeekPurchase}
                        onChange={(e) =>
                          setNewPartnerForm({ ...newPartnerForm, firstWeekPurchase: e.target.checked })
                        }
                        className="accent-[#8B1E24]"
                      />
                      <span>Califica para Bono 5 Binario Progresivo (compra en 1ª semana)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Bloque 3: Contacto y Datos Bancarios */}
              <div className="pt-5 border-t border-slate-100 space-y-3">
                <div className="text-xs font-semibold text-slate-900">3. Contacto y Cuenta Bancaria (Información Privada)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Teléfono / WhatsApp</label>
                    <input
                      type="text"
                      maxLength={40}
                      value={newPartnerForm.phone}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, phone: e.target.value })}
                      placeholder="+591 7..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Cédula de Identidad (CI)</label>
                    <input
                      type="text"
                      maxLength={40}
                      value={newPartnerForm.ciNumber}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, ciNumber: e.target.value })}
                      placeholder="Ej. 6281940 SC"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Ciudad</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={newPartnerForm.city}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, city: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Banco</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={newPartnerForm.bankName}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, bankName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Cuenta Bancaria / QR</label>
                    <input
                      type="text"
                      maxLength={64}
                      value={newPartnerForm.bankAccount}
                      onChange={(e) => setNewPartnerForm({ ...newPartnerForm, bankAccount: e.target.value })}
                      placeholder="Ej. 4010-123456"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono-num"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {AFFILIATION_PACKAGES[newPartnerForm.packageTier].name} ·{' '}
                  {AFFILIATION_PACKAGES[newPartnerForm.packageTier].accessSummary}
                </div>
                <button
                  type="submit"
                  disabled={busyId === 'create_partner'}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  {busyId === 'create_partner' ? 'Guardando afiliado...' : 'Guardar Afiliado en Base de Datos'}
                </button>
              </div>
            </form>
          </div>

          {/* Tabla resumen de afiliados registrados */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Afiliados Activos en Base de Datos ({partners.filter((p) => p.id !== 'vn_root').length})
            </h3>
            {partners.filter((p) => p.id !== 'vn_root').length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                Aún no hay afiliados creados bajo la sede raíz. Usa el formulario superior para registrar el primero.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-3">Afiliado</th>
                      <th className="py-2.5 px-3">PIN Acceso</th>
                      <th className="py-2.5 px-3">Patrocinador</th>
                      <th className="py-2.5 px-3">Pierna Binaria</th>
                      <th className="py-2.5 px-3">Paquete</th>
                      <th className="py-2.5 px-3">Rango</th>
                      <th className="py-2.5 px-3 text-right">PV / CV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {partners
                      .filter((p) => p.id !== 'vn_root')
                      .map((p) => {
                        const sponsor = partners.find((s) => s.id === p.sponsorId);
                        const pinDoc = getPartnerPin(p);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{p.fullName}</div>
                              <div className="text-[11px] font-mono-num text-slate-500">{p.referralCode}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              {pinDoc ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="font-mono-num font-bold text-slate-900 tracking-wider">
                                    {pinDoc.pinCode}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPin(pinDoc.pinCode, `new_${p.id}`)}
                                    className="text-slate-400 hover:text-[#8B1E24] cursor-pointer"
                                    title="Copiar PIN"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  {copiedPinId === `new_${p.id}` && (
                                    <span className="text-[10px] font-semibold text-[#15803D]">Copiado</span>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAssignPin(p)}
                                  className="text-[11px] font-medium text-[#8B1E24] hover:underline cursor-pointer"
                                >
                                  + Generar PIN
                                </button>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {sponsor ? sponsor.fullName : p.sponsorId || 'Sede Raíz'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {p.binaryLeg === 'left' ? 'Izquierda' : p.binaryLeg === 'right' ? 'Derecha' : 'Raíz'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {AFFILIATION_PACKAGES[p.packageTier].name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{RANK_MAP[p.rankId].name}</td>
                            <td className="py-2.5 px-3 text-right font-mono-num text-slate-900">
                              {p.personalPv} PV · {p.personalCv} CV
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIGURACIÓN DEL PLAN Y REINICIO DE BASE DE DATOS */}
      {activeSection === 'config' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveConfig} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#8B1E24]" />
              <h2 className="text-base font-semibold text-slate-900">Parámetros del Plan de Compensación</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tasa Conversión (Bs por 1 CV)</label>
                <input
                  type="number"
                  step="0.5"
                  value={cfgForm.cvToBsRate}
                  onChange={(e) => setCfgForm({ ...cfgForm, cvToBsRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Recompra Mínima Activo (PV/mes)</label>
                <input
                  type="number"
                  value={cfgForm.minMonthlyPv}
                  onChange={(e) => setCfgForm({ ...cfgForm, minMonthlyPv: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Límite Máximo de Reparto (%)</label>
                <input
                  type="number"
                  value={cfgForm.maxPayoutRatioPercent}
                  onChange={(e) => setCfgForm({ ...cfgForm, maxPayoutRatioPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Equilibrio Binario Mínimo (%)</label>
                <input
                  type="number"
                  value={cfgForm.binaryEquilibriumPercent}
                  onChange={(e) => setCfgForm({ ...cfgForm, binaryEquilibriumPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Consumo Real Mínimo (Bs/mes)</label>
                <input
                  type="number"
                  value={cfgForm.minRealConsumptionBs}
                  onChange={(e) => setCfgForm({ ...cfgForm, minRealConsumptionBs: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Acumulación Binaria (Días)</label>
                <input
                  type="number"
                  value={cfgForm.accumulationMaxDays}
                  onChange={(e) => setCfgForm({ ...cfgForm, accumulationMaxDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busyId === 'config'}
                className="px-4 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] disabled:opacity-50 cursor-pointer"
              >
                Guardar Configuración Oficial
              </button>
            </div>
          </form>

          {/* Zona Administrativa: Reiniciar Base de Datos */}
          <div className="bg-white border border-red-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-900">
                  Reiniciar Base de Datos (Borrar Todos los Datos)
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Elimina permanentemente todos los afiliados registrados, productos del Marketplace, pedidos, comisiones,
                  solicitudes de retiro y bitácora previa, dejando únicamente la sede raíz corporativa y la configuración
                  oficial en cero para operar desde limpio.
                </p>
              </div>
            </div>

            {confirmPurgeDb ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-medium text-red-900">
                  Esta acción borrará toda la información actual de Firestore. ¿Confirmas reiniciar el sistema en cero?
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === 'purge'}
                    onClick={handlePurgeDatabase}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-700 text-white text-xs font-semibold rounded-lg hover:bg-red-800 disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {busyId === 'purge' ? 'Borrando datos...' : 'Sí, Borrar Todo y Reiniciar'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === 'purge'}
                    onClick={() => setConfirmPurgeDb(false)}
                    className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmPurgeDb(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Vaciar Base de Datos y Reiniciar en Limpio
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AUDITORÍA */}
      {activeSection === 'auditoria' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-[#8B1E24]" />
            <h2 className="text-base font-semibold text-slate-900">Bitácora Inmutable de Auditoría</h2>
          </div>
          {auditLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              Sin eventos registrados todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-3">Acción</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Colección / ID</th>
                    <th className="py-2.5 px-3">Resumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono-num font-semibold text-slate-900">{log.action}</td>
                      <td className="py-2.5 px-3 text-slate-600">{log.actorEmail}</td>
                      <td className="py-2.5 px-3 font-mono-num text-slate-500">
                        {log.targetCollection}/{log.targetId}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL EDITAR TODO EL SOCIO */}
      {editingPartner && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Editar Socio: {editingPartner.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPartner(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSavePartnerEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nombre completo</label>
                  <input
                    type="text"
                    required
                    value={partnerEditForm.fullName}
                    onChange={(e) => setPartnerEditForm({ ...partnerEditForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Correo de Google</label>
                  <input
                    type="email"
                    maxLength={200}
                    value={partnerEditEmail}
                    onChange={(e) => setPartnerEditEmail(e.target.value)}
                    placeholder="afiliado@gmail.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">PV Personal</label>
                  <input
                    type="number"
                    min={0}
                    value={partnerEditForm.personalPv}
                    onChange={(e) => setPartnerEditForm({ ...partnerEditForm, personalPv: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">CV Personal</label>
                  <input
                    type="number"
                    min={0}
                    value={partnerEditForm.personalCv}
                    onChange={(e) => setPartnerEditForm({ ...partnerEditForm, personalCv: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">CV Rama Izquierda</label>
                  <input
                    type="number"
                    min={0}
                    value={partnerEditForm.leftBranchCv}
                    onChange={(e) => setPartnerEditForm({ ...partnerEditForm, leftBranchCv: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">CV Rama Derecha</label>
                  <input
                    type="number"
                    min={0}
                    value={partnerEditForm.rightBranchCv}
                    onChange={(e) => setPartnerEditForm({ ...partnerEditForm, rightBranchCv: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">CV Total de Equipo</label>
                  <input
                    type="number"
                    min={0}
                    value={partnerEditForm.teamCv}
                    onChange={(e) => setPartnerEditForm({ ...partnerEditForm, teamCv: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Rango ({RANK_MAP[partnerEditForm.rankId].name})</label>
                  <select
                    value={partnerEditForm.rankId}
                    onChange={(e) => setPartnerEditForm({ ...partnerEditForm, rankId: e.target.value as RankId })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {RANK_LADDER.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    checked={partnerEditForm.firstWeekPurchase}
                    onChange={(e) =>
                      setPartnerEditForm({ ...partnerEditForm, firstWeekPurchase: e.target.checked })
                    }
                    className="accent-[#8B1E24]"
                  />
                  <span>Califica para Bono 5 Binario Progresivo (compra en 1ª semana)</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPartner(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busyId === editingPartner.id}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#8B1E24] rounded-lg hover:bg-[#73181D] cursor-pointer"
                >
                  Guardar Modificaciones
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pinEditorPartner && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">PIN de Acceso · {pinEditorPartner.fullName}</h3>
                <p className="text-[11px] text-slate-500 font-mono-num">{pinEditorPartner.referralCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setPinEditorPartner(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <label className="block font-medium text-slate-700">Nuevo PIN (4 a 16 caracteres)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  minLength={4}
                  maxLength={16}
                  value={customPinInput}
                  onChange={(e) => setCustomPinInput(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono-num font-bold tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setCustomPinInput(generateRandomAffiliatePin())}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-slate-700 hover:border-[#8B1E24] cursor-pointer"
                  title="Generar aleatorio"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPinEditorPartner(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyId === `pin_${pinEditorPartner.id}`}
                onClick={() => handleAssignPin(pinEditorPartner, customPinInput)}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#8B1E24] rounded-lg hover:bg-[#73181D] disabled:opacity-50 cursor-pointer"
              >
                {busyId === `pin_${pinEditorPartner.id}` ? 'Guardando...' : 'Guardar PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
