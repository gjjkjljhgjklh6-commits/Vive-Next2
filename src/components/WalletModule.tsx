import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Clock, Wallet, X, XCircle } from 'lucide-react';
import { BONUS_LABELS } from '../data/compensationPlan';
import { requestWithdrawal, reviewWithdrawal } from '../services/firestoreService';
import type { BonusType, Commission, Partner, Withdrawal } from '../types/vivenext';

interface WalletModuleProps {
  currentPartner: Partner;
  isAdmin: boolean;
  commissions: Commission[];
  withdrawals: Withdrawal[];
}

export const WalletModule: React.FC<WalletModuleProps> = ({
  currentPartner,
  isAdmin,
  commissions,
  withdrawals,
}) => {
  const [bonusFilter, setBonusFilter] = useState<'all' | BonusType>('all');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amountBs, setAmountBs] = useState(500);
  const [method, setMethod] = useState<Withdrawal['method']>('qr_bolivia');
  const [destinationAccount, setDestinationAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const myCommissions = useMemo(
    () => commissions.filter((c) => c.partnerId === currentPartner.id || c.partnerUid === currentPartner.ownerUid),
    [commissions, currentPartner]
  );

  const myWithdrawals = useMemo(
    () => withdrawals.filter((w) => w.partnerId === currentPartner.id || w.partnerUid === currentPartner.ownerUid),
    [withdrawals, currentPartner]
  );

  const stats = useMemo(() => {
    const grossAvailable = myCommissions
      .filter((c) => c.status === 'disponible')
      .reduce((s, c) => s + c.amountBs, 0);
    const paidCommissions = myCommissions
      .filter((c) => c.status === 'pagada')
      .reduce((s, c) => s + c.amountBs, 0);
    const pendingCommissions = myCommissions
      .filter((c) => c.status === 'pendiente')
      .reduce((s, c) => s + c.amountBs, 0);

    const approvedWithdrawn = myWithdrawals
      .filter((w) => w.status === 'aprobado')
      .reduce((s, w) => s + w.amountBs, 0);
    const pendingWithdrawn = myWithdrawals
      .filter((w) => w.status === 'pendiente')
      .reduce((s, w) => s + w.amountBs, 0);

    const availableBalance = Math.max(0, grossAvailable - approvedWithdrawn - pendingWithdrawn);
    return {
      availableBalance,
      pendingCommissions,
      totalHistorical: grossAvailable + paidCommissions,
      pendingWithdrawn,
    };
  }, [myCommissions, myWithdrawals]);

  const displayedCommissions = useMemo(() => {
    const base = isAdmin ? commissions : myCommissions;
    if (bonusFilter === 'all') return base;
    return base.filter((c) => c.bonusType === bonusFilter);
  }, [commissions, myCommissions, isAdmin, bonusFilter]);

  const displayedWithdrawals = isAdmin ? withdrawals : myWithdrawals;

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountBs <= 0 || amountBs > stats.availableBalance) {
      setError(`El monto debe ser mayor a 0 y no superar tu saldo disponible (${stats.availableBalance.toFixed(2)} Bs).`);
      return;
    }
    if (destinationAccount.trim().length < 3) {
      setError('Ingresa el número de cuenta o referencia QR destino.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await requestWithdrawal({
        partnerId: currentPartner.id,
        partnerUid: currentPartner.ownerUid,
        partnerName: currentPartner.fullName,
        amountBs,
        method,
        destinationAccount: destinationAccount.trim(),
      });
      setShowWithdrawModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud de retiro.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comisiones y Billetera</h1>
          <p className="text-sm text-slate-500">
            Saldo disponible en Bolivianos (Bs), historial de bonos acreditados y solicitudes de retiro.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAmountBs(Math.min(500, Math.floor(stats.availableBalance)));
            setError('');
            setShowWithdrawModal(true);
          }}
          disabled={stats.availableBalance <= 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowDownToLine className="w-4 h-4" />
          Solicitar Retiro
        </button>
      </div>

      {/* Wallet KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Saldo Disponible para Retiro</div>
          <div className="text-2xl font-bold text-[#15803D] font-mono-num mt-1">
            {stats.availableBalance.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
          </div>
          <div className="text-xs text-slate-500 mt-1">Listo para transferencia o QR</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Retiros en Revisión</div>
          <div className="text-2xl font-bold text-[#B45309] font-mono-num mt-1">
            {stats.pendingWithdrawn.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
          </div>
          <div className="text-xs text-slate-500 mt-1">Pendientes de aprobación</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Comisiones Pendientes</div>
          <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
            {stats.pendingCommissions.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
          </div>
          <div className="text-xs text-slate-500 mt-1">En espera de cierre</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Histórico Generado</div>
          <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
            {stats.totalHistorical.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
          </div>
          <div className="text-xs text-slate-500 mt-1">Bonos 1 al 9 acumulados</div>
        </div>
      </div>

      {/* Historial de Comisiones */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#8B1E24]" />
            <h2 className="text-base font-semibold text-slate-900">
              Historial de Comisiones {isAdmin ? '(Vista Global)' : '(Mi Billetera)'}
            </h2>
          </div>
          <select
            value={bonusFilter}
            onChange={(e) => setBonusFilter(e.target.value as 'all' | BonusType)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="all">Todos los Bonos</option>
            {Object.entries(BONUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {displayedCommissions.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Aún no hay comisiones registradas con este filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-3">Socio</th>
                  <th className="py-2.5 px-3">Bono</th>
                  <th className="py-2.5 px-3">Detalle</th>
                  <th className="py-2.5 px-3 text-right">Base CV</th>
                  <th className="py-2.5 px-3 text-right">%</th>
                  <th className="py-2.5 px-3 text-right">Monto (Bs)</th>
                  <th className="py-2.5 px-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedCommissions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">{c.partnerName}</td>
                    <td className="py-2.5 px-3 text-slate-700">{BONUS_LABELS[c.bonusType]}</td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{c.description}</td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                      {c.baseCv.toLocaleString('es-BO')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">{c.ratePercent}%</td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">
                      {c.amountBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      <span
                        className={
                          c.status === 'disponible' || c.status === 'pagada'
                            ? 'text-[#15803D]'
                            : c.status === 'pendiente'
                            ? 'text-[#B45309]'
                            : 'text-red-600'
                        }
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Solicitudes de Retiro */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">
          Retiros y Aprobación de Pagos
        </h2>
        {displayedWithdrawals.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
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
                  {isAdmin && <th className="py-2.5 px-3 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayedWithdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">{w.partnerName}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {w.method === 'qr_bolivia'
                        ? 'QR Simple Bolivia'
                        : w.method === 'transferencia_bancaria'
                        ? 'Transferencia Bancaria'
                        : 'Efectivo Oficina'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{w.destinationAccount}</td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">
                      {w.amountBs.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          w.status === 'aprobado'
                            ? 'text-[#15803D]'
                            : w.status === 'pendiente'
                            ? 'text-[#B45309]'
                            : 'text-red-600'
                        }`}
                      >
                        {w.status === 'aprobado' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {w.status === 'pendiente' && <Clock className="w-3.5 h-3.5" />}
                        {w.status === 'rechazado' && <XCircle className="w-3.5 h-3.5" />}
                        {w.status.toUpperCase()}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 px-3 text-right">
                        {w.status === 'pendiente' ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => reviewWithdrawal(w, 'aprobado', 'Pago procesado por Tesorería')}
                              className="px-2.5 py-1 bg-[#15803D] text-white rounded text-[11px] font-medium hover:bg-emerald-800 cursor-pointer"
                            >
                              Aprobar
                            </button>
                            <button
                              type="button"
                              onClick={() => reviewWithdrawal(w, 'rechazado', 'Datos bancarios inconsistentes')}
                              className="px-2.5 py-1 bg-slate-200 text-slate-800 rounded text-[11px] font-medium hover:bg-slate-300 cursor-pointer"
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">{w.reviewedBy || 'Procesado'}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Solicitar Retiro */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Solicitar Retiro de Billetera</h3>
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRequestWithdrawal} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex justify-between">
                <span>Saldo disponible:</span>
                <strong className="font-mono-num text-slate-900">
                  {stats.availableBalance.toLocaleString('es-BO', { minimumFractionDigits: 2 })} Bs
                </strong>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Monto a retirar (Bs)</label>
                <input
                  type="number"
                  min={1}
                  max={stats.availableBalance}
                  step="0.01"
                  required
                  value={amountBs}
                  onChange={(e) => setAmountBs(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Método de Desembolso</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as Withdrawal['method'])}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="qr_bolivia">QR Simple Bolivia</option>
                  <option value="transferencia_bancaria">Transferencia Bancaria ACH</option>
                  <option value="efectivo_oficina">Efectivo en Oficina Santa Cruz</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cuenta / Teléfono QR Destino
                </label>
                <input
                  type="text"
                  required
                  value={destinationAccount}
                  onChange={(e) => setDestinationAccount(e.target.value)}
                  placeholder="Ej. QR Banco Unión / Cuenta BMSC 4010-..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#8B1E24] rounded-lg hover:bg-[#73181D] disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Enviando...' : 'Confirmar Retiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
