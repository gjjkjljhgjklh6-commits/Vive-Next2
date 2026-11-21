import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  AFFILIATION_PACKAGES,
  CV_TO_BS_DEFAULT,
  RANK_MAP,
  determineQualifiedRank,
} from '../data/compensationPlan';
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
  PartnerPrivateInfo,
  PlanConfig,
  Product,
  RankId,
  UserRole,
  Withdrawal,
} from '../types/vivenext';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'gjjkjljhgjklh6@gmail.com';

export function isUserBootstrappedAdmin(email?: string | null, emailVerified?: boolean | null): boolean {
  return Boolean(emailVerified && email === BOOTSTRAPPED_ADMIN_EMAIL);
}

export function normalizeAffiliatePin(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export function generateRandomAffiliatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function hashAffiliatePin(rawPin: string): Promise<string> {
  const normalized = normalizeAffiliatePin(rawPin);
  if (normalized.length < 4 || normalized.length > 16) {
    throw new Error('El PIN debe tener entre 4 y 16 caracteres alfanuméricos.');
  }
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function formatPeriodMonth(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function logAudit(
  action: string,
  targetCollection: string,
  targetId: string,
  summary: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const id = makeId('aud');
  try {
    await setDoc(doc(db, 'audit_logs', id), {
      id,
      actorUid: user.uid,
      actorEmail: user.email ?? 'admin@vivenext.bo',
      action,
      targetCollection,
      targetId,
      summary: summary.slice(0, 390),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${id}`);
  }
}

export async function purgeAllFirestoreData(
  adminUid: string,
  adminEmail: string,
  adminName: string
): Promise<{ deletedCount: number }> {
  let deletedCount = 0;
  try {
    const deleteCollection = async (colName: string) => {
      const snap = await getDocs(collection(db, colName));
      for (const d of snap.docs) {
        if (colName === 'partners') {
          try {
            const privSnap = await getDoc(doc(db, 'partners', d.id, 'private', 'info'));
            if (privSnap.exists()) {
              await deleteDoc(doc(db, 'partners', d.id, 'private', 'info'));
              deletedCount++;
            }
          } catch {
            // Ignore if private info doc does not exist
          }
        }
        await deleteDoc(doc(db, colName, d.id));
        deletedCount++;
      }
    };

    await deleteCollection('products');
    await deleteCollection('orders');
    await deleteCollection('commissions');
    await deleteCollection('withdrawals');
    await deleteCollection('affiliate_pins');
    await deleteCollection('partners');
    await deleteCollection('audit_logs');

    const adminRef = doc(db, 'admins', adminUid);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      await setDoc(adminRef, {
        uid: adminUid,
        email: adminEmail,
        role: 'admin',
        createdAt: serverTimestamp(),
      });
    }

    await setDoc(doc(db, 'plan_config', 'default'), {
      id: 'default',
      cvToBsRate: 5,
      minMonthlyPv: 75,
      maxPayoutRatioPercent: 48,
      binaryEquilibriumPercent: 30,
      minRealConsumptionBs: 350,
      accumulationMaxDays: 30,
      firstWeekEndDay: 7,
      updatedBy: adminEmail,
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'partners', 'vn_root'), {
      id: 'vn_root',
      ownerUid: adminUid,
      fullName: adminName || 'Dirección Vive Next',
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
      uplineUids: [adminUid],
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'partners', 'vn_root', 'private', 'info'), {
      partnerId: 'vn_root',
      ownerUid: adminUid,
      email: adminEmail,
      phone: '',
      ciNumber: '',
      city: 'Santa Cruz de la Sierra',
      bankName: '',
      bankAccount: '',
      updatedAt: serverTimestamp(),
    });

    const audId = makeId('aud');
    await setDoc(doc(db, 'audit_logs', audId), {
      id: audId,
      actorUid: adminUid,
      actorEmail: adminEmail,
      action: 'SYSTEM_PRODUCTION_START_V1',
      targetCollection: 'plan_config',
      targetId: 'default',
      summary: 'Todos los datos previos fueron eliminados. Sistema Vive Next iniciado en limpio para operación real.',
      createdAt: serverTimestamp(),
    });

    return { deletedCount };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'purgeAllFirestoreData');
  }
}

export async function ensureCleanProductionDatabase(
  adminUid: string,
  adminEmail: string,
  adminName: string
): Promise<void> {
  try {
    const markerSnap = await getDocs(
      query(collection(db, 'audit_logs'), where('action', '==', 'SYSTEM_PRODUCTION_START_V1'))
    );
    if (markerSnap.empty) {
      await purgeAllFirestoreData(adminUid, adminEmail, adminName);
      return;
    }

    const adminRef = doc(db, 'admins', adminUid);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      await setDoc(adminRef, {
        uid: adminUid,
        email: adminEmail,
        role: 'admin',
        createdAt: serverTimestamp(),
      });
    }

    const configSnap = await getDoc(doc(db, 'plan_config', 'default'));
    if (!configSnap.exists()) {
      await setDoc(doc(db, 'plan_config', 'default'), {
        id: 'default',
        cvToBsRate: 5,
        minMonthlyPv: 75,
        maxPayoutRatioPercent: 48,
        binaryEquilibriumPercent: 30,
        minRealConsumptionBs: 350,
        accumulationMaxDays: 30,
        firstWeekEndDay: 7,
        updatedBy: adminEmail,
        updatedAt: serverTimestamp(),
      });
    }

    const rootSnap = await getDoc(doc(db, 'partners', 'vn_root'));
    if (!rootSnap.exists()) {
      await setDoc(doc(db, 'partners', 'vn_root'), {
        id: 'vn_root',
        ownerUid: adminUid,
        fullName: adminName || 'Dirección Vive Next',
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
        uplineUids: [adminUid],
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'ensureCleanProductionDatabase');
  }
}

export async function registerPartnerNode(params: {
  id: string;
  ownerUid: string;
  fullName: string;
  sponsorId: string;
  binaryParentId: string;
  binaryLeg: BinaryLeg;
  packageTier: PackageTier;
  uplineUids: string[];
  email: string;
  phone: string;
  ciNumber: string;
  city: string;
  bankName: string;
  bankAccount: string;
}): Promise<Partner> {
  const code = `VN-${params.fullName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')}-${Math.floor(100 + Math.random() * 899)}`;
  const partnerData = {
    id: params.id,
    ownerUid: params.ownerUid,
    fullName: params.fullName.trim(),
    referralCode: code,
    sponsorId: params.sponsorId,
    binaryParentId: params.binaryParentId,
    binaryLeg: params.binaryLeg,
    packageTier: params.packageTier,
    rankId: 'consultor_elite' as RankId,
    status: 'activo' as const,
    role: 'socio' as UserRole,
    personalPv: 0,
    personalCv: 0,
    leftBranchCv: 0,
    rightBranchCv: 0,
    teamCv: 0,
    directCount: 0,
    activeLines: 0,
    firstWeekPurchase: false,
    uplineUids: params.uplineUids.slice(0, 20),
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'partners', params.id), partnerData);
    await setDoc(doc(db, 'partners', params.id, 'private', 'info'), {
      partnerId: params.id,
      ownerUid: params.ownerUid,
      email: params.email,
      phone: params.phone || '+591',
      ciNumber: params.ciNumber || 'Pendiente',
      city: params.city || 'Santa Cruz',
      bankName: params.bankName || 'Por definir',
      bankAccount: params.bankAccount || 'Por definir',
      updatedAt: serverTimestamp(),
    });
    return { ...partnerData } as Partner;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `partners/${params.id}`);
  }
}

export async function adminCreatePartner(params: {
  adminUid: string;
  fullName: string;
  referralCode?: string;
  accessPin?: string;
  sponsorId: string;
  binaryParentId: string;
  binaryLeg: BinaryLeg;
  packageTier: PackageTier;
  rankId: RankId;
  role: UserRole;
  status: 'activo' | 'pendiente' | 'inactivo';
  personalPv: number;
  personalCv: number;
  firstWeekPurchase: boolean;
  ownerUid?: string;
  email: string;
  phone: string;
  ciNumber: string;
  city: string;
  bankName: string;
  bankAccount: string;
  sponsorPartner?: Partner | null;
}): Promise<Partner & { plainPin?: string }> {
  const id = makeId('soc');
  const cleanName = params.fullName.trim().slice(0, 120);
  const rawOwnerUid = (params.ownerUid || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const effectiveOwnerUid = (rawOwnerUid || params.adminUid).slice(0, 128);

  const rawRef = (params.referralCode || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const prefix = cleanName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X').padEnd(3, 'X');
  const referralCode = (rawRef.length >= 3 ? rawRef : `VN-${prefix}-${Math.floor(100 + Math.random() * 899)}`).slice(0, 32);

  const cleanPin = params.accessPin ? normalizeAffiliatePin(params.accessPin) : '';
  let pinHash = '';
  if (cleanPin.length > 0) {
    if (cleanPin.length < 4 || cleanPin.length > 16) {
      throw new Error('El PIN de acceso debe tener entre 4 y 16 caracteres.');
    }
    pinHash = await hashAffiliatePin(cleanPin);
    const existingPinSnap = await getDoc(doc(db, 'affiliate_pins', pinHash));
    if (existingPinSnap.exists()) {
      throw new Error('Ese PIN ya está asignado a otro afiliado. Elige otro PIN o genera uno nuevo.');
    }
  }

  const uplineSet = new Set<string>([
    ...(params.sponsorPartner?.uplineUids || []),
    params.sponsorPartner?.ownerUid || '',
    params.adminUid,
    effectiveOwnerUid,
  ]);
  uplineSet.delete('');
  const uplineUids = Array.from(uplineSet).slice(0, 20);

  const pv = Math.max(0, Number(params.personalPv) || 0);
  const cv = Math.max(0, Number(params.personalCv) || 0);

  const partnerData = {
    id,
    ownerUid: effectiveOwnerUid,
    fullName: cleanName,
    referralCode,
    sponsorId: (params.sponsorId || 'vn_root').slice(0, 128),
    binaryParentId: (params.binaryParentId || params.sponsorId || 'vn_root').slice(0, 128),
    binaryLeg: params.binaryLeg,
    packageTier: params.packageTier,
    rankId: params.rankId,
    status: params.status,
    role: params.role,
    personalPv: pv,
    personalCv: cv,
    leftBranchCv: 0,
    rightBranchCv: 0,
    teamCv: cv,
    directCount: 0,
    activeLines: 0,
    firstWeekPurchase: Boolean(params.firstWeekPurchase),
    uplineUids,
    ...(pinHash ? { pinHash } : {}),
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'partners', id), partnerData);
    await setDoc(doc(db, 'partners', id, 'private', 'info'), {
      partnerId: id,
      ownerUid: effectiveOwnerUid,
      email: params.email.trim().slice(0, 200),
      phone: (params.phone.trim() || '+591').slice(0, 40),
      ciNumber: (params.ciNumber.trim() || 'Pendiente').slice(0, 40),
      city: (params.city.trim() || 'Santa Cruz de la Sierra').slice(0, 80),
      bankName: (params.bankName.trim() || 'Por definir').slice(0, 80),
      bankAccount: (params.bankAccount.trim() || 'Por definir').slice(0, 64),
      updatedAt: serverTimestamp(),
    });

    if (pinHash && cleanPin) {
      await setDoc(doc(db, 'affiliate_pins', pinHash), {
        id: pinHash,
        pinCode: cleanPin,
        partnerId: id,
        partnerName: cleanName,
        referralCode,
        active: true,
        claimedByUid: rawOwnerUid || '',
        createdBy: params.adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (params.sponsorPartner) {
      await updateDoc(doc(db, 'partners', params.sponsorPartner.id), {
        directCount: (params.sponsorPartner.directCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    }

    await logAudit(
      'PARTNER_CREATED_BY_ADMIN',
      'partners',
      id,
      `Afiliado creado desde Panel de Administrador: ${cleanName} (${referralCode}) · Paquete ${params.packageTier}${cleanPin ? ' · con PIN de acceso' : ''}`
    );

    return { ...(partnerData as Partner), plainPin: cleanPin || undefined };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `partners/${id}`);
  }
}

export async function adminAssignAffiliatePin(
  partner: Partner,
  adminUid: string,
  customPin?: string
): Promise<AffiliatePin> {
  const cleanPin = normalizeAffiliatePin(customPin || generateRandomAffiliatePin());
  if (cleanPin.length < 4 || cleanPin.length > 16) {
    throw new Error('El PIN debe tener entre 4 y 16 caracteres alfanuméricos.');
  }
  const pinHash = await hashAffiliatePin(cleanPin);
  try {
    const existingPinSnap = await getDoc(doc(db, 'affiliate_pins', pinHash));
    if (existingPinSnap.exists()) {
      const existingData = existingPinSnap.data() as AffiliatePin;
      if (existingData.partnerId !== partner.id) {
        throw new Error('Ese PIN ya pertenece a otro afiliado. Elige otro PIN.');
      }
    }

    if (partner.pinHash && partner.pinHash !== pinHash) {
      try {
        await deleteDoc(doc(db, 'affiliate_pins', partner.pinHash));
      } catch {
        // Ignore if old PIN doc does not exist
      }
    }

    const pinDoc: Omit<AffiliatePin, 'createdAt' | 'updatedAt'> = {
      id: pinHash,
      pinCode: cleanPin,
      partnerId: partner.id,
      partnerName: partner.fullName.slice(0, 120),
      referralCode: partner.referralCode.slice(0, 32),
      active: true,
      claimedByUid: '',
      createdBy: adminUid,
    };

    await setDoc(doc(db, 'affiliate_pins', pinHash), {
      ...pinDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'partners', partner.id), {
      pinHash,
      updatedAt: serverTimestamp(),
    });

    await logAudit(
      'PARTNER_PIN_ISSUED',
      'affiliate_pins',
      pinHash,
      `PIN de acceso asignado a ${partner.fullName} (${partner.referralCode})`
    );

    return { ...pinDoc, createdAt: null, updatedAt: null };
  } catch (error) {
    if (error instanceof Error && error.message.includes('pertenece a otro afiliado')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `affiliate_pins/${pinHash}`);
  }
}

export async function adminToggleAffiliatePin(pin: AffiliatePin, active: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'affiliate_pins', pin.id), {
      active,
      updatedAt: serverTimestamp(),
    });
    await logAudit(
      active ? 'PARTNER_PIN_ENABLED' : 'PARTNER_PIN_DISABLED',
      'affiliate_pins',
      pin.id,
      `PIN de ${pin.partnerName} ${active ? 'activado' : 'desactivado'}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `affiliate_pins/${pin.id}`);
  }
}

export async function adminResetAffiliatePinClaim(pin: AffiliatePin): Promise<void> {
  try {
    await updateDoc(doc(db, 'affiliate_pins', pin.id), {
      claimedByUid: '',
      active: true,
      updatedAt: serverTimestamp(),
    });
    await logAudit(
      'PARTNER_PIN_UNLOCKED',
      'affiliate_pins',
      pin.id,
      `Vinculación de Google restablecida para el PIN de ${pin.partnerName}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `affiliate_pins/${pin.id}`);
  }
}

export async function verifyAndClaimAffiliatePin(
  rawPin: string,
  userUid: string,
  isBootAdmin: boolean
): Promise<{ partnerId: string; partnerName: string; referralCode: string }> {
  const cleanPin = normalizeAffiliatePin(rawPin);
  if (cleanPin.length < 4 || cleanPin.length > 16) {
    throw new Error('Ingresa un PIN válido de 4 a 16 caracteres.');
  }
  const pinHash = await hashAffiliatePin(cleanPin);

  let pinSnap;
  try {
    pinSnap = await getDoc(doc(db, 'affiliate_pins', pinHash));
  } catch {
    throw new Error('PIN inválido, inactivo o ya vinculado a otra cuenta de Google.');
  }

  if (!pinSnap.exists()) {
    throw new Error('PIN no encontrado. Verifica el código con el Administrador.');
  }

  const pinData = pinSnap.data() as AffiliatePin;
  if (!pinData.active) {
    throw new Error('Este PIN está desactivado por el Administrador.');
  }

  if (isBootAdmin) {
    return {
      partnerId: pinData.partnerId,
      partnerName: pinData.partnerName,
      referralCode: pinData.referralCode,
    };
  }

  if (pinData.claimedByUid && pinData.claimedByUid !== userUid) {
    throw new Error('Este PIN ya está vinculado a otra cuenta de Google. Pide un nuevo PIN al Administrador.');
  }

  if (!pinData.claimedByUid) {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'affiliate_pins', pinHash), {
        claimedByUid: userUid,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'partners', pinData.partnerId), {
        ownerUid: userUid,
        uplineUids: arrayUnion(userUid),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'partners', pinData.partnerId, 'private', 'info'), {
        ownerUid: userUid,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `affiliate_pins/${pinHash}`);
    }
  }

  return {
    partnerId: pinData.partnerId,
    partnerName: pinData.partnerName,
    referralCode: pinData.referralCode,
  };
}

export async function verifyAffiliatePinDirect(
  rawPin: string
): Promise<{ partnerId: string; pinHash: string; partnerName: string; referralCode: string }> {
  const cleanPin = normalizeAffiliatePin(rawPin);
  if (cleanPin.length < 4 || cleanPin.length > 16) {
    throw new Error('Ingresa un PIN válido de 4 a 16 caracteres.');
  }
  const pinHash = await hashAffiliatePin(cleanPin);

  let pinSnap;
  try {
    pinSnap = await getDoc(doc(db, 'affiliate_pins', pinHash));
  } catch {
    throw new Error('PIN no encontrado o desactivado. Verifica el código con el Administrador.');
  }

  if (!pinSnap.exists()) {
    throw new Error('PIN no encontrado. Verifica el código con el Administrador.');
  }

  const pinData = pinSnap.data() as AffiliatePin;
  if (!pinData.active) {
    throw new Error('Este PIN está desactivado por el Administrador.');
  }

  const partnerSnap = await getDoc(doc(db, 'partners', pinData.partnerId));
  if (!partnerSnap.exists()) {
    throw new Error('La ficha del afiliado asociado a este PIN ya no existe.');
  }

  return {
    partnerId: pinData.partnerId,
    pinHash,
    partnerName: pinData.partnerName,
    referralCode: pinData.referralCode,
  };
}

export async function adminUpdatePartnerPrivateEmail(
  partner: Partner,
  email: string
): Promise<void> {
  const cleanEmail = email.trim().slice(0, 200);
  try {
    const ref = doc(db, 'partners', partner.id, 'private', 'info');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        email: cleanEmail,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        partnerId: partner.id,
        ownerUid: partner.ownerUid,
        email: cleanEmail,
        phone: '+591',
        ciNumber: 'Pendiente',
        city: 'Santa Cruz de la Sierra',
        bankName: 'Por definir',
        bankAccount: 'Por definir',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `partners/${partner.id}/private/info`);
  }
}

export async function updatePartnerPrivateInfo(
  partnerId: string,
  updates: Pick<PartnerPrivateInfo, 'phone' | 'ciNumber' | 'city' | 'bankName' | 'bankAccount'>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'partners', partnerId, 'private', 'info'), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `partners/${partnerId}/private/info`);
  }
}

export async function adminUpdatePartner(
  partnerId: string,
  updates: Partial<
    Pick<
      Partner,
      | 'role'
      | 'status'
      | 'packageTier'
      | 'rankId'
      | 'fullName'
      | 'personalPv'
      | 'personalCv'
      | 'leftBranchCv'
      | 'rightBranchCv'
      | 'teamCv'
      | 'sponsorId'
      | 'firstWeekPurchase'
    >
  >
): Promise<void> {
  try {
    await updateDoc(doc(db, 'partners', partnerId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await logAudit(
      'PARTNER_UPDATED',
      'partners',
      partnerId,
      `Actualización administrativa de socio ${partnerId}: ${JSON.stringify(updates)}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `partners/${partnerId}`);
  }
}

export async function adminDeletePartner(partnerId: string, partnerName: string): Promise<void> {
  try {
    try {
      const pinSnaps = await getDocs(query(collection(db, 'affiliate_pins'), where('partnerId', '==', partnerId)));
      for (const pDoc of pinSnaps.docs) {
        await deleteDoc(doc(db, 'affiliate_pins', pDoc.id));
      }
    } catch {
      // Ignore if no PIN docs exist
    }
    try {
      const privSnap = await getDoc(doc(db, 'partners', partnerId, 'private', 'info'));
      if (privSnap.exists()) {
        await deleteDoc(doc(db, 'partners', partnerId, 'private', 'info'));
      }
    } catch {
      // Ignore if private info doc does not exist
    }
    await deleteDoc(doc(db, 'partners', partnerId));
    await logAudit(
      'PARTNER_DELETED',
      'partners',
      partnerId,
      `Socio eliminado por administración: ${partnerName} (${partnerId})`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `partners/${partnerId}`);
  }
}

export async function adminDeleteOrder(orderId: string, orderNumber: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'orders', orderId));
    await logAudit('ORDER_DELETED', 'orders', orderId, `Pedido eliminado: ${orderNumber}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
  }
}

export async function adminCreateManualCommission(params: {
  partner: Partner;
  bonusType: BonusType;
  amountBs: number;
  baseCv: number;
  ratePercent: number;
  description: string;
}): Promise<void> {
  const id = makeId('com');
  const period = formatPeriodMonth();
  try {
    await setDoc(doc(db, 'commissions', id), {
      id,
      partnerId: params.partner.id,
      partnerUid: params.partner.ownerUid,
      partnerName: params.partner.fullName,
      sourceOrderId: 'admin_manual',
      bonusType: params.bonusType,
      level: 1,
      baseCv: params.baseCv,
      ratePercent: params.ratePercent,
      amountBs: params.amountBs,
      status: 'disponible',
      periodMonth: period,
      description: params.description.slice(0, 230),
      createdAt: serverTimestamp(),
    });
    await logAudit(
      'COMMISSION_MANUAL_CREATED',
      'commissions',
      id,
      `Comisión manual ${params.bonusType} de ${params.amountBs} Bs acreditada a ${params.partner.fullName}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `commissions/${id}`);
  }
}

export async function adminUpdateCommissionStatus(
  commissionId: string,
  status: CommissionStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'commissions', commissionId), { status });
    await logAudit(
      'COMMISSION_STATUS_UPDATED',
      'commissions',
      commissionId,
      `Estado de comisión ${commissionId} cambiado a ${status}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commissions/${commissionId}`);
  }
}

export async function adminDeleteCommission(commissionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'commissions', commissionId));
    await logAudit('COMMISSION_DELETED', 'commissions', commissionId, `Comisión eliminada: ${commissionId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `commissions/${commissionId}`);
  }
}

export async function createOrder(order: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = makeId('ord');
  const orderNumber = `VN-2026-${Math.floor(1000 + Math.random() * 8999)}`;
  let pinProof = '';
  if (!auth.currentUser) {
    try {
      pinProof = sessionStorage.getItem('vn_pin_hash') || '';
    } catch {
      pinProof = '';
    }
  }
  try {
    await setDoc(doc(db, 'orders', id), {
      ...order,
      ...(pinProof ? { pinProof } : {}),
      id,
      orderNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return orderNumber;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `orders/${id}`);
  }
}

export async function validateOrderAndGenerateBonuses(
  order: Order,
  decision: 'validado' | 'rechazado',
  allPartners: Partner[],
  cvToBsRate = CV_TO_BS_DEFAULT
): Promise<void> {
  const adminEmail = auth.currentUser?.email ?? 'admin@vivenext.bo';
  try {
    await updateDoc(doc(db, 'orders', order.id), {
      paymentStatus: decision,
      validatedBy: adminEmail,
      updatedAt: serverTimestamp(),
    });

    if (decision === 'rechazado') {
      await logAudit('ORDER_REJECTED', 'orders', order.id, `Pedido ${order.orderNumber} rechazado.`);
      return;
    }

    const buyer = allPartners.find((p) => p.id === order.partnerId);
    if (buyer) {
      let nextTier: PackageTier = buyer.packageTier;
      const tierOrder: Record<PackageTier, number> = { base: 1, emprendedor: 2, elite: 3 };
      for (const item of order.items) {
        if (item.isPackage && item.packageTier !== 'none') {
          if (tierOrder[item.packageTier] > tierOrder[nextTier]) {
            nextTier = item.packageTier;
          }
        }
      }
      const newPv = buyer.personalPv + order.totalPv;
      const newCv = buyer.personalCv + order.totalCv;
      const newTeamCv = buyer.teamCv + order.totalCv;
      const nextRank = determineQualifiedRank(newPv, newTeamCv, buyer.rankId);
      const dayOfMonth = new Date().getDate();

      await updateDoc(doc(db, 'partners', buyer.id), {
        personalPv: newPv,
        personalCv: newCv,
        teamCv: newTeamCv,
        packageTier: nextTier,
        rankId: nextRank,
        status: newPv >= 75 ? 'activo' : buyer.status,
        firstWeekPurchase: buyer.firstWeekPurchase || dayOfMonth <= 7,
        updatedAt: serverTimestamp(),
      });

      // Propagate Binary leg CV & Team CV up the binary/sponsor chain
      let child = buyer;
      let depth = 0;
      while (child.binaryParentId && depth < 12) {
        const parent = allPartners.find((p) => p.id === child.binaryParentId);
        if (!parent) break;
        const leftAdd = child.binaryLeg === 'left' ? order.totalCv : 0;
        const rightAdd = child.binaryLeg === 'right' ? order.totalCv : 0;
        const updatedTeamCv = parent.teamCv + order.totalCv;
        await updateDoc(doc(db, 'partners', parent.id), {
          leftBranchCv: parent.leftBranchCv + leftAdd,
          rightBranchCv: parent.rightBranchCv + rightAdd,
          teamCv: updatedTeamCv,
          rankId: determineQualifiedRank(parent.personalPv, updatedTeamCv, parent.rankId),
          updatedAt: serverTimestamp(),
        });
        child = parent;
        depth++;
      }

      const period = formatPeriodMonth();

      // Bono 2: Inicio Rápido (25% / 3% / 2%) over 30% surcharge pool
      if (order.isFirstPurchase && order.surchargeBs > 0) {
        const rates = [
          { level: 1, pct: 25, shareOfPool: 25 / 30 },
          { level: 2, pct: 3, shareOfPool: 3 / 30 },
          { level: 3, pct: 2, shareOfPool: 2 / 30 },
        ];
        let currentSponsorId = buyer.sponsorId;
        for (const r of rates) {
          if (!currentSponsorId) break;
          const sponsor = allPartners.find((p) => p.id === currentSponsorId);
          if (!sponsor) break;
          if (sponsor.status === 'activo') {
            const amountBs = Math.round(order.surchargeBs * r.shareOfPool * 100) / 100;
            const cid = makeId('com');
            await setDoc(doc(db, 'commissions', cid), {
              id: cid,
              partnerId: sponsor.id,
              partnerUid: sponsor.ownerUid,
              partnerName: sponsor.fullName,
              sourceOrderId: order.id,
              bonusType: 'B2_INICIO_RAPIDO',
              level: r.level,
              baseCv: order.totalCv,
              ratePercent: r.pct,
              amountBs,
              status: 'disponible',
              periodMonth: period,
              description: `Bono Inicio Rápido N${r.level} (${r.pct}%) · Pedido ${order.orderNumber} de ${buyer.fullName}`,
              createdAt: serverTimestamp(),
            });
          }
          currentSponsorId = sponsor.sponsorId;
        }
      } else if (order.totalCv > 0) {
        // Bono 3: Unilevel Residual 20% Fijo (nivel 1 sponsor if Emprendedor or Élite)
        let currentSponsorId = buyer.sponsorId;
        let lvl = 1;
        while (currentSponsorId && lvl <= 5) {
          const sponsor = allPartners.find((p) => p.id === currentSponsorId);
          if (!sponsor) break;
          const pkgSpec = AFFILIATION_PACKAGES[sponsor.packageTier];
          if (sponsor.status === 'activo' && pkgSpec.allowsUnilevel) {
            const rankSpec = RANK_MAP[sponsor.rankId];
            const capturableCv = Math.min(order.totalCv, rankSpec.unilevelLineLimitCv);
            const amountBs = Math.round(capturableCv * 0.2 * cvToBsRate * 100) / 100;
            const cid = makeId('com');
            await setDoc(doc(db, 'commissions', cid), {
              id: cid,
              partnerId: sponsor.id,
              partnerUid: sponsor.ownerUid,
              partnerName: sponsor.fullName,
              sourceOrderId: order.id,
              bonusType: 'B3_UNILEVEL',
              level: lvl,
              baseCv: capturableCv,
              ratePercent: 20,
              amountBs,
              status: 'disponible',
              periodMonth: period,
              description: `Unilevel 20% Fijo N${lvl} · Recompra ${order.orderNumber} de ${buyer.fullName}`,
              createdAt: serverTimestamp(),
            });
            break;
          }
          currentSponsorId = sponsor.sponsorId;
          lvl++;
        }
      }
    }

    await logAudit(
      'ORDER_VALIDATED',
      'orders',
      order.id,
      `Pedido ${order.orderNumber} (${order.totalBs} Bs / ${order.totalPv} PV / ${order.totalCv} CV) validado con acreditación de bonos.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${order.id}`);
  }
}

export async function runMonthlyCompensationCycle(
  partners: Partner[],
  config: PlanConfig
): Promise<{ generatedCount: number; totalBs: number }> {
  const period = formatPeriodMonth();
  let generatedCount = 0;
  let totalBs = 0;

  try {
    const eliteActives = partners.filter(
      (p) => p.status === 'activo' && p.packageTier === 'elite' && p.personalPv >= config.minMonthlyPv
    );

    const binaryTotalsByPartner: Record<string, number> = {};

    for (const p of eliteActives) {
      const minorCv = Math.min(p.leftBranchCv, p.rightBranchCv);
      const majorCv = Math.max(p.leftBranchCv, p.rightBranchCv);
      if (minorCv <= 0) continue;

      const eqRatio = majorCv > 0 ? (minorCv / majorCv) * 100 : 100;
      if (eqRatio < config.binaryEquilibriumPercent) continue;

      const rank = RANK_MAP[p.rankId];
      const rawBinBs = minorCv * (rank.binaryPercent / 100) * config.cvToBsRate;
      const binBs = Math.min(Math.round(rawBinBs * 100) / 100, rank.binaryMonthlyCapBs);

      if (binBs > 0) {
        const cid = makeId('com');
        await setDoc(doc(db, 'commissions', cid), {
          id: cid,
          partnerId: p.id,
          partnerUid: p.ownerUid,
          partnerName: p.fullName,
          sourceOrderId: `cycle_${period}`,
          bonusType: 'B4_BINARIO',
          level: 0,
          baseCv: minorCv,
          ratePercent: rank.binaryPercent,
          amountBs: binBs,
          status: 'disponible',
          periodMonth: period,
          description: `Cierre Binario Híbrido ${rank.name} (${rank.binaryPercent}%) sobre ${minorCv} CV rama menor`,
          createdAt: serverTimestamp(),
        });
        binaryTotalsByPartner[p.id] = binBs;
        generatedCount++;
        totalBs += binBs;

        if (p.firstWeekPurchase && p.personalPv >= rank.progressiveWeek1Pv) {
          const progBs = Math.round(minorCv * 0.05 * config.cvToBsRate * 100) / 100;
          const pid = makeId('com');
          await setDoc(doc(db, 'commissions', pid), {
            id: pid,
            partnerId: p.id,
            partnerUid: p.ownerUid,
            partnerName: p.fullName,
            sourceOrderId: `cycle_${period}`,
            bonusType: 'B5_BINARIO_PROGRESIVO',
            level: 0,
            baseCv: minorCv,
            ratePercent: 5,
            amountBs: progBs,
            status: 'disponible',
            periodMonth: period,
            description: `Binario Progresivo +5% Extra (1ª semana ${p.personalPv} PV)`,
            createdAt: serverTimestamp(),
          });
          generatedCount++;
          totalBs += progBs;
        }
      }
    }

    // Bono 6: Matching 50% Nivel 1 on directs' binary earnings
    for (const p of eliteActives) {
      const directsBinary = partners
        .filter((d) => d.sponsorId === p.id)
        .reduce((sum, d) => sum + (binaryTotalsByPartner[d.id] ?? 0), 0);
      if (directsBinary > 0) {
        const matchBs = Math.round(directsBinary * 0.5 * 100) / 100;
        const mid = makeId('com');
        await setDoc(doc(db, 'commissions', mid), {
          id: mid,
          partnerId: p.id,
          partnerUid: p.ownerUid,
          partnerName: p.fullName,
          sourceOrderId: `cycle_${period}`,
          bonusType: 'B6_MATCHING',
          level: 1,
          baseCv: Math.round(directsBinary / config.cvToBsRate),
          ratePercent: 50,
          amountBs: matchBs,
          status: 'disponible',
          periodMonth: period,
          description: `Matching Bonus 50% Nivel 1 sobre binario de directos (${period})`,
          createdAt: serverTimestamp(),
        });
        generatedCount++;
        totalBs += matchBs;
      }
    }

    await logAudit(
      'CYCLE_EXECUTED',
      'commissions',
      period,
      `Cierre de ciclo ${period}: ${generatedCount} comisiones generadas por un total de ${totalBs.toFixed(2)} Bs.`
    );
    return { generatedCount, totalBs: Math.round(totalBs * 100) / 100 };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'commissions/cycle');
  }
}

export async function requestWithdrawal(payload: {
  partnerId: string;
  partnerUid: string;
  partnerName: string;
  amountBs: number;
  method: Withdrawal['method'];
  destinationAccount: string;
}): Promise<void> {
  const id = makeId('wdr');
  let pinProof = '';
  if (!auth.currentUser) {
    try {
      pinProof = sessionStorage.getItem('vn_pin_hash') || '';
    } catch {
      pinProof = '';
    }
  }
  try {
    await setDoc(doc(db, 'withdrawals', id), {
      ...payload,
      ...(pinProof ? { pinProof } : {}),
      id,
      status: 'pendiente',
      reviewedBy: '',
      reviewNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `withdrawals/${id}`);
  }
}

export async function reviewWithdrawal(
  withdrawal: Withdrawal,
  decision: 'aprobado' | 'rechazado',
  reviewNote: string
): Promise<void> {
  const adminEmail = auth.currentUser?.email ?? 'admin@vivenext.bo';
  try {
    await updateDoc(doc(db, 'withdrawals', withdrawal.id), {
      status: decision,
      reviewedBy: adminEmail,
      reviewNote: reviewNote.slice(0, 230),
      updatedAt: serverTimestamp(),
    });
    await logAudit(
      decision === 'aprobado' ? 'WITHDRAWAL_APPROVED' : 'WITHDRAWAL_REJECTED',
      'withdrawals',
      withdrawal.id,
      `Retiro de ${withdrawal.partnerName} por ${withdrawal.amountBs.toFixed(2)} Bs marcado como ${decision}.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `withdrawals/${withdrawal.id}`);
  }
}

export async function saveProduct(
  product: Omit<Product, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  try {
    if (isNew) {
      await setDoc(doc(db, 'products', product.id), {
        ...product,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAudit('PRODUCT_CREATED', 'products', product.id, `Producto subido: ${product.name} (${product.wholesalePriceBs} Bs)`);
    } else {
      await updateDoc(doc(db, 'products', product.id), {
        sku: product.sku,
        name: product.name,
        category: product.category,
        isPackage: product.isPackage,
        packageTier: product.packageTier,
        retailPriceBs: product.retailPriceBs,
        wholesalePriceBs: product.wholesalePriceBs,
        firstPurchaseSurchargeBs: product.firstPurchaseSurchargeBs,
        pv: product.pv,
        cv: product.cv,
        stock: product.stock,
        active: product.active,
        imageUrl: product.imageUrl,
        description: product.description,
        updatedAt: serverTimestamp(),
      });
      await logAudit('PRODUCT_UPDATED', 'products', product.id, `Producto modificado: ${product.name}`);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, `products/${product.id}`);
  }
}

export async function deleteProduct(productId: string, productName: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'products', productId));
    await logAudit('PRODUCT_DELETED', 'products', productId, `Producto eliminado del catálogo: ${productName}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
  }
}

export async function compressProductImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida.'));
      img.onload = () => {
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        if (dataUrl.length > 140000) {
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function updatePlanConfig(config: Omit<PlanConfig, 'updatedAt' | 'updatedBy'>): Promise<void> {
  const adminEmail = auth.currentUser?.email ?? 'admin@vivenext.bo';
  try {
    await setDoc(doc(db, 'plan_config', config.id), {
      ...config,
      updatedBy: adminEmail,
      updatedAt: serverTimestamp(),
    });
    await logAudit(
      'PLAN_CONFIG_UPDATED',
      'plan_config',
      config.id,
      `Parámetros del plan actualizados: 1 CV = ${config.cvToBsRate} Bs, Recompra ${config.minMonthlyPv} PV, Tope ${config.maxPayoutRatioPercent}%.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `plan_config/${config.id}`);
  }
}

export function subscribeProducts(isAdmin: boolean, cb: (items: Product[]) => void): Unsubscribe {
  const path = 'products';
  const q = isAdmin
    ? query(collection(db, path))
    : query(collection(db, path), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => d.data() as Product));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribePartners(uid: string, isAdmin: boolean, cb: (items: Partner[]) => void): Unsubscribe {
  const path = 'partners';
  const q = isAdmin
    ? query(collection(db, path))
    : query(collection(db, path), where('uplineUids', 'array-contains', uid));
  return onSnapshot(
    q,
    async (snap) => {
      const list = snap.docs.map((d) => d.data() as Partner);
      if (!isAdmin) {
        try {
          const ownSnap = await getDocs(query(collection(db, path), where('ownerUid', '==', uid)));
          ownSnap.docs.forEach((d) => {
            const item = d.data() as Partner;
            if (!list.some((x) => x.id === item.id)) list.push(item);
          });
          const rootDoc = await getDoc(doc(db, path, 'vn_root'));
          if (rootDoc.exists() && !list.some((x) => x.id === 'vn_root')) {
            list.push(rootDoc.data() as Partner);
          }
        } catch {
          // Ignore optional root lookup if absent
        }
      }
      cb(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribePartnersForPin(partnerId: string, cb: (items: Partner[]) => void): Unsubscribe {
  const path = 'partners';
  const q = query(collection(db, path), where('status', 'in', ['activo', 'pendiente', 'inactivo']));
  return onSnapshot(
    q,
    async (snap) => {
      const list = snap.docs.map((d) => d.data() as Partner);
      if (!list.some((p) => p.id === partnerId)) {
        try {
          const ownDoc = await getDoc(doc(db, path, partnerId));
          if (ownDoc.exists()) list.push(ownDoc.data() as Partner);
        } catch {
          // Ignore if partner doc is missing or inaccessible
        }
      }
      cb(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeOrders(uid: string, isAdmin: boolean, cb: (items: Order[]) => void): Unsubscribe {
  const path = 'orders';
  const q = isAdmin
    ? query(collection(db, path), orderBy('createdAt', 'desc'))
    : query(collection(db, path), where('buyerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Order)),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeOrdersForPartner(partnerId: string, cb: (items: Order[]) => void): Unsubscribe {
  const path = 'orders';
  const q = query(collection(db, path), where('partnerId', '==', partnerId));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Order)),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeCommissions(uid: string, isAdmin: boolean, cb: (items: Commission[]) => void): Unsubscribe {
  const path = 'commissions';
  const q = isAdmin
    ? query(collection(db, path), orderBy('createdAt', 'desc'))
    : query(collection(db, path), where('partnerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Commission)),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeCommissionsForPartner(partnerId: string, cb: (items: Commission[]) => void): Unsubscribe {
  const path = 'commissions';
  const q = query(collection(db, path), where('partnerId', '==', partnerId));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Commission)),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeWithdrawals(uid: string, isAdmin: boolean, cb: (items: Withdrawal[]) => void): Unsubscribe {
  const path = 'withdrawals';
  const q = isAdmin
    ? query(collection(db, path), orderBy('createdAt', 'desc'))
    : query(collection(db, path), where('partnerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Withdrawal)),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeWithdrawalsForPartner(partnerId: string, cb: (items: Withdrawal[]) => void): Unsubscribe {
  const path = 'withdrawals';
  const q = query(collection(db, path), where('partnerId', '==', partnerId));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Withdrawal)),
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribePlanConfig(cb: (cfg: PlanConfig | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'plan_config', 'default'),
    (snap) => cb(snap.exists() ? (snap.data() as PlanConfig) : null),
    (err) => handleFirestoreError(err, OperationType.GET, 'plan_config/default')
  );
}

export function subscribeAuditLogs(cb: (items: AuditLog[]) => void): Unsubscribe {
  const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as AuditLog)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs')
  );
}

export function subscribeAffiliatePins(cb: (items: AffiliatePin[]) => void): Unsubscribe {
  const q = query(collection(db, 'affiliate_pins'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as AffiliatePin)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'affiliate_pins')
  );
}

export async function fetchPartnerPrivateInfo(partnerId: string): Promise<PartnerPrivateInfo | null> {
  if (!auth.currentUser) return null;
  try {
    const snap = await getDoc(doc(db, 'partners', partnerId, 'private', 'info'));
    return snap.exists() ? (snap.data() as PartnerPrivateInfo) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `partners/${partnerId}/private/info`);
  }
}
