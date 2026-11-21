import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Minus,
  Package,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { createOrder } from '../services/firestoreService';
import type {
  CartItem,
  Order,
  Partner,
  PaymentMethod,
  Product,
} from '../types/vivenext';

interface StoreModuleProps {
  currentPartner: Partner;
  products: Product[];
  orders: Order[];
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onUpdateQty: (productId: string, delta: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onClearCart: () => void;
  isAdminView?: boolean;
  onOpenAdminProductUpload?: () => void;
}

const DeterministicQrSvg: React.FC<{ value: string }> = ({ value }) => {
  const size = 21;
  const cells: boolean[] = [];
  let seed = 0;
  for (let i = 0; i < value.length; i++) {
    seed = (seed * 31 + value.charCodeAt(i)) % 999983;
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 7 && c < 7;
      const inTopRight = r < 7 && c >= size - 7;
      const inBottomLeft = r >= size - 7 && c < 7;
      if (inTopLeft || inTopRight || inBottomLeft) {
        const lr = r % 7 === 0 || (r >= size - 7 && r === size - 7) || r === 6 || r === size - 1;
        const lc = c % 7 === 0 || (c >= size - 7 && c === size - 7) || c === 6 || c === size - 1;
        const center =
          (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
          (r >= 2 && r <= 4 && c >= size - 5 && c <= size - 3) ||
          (r >= size - 5 && r <= size - 3 && c >= 2 && c <= 4);
        cells.push(lr || lc || center);
      } else {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        cells.push((seed % 100) < 46);
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-36 h-36 bg-white p-2 border border-slate-200 rounded-lg">
      {cells.map((filled, idx) =>
        filled ? (
          <rect
            key={idx}
            x={idx % size}
            y={Math.floor(idx / size)}
            width={1}
            height={1}
            fill="#0F172A"
          />
        ) : null
      )}
    </svg>
  );
};

export const StoreModule: React.FC<StoreModuleProps> = ({
  currentPartner,
  products,
  orders,
  cart,
  onAddToCart,
  onUpdateQty,
  onRemoveFromCart,
  onClearCart,
  isAdminView = false,
  onOpenAdminProductUpload,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFirstPurchase, setIsFirstPurchase] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('qr');
  const [paymentReference, setPaymentReference] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState('');

  const categories = useMemo(() => {
    const set = new Set<string>(['Todas']);
    products.forEach((p) => {
      if (p.active) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.active) return false;
      if (categoryFilter !== 'Todas' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    });
  }, [products, categoryFilter, searchTerm]);

  const cartSummary = useMemo(() => {
    const subtotalBs = cart.reduce((s, item) => s + item.product.wholesalePriceBs * item.quantity, 0);
    const surchargeBs = isFirstPurchase
      ? cart.reduce((s, item) => s + item.product.firstPurchaseSurchargeBs * item.quantity, 0)
      : 0;
    const totalBs = subtotalBs + surchargeBs;
    const totalPv = cart.reduce((s, item) => s + item.product.pv * item.quantity, 0);
    const totalCv = cart.reduce((s, item) => s + item.product.cv * item.quantity, 0);
    const retailPotentialBs = cart.reduce((s, item) => s + item.product.retailPriceBs * item.quantity, 0);
    return {
      subtotalBs,
      surchargeBs,
      totalBs,
      totalPv,
      totalCv,
      directMarginBs: Math.max(0, retailPotentialBs - subtotalBs),
    };
  }, [cart, isFirstPurchase]);

  const myOrders = useMemo(
    () => orders.filter((o) => o.buyerUid === currentPartner.ownerUid || o.partnerId === currentPartner.id),
    [orders, currentPartner]
  );

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setCheckoutError('');
    setSubmitting(true);
    try {
      const orderNumber = await createOrder({
        buyerUid: currentPartner.ownerUid,
        partnerId: currentPartner.id,
        partnerName: currentPartner.fullName,
        sponsorId: currentPartner.sponsorId,
        isFirstPurchase,
        items: cart.map((c) => ({
          productId: c.product.id,
          sku: c.product.sku,
          name: c.product.name,
          quantity: c.quantity,
          unitWholesaleBs: c.product.wholesalePriceBs,
          unitRetailBs: c.product.retailPriceBs,
          unitSurchargeBs: isFirstPurchase ? c.product.firstPurchaseSurchargeBs : 0,
          unitPv: c.product.pv,
          unitCv: c.product.cv,
          isPackage: c.product.isPackage,
          packageTier: c.product.packageTier,
        })),
        subtotalBs: cartSummary.subtotalBs,
        surchargeBs: cartSummary.surchargeBs,
        totalBs: cartSummary.totalBs,
        totalPv: cartSummary.totalPv,
        totalCv: cartSummary.totalCv,
        paymentMethod,
        paymentReference:
          paymentReference.trim() ||
          `${paymentMethod.toUpperCase()}-${Math.floor(100000 + Math.random() * 899999)}`,
        receiptNote:
          receiptNote.trim() ||
          `Comprobante registrado por ${currentPartner.fullName} (${paymentMethod})`,
        paymentStatus: 'pendiente',
        validatedBy: '',
      });
      onClearCart();
      setShowCheckout(false);
      setPaymentReference('');
      setReceiptNote('');
      setOrderConfirmation(
        `Pedido ${orderNumber} registrado en estado Pendiente de Validación. Una vez aprobado por Administración, se acreditarán ${cartSummary.totalPv} PV y ${cartSummary.totalCv} CV.`
      );
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Error al registrar el pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Marketplace de Productos Vive Next</h1>
          <p className="text-sm text-slate-500">
            Precio Mayorista de Afiliado con +50% de margen en Venta Directa · Pago en Efectivo, QR Simple o Transferencia.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isAdminView && onOpenAdminProductUpload && (
            <button
              type="button"
              onClick={onOpenAdminProductUpload}
              className="px-3.5 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Subir / Gestionar Productos
            </button>
          )}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar producto o SKU..."
              className="pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white w-56 focus:outline-none focus:border-[#8B1E24]"
            />
          </div>
        </div>
      </div>

      {orderConfirmation && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
            <span>{orderConfirmation}</span>
          </div>
          <button
            type="button"
            onClick={() => setOrderConfirmation('')}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Category Segmented Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              categoryFilter === cat
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Split: Catalog Grid (Left) + Cart Summary (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          {filteredProducts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              {products.filter((p) => p.active).length === 0
                ? 'Aún no hay productos publicados en el Marketplace. Cuando el Administrador suba productos aparecerán aquí.'
                : 'No hay productos que coincidan con tu búsqueda.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="text-[11px] font-medium text-slate-500">
                    {product.category} · <span className="font-mono-num">{product.sku}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">{product.name}</h3>
                  <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{product.description}</p>
                </div>
              </div>

              <div className="p-4 pt-0 space-y-3">
                <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                  <div>
                    <div className="text-[11px] text-slate-500">Mayorista</div>
                    <div className="text-base font-bold text-slate-900 font-mono-num">
                      {product.wholesalePriceBs.toLocaleString('es-BO')} Bs
                    </div>
                  </div>
                  <div className="text-right font-mono-num">
                    <div className="text-[11px] text-slate-500">
                      PVP: {product.retailPriceBs.toLocaleString('es-BO')} Bs
                    </div>
                    <div className="text-xs font-semibold text-[#15803D]">
                      {product.pv} PV · {product.cv} CV
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onAddToCart(product)}
                  disabled={product.stock <= 0}
                  className="w-full py-2 px-3 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-[#8B1E24] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {product.stock > 0 ? 'Agregar al Carrito' : 'Sin Stock'}
                </button>
              </div>
            </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Panel */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4 lg:sticky lg:top-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#8B1E24]" />
              <h2 className="text-base font-semibold text-slate-900">Carrito de Compra</h2>
            </div>
            <span className="text-xs font-mono-num text-slate-500">
              {cart.reduce((s, c) => s + c.quantity, 0)} ítems
            </span>
          </div>

          {cart.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
              Agrega productos o paquetes del catálogo para generar un pedido con PV/CV.
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {item.product.name}
                      </div>
                      <div className="text-[11px] font-mono-num text-slate-500">
                        {item.product.wholesalePriceBs} Bs · {item.product.pv} PV
                      </div>
                      <div className="mt-1.5 inline-flex items-center gap-1 border border-slate-200 rounded-md">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.product.id, -1)}
                          className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-mono-num">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.product.id, 1)}
                          className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono-num font-semibold text-slate-900">
                        {(item.product.wholesalePriceBs * item.quantity).toLocaleString('es-BO')} Bs
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveFromCart(item.product.id)}
                        className="mt-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        aria-label="Eliminar producto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 pt-2 border-t border-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFirstPurchase}
                  onChange={(e) => setIsFirstPurchase(e.target.checked)}
                  className="accent-[#8B1E24]"
                />
                <span>Aplica recargo 1ª compra de paquete (+30% Fondo Inicio)</span>
              </label>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Mayorista</span>
                  <span className="font-mono-num">{cartSummary.subtotalBs.toLocaleString('es-BO')} Bs</span>
                </div>
                {cartSummary.surchargeBs > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Recargo Paquete (+30%)</span>
                    <span className="font-mono-num">{cartSummary.surchargeBs.toLocaleString('es-BO')} Bs</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
                  <span>Total a Pagar</span>
                  <span className="font-mono-num">{cartSummary.totalBs.toLocaleString('es-BO')} Bs</span>
                </div>
                <div className="flex justify-between text-[#15803D] font-medium">
                  <span>Volumen Generado</span>
                  <span className="font-mono-num">
                    {cartSummary.totalPv} PV / {cartSummary.totalCv} CV
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Margen Venta Directa (50%)</span>
                  <span className="font-mono-num">+{cartSummary.directMarginBs.toLocaleString('es-BO')} Bs</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCheckout(true)}
                className="w-full py-2.5 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] transition-colors cursor-pointer"
              >
                Registrar Pago y Confirmar Pedido
              </button>
            </>
          )}
        </div>
      </div>

      {/* Historial de Pedidos */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-[#8B1E24]" />
          <h2 className="text-base font-semibold text-slate-900">Mis Pedidos y Comprobantes</h2>
        </div>
        {myOrders.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No tienes pedidos registrados todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-3">Pedido</th>
                  <th className="py-2.5 px-3">Socio</th>
                  <th className="py-2.5 px-3">Método / Comprobante</th>
                  <th className="py-2.5 px-3 text-right">PV / CV</th>
                  <th className="py-2.5 px-3 text-right">Total Bs</th>
                  <th className="py-2.5 px-3 text-right">Validación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {myOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono-num font-semibold text-slate-900">{o.orderNumber}</td>
                    <td className="py-2.5 px-3 text-slate-700">{o.partnerName}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <span className="uppercase font-medium">{o.paymentMethod}</span> · {o.paymentReference}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Checkout Efectivo / QR */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#8B1E24]" />
                <h3 className="text-lg font-bold text-slate-900">Pago y Registro de Comprobante</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
                {(['qr', 'efectivo', 'transferencia'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      paymentMethod === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {m === 'qr' ? 'QR / Pago Online' : m === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                  </button>
                ))}
              </div>

              {paymentMethod === 'qr' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-center gap-4">
                  <DeterministicQrSvg value={`VIVENEXT-BS-${cartSummary.totalBs}-${currentPartner.referralCode}`} />
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <QrCode className="w-4 h-4 text-[#8B1E24]" />
                      <span>QR Simple Interoperable Bolivia</span>
                    </div>
                    <p>
                      Escanea desde tu banca móvil por exactamente{' '}
                      <strong className="font-mono-num text-slate-900">
                        {cartSummary.totalBs.toLocaleString('es-BO')} Bs
                      </strong>.
                    </p>
                    <p className="text-slate-500">Beneficiario: VIVE NEXT BOLIVIA S.R.L. · Santa Cruz</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Número de Comprobante / Transacción
                </label>
                <input
                  type="text"
                  required
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder={
                    paymentMethod === 'qr'
                      ? 'Ej. QR-BMSC-902184'
                      : paymentMethod === 'efectivo'
                      ? 'Ej. RECIBO-CAJA-SCZ-112'
                      : 'Ej. ACH-BNB-44912'
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nota de Comprobante / Sucursal
                </label>
                <input
                  type="text"
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  placeholder="Ej. Pago verificado en oficina Equipetrol o adjunto referencia QR"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              {checkoutError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {checkoutError}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-600">
                  Total:{' '}
                  <strong className="text-base font-bold text-slate-900 font-mono-num">
                    {cartSummary.totalBs.toLocaleString('es-BO')} Bs
                  </strong>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCheckout(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#8B1E24] rounded-lg hover:bg-[#73181D] disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Enviando...' : 'Enviar para Validación'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
