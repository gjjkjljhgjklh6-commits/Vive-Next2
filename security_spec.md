# Security Specification — Vive Next Platform

## 1. Data Invariants
1. **Identidad de Socios y Aislamiento PII**: Todo documento en `/partners/{partnerId}` contiene únicamente datos estructurales de red (nombre visible, código de referido, patrocinador, pierna binaria, paquete, rango, volúmenes PV/CV). Toda información personal identificable (`email`, `phone`, `ciNumber`, `city`, `bankName`, `bankAccount`) reside estrictamente en `/partners/{partnerId}/private/info` con lectura/escritura limitada al propietario (`ownerUid == request.auth.uid`) o Administrador.
2. **Prevención de Auto-Escalación de Roles y Paquetes**: Un usuario estándar no puede crear su perfil con `role == 'admin'` ni modificar campos protegidos de RBAC, rango (`rankId`), o volúmenes comisionables (`personalPv`, `teamCv`, `leftBranchCv`, `rightBranchCv`) directamente mediante actualización de perfil.
3. **Integridad Financiera en Pedidos y Comisiones**: Todo pedido creado por un socio inicia estrictamente en `paymentStatus == 'pendiente'` y `validatedBy == ''`. Solo un Administrador verificado puede validar o rechazar pagos y emitir o liquidar comisiones.
4. **Control de Retiros en Billetera**: Toda solicitud de retiro inicia en `status == 'pendiente'` con `amountBs > 0` y `partnerUid == request.auth.uid`. Solo un Administrador puede aprobar o rechazar retiros.
5. **Integridad Temporal**: Todo `createdAt` en creación y `updatedAt` en actualización debe coincidir exactamente con `request.time`.
6. **Inmutabilidad de Auditoría**: Los registros en `/audit_logs/{logId}` son solo de creación por Administradores y nunca pueden actualizarse ni eliminarse.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Partner Create**: Enviar `isAdmin: true` o `extraBonus: 9999` junto a campos válidos en `/partners/{id}` -> rechazado por `keys().hasOnly(...)`.
2. **Self-Role Escalation**: Usuario no-admin intentando crear `/partners/{uid}` con `role: 'admin'` -> rechazado por `incoming().role == 'socio'`.
3. **Spoofed Owner UID**: Usuario A intentando crear `/orders/{id}` con `buyerUid: 'usuario_B'` -> rechazado por `incoming().buyerUid == request.auth.uid`.
4. **Unverified Email Write**: Token con `email_verified: false` intentando escribir en `/orders/{id}` -> rechazado por `isVerified()`.
5. **Email Admin Spoofing**: Usuario con `email: 'gjjkjljhgjklh6@gmail.com'` pero `email_verified: false` -> rechazado por `request.auth.token.email_verified == true`.
6. **Direct Order Auto-Validation**: Socio intentando crear `/orders/{id}` directamente con `paymentStatus: 'validado'` -> rechazado por `incoming().paymentStatus == 'pendiente'`.
7. **Terminal State Bypass on Withdrawal**: Socio intentando cambiar su retiro ya `aprobado` o `rechazado` de vuelta a `pendiente` -> rechazado por bloqueo de estado terminal y restricción solo-admin.
8. **PII Cross-Read Attack**: Socio B intentando leer `/partners/socioA/private/info` -> rechazado por `isOwnerOrAdmin`.
9. **ID Poisoning (1.5KB Document ID)**: Crear documento con ID de 1500 caracteres o caracteres inválidos `../admin` -> rechazado por `isValidId()`.
10. **Client Timestamp Tampering**: Enviar `createdAt` manipulado en el pasado en lugar de `serverTimestamp()` -> rechazado por `incoming().createdAt == request.time`.
11. **Unbounded Array Exhaustion**: Enviar `items` con más de 25 elementos en `/orders/{id}` -> rechazado por `data.items.size() >= 1 && data.items.size() <= 25`.
12. **Audit Log Tampering**: Intentar `update` o `delete` sobre `/audit_logs/{logId}` incluso siendo admin -> rechazado por `allow update, delete: if false;`.
