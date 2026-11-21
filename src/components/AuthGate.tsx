import React, { useEffect, useMemo, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  KeyRound,
  LogOut,
  Package,
  Search,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Target,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { AFFILIATION_PACKAGES, SOLID_GROWTH_GUARANTEES } from '../data/compensationPlan';
import type { BinaryLeg, PackageTier, Partner, Product } from '../types/vivenext';

export type LoginAccessMode = 'affiliate' | 'admin';

interface AuthGateProps {
  mode: 'login' | 'onboarding' | 'admin_denied';
  userEmail?: string;
  userName?: string;
  userUid?: string;
  rootPartner?: Partner | null;
  marketplaceProducts?: Product[];
  initialLoginError?: string;
  onSelectLoginMode?: (mode: LoginAccessMode) => void;
  onLoginWithPin?: (pin: string) => Promise<void>;
  onSwitchToAffiliateMode?: () => void;
  onSignOut?: () => Promise<void> | void;
  onCompleteOnboarding?: (payload: {
    fullName: string;
    sponsorId: string;
    binaryLeg: BinaryLeg;
    packageTier: PackageTier;
    phone: string;
    ciNumber: string;
    city: string;
    bankName: string;
    bankAccount: string;
  }) => Promise<void>;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  mode,
  userEmail,
  userName,
  marketplaceProducts = [],
  initialLoginError = '',
  onSelectLoginMode,
  onLoginWithPin,
  onSwitchToAffiliateMode,
  onSignOut,
  onCompleteOnboarding,
}) => {
  const [loggingIn, setLoggingIn] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(initialLoginError);
  const [bannerImgFailed, setBannerImgFailed] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(Boolean(initialLoginError));
  const [selectedLoginMode, setSelectedLoginMode] = useState<LoginAccessMode>('affiliate');

  useEffect(() => {
    if (initialLoginError) {
      setError(initialLoginError);
      setShowLoginModal(true);
      setSelectedLoginMode('affiliate');
    }
  }, [initialLoginError]);

  // Marketplace preview filters
  const [marketCategory, setMarketCategory] = useState('Todas');
  const [marketSearch, setMarketSearch] = useState('');

  // Onboarding form state
  const [fullName, setFullName] = useState(userName || '');
  const [sponsorId, setSponsorId] = useState('vn_root');
  const [binaryLeg, setBinaryLeg] = useState<BinaryLeg>('left');
  const [packageTier, setPackageTier] = useState<PackageTier>('elite');
  const [phone, setPhone] = useState('+591 ');
  const [ciNumber, setCiNumber] = useState('');
  const [city, setCity] = useState('Santa Cruz de la Sierra');
  const [bankName, setBankName] = useState('Banco Mercantil Santa Cruz');
  const [bankAccount, setBankAccount] = useState('');
  const [onboardingBusy, setOnboardingBusy] = useState(false);

  const visibleCatalog = useMemo(() => {
    return marketplaceProducts.filter((p) => p.active);
  }, [marketplaceProducts]);

  const marketCategories = useMemo(() => {
    const set = new Set<string>(['Todas']);
    visibleCatalog.forEach((p) => set.add(p.category));
    return Array.from(set);
  }, [visibleCatalog]);

  const filteredCatalog = useMemo(() => {
    const q = marketSearch.trim().toLowerCase();
    return visibleCatalog.filter((p) => {
      if (marketCategory !== 'Todas' && p.category !== marketCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [visibleCatalog, marketCategory, marketSearch]);

  const handleGoogleLogin = async (accessMode: LoginAccessMode = selectedLoginMode) => {
    setError('');
    setLoggingIn(true);
    try {
      onSelectLoginMode?.(accessMode);
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/popup-blocked') {
        setError('El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e intenta nuevamente.');
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Se cerró la ventana de inicio de sesión antes de completar el ingreso.');
      } else if (code === 'auth/unauthorized-domain') {
        setError('Este dominio no está autorizado en Firebase Auth.');
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.');
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLoginWithPin) return;
    const clean = pinInput.trim().toUpperCase();
    if (clean.length < 4) {
      setError('Ingresa el PIN de acceso rápido (mínimo 4 caracteres).');
      return;
    }
    setError('');
    setPinBusy(true);
    try {
      await onLoginWithPin(clean);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/popup-blocked') {
        setError('El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e intenta nuevamente.');
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Se cerró la confirmación de Google antes de validar el PIN.');
      } else {
        setError(err instanceof Error ? err.message : 'PIN inválido o no autorizado.');
      }
    } finally {
      setPinBusy(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCompleteOnboarding) return;
    if (fullName.trim().length < 2) {
      setError('Ingresa tu nombre completo.');
      return;
    }
    setError('');
    setOnboardingBusy(true);
    try {
      await onCompleteOnboarding({
        fullName: fullName.trim(),
        sponsorId: sponsorId.trim() || 'vn_root',
        binaryLeg,
        packageTier,
        phone: phone.trim(),
        ciNumber: ciNumber.trim(),
        city: city.trim(),
        bankName: bankName.trim(),
        bankAccount: bankAccount.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar tu perfil de afiliado.');
    } finally {
      setOnboardingBusy(false);
    }
  };

  if (mode === 'admin_denied') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 text-[#8B1E24] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Acceso exclusivo de Administrador</h1>
              <p className="text-xs text-slate-500">{userEmail}</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Esta cuenta de Google no tiene permisos de Administrador. Puedes ingresar a tu{' '}
            <strong className="text-slate-900">Panel de Afiliado</strong> con esta misma cuenta o
            cambiar de cuenta de Google.
          </p>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => onSwitchToAffiliateMode?.()}
              className="w-full py-2.5 px-4 bg-[#8B1E24] text-white text-sm font-semibold rounded-lg hover:bg-[#73181D] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Entrar en Modo Afiliado con esta cuenta</span>
            </button>
            <button
              type="button"
              onClick={() => onSignOut?.()}
              className="w-full py-2.5 px-4 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Cambiar de cuenta Google</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'onboarding') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#8B1E24] text-white flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Alta de Nuevo Afiliado Vive Next</h1>
                <p className="text-xs text-slate-500">{userEmail} · Vinculación de patrocinador y paquete inicial</p>
              </div>
            </div>
            {onSignOut && (
              <button
                type="button"
                onClick={() => onSignOut()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cambiar cuenta</span>
              </button>
            )}
          </div>

          {onLoginWithPin && (
            <form
              onSubmit={handlePinSubmit}
              className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <KeyRound className="w-4 h-4 text-[#8B1E24]" />
                <span>¿El Administrador te dio un PIN de acceso rápido?</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  maxLength={16}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                  placeholder="Ingresa tu PIN (ej. 482915)"
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white font-mono-num font-bold tracking-widest focus:outline-none focus:border-[#8B1E24]"
                />
                <button
                  type="submit"
                  disabled={pinBusy}
                  className="px-4 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {pinBusy ? 'Verificando PIN...' : 'Entrar rápido con PIN'}
                </button>
              </div>
            </form>
          )}

          <form onSubmit={handleOnboardingSubmit} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#8B1E24]"
                  placeholder="Ej. Valeria Mendoza"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">ID de Patrocinador</label>
                <input
                  type="text"
                  value={sponsorId}
                  onChange={(e) => setSponsorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num focus:outline-none focus:border-[#8B1E24]"
                  placeholder="vn_root"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Pierna Binaria Preferida</label>
                <select
                  value={binaryLeg}
                  onChange={(e) => setBinaryLeg(e.target.value as BinaryLeg)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#8B1E24]"
                >
                  <option value="left">Equipo Izquierdo</option>
                  <option value="right">Equipo Derecho</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Paquete de Afiliación</label>
                <select
                  value={packageTier}
                  onChange={(e) => setPackageTier(e.target.value as PackageTier)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#8B1E24]"
                >
                  <option value="base">Distribuidor Base (975 Bs · 75 PV)</option>
                  <option value="emprendedor">Emprendedor (1.950 Bs · 150 PV)</option>
                  <option value="elite">Emprendedor Élite (3.900 Bs · 300 PV)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#8B1E24]"
                  placeholder="+591 7..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Cédula de Identidad (CI)</label>
                <input
                  type="text"
                  value={ciNumber}
                  onChange={(e) => setCiNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#8B1E24]"
                  placeholder="Ej. 6281940 SC"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Ciudad</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#8B1E24]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Banco y Cuenta (para retiros)</label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#8B1E24]"
                  placeholder="Ej. BMSC 4010-123456"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              <strong className="text-slate-900">{AFFILIATION_PACKAGES[packageTier].name}:</strong>{' '}
              {AFFILIATION_PACKAGES[packageTier].accessSummary}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={onboardingBusy}
              className="w-full py-2.5 px-4 bg-[#8B1E24] text-white text-sm font-semibold rounded-lg hover:bg-[#73181D] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {onboardingBusy ? 'Activando cuenta de afiliado...' : 'Completar Registro e Ingresar al Panel de Afiliado'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: exact 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-6 lg:px-12 h-16 flex items-center justify-between gap-8">
        <a
          href="#inicio"
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Vive Next
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="#empresa" className="hover:text-[#8B1E24] transition-colors whitespace-nowrap shrink-0">
            Empresa
          </a>
          <a href="#mision-vision" className="hover:text-[#8B1E24] transition-colors whitespace-nowrap shrink-0">
            Misión y Visión
          </a>
          <a href="#precios" className="hover:text-[#8B1E24] transition-colors whitespace-nowrap shrink-0">
            Precios
          </a>
          <a href="#marketplace" className="hover:text-[#8B1E24] transition-colors whitespace-nowrap shrink-0">
            Marketplace
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowLoginModal(true)}
            className="px-4 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Iniciar Sesión
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section matching Vive Next Crimson + Gold Official Design */}
        <section
          id="inicio"
          className="bg-gradient-to-br from-[#B80D0D] via-[#99151B] to-[#6B0F14] text-white border-b border-[#7F1D1D]"
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="text-xs font-medium text-amber-200 tracking-wide">
                Salud, Liderazgo y Libertad · Santa Cruz, Bolivia
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[46px] font-bold tracking-tight text-balance leading-[1.12]">
                Bienestar y red empresarial con crecimiento real.
              </h1>
              <p className="text-sm sm:text-base text-red-50/90 leading-relaxed max-w-xl">
                Emprendedores con un solo propósito: crecer, servir y triunfar juntos. Liderazgo,
                resistencia y espíritu inquebrantable. ¡Cada obstáculo lo convertimos en escalón!
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-white text-[#8B1E24] text-sm font-bold rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#marketplace"
                  className="inline-flex items-center gap-2 px-5 py-3 border border-white/35 text-white text-sm font-semibold rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Ver Marketplace</span>
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-xl overflow-hidden border border-white/20 bg-[#C40000] shadow-xl">
                {bannerImgFailed ? (
                  <div className="aspect-[16/9] flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#D00000] to-[#7F0000]">
                    <div className="font-display text-4xl font-bold tracking-tight text-white">VIVE NEXT</div>
                    <div className="mt-2 text-xs tracking-widest text-amber-200">
                      — SALUD, LIDERAZGO Y LIBERTAD —
                    </div>
                  </div>
                ) : (
                  <img
                    src="/assets/aistudio/WhatsApp_Image_2026-11-17_at_7.58.05_AM_7198c37d.jpeg"
                    alt="Vive Next — Salud, Liderazgo y Libertad"
                    referrerPolicy="no-referrer"
                    onError={() => setBannerImgFailed(true)}
                    className="w-full h-auto object-cover block"
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Quantitative Metrics Strip */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 py-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-slate-500">Margen Venta Directa</div>
              <div className="text-2xl font-bold text-slate-900 font-mono-num mt-0.5">50%</div>
              <div className="text-xs text-slate-500">Sobre precio mayorista</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Conversión Oficial</div>
              <div className="text-2xl font-bold text-slate-900 font-mono-num mt-0.5">1 CV = 5 Bs</div>
              <div className="text-xs text-slate-500">Moneda local transparente</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Fuentes de Ingreso</div>
              <div className="text-2xl font-bold text-slate-900 font-mono-num mt-0.5">9 Bonos</div>
              <div className="text-xs text-slate-500">11 rangos de liderazgo</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Sostenibilidad Global</div>
              <div className="text-2xl font-bold text-slate-900 font-mono-num mt-0.5">≤ 48% CV</div>
              <div className="text-xs text-slate-500">7 garantías financieras</div>
            </div>
          </div>
        </section>

        {/* 01. Empresa, Misión y Visión */}
        <section id="empresa" className="max-w-7xl mx-auto px-6 lg:px-12 py-14 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-[#8B1E24] mb-2">01. Sobre la Empresa</div>
                <h2 className="font-display text-2xl font-bold text-slate-900 text-balance">
                  Nutrición celular avanzada y liderazgo empresarial en Bolivia
                </h2>
                <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                  Vive Next nace en Santa Cruz de la Sierra con el propósito de unir fórmulas
                  nutricionales de alta biodisponibilidad con un sistema comercial justo y
                  matemáticamente sostenible. Cada producto cuenta con volumen comisionable real
                  (PV y CV) y respaldo operativo directo para nuestros afiliados y clientes.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-semibold text-slate-900">Sede Operativa</div>
                  <div className="text-slate-500 mt-0.5">Santa Cruz, Bolivia</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Recompra Activa</div>
                  <div className="text-slate-500 mt-0.5 font-mono-num">75 PV mensuales</div>
                </div>
              </div>
            </div>

            <div id="mision-vision" className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-red-50 text-[#8B1E24] flex items-center justify-center mb-4">
                    <Target className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900">Nuestra Misión</h3>
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                    Transformar la salud y la economía familiar ofreciendo productos de bienestar
                    celular de calidad comprobada junto a un Plan de Prosperidad claro, ético y
                    accesible que recompensa tanto la venta directa como la formación de equipos.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
                  Enfoque · Bienestar diario y oportunidad comercial real
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-[#B45309] flex items-center justify-center mb-4">
                    <Compass className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900">Nuestra Visión</h3>
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                    Consolidarnos como la comunidad de salud y liderazgo multinivel referente en
                    Latinoamérica, reconocida por la eficacia de nuestro catálogo, la transparencia
                    de nuestra oficina virtual y la libertad financiera sostenible de nuestros socios.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
                  Proyección · Expansión regional con liderazgo sólido
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02. Precios y Paquetes de Afiliación */}
        <section id="precios" className="bg-white border-y border-slate-200 py-14">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-[#8B1E24] mb-1">02. Planes y Precios Oficiales</div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                  Paquetes de Afiliación 2026
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Elige el nivel con el que deseas iniciar tu red y acceder al Marketplace con precio mayorista.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                1ª compra incluye +30% destinado al Fondo de Inicio Rápido
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(['base', 'emprendedor', 'elite'] as PackageTier[]).map((tier) => {
                const pkg = AFFILIATION_PACKAGES[tier];
                const featured = tier === 'elite';
                return (
                  <div
                    key={tier}
                    className={`rounded-xl p-6 flex flex-col justify-between border ${
                      featured
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-900 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={featured ? 'text-amber-300 font-semibold' : 'text-slate-500 font-medium'}>
                          {featured ? 'Plan Completo · Recomendado' : 'Paquete de Inicio'}
                        </span>
                        <span className="font-mono-num">
                          {pkg.pv} PV · {pkg.cv} CV
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-bold mt-2">{pkg.name}</h3>

                      <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-bold font-mono-num">
                          {pkg.firstPurchaseTotalBs.toLocaleString('es-BO')} Bs
                        </span>
                        <span className={`text-xs ${featured ? 'text-slate-300' : 'text-slate-500'}`}>
                          1ª afiliación
                        </span>
                      </div>

                      <p className={`mt-3 text-xs leading-relaxed ${featured ? 'text-slate-300' : 'text-slate-600'}`}>
                        {pkg.accessSummary}
                      </p>

                      <div
                        className={`mt-5 pt-4 border-t space-y-2 text-xs ${
                          featured ? 'border-slate-700 text-slate-200' : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span>Precio Mayorista Base</span>
                          <strong className="font-mono-num">{pkg.wholesaleBs.toLocaleString('es-BO')} Bs</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Fondo Inicio Rápido (30%)</span>
                          <strong className="font-mono-num">{pkg.fastStartPoolBs.toLocaleString('es-BO')} Bs</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Bono Unilevel 20%</span>
                          <strong>{pkg.allowsUnilevel ? 'Habilitado' : 'No incluido'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Binario + Matching + Premios</span>
                          <strong>{pkg.allowsBinaryAndPrizes ? 'Habilitado' : 'No incluido'}</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      className={`mt-6 w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-center transition-colors cursor-pointer ${
                        featured
                          ? 'bg-[#8B1E24] text-white hover:bg-[#73181D]'
                          : 'bg-white text-slate-900 border border-slate-200 hover:border-[#8B1E24]'
                      }`}
                    >
                      Afiliarme con {pkg.name}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 7 Garantías compacto */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 mb-3">
                <ShieldCheck className="w-4 h-4 text-[#8B1E24]" />
                <span>Las 7 Garantías de Crecimiento Sólido Vive Next</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {SOLID_GROWTH_GUARANTEES.slice(0, 4).map((g) => (
                  <div key={g.code} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="font-semibold text-slate-900">
                      {g.code}. {g.title}
                    </div>
                    <div className="text-[#8B1E24] font-medium mt-0.5">{g.rule}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 03. Marketplace de Productos Vive Next */}
        <section id="marketplace" className="max-w-7xl mx-auto px-6 lg:px-12 py-14 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-[#8B1E24] mb-1">03. Catálogo Oficial</div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                Marketplace de Productos Vive Next
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Productos publicados y actualizados en tiempo real desde el Panel de Administrador.
              </p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                placeholder="Buscar producto o SKU..."
                className="pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white w-60 focus:outline-none focus:border-[#8B1E24]"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {marketCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setMarketCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  marketCategory === cat
                    ? 'bg-[#8B1E24] text-white border-[#8B1E24]'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {filteredCatalog.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              {visibleCatalog.length === 0
                ? 'El catálogo del Marketplace se encuentra limpio. El Administrador publicará los productos oficiales aquí.'
                : 'No hay productos que coincidan con tu búsqueda en este momento.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCatalog.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-colors"
                >
                  <div>
                    <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5">
                      <div className="text-[11px] font-medium text-slate-500">
                        {product.category} · <span className="font-mono-num">{product.sku}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{product.name}</h3>
                      <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{product.description}</p>
                    </div>
                  </div>

                  <div className="p-5 pt-0 space-y-3">
                    <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                      <div>
                        <div className="text-[11px] text-slate-500">Precio Afiliado (Mayorista)</div>
                        <div className="text-lg font-bold text-slate-900 font-mono-num">
                          {product.wholesalePriceBs.toLocaleString('es-BO')} Bs
                        </div>
                      </div>
                      <div className="text-right font-mono-num">
                        <div className="text-[11px] text-slate-500">
                          PVP Público: {product.retailPriceBs.toLocaleString('es-BO')} Bs
                        </div>
                        <div className="text-xs font-semibold text-[#15803D]">
                          {product.pv} PV · {product.cv} CV
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      className="w-full py-2 px-3 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-[#8B1E24] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Ingresar para Comprar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Modal de Inicio de Sesión (abierto al hacer clic) */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Iniciar Sesión en Vive Next</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Elige el modo de acceso: entra directo solo con tu PIN de afiliado o con tu cuenta de Google.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedLoginMode('affiliate');
                  setError('');
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                  selectedLoginMode === 'affiliate'
                    ? 'bg-red-50/50 border-[#8B1E24]'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <UserCheck
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      selectedLoginMode === 'affiliate' ? 'text-[#8B1E24]' : 'text-slate-700'
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-slate-900">Entrar en Modo Afiliado</div>
                    <div className="text-slate-500 mt-0.5">
                      Accede directo al Panel de Afiliado poniendo solo tu PIN o con tu cuenta de Google.
                    </div>
                  </div>
                </div>
                {selectedLoginMode === 'affiliate' && (
                  <CheckCircle2 className="w-4 h-4 text-[#8B1E24] shrink-0 mt-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedLoginMode('admin');
                  setError('');
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                  selectedLoginMode === 'admin'
                    ? 'bg-red-50/50 border-[#8B1E24]'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Shield
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      selectedLoginMode === 'admin' ? 'text-[#8B1E24]' : 'text-slate-700'
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-slate-900">Entrar en Modo Administrador</div>
                    <div className="text-slate-500 mt-0.5">
                      Accede exclusivamente al Panel de Administrador (afiliados, productos, pagos y red).
                    </div>
                  </div>
                </div>
                {selectedLoginMode === 'admin' && (
                  <CheckCircle2 className="w-4 h-4 text-[#8B1E24] shrink-0 mt-0.5" />
                )}
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            {selectedLoginMode === 'affiliate' && onLoginWithPin && (
              <form
                onSubmit={handlePinSubmit}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <KeyRound className="w-4 h-4 text-[#8B1E24]" />
                  <span>Ingreso Rápido con PIN de Afiliado</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={16}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value.toUpperCase());
                      setError('');
                    }}
                    placeholder="PIN (ej. 482915)"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white font-mono-num font-bold tracking-widest focus:outline-none focus:border-[#8B1E24]"
                  />
                  <button
                    type="submit"
                    disabled={pinBusy || loggingIn}
                    className="px-4 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {pinBusy ? 'Validando...' : 'Entrar con PIN'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Acceso directo sin abrir Google: solo escribe el PIN que te entregó el Administrador para entrar a tu oficina.
                </p>
              </form>
            )}

            {selectedLoginMode === 'affiliate' && (
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <div className="flex-1 h-px bg-slate-200" />
                <span>o continúa sin PIN</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            )}

            <button
              type="button"
              onClick={() => handleGoogleLogin(selectedLoginMode)}
              disabled={loggingIn || pinBusy}
              className={`w-full py-3.5 px-4 rounded-xl transition-colors flex items-center justify-between gap-3 text-left cursor-pointer disabled:opacity-50 ${
                selectedLoginMode === 'admin'
                  ? 'bg-[#8B1E24] text-white hover:bg-[#73181D]'
                  : 'bg-white border border-slate-300 text-slate-900 hover:border-[#8B1E24]'
              }`}
            >
              <div>
                <div className="text-sm font-semibold">
                  {loggingIn
                    ? 'Conectando con Google...'
                    : selectedLoginMode === 'affiliate'
                      ? 'Continuar con Google como Afiliado'
                      : 'Continuar con Google como Administrador'}
                </div>
                <div className={`text-[11px] ${selectedLoginMode === 'admin' ? 'text-red-100' : 'text-slate-500'}`}>
                  {selectedLoginMode === 'affiliate'
                    ? 'Registro nuevo o ingreso directo con tu cuenta de Google'
                    : 'Verificación exclusiva de credenciales de Administrador'}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 lg:px-12 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="font-semibold text-slate-900">
            Vive Next · Salud, Liderazgo y Libertad
          </div>
          <div className="flex items-center gap-5">
            <a href="#empresa" className="hover:text-slate-900">Empresa</a>
            <a href="#mision-vision" className="hover:text-slate-900">Misión y Visión</a>
            <a href="#precios" className="hover:text-slate-900">Precios</a>
            <a href="#marketplace" className="hover:text-slate-900">Marketplace</a>
          </div>
          <div>Santa Cruz de la Sierra, Bolivia · 2026</div>
        </div>
      </footer>
    </div>
  );
};
