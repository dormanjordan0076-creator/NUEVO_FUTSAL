
# Etapa de Corrección de Lógica e Integridad

Objetivo: cerrar las inconsistencias detectadas sin cambiar arquitectura ni agregar funcionalidad nueva. Mantengo multi-campeonato, Motor Deportivo, categorías/grupos/fases.

## 1. Walkover suma correctamente en la tabla

- `MatchEditDialog` (admin.tsx): al guardar con `result_type = 'walkover'` persistir `status = 'finalizado'`, `home_score`/`away_score` con los valores de `championships.walkover_score_winner/loser`, sin insertar `match_events`.
- `computeStandings` (`src/lib/standings.ts`): ya suma cualquier partido `finalizado` con marcadores presentes — verificar que el flujo anterior deje esos campos poblados y que `estadisticas.tsx` siga filtrando `result_type='walkover'` para goleadores/tarjetas. Sin cambios de esquema.

## 2. Sorteo y Fixture: mismos equipos por categoría

- `DrawTab` y `FixtureTab` (admin.tsx): consulta única `teams.eq(championship_id).eq(category_id)`, compartida por sorteo automático, sorteo manual, fixture automático y fixture manual.
- Eliminar consultas duplicadas que estaban filtrando sólo por championship.

## 3. Eliminar Campeonato en cascada

Migración SQL nueva (`PENDING_CASCADE_DELETE.sql`, no se ejecuta hasta que el usuario avise):

- `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE CASCADE` en todas las FK que apuntan a `championships`, `categories`, `groups`, `phases`, `teams`, `matches` (participaciones, sanciones, resoluciones, observaciones, phase_participants, match_events, etc.).
- Post-migración: `DELETE FROM championships WHERE id = ?` limpia todo en una sola operación.

`campeonatos.tsx`: mantener el confirm doble; el borrado ya usa `.delete().eq('id', ...)`.

## 4. Finalizar Campeonato: constraint coherente

Migración SQL nueva (`PENDING_CHAMP_STATUS_FIX.sql`):

```sql
ALTER TABLE championships DROP CONSTRAINT IF EXISTS championships_status_check;
ALTER TABLE championships
  ADD CONSTRAINT championships_status_check
  CHECK (status IN ('activo','finalizado'));
UPDATE championships SET status = 'activo' WHERE status IS NULL OR status NOT IN ('activo','finalizado');
```

No hay cambios de UI; `campeonatos.tsx` ya envía `status: 'finalizado' | 'activo'`.

## 5. Usuarios y Campeonatos (participaciones)

- `src/lib/users.functions.ts`: extender `createUser`/`updateUser` para aceptar `participations: [{ championship_id, team_id?, role }]` y sincronizar `team_participations` + `user_roles` (rol por campeonato).
- `UsuariosTab`: el diálogo agrega una sección "Campeonatos y equipos" con lista dinámica (campeonato + rol + equipo opcional). Compatibilidad: si sólo se elige un campeonato + delegado + equipo, se sigue seteando `teams.delegate_user_id` como hoy.
- `mi-equipo.tsx`: usa `team_participations` cruzado por `user_id` para mostrar los campeonatos del delegado. Si hay al menos una participación, nunca aparece el mensaje "No tenés campeonatos". Selector de campeonato activo dentro de la pantalla.

## 6. Usuario público (sin login)

- `src/routes/_authenticated/route.tsx`: sigue protegiendo admin/mi-equipo.
- `campeonatos.tsx`: si no hay `user`, en lugar del CTA "Iniciar sesión" mostrar los campeonatos públicos (activos + historial) con botón "Entrar como visitante" que setea el `activeId` y navega a `/`.
- Rutas públicas ya existentes (`/`, `/fixture`, `/tabla`, `/estadisticas`, `/equipo/$teamId`, `/resoluciones`) permanecen accesibles sin sesión. Verificar que ninguna dependa de `useAuth().user` para renderizar contenido.

## 7. Botón "Edit with Lovable"

- Llamar `publish_settings--set_badge_visibility` con `hidden = true` (requiere plan Pro; si falla lo dejamos documentado en el resumen final como limitación de plataforma).

## 8. Detalle del partido (modal)

- Nuevo componente `src/components/MatchDetailDialog.tsx`: recibe `matchId`, consulta `matches` + `teams` + `phases` + `match_events` + `match_officials` (si existe) + `observations`/`resolutions` relacionadas.
- Muestra fecha/hora/cancha/categoría/grupo/fase/estado/resultado/tipo/árbitros/goleadores/amarillas/rojas/observaciones/resoluciones. Si el partido no se jugó: sólo lo disponible.
- Enganchar en `MatchRow` (`index.tsx`) y en la lista de `fixture.tsx` para que cualquier partido sea clickeable.

## 9. Detalle del equipo (modal / uso de ruta existente)

- Ya existe `src/routes/equipo.$teamId.tsx`. Verificar que filtre por campeonato activo y muestre: escudo, nombre, categoría, grupo, delegado, plantel, próximos, últimos, historial, posición actual, GF/GC/DG, goleador del equipo, valla menos vencida, fair play.
- Añadir wrapper `TeamLink` para que los nombres/escudos de equipo en index/fixture/tabla naveguen a esa página.

## 10. Validaciones finales

- `bun run build` + `tsgo` en verde.
- Chequeo manual: walkover cuenta en tabla; sorteo/fixture cargan por categoría; delete cascada; finalizar sin error; delegados con múltiples campeonatos; visitante sin login navega; modales de partido y equipo abren desde cualquier lista.

## Detalles técnicos

- **Migraciones nuevas (no se ejecutan)**: `PENDING_CASCADE_DELETE.sql`, `PENDING_CHAMP_STATUS_FIX.sql`. Espero tu OK para correrlas antes de tocar la parte de UI que depende de ellas.
- Archivos a tocar (aprox.): `src/routes/_authenticated/admin.tsx`, `src/routes/_authenticated/mi-equipo.tsx`, `src/routes/campeonatos.tsx`, `src/routes/index.tsx`, `src/routes/fixture.tsx`, `src/routes/equipo.$teamId.tsx`, `src/components/admin/UsuariosTab.tsx`, `src/lib/users.functions.ts`, y nuevo `src/components/MatchDetailDialog.tsx`.
- **NO** se toca: auth, comité, resoluciones/PDF, motor deportivo, planilla, estadísticas (más allá de reutilizar consultas), esquema de tablas fuera de las dos migraciones anteriores.

## Fuera de alcance

Clasificación/cruces/eliminatorias automáticas, plantillas, duplicar campeonato, optimización APK.
