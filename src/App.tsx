import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  Award,
  BarChart3,
  ClipboardList,
  FileCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PackagePlus,
  Settings,
  Shield,
  ShoppingBag,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { auth, testConnection } from './firebase';
import {
  ensureCleanProductionDatabase,
  isUserBootstrappedAdmin,
  registerPartnerNode,
  subscribeAffiliatePins,
  subscribeAuditLogs,
  subscribeCommissions,
  subscribeCommissionsForPartner,
  subscribeOrders,
  subscribeOrdersForPartner,
  subscribePartners,
  subscribePartnersForPin,
  subscribePlanConfig,
  subscribeProducts,
  subscribeWithdrawals,
  subscribeWithdrawalsForPartner,
  verifyAffiliatePinDirect,
  verifyAndClaimAffiliatePin,
} from './services/firestoreService';
import type {
  AffiliatePin,
  AuditLog,
  BinaryLeg,
  CartItem,
  Commission,
  Order,
  PackageTier,
  Partner,
  PlanConfig,
  Product,
  Withdrawal,
} from './types/vivenext';
import { AuthGate, type LoginAccessMode } from './components/AuthGate';
import { DashboardReportsModule } from './components/DashboardReportsModule';
import { NetworkModule } from './components/NetworkModule';
import { CompensationModule } from './components/CompensationModule';
import { WalletModule } from './components/WalletModule';
import { StoreModule } from './components/StoreModule';
import { AdminModule, type AdminSection } from './components/AdminModule';
import { ErrorBoundary } from './components/ErrorBoundary';

type AffiliateModule = 'dashboard' | 'network' | 'compensation' | 'wallet' | 'store';

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [initializingDb, setInitializingDb] = useState(false);

  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [affiliatePins, setAffiliatePins] = useState<AffiliatePin[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [loginMode, setLoginMode] = useState<LoginAccessMode | null>(() => {
    try {
      const saved = sessionStorage.getItem('vn_login_mode');
      return saved === 'admin' || saved === 'affiliate' ? saved : null;
    } catch {
      return null;
    }
  });
  const [pinPartnerId, setPinPartnerId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('vn_pin_partner_id');
    } catch {
      return null;
    }
  });
  const [pinHash, setPinHash] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('vn_pin_hash');
    } catch {
      return null;
    }
  });
  const [pinClaimBusy, setPinClaimBusy] = useState(false);
  const [loginBannerError, setLoginBannerError] = useState('');
  const [affiliateTab, setAffiliateTab] = useState<AffiliateModule>('dashboard');
  const [adminSection, setAdminSection] = useState<AdminSection>('resumen');
  const [adminViewMode, setAdminViewMode] = useState<
    'control' | 'marketplace' | 'reports' | 'network' | 'compensation'
  >('control');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleSetPinSession = (partnerId: string | null, hash: string | null) => {
    setPinPartnerId(partnerId);
    setPinHash(hash);
    try {
      if (partnerId) sessionStorage.setItem('vn_pin_partner_id', partnerId);
      else sessionStorage.removeItem('vn_pin_partner_id');
      if (hash) sessionStorage.setItem('vn_pin_hash', hash);
      else sessionStorage.removeItem('vn_pin_hash');
    } catch {
      // Ignore storage failures
    }
  };

  const handleSelectLoginMode = (mode: LoginAccessMode) => {
    setLoginMode(mode);
    setLoginBannerError('');
    handleSetPinSession(null, null);
    try {
      sessionStorage.setItem('vn_login_mode', mode);
    } catch {
      // Ignore storage failures
    }
  };

  const handleSignOut = async () => {
    try {
      sessionStorage.removeItem('vn_login_mode');
      sessionStorage.removeItem('vn_pin_partner_id');
      sessionStorage.removeItem('vn_pin_hash');
    } catch {
      // Ignore storage failures
    }
    setLoginMode(null);
    setPinPartnerId(null);
    setPinHash(null);
    setLoginBannerError('');
    if (auth.currentUser) {
      await signOut(auth);
    }
  };

  const handleLoginWithPin = async (rawPin: string) => {
    setLoginBannerError('');
    setPinClaimBusy(true);
    try {
      const activeUser = auth.currentUser;
      if (activeUser) {
        setLoginMode('affiliate');
        try {
          sessionStorage.setItem('vn_login_mode', 'affiliate');
        } catch {
          // Ignore storage failures
        }
        const userIsBootAdmin = isUserBootstrappedAdmin(activeUser.email, activeUser.emailVerified);
        const matched = await verifyAndClaimAffiliatePin(rawPin, activeUser.uid, userIsBootAdmin);
        handleSetPinSession(matched.partnerId, null);
      } else {
        // Direct PIN-only affiliate entry without opening any Google popup
        const matched = await verifyAffiliatePinDirect(rawPin);
        setDataLoaded(false);
        setLoginMode('affiliate');
        try {
          sessionStorage.setItem('vn_login_mode', 'affiliate');
        } catch {
          // Ignore storage failures
        }
        handleSetPinSession(matched.partnerId, matched.pinHash);
      }
    } finally {
      setPinClaimBusy(false);
    }
  };

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const isBootAdmin = useMemo(
    () => isUserBootstrappedAdmin(user?.email, user?.emailVerified),
    [user]
  );

  // Public Marketplace active products subscription (for pre-login landing & storefront)
  useEffect(() => {
    const unsubProducts = subscribeProducts(isBootAdmin, setProducts);
    return () => unsubProducts();
  }, [isBootAdmin]);

  useEffect(() => {
    const isDirectPinSession = Boolean(!user && pinPartnerId && pinHash);
    if (!user && !isDirectPinSession) {
      setPartners([]);
      setOrders([]);
      setCommissions([]);
      setWithdrawals([]);
      setAuditLogs([]);
      setAffiliatePins([]);
      setDataLoaded(false);
      return;
    }

    if (isDirectPinSession && pinPartnerId) {
      const unsubs = [
        subscribePartnersForPin(pinPartnerId, (list) => {
          setPartners(list);
          setDataLoaded(true);
        }),
        subscribeOrdersForPartner(pinPartnerId, setOrders),
        subscribeCommissionsForPartner(pinPartnerId, setCommissions),
        subscribeWithdrawalsForPartner(pinPartnerId, setWithdrawals),
        subscribePlanConfig(setPlanConfig),
      ];
      return () => {
        unsubs.forEach((u) => u());
      };
    }

    if (!user) return;

    let cancelled = false;
    const init = async () => {
      if (isBootAdmin) {
        setInitializingDb(true);
        try {
          await ensureCleanProductionDatabase(
            user.uid,
            user.email || 'admin@vivenext.bo',
            user.displayName || 'Dirección Vive Next'
          );
        } finally {
          if (!cancelled) setInitializingDb(false);
        }
      }
    };
    init();

    const unsubs = [
      subscribePartners(user.uid, isBootAdmin, (list) => {
        setPartners(list);
        setDataLoaded(true);
      }),
      subscribeOrders(user.uid, isBootAdmin, setOrders),
      subscribeCommissions(user.uid, isBootAdmin, setCommissions),
      subscribeWithdrawals(user.uid, isBootAdmin, setWithdrawals),
      subscribePlanConfig(setPlanConfig),
    ];

    if (isBootAdmin) {
      unsubs.push(subscribeAuditLogs(setAuditLogs));
      unsubs.push(subscribeAffiliatePins(setAffiliatePins));
    }

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [user, isBootAdmin, pinPartnerId, pinHash]);

  const currentPartner = useMemo(() => {
    if (!user) return null;
    return (
      partners.find((p) => p.id === user.uid) ||
      (isBootAdmin ? partners.find((p) => p.id === 'vn_root') : undefined) ||
      partners.find((p) => p.ownerUid === user.uid) ||
      null
    );
  }, [partners, user, isBootAdmin]);

  const effectiveLoginMode: LoginAccessMode = loginMode ?? (isBootAdmin ? 'admin' : 'affiliate');
  const isAdmin = Boolean(user && isBootAdmin && effectiveLoginMode === 'admin');
  const hasDirectPinSession = Boolean(!user && pinPartnerId && pinHash);
  const hasActiveSession = Boolean(user || hasDirectPinSession);

  const handleCompleteOnboarding = async (payload: {
    fullName: string;
    sponsorId: string;
    binaryLeg: BinaryLeg;
    packageTier: PackageTier;
    phone: string;
    ciNumber: string;
    city: string;
    bankName: string;
    bankAccount: string;
  }) => {
    if (!user) return;
    await registerPartnerNode({
      id: user.uid,
      ownerUid: user.uid,
      fullName: payload.fullName,
      sponsorId: payload.sponsorId,
      binaryParentId: payload.sponsorId,
      binaryLeg: payload.binaryLeg,
      packageTier: payload.packageTier,
      uplineUids: [user.uid],
      email: user.email || '',
      phone: payload.phone,
      ciNumber: payload.ciNumber,
      city: payload.city,
      bankName: payload.bankName,
      bankAccount: payload.bankAccount,
    });
  };

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  if (!authReady || pinClaimBusy || (hasActiveSession && (!dataLoaded || initializingDb))) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="text-base font-display font-bold text-slate-900">Vive Next</div>
          <div className="text-xs text-slate-500">Cargando oficina virtual y Marketplace...</div>
        </div>
      </div>
    );
  }

  if (!user && !hasDirectPinSession) {
    return (
      <AuthGate
        mode="login"
        marketplaceProducts={products}
        initialLoginError={loginBannerError}
        onSelectLoginMode={handleSelectLoginMode}
        onLoginWithPin={handleLoginWithPin}
      />
    );
  }

  if (user && !isBootAdmin && loginMode === 'admin') {
    return (
      <AuthGate
        mode="admin_denied"
        userEmail={user.email || ''}
        onSwitchToAffiliateMode={() => handleSelectLoginMode('affiliate')}
        onSignOut={handleSignOut}
      />
    );
  }

  const adminRootPartner: Partner = currentPartner || {
    id: 'vn_root',
    ownerUid: user?.uid || 'vn_root',
    fullName: user?.displayName || 'Dirección Vive Next',
    referralCode: 'VN-VISION-01',
    sponsorId: '',
    binaryParentId: '',
    binaryLeg: 'root',
    packageTier: 'elite',
    rankId: 'consultor_elite',
    status: 'activo',
    role: 'admin',
    personalPv: 0,
    personalCv: 0,
    leftBranchCv: 0,
    rightBranchCv: 0,
    teamCv: 0,
    directCount: 0,
    activeLines: 0,
    firstWeekPurchase: false,
    uplineUids: [user?.uid || 'vn_root'],
    joinedAt: null,
    updatedAt: null,
  };

  const pinMatchedPartner = pinPartnerId
    ? partners.find((p) => p.id === pinPartnerId) || null
    : null;

  const effectiveAffiliatePartner: Partner | null =
    pinMatchedPartner || currentPartner || (isBootAdmin ? adminRootPartner : null);

  if (hasDirectPinSession && !effectiveAffiliatePartner) {
    return (
      <AuthGate
        mode="login"
        marketplaceProducts={products}
        initialLoginError="La ficha de afiliado asociada a este PIN no está disponible. Verifica con el Administrador."
        onSelectLoginMode={handleSelectLoginMode}
        onLoginWithPin={handleLoginWithPin}
      />
    );
  }

  if (user && !isAdmin && !effectiveAffiliatePartner) {
    return (
      <AuthGate
        mode="onboarding"
        userEmail={user.email || ''}
        userName={user.displayName || ''}
        userUid={user.uid}
        onSignOut={handleSignOut}
        onLoginWithPin={handleLoginWithPin}
        onCompleteOnboarding={handleCompleteOnboarding}
      />
    );
  }

  const affiliateOrders =
    isBootAdmin && !isAdmin && effectiveAffiliatePartner
      ? orders.filter((o) => o.partnerId === effectiveAffiliatePartner.id)
      : orders;
  const affiliateCommissions =
    isBootAdmin && !isAdmin && effectiveAffiliatePartner
      ? commissions.filter((c) => c.partnerId === effectiveAffiliatePartner.id)
      : commissions;
  const affiliateWithdrawals =
    isBootAdmin && !isAdmin && effectiveAffiliatePartner
      ? withdrawals.filter((w) => w.partnerId === effectiveAffiliatePartner.id)
      : withdrawals;

  const affiliateNavItems: Array<{
    id: AffiliateModule;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: 'Mi Resumen y Reportes', icon: BarChart3 },
    { id: 'network', label: 'Mi Red de Afiliados', icon: Network },
    { id: 'compensation', label: 'Rangos y Bonos', icon: Award },
    { id: 'wallet', label: 'Mi Billetera', icon: Wallet },
    { id: 'store', label: 'Marketplace', icon: ShoppingBag },
  ];

  const adminNavItems: Array<{
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    active: boolean;
  }> = [
    {
      key: 'resumen',
      label: 'Control y Minipanel',
      icon: LayoutDashboard,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('resumen');
      },
      active: adminViewMode === 'control' && adminSection === 'resumen',
    },
    {
      key: 'productos',
      label: 'Subir Productos (Marketplace)',
      icon: PackagePlus,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('productos');
      },
      active: adminViewMode === 'control' && adminSection === 'productos',
    },
    {
      key: 'marketplace',
      label: 'Marketplace (Vista)',
      icon: ShoppingBag,
      onClick: () => setAdminViewMode('marketplace'),
      active: adminViewMode === 'marketplace',
    },
    {
      key: 'pedidos',
      label: 'Pedidos y Pagos',
      icon: FileCheck,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('pedidos');
      },
      active: adminViewMode === 'control' && adminSection === 'pedidos',
    },
    {
      key: 'comisiones',
      label: 'Comisiones y Retiros',
      icon: Wallet,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('comisiones');
      },
      active: adminViewMode === 'control' && adminSection === 'comisiones',
    },
    {
      key: 'socios',
      label: 'Gestión de Afiliados',
      icon: Users,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('socios');
      },
      active: adminViewMode === 'control' && adminSection === 'socios',
    },
    {
      key: 'crear_afiliado',
      label: 'Crear Afiliado',
      icon: UserPlus,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('crear_afiliado');
      },
      active: adminViewMode === 'control' && adminSection === 'crear_afiliado',
    },
    {
      key: 'network',
      label: 'Árbol Completo de Red',
      icon: Network,
      onClick: () => setAdminViewMode('network'),
      active: adminViewMode === 'network',
    },
    {
      key: 'reports',
      label: 'Reportes PDF / Excel',
      icon: BarChart3,
      onClick: () => setAdminViewMode('reports'),
      active: adminViewMode === 'reports',
    },
    {
      key: 'config',
      label: 'Parámetros del Plan',
      icon: Settings,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('config');
      },
      active: adminViewMode === 'control' && adminSection === 'config',
    },
    {
      key: 'auditoria',
      label: 'Auditoría',
      icon: ClipboardList,
      onClick: () => {
        setAdminViewMode('control');
        setAdminSection('auditoria');
      },
      active: adminViewMode === 'control' && adminSection === 'auditoria',
    },
  ];

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const renderSidebarBody = (closeMobile?: () => void) => (
    <>
      <div
        className={`h-16 px-6 flex items-center justify-between border-b ${
          isAdmin
            ? 'bg-[#8B1E24] text-white border-[#73181D]'
            : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap">
          Vive Next
        </span>
        {closeMobile && (
          <button
            type="button"
            onClick={closeMobile}
            className={`p-1 cursor-pointer ${isAdmin ? 'text-white/80' : 'text-slate-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {isAdmin ? (
          adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  item.onClick();
                  if (closeMobile) closeMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  item.active
                    ? 'bg-[#8B1E24] text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })
        ) : (
          affiliateNavItems.map((item) => {
            const Icon = item.icon;
            const active = affiliateTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAffiliateTab(item.id);
                  if (closeMobile) closeMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#8B1E24] text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })
        )}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="text-xs">
          <div className="font-semibold text-slate-900 truncate">
            {isAdmin ? user?.displayName || adminRootPartner.fullName : effectiveAffiliatePartner!.fullName}
          </div>
          <div className="text-slate-500 truncate">
            {isAdmin
              ? 'Administrador · Acceso exclusivo'
              : user
                ? 'Afiliado · Oficina virtual'
                : 'Afiliado · Acceso directo con PIN'}
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar Sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        {renderSidebarBody()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 bg-white h-full flex flex-col border-r border-slate-200 z-10">
            {renderSidebarBody(() => setMobileMenuOpen(false))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: 3 zones */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 cursor-pointer"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs text-slate-500 truncate">
              <span>{isAdmin ? 'Panel de Administrador' : 'Panel de Afiliado'}</span>
              <span className="mx-1.5">/</span>
              <span className="font-semibold text-slate-900">
                {isAdmin
                  ? adminNavItems.find((i) => i.active)?.label || 'Administración'
                  : affiliateNavItems.find((i) => i.id === affiliateTab)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setAdminViewMode('control');
                  setAdminSection('productos');
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-[#8B1E24] rounded-lg hover:bg-[#73181D] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Subir Productos</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAffiliateTab('store')}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#8B1E24]" />
                <span>Marketplace ({cartCount})</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-5">
          {isAdmin ? (
            <>
              {adminViewMode === 'control' && (
                <AdminModule
                  activeSection={adminSection}
                  onChangeSection={setAdminSection}
                  partners={partners}
                  affiliatePins={affiliatePins}
                  products={products}
                  orders={orders}
                  commissions={commissions}
                  withdrawals={withdrawals}
                  planConfig={planConfig}
                  auditLogs={auditLogs}
                  adminUser={{
                    uid: user!.uid,
                    email: user!.email || 'admin@vivenext.bo',
                    name: user!.displayName || 'Dirección Vive Next',
                  }}
                />
              )}
              {adminViewMode === 'marketplace' && (
                <StoreModule
                  currentPartner={adminRootPartner}
                  products={products}
                  orders={orders}
                  cart={cart}
                  onAddToCart={handleAddToCart}
                  onUpdateQty={handleUpdateQty}
                  onRemoveFromCart={(id) => setCart((prev) => prev.filter((c) => c.product.id !== id))}
                  onClearCart={() => setCart([])}
                  isAdminView
                  onOpenAdminProductUpload={() => {
                    setAdminViewMode('control');
                    setAdminSection('productos');
                  }}
                />
              )}
              {adminViewMode === 'network' && (
                <NetworkModule
                  currentPartner={adminRootPartner}
                  partners={partners}
                  currentUserUid={user!.uid}
                  isAdmin
                />
              )}
              {adminViewMode === 'reports' && (
                <DashboardReportsModule
                  currentPartner={adminRootPartner}
                  partners={partners}
                  orders={orders}
                  commissions={commissions}
                  planConfig={planConfig}
                  onNavigate={(tab) => {
                    if (tab === 'network') setAdminViewMode('network');
                    else if (tab === 'compensation') setAdminViewMode('compensation');
                    else if (tab === 'store') setAdminViewMode('marketplace');
                    else {
                      setAdminViewMode('control');
                      setAdminSection('resumen');
                    }
                  }}
                />
              )}
              {adminViewMode === 'compensation' && (
                <CompensationModule currentPartner={adminRootPartner} planConfig={planConfig} />
              )}
            </>
          ) : (
            <>
              {affiliateTab === 'dashboard' && (
                <DashboardReportsModule
                  currentPartner={effectiveAffiliatePartner!}
                  partners={partners}
                  orders={affiliateOrders}
                  commissions={affiliateCommissions}
                  planConfig={planConfig}
                  onNavigate={(tab) => {
                    if (tab !== 'admin') setAffiliateTab(tab);
                  }}
                />
              )}
              {affiliateTab === 'network' && (
                <NetworkModule
                  currentPartner={effectiveAffiliatePartner!}
                  partners={partners}
                  currentUserUid={user?.uid || effectiveAffiliatePartner!.ownerUid}
                  isAdmin={false}
                  isPinSession={!user}
                />
              )}
              {affiliateTab === 'compensation' && (
                <CompensationModule currentPartner={effectiveAffiliatePartner!} planConfig={planConfig} />
              )}
              {affiliateTab === 'wallet' && (
                <WalletModule
                  currentPartner={effectiveAffiliatePartner!}
                  isAdmin={false}
                  commissions={affiliateCommissions}
                  withdrawals={affiliateWithdrawals}
                />
              )}
              {affiliateTab === 'store' && (
                <StoreModule
                  currentPartner={effectiveAffiliatePartner!}
                  products={products}
                  orders={affiliateOrders}
                  cart={cart}
                  onAddToCart={handleAddToCart}
                  onUpdateQty={handleUpdateQty}
                  onRemoveFromCart={(id) => setCart((prev) => prev.filter((c) => c.product.id !== id))}
                  onClearCart={() => setCart([])}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
