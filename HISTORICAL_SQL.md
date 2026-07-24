# SQL históricos (no ejecutar automáticamente)

Los siguientes archivos SQL en la raíz del repositorio son **históricos / de referencia**.
Fueron aplicados manualmente en Supabase durante etapas anteriores del proyecto y **no forman parte del pipeline de migraciones** (`supabase/migrations/`).

- `PHASE1_MULTI_CHAMP.sql` — Fase 1: multi-campeonato (idempotente).
- `PHASE2_SPORTS.sql` — Fase 2: estructura deportiva multi-campeonato (idempotente, depende de Fase 1).
- `RLS_DELEGADO.sql` — Ajustes de RLS para el rol delegado.

## Reglas

- **No ejecutar** estos archivos automáticamente ni desde CI.
- **No modificar** su contenido: son un registro histórico.
- Si alguno de estos cambios necesita re-aplicarse o versionarse como parte del flujo oficial, convertirlo previamente en un archivo bajo `supabase/migrations/` con timestamp propio y revisión.

Las migraciones oficiales y versionadas viven exclusivamente en `supabase/migrations/`.
