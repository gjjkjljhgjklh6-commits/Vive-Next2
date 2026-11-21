import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Focus,
  GitBranch,
  Maximize2,
  Minimize2,
  Network,
  Plus,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AFFILIATION_PACKAGES, RANK_MAP } from '../data/compensationPlan';
import {
  fetchPartnerPrivateInfo,
  registerPartnerNode,
  updatePartnerPrivateInfo,
} from '../services/firestoreService';
import type { BinaryLeg, PackageTier, Partner, PartnerPrivateInfo } from '../types/vivenext';

interface NetworkModuleProps {
  currentPartner: Partner;
  partners: Partner[];
  currentUserUid: string;
  isAdmin?: boolean;
  isPinSession?: boolean;
}

interface VisualTreeNode {
  key: string;
  partner?: Partner;
  parentPartnerId?: string;
  legLabel: string;
  binaryLeg?: 'left' | 'right';
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  totalDirectCount: number;
  children: VisualTreeNode[];
  subtreeWidth: number;
  x: number;
  y: number;
  centerX: number;
}

interface TreeEdge {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  depth: number;
  status: 'activo' | 'pendiente' | 'inactivo' | 'empty';
  isSelectedPath: boolean;
}

const NODE_W = 204;
const NODE_H = 104;
const H_GAP = 26;
const V_GAP = 64;
const PAD_X = 32;
const PAD_TOP = 38;
const PAD_BOTTOM = 28;

export const NetworkModule: React.FC<NetworkModuleProps> = ({
  currentPartner,
  partners,
  currentUserUid,
  isAdmin = false,
  isPinSession = false,
}) => {
  const defaultRootId = useMemo(() => {
    if (isAdmin) {
      return partners.find((p) => p.id === 'vn_root')?.id || currentPartner.id;
    }
    return currentPartner.id;
  }, [isAdmin, partners, currentPartner.id]);

  const [treeView, setTreeView] = useState<'unilevel' | 'binary'>('unilevel');
  const [rootPartnerId, setRootPartnerId] = useState<string>(defaultRootId);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(currentPartner.id);
  const [zoom, setZoom] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Private PII modal/section for own node
  const [privateInfo, setPrivateInfo] = useState<PartnerPrivateInfo | null>(null);
  const [editingPii, setEditingPii] = useState(false);
  const [piiForm, setPiiForm] = useState({
    phone: '',
    ciNumber: '',
    city: '',
    bankName: '',
    bankAccount: '',
  });
  const [piiStatus, setPiiStatus] = useState('');

  // Recruit modal
  const [showRecruitModal, setShowRecruitModal] = useState(false);
  const [recruitSaving, setRecruitSaving] = useState(false);
  const [recruitError, setRecruitError] = useState('');
  const [recruitForm, setRecruitForm] = useState({
    fullName: '',
    sponsorId: currentPartner.id,
    binaryParentId: currentPartner.id,
    binaryLeg: 'left' as BinaryLeg,
    packageTier: 'emprendedor' as PackageTier,
    email: '',
    phone: '+591 ',
    ciNumber: '',
    city: 'Santa Cruz de la Sierra',
    bankName: 'Banco Mercantil Santa Cruz',
    bankAccount: '',
  });

  useEffect(() => {
    setRootPartnerId(defaultRootId);
  }, [defaultRootId]);

  useEffect(() => {
    let active = true;
    fetchPartnerPrivateInfo(currentPartner.id)
      .then((info) => {
        if (active && info) {
          setPrivateInfo(info);
          setPiiForm({
            phone: info.phone,
            ciNumber: info.ciNumber,
            city: info.city,
            bankName: info.bankName,
            bankAccount: info.bankAccount,
          });
        }
      })
      .catch(() => {
        // Handled cleanly if missing
      });
    return () => {
      active = false;
    };
  }, [currentPartner.id]);

  const activeRootPartner = useMemo(() => {
    return (
      partners.find((p) => p.id === rootPartnerId) ||
      partners.find((p) => p.id === defaultRootId) ||
      currentPartner
    );
  }, [partners, rootPartnerId, defaultRootId, currentPartner]);

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === selectedPartnerId) || currentPartner,
    [partners, selectedPartnerId, currentPartner]
  );

  const directReferrals = useMemo(
    () => partners.filter((p) => p.sponsorId === selectedPartner.id),
    [partners, selectedPartner.id]
  );

  const filteredPartners = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.referralCode.toLowerCase().includes(q) ||
        RANK_MAP[p.rankId]?.name.toLowerCase().includes(q)
    );
  }, [partners, searchTerm]);

  const minorCv = Math.min(selectedPartner.leftBranchCv, selectedPartner.rightBranchCv);
  const majorCv = Math.max(selectedPartner.leftBranchCv, selectedPartner.rightBranchCv);
  const eqPercent = majorCv > 0 ? Math.round((minorCv / majorCv) * 1000) / 10 : 100;

  const isNodeExpanded = (id: string, depth: number): boolean => {
    if (Object.prototype.hasOwnProperty.call(expandedNodes, id)) {
      return expandedNodes[id];
    }
    return treeView === 'binary' ? depth < 2 : depth < 3;
  };

  const toggleExpand = (id: string, currentDepth: number) => {
    const currentState = isNodeExpanded(id, currentDepth);
    setExpandedNodes((prev) => ({ ...prev, [id]: !currentState }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    partners.forEach((p) => {
      next[p.id] = true;
    });
    setExpandedNodes(next);
  };

  const handleCollapseToRoot = () => {
    const next: Record<string, boolean> = {};
    partners.forEach((p) => {
      next[p.id] = p.id === activeRootPartner.id;
    });
    setExpandedNodes(next);
  };

  const openRecruitForSlot = (parentPartnerId: string, leg: BinaryLeg) => {
    setRecruitForm((prev) => ({
      ...prev,
      sponsorId: parentPartnerId,
      binaryParentId: parentPartnerId,
      binaryLeg: leg,
    }));
    setShowRecruitModal(true);
  };

  // Build hierarchical tree structure & compute exact SVG branch coordinates
  const treeLayout = useMemo(() => {
    const visited = new Set<string>();

    const buildUnilevel = (partner: Partner, depth: number, legLabel: string): VisualTreeNode => {
      visited.add(partner.id);
      const childrenPartners = partners.filter((p) => p.sponsorId === partner.id && !visited.has(p.id));
      const expanded = isNodeExpanded(partner.id, depth);
      const children: VisualTreeNode[] = expanded
        ? childrenPartners.map((child, idx) =>
            buildUnilevel(child, depth + 1, `Rama ${idx + 1} · N${depth + 1}`)
          )
        : [];

      return {
        key: partner.id,
        partner,
        legLabel: depth === 0 ? 'Tronco Principal' : legLabel,
        depth,
        hasChildren: childrenPartners.length > 0,
        isExpanded: expanded,
        totalDirectCount: childrenPartners.length,
        children,
        subtreeWidth: NODE_W,
        x: 0,
        y: 0,
        centerX: 0,
      };
    };

    const buildBinary = (
      partner: Partner | undefined,
      depth: number,
      legLabel: string,
      parentPartnerId?: string,
      binaryLeg?: 'left' | 'right'
    ): VisualTreeNode => {
      if (!partner) {
        return {
          key: `empty_${parentPartnerId}_${binaryLeg}`,
          parentPartnerId,
          binaryLeg,
          legLabel,
          depth,
          hasChildren: false,
          isExpanded: false,
          totalDirectCount: 0,
          children: [],
          subtreeWidth: NODE_W,
          x: 0,
          y: 0,
          centerX: 0,
        };
      }

      visited.add(partner.id);
      const leftChild = partners.find(
        (p) => p.binaryParentId === partner.id && p.binaryLeg === 'left' && !visited.has(p.id)
      );
      const rightChild = partners.find(
        (p) => p.binaryParentId === partner.id && p.binaryLeg === 'right' && !visited.has(p.id)
      );
      const expanded = isNodeExpanded(partner.id, depth);

      const children: VisualTreeNode[] = expanded
        ? [
            buildBinary(leftChild, depth + 1, 'Rama Izquierda', partner.id, 'left'),
            buildBinary(rightChild, depth + 1, 'Rama Derecha', partner.id, 'right'),
          ]
        : [];

      return {
        key: partner.id,
        partner,
        binaryLeg,
        legLabel: depth === 0 ? 'Tronco Principal' : legLabel,
        depth,
        hasChildren: true,
        isExpanded: expanded,
        totalDirectCount: (leftChild ? 1 : 0) + (rightChild ? 1 : 0),
        children,
        subtreeWidth: NODE_W,
        x: 0,
        y: 0,
        centerX: 0,
      };
    };

    const rootTree =
      treeView === 'unilevel'
        ? buildUnilevel(activeRootPartner, 0, 'Tronco Principal')
        : buildBinary(activeRootPartner, 0, 'Tronco Principal');

    // Bottom-up width calculation
    let maxDepth = 0;
    const measure = (node: VisualTreeNode): number => {
      maxDepth = Math.max(maxDepth, node.depth);
      if (node.children.length === 0) {
        node.subtreeWidth = NODE_W;
        return NODE_W;
      }
      const childrenTotal =
        node.children.reduce((sum, child) => sum + measure(child), 0) +
        H_GAP * (node.children.length - 1);
      node.subtreeWidth = Math.max(NODE_W, childrenTotal);
      return node.subtreeWidth;
    };

    measure(rootTree);

    const flatNodes: VisualTreeNode[] = [];
    const edges: TreeEdge[] = [];

    const assign = (node: VisualTreeNode, leftX: number) => {
      const centerX = leftX + node.subtreeWidth / 2;
      node.centerX = centerX;
      node.x = centerX - NODE_W / 2;
      node.y = PAD_TOP + node.depth * (NODE_H + V_GAP);
      flatNodes.push(node);

      if (node.children.length > 0) {
        const childrenSpan =
          node.children.reduce((sum, c) => sum + c.subtreeWidth, 0) +
          H_GAP * (node.children.length - 1);
        let curX = centerX - childrenSpan / 2;
        for (const child of node.children) {
          assign(child, curX);
          curX += child.subtreeWidth + H_GAP;

          const childStatus: TreeEdge['status'] = !child.partner
            ? 'empty'
            : child.partner.status;
          const isSelectedPath =
            node.partner?.id === selectedPartner.id || child.partner?.id === selectedPartner.id;

          edges.push({
            id: `${node.key}__${child.key}`,
            fromX: node.centerX,
            fromY: node.y + NODE_H,
            toX: child.centerX,
            toY: child.y,
            depth: node.depth,
            status: childStatus,
            isSelectedPath,
          });
        }
      }
    };

    assign(rootTree, PAD_X);

    const canvasWidth = Math.max(680, rootTree.subtreeWidth + PAD_X * 2);
    const canvasHeight = PAD_TOP + (maxDepth + 1) * NODE_H + maxDepth * V_GAP + PAD_BOTTOM;

    return {
      rootTree,
      flatNodes,
      edges,
      canvasWidth,
      canvasHeight,
    };
  }, [partners, activeRootPartner, treeView, expandedNodes, selectedPartner.id]);

  const handleSavePii = async (e: React.FormEvent) => {
    e.preventDefault();
    setPiiStatus('');
    await updatePartnerPrivateInfo(currentPartner.id, piiForm);
    setPrivateInfo((prev) => (prev ? { ...prev, ...piiForm } : prev));
    setEditingPii(false);
    setPiiStatus('Datos personales y bancarios actualizados.');
  };

  const handleRecruitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPinSession) {
      setRecruitError('Para registrar nuevos afiliados desde tu red, inicia sesión con tu cuenta de Google o solicita el alta al Administrador.');
      return;
    }
    if (recruitForm.fullName.trim().length < 2) {
      setRecruitError('Ingresa el nombre del nuevo socio.');
      return;
    }
    setRecruitError('');
    setRecruitSaving(true);
    try {
      const sponsor = partners.find((p) => p.id === recruitForm.sponsorId) || currentPartner;
      const uplines = Array.from(new Set([currentUserUid, sponsor.ownerUid, ...(sponsor.uplineUids || [])]));
      const newId = `vn_p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await registerPartnerNode({
        id: newId,
        ownerUid: currentUserUid,
        fullName: recruitForm.fullName,
        sponsorId: sponsor.id,
        binaryParentId: recruitForm.binaryParentId || sponsor.id,
        binaryLeg: recruitForm.binaryLeg,
        packageTier: recruitForm.packageTier,
        uplineUids: uplines,
        email: recruitForm.email || `${newId}@vivenext.bo`,
        phone: recruitForm.phone,
        ciNumber: recruitForm.ciNumber,
        city: recruitForm.city,
        bankName: recruitForm.bankName,
        bankAccount: recruitForm.bankAccount,
      });
      setExpandedNodes((prev) => ({
        ...prev,
        [sponsor.id]: true,
        [recruitForm.binaryParentId || sponsor.id]: true,
      }));
      setShowRecruitModal(false);
      setRecruitForm((prev) => ({ ...prev, fullName: '', email: '', ciNumber: '', bankAccount: '' }));
    } catch (err) {
      setRecruitError(err instanceof Error ? err.message : 'No se pudo registrar el socio.');
    } finally {
      setRecruitSaving(false);
    }
  };

  const getEdgeStroke = (edge: TreeEdge): string => {
    if (edge.status === 'empty') return '#CBD5E1';
    if (edge.isSelectedPath) return '#8B1E24';
    if (edge.status === 'activo') return '#15803D';
    if (edge.status === 'pendiente') return '#D97706';
    return '#94A3B8';
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isAdmin ? 'Árbol Global de Red Multinivel' : 'Mi Red Multinivel y Ramas'}
          </h1>
          <p className="text-sm text-slate-500">
            Visualización orgánica en árbol con ramas de patrocinio unilevel y estructura binaria izquierda/derecha.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setTreeView('unilevel')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                treeView === 'unilevel' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Árbol de Patrocinio
            </button>
            <button
              type="button"
              onClick={() => setTreeView('binary')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                treeView === 'binary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Árbol Binario (Izq / Der)
            </button>
          </div>
          <button
            type="button"
            onClick={() => openRecruitForSlot(selectedPartner.id, 'left')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Afiliar Socio
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Socios en Red</div>
          <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">{partners.length}</div>
          <div className="text-xs text-slate-500 mt-1">
            {partners.filter((p) => p.status === 'activo').length} activos (≥ 75 PV)
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Rama Izquierda / Derecha</div>
          <div className="text-lg font-bold text-slate-900 font-mono-num mt-1">
            {selectedPartner.leftBranchCv.toLocaleString('es-BO')} /{' '}
            {selectedPartner.rightBranchCv.toLocaleString('es-BO')} CV
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Rama menor: <span className="font-mono-num font-semibold text-slate-800">{minorCv.toLocaleString('es-BO')} CV</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Equilibrio Binario (Garantía C)</div>
          <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">{eqPercent}%</div>
          <div className={`text-xs font-medium mt-1 ${eqPercent >= 30 ? 'text-[#15803D]' : 'text-[#B45309]'}`}>
            {eqPercent >= 30 ? 'Cumple mínimo ≥ 30%' : 'Requiere balance ≥ 30%'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Tu Código de Patrocinador</div>
          <div className="text-lg font-bold text-slate-900 font-mono-num mt-1">
            {currentPartner.referralCode}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Paquete: {AFFILIATION_PACKAGES[currentPartner.packageTier].name}
          </div>
        </div>
      </div>

      {/* Main Split: Tree Canvas + Selected Partner Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Tree Toolbar */}
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {treeView === 'unilevel' ? (
                <Network className="w-4 h-4 text-[#8B1E24] shrink-0" />
              ) : (
                <GitBranch className="w-4 h-4 text-[#8B1E24] shrink-0" />
              )}
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 truncate">
                  {treeView === 'unilevel' ? 'Árbol y Ramas de Patrocinio' : 'Árbol Binario con Ramas'} ·{' '}
                  <span className="text-[#8B1E24]">{activeRootPartner.fullName}</span>
                </h2>
                <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                  <span>Rama Activa (Verde)</span>
                  <span aria-hidden="true">·</span>
                  <span>Nodo Seleccionado (Carmesí)</span>
                  <span aria-hidden="true">·</span>
                  <span>Pendiente (Ámbar)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {activeRootPartner.id !== defaultRootId && (
                <button
                  type="button"
                  onClick={() => setRootPartnerId(defaultRootId)}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#8B1E24] border border-[#8B1E24]/30 rounded-lg hover:bg-red-50 whitespace-nowrap cursor-pointer"
                >
                  Volver a raíz
                </button>
              )}
              <button
                type="button"
                onClick={handleExpandAll}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                title="Expandir todas las ramas"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expandir</span>
              </button>
              <button
                type="button"
                onClick={handleCollapseToRoot}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                title="Contraer ramas"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Contraer</span>
              </button>
              <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.65, Math.round((z - 0.1) * 100) / 100))}
                  className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                  aria-label="Alejar árbol"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-[11px] font-mono-num text-slate-700">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.25, Math.round((z + 0.1) * 100) / 100))}
                  className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                  aria-label="Acercar árbol"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Tree & Branches Canvas */}
          <div className="overflow-auto bg-slate-50/70 p-4 min-h-[440px] max-h-[640px]">
            <div
              style={{
                width: treeLayout.canvasWidth * zoom,
                height: treeLayout.canvasHeight * zoom,
              }}
              className="mx-auto relative"
            >
              <div
                style={{
                  width: treeLayout.canvasWidth,
                  height: treeLayout.canvasHeight,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
                className="relative"
              >
                {/* SVG Branches Layer */}
                <svg
                  width={treeLayout.canvasWidth}
                  height={treeLayout.canvasHeight}
                  className="absolute inset-0 pointer-events-none"
                >
                  {/* Root trunk stem */}
                  <line
                    x1={treeLayout.rootTree.centerX}
                    y1={10}
                    x2={treeLayout.rootTree.centerX}
                    y2={treeLayout.rootTree.y}
                    stroke="#8B1E24"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                  />
                  <circle cx={treeLayout.rootTree.centerX} cy={10} r={4} fill="#8B1E24" />

                  {/* Curved Tree Branches */}
                  {treeLayout.edges.map((edge) => {
                    const midY = edge.fromY + (edge.toY - edge.fromY) * 0.52;
                    const pathD = `M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${midY}, ${edge.toX} ${midY}, ${edge.toX} ${edge.toY}`;
                    const strokeColor = getEdgeStroke(edge);
                    const strokeWidth =
                      edge.status === 'empty'
                        ? 1.75
                        : Math.max(1.75, 3.25 - edge.depth * 0.45);

                    return (
                      <g key={edge.id}>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={edge.status === 'empty' ? '5 5' : undefined}
                          strokeLinecap="round"
                        />
                        <circle
                          cx={edge.fromX}
                          cy={edge.fromY}
                          r={3.5}
                          fill={edge.isSelectedPath ? '#8B1E24' : '#64748B'}
                        />
                        <circle
                          cx={edge.toX}
                          cy={edge.toY}
                          r={3.5}
                          fill={edge.status === 'empty' ? '#CBD5E1' : strokeColor}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Tree Nodes Layer */}
                {treeLayout.flatNodes.map((node) => {
                  if (!node.partner) {
                    // Empty Binary Branch Slot
                    return (
                      <button
                        key={node.key}
                        type="button"
                        onClick={() =>
                          node.parentPartnerId &&
                          node.binaryLeg &&
                          openRecruitForSlot(node.parentPartnerId, node.binaryLeg)
                        }
                        style={{
                          left: node.x,
                          top: node.y,
                          width: NODE_W,
                          height: NODE_H,
                        }}
                        className="absolute rounded-xl border border-dashed border-slate-300 bg-white/85 hover:border-[#8B1E24] hover:bg-red-50/30 p-3 flex flex-col items-center justify-center text-center transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-slate-400 mb-1" />
                        <span className="text-xs font-semibold text-slate-700">{node.legLabel}</span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          Posición disponible · Afiliar
                        </span>
                      </button>
                    );
                  }

                  const p = node.partner;
                  const isSelected = selectedPartner.id === p.id;
                  const isRootNode = node.depth === 0;
                  const rankName = RANK_MAP[p.rankId]?.name || p.rankId;
                  const statusLabel =
                    p.status === 'activo'
                      ? 'Activo'
                      : p.status === 'pendiente'
                      ? 'Pendiente'
                      : 'Inactivo';
                  const statusColor = isSelected
                    ? 'text-amber-200'
                    : p.status === 'activo'
                    ? 'text-[#15803D]'
                    : p.status === 'pendiente'
                    ? 'text-[#B45309]'
                    : 'text-red-600';

                  return (
                    <div
                      key={node.key}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: NODE_W,
                        height: NODE_H,
                      }}
                      className="absolute"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedPartnerId(p.id)}
                        className={`w-full h-full rounded-xl border p-3 text-left transition-colors flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#8B1E24] text-white border-[#73181D] shadow-md'
                            : isRootNode
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-900 border-slate-200 hover:border-[#8B1E24]/60 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span
                            className={`truncate font-medium ${
                              isSelected || isRootNode ? 'text-white/80' : 'text-slate-500'
                            }`}
                          >
                            {node.legLabel}
                          </span>
                          <span className={`font-semibold shrink-0 ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{p.fullName}</div>
                          <div
                            className={`text-[11px] truncate ${
                              isSelected || isRootNode ? 'text-white/75' : 'text-slate-500'
                            }`}
                          >
                            {rankName} · {AFFILIATION_PACKAGES[p.packageTier].name}
                          </div>
                        </div>

                        <div
                          className={`pt-1.5 border-t flex items-center justify-between text-[11px] font-mono-num ${
                            isSelected || isRootNode
                              ? 'border-white/15 text-white/90'
                              : 'border-slate-100 text-slate-700'
                          }`}
                        >
                          <span>{p.personalPv} PV</span>
                          <span>
                            {treeView === 'binary'
                              ? `I:${p.leftBranchCv} · D:${p.rightBranchCv}`
                              : `${p.teamCv.toLocaleString('es-BO')} CV`}
                          </span>
                        </div>
                      </button>

                      {/* Branch Expand / Collapse Junction Button */}
                      {node.hasChildren && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(p.id, node.depth);
                          }}
                          title={node.isExpanded ? 'Contraer ramas' : 'Expandir ramas'}
                          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white border border-slate-300 text-[10px] font-mono-num font-semibold text-slate-700 hover:border-[#8B1E24] hover:text-[#8B1E24] shadow-xs cursor-pointer"
                        >
                          {node.isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          <span>{node.totalDirectCount}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Node Details & Personal PII */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Detalle del Nodo</h3>
              <span
                className={`text-xs font-medium ${
                  selectedPartner.status === 'activo'
                    ? 'text-[#15803D]'
                    : selectedPartner.status === 'pendiente'
                    ? 'text-[#B45309]'
                    : 'text-red-600'
                }`}
              >
                {selectedPartner.status.toUpperCase()}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Nombre y Código</div>
                <div className="font-semibold text-slate-900">{selectedPartner.fullName}</div>
                <div className="text-xs font-mono-num text-slate-500">{selectedPartner.referralCode}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <div className="text-xs text-slate-500">Rango Actual</div>
                  <div className="font-semibold text-slate-900">
                    {RANK_MAP[selectedPartner.rankId]?.name}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Paquete</div>
                  <div className="font-semibold text-slate-900">
                    {AFFILIATION_PACKAGES[selectedPartner.packageTier].name}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 font-mono-num">
                <div>
                  <div className="text-xs text-slate-500 font-sans">PV / CV Personal</div>
                  <div className="font-semibold text-slate-900">
                    {selectedPartner.personalPv} PV / {selectedPartner.personalCv} CV
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-sans">CV Grupal</div>
                  <div className="font-semibold text-slate-900">
                    {selectedPartner.teamCv.toLocaleString('es-BO')} CV
                  </div>
                </div>
              </div>

              {selectedPartner.id !== activeRootPartner.id && (
                <button
                  type="button"
                  onClick={() => setRootPartnerId(selectedPartner.id)}
                  className="w-full mt-2 py-2 px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:border-[#8B1E24] hover:text-[#8B1E24] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Focus className="w-3.5 h-3.5" />
                  <span>Enfocar árbol desde este socio</span>
                </button>
              )}

              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-1.5">Referidos Directos ({directReferrals.length})</div>
                {directReferrals.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin referidos directos registrados.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {directReferrals.map((d) => (
                      <li key={d.id} className="flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedPartnerId(d.id)}
                          className="text-slate-700 hover:text-[#8B1E24] font-medium truncate cursor-pointer"
                        >
                          {d.fullName}
                        </button>
                        <span className="font-mono-num text-slate-500">{d.personalPv} PV</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Private PII Profile Card for Current User */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#8B1E24]" />
                <h3 className="text-sm font-semibold text-slate-900">Mi Perfil Privado y Cuenta</h3>
              </div>
              {!isPinSession && (
                <button
                  type="button"
                  onClick={() => setEditingPii((v) => !v)}
                  className="text-xs font-medium text-[#8B1E24] hover:underline cursor-pointer"
                >
                  {editingPii ? 'Cancelar' : 'Editar'}
                </button>
              )}
            </div>
            {isPinSession && (
              <div className="mb-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600">
                Ingresaste con acceso rápido por PIN. Los datos privados (correo, CI y cuenta bancaria) permanecen protegidos.
              </div>
            )}
            {piiStatus && (
              <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
                {piiStatus}
              </div>
            )}
            {editingPii ? (
              <form onSubmit={handleSavePii} className="space-y-3">
                <input
                  type="text"
                  value={piiForm.phone}
                  onChange={(e) => setPiiForm({ ...piiForm, phone: e.target.value })}
                  placeholder="Teléfono"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={piiForm.ciNumber}
                  onChange={(e) => setPiiForm({ ...piiForm, ciNumber: e.target.value })}
                  placeholder="Cédula de Identidad"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={piiForm.city}
                  onChange={(e) => setPiiForm({ ...piiForm, city: e.target.value })}
                  placeholder="Ciudad"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={piiForm.bankName}
                  onChange={(e) => setPiiForm({ ...piiForm, bankName: e.target.value })}
                  placeholder="Banco"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={piiForm.bankAccount}
                  onChange={(e) => setPiiForm({ ...piiForm, bankAccount: e.target.value })}
                  placeholder="Número de Cuenta"
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-[#8B1E24] text-white text-xs font-semibold rounded-lg hover:bg-[#73181D] cursor-pointer"
                >
                  Guardar Datos
                </button>
              </form>
            ) : (
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">Correo:</span>
                  <span className="font-medium text-slate-900">{privateInfo?.email || 'Protegido'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Teléfono:</span>
                  <span className="font-mono-num text-slate-900">{privateInfo?.phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ciudad / CI:</span>
                  <span className="text-slate-900">
                    {privateInfo?.city || '—'} · {privateInfo?.ciNumber || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Banco Retiros:</span>
                  <span className="text-slate-900 truncate max-w-[170px]">
                    {privateInfo?.bankName || '—'} ({privateInfo?.bankAccount || '—'})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#8B1E24]" />
            <h2 className="text-base font-semibold text-slate-900">Directorio de Socios de la Red</h2>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar socio, código o rango..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#8B1E24]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-3">Socio</th>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Paquete</th>
                <th className="py-2.5 px-3">Rango</th>
                <th className="py-2.5 px-3 text-right">PV Mes</th>
                <th className="py-2.5 px-3 text-right">CV Equipo</th>
                <th className="py-2.5 px-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredPartners.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    setSelectedPartnerId(p.id);
                    setRootPartnerId(p.id);
                  }}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 font-medium text-slate-900">{p.fullName}</td>
                  <td className="py-2.5 px-3 text-xs font-mono-num text-slate-500">{p.referralCode}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">
                    {AFFILIATION_PACKAGES[p.packageTier].name}
                  </td>
                  <td className="py-2.5 px-3 text-xs font-medium text-slate-800">
                    {RANK_MAP[p.rankId]?.name}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-slate-900">{p.personalPv}</td>
                  <td className="py-2.5 px-3 text-right font-mono-num text-slate-900">
                    {p.teamCv.toLocaleString('es-BO')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-medium">
                    <span
                      className={
                        p.status === 'activo'
                          ? 'text-[#15803D]'
                          : p.status === 'pendiente'
                          ? 'text-[#B45309]'
                          : 'text-red-600'
                      }
                    >
                      {p.status === 'activo' ? 'Activo' : p.status === 'pendiente' ? 'Pendiente' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Afiliar Nuevo Socio */}
      {showRecruitModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Afiliar Nuevo Socio</h3>
              <button
                type="button"
                onClick={() => setShowRecruitModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecruitSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nombre completo</label>
                  <input
                    type="text"
                    required
                    value={recruitForm.fullName}
                    onChange={(e) => setRecruitForm({ ...recruitForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    placeholder="Ej. Camila Torrez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Patrocinador</label>
                  <select
                    value={recruitForm.sponsorId}
                    onChange={(e) =>
                      setRecruitForm({
                        ...recruitForm,
                        sponsorId: e.target.value,
                        binaryParentId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} ({p.referralCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Pierna Binaria</label>
                  <select
                    value={recruitForm.binaryLeg}
                    onChange={(e) => setRecruitForm({ ...recruitForm, binaryLeg: e.target.value as BinaryLeg })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="left">Equipo Izquierdo</option>
                    <option value="right">Equipo Derecho</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Paquete</label>
                  <select
                    value={recruitForm.packageTier}
                    onChange={(e) => setRecruitForm({ ...recruitForm, packageTier: e.target.value as PackageTier })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="base">Distribuidor Base (975 Bs)</option>
                    <option value="emprendedor">Emprendedor (1.950 Bs)</option>
                    <option value="elite">Emprendedor Élite (3.900 Bs)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={recruitForm.city}
                    onChange={(e) => setRecruitForm({ ...recruitForm, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={recruitForm.phone}
                    onChange={(e) => setRecruitForm({ ...recruitForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    value={recruitForm.email}
                    onChange={(e) => setRecruitForm({ ...recruitForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    placeholder="socio@correo.com"
                  />
                </div>
              </div>

              {recruitError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {recruitError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecruitModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={recruitSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#8B1E24] rounded-lg hover:bg-[#73181D] disabled:opacity-50 cursor-pointer"
                >
                  {recruitSaving ? 'Registrando...' : 'Registrar Socio en Red'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
