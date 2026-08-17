export const PUBLIC_EVENT_MASTER_SCHEMA_MIGRATION_VERSION=14;

export function applyPublicEventMasterSchema(db){
  db.run(`CREATE TABLE IF NOT EXISTS public_event_master(
    event_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    locale TEXT NOT NULL,
    region TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    camp_scope_json TEXT NOT NULL DEFAULT '[]',
    effects_json TEXT NOT NULL DEFAULT '{}',
    missions_json TEXT NOT NULL DEFAULT '[]',
    rewards_json TEXT NOT NULL DEFAULT '[]',
    limited_mechanics_json TEXT NOT NULL DEFAULT '[]',
    authority_status TEXT NOT NULL,
    source_json TEXT NOT NULL DEFAULT '{}',
    field_provenance_json TEXT NOT NULL DEFAULT '{}',
    data_version TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_public_event_master_active
    ON public_event_master(start_at,end_at,region)`);
  db.run(`CREATE TABLE IF NOT EXISTS public_event_phase(
    event_id TEXT NOT NULL,
    phase_id TEXT NOT NULL,
    title TEXT,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    effects_json TEXT NOT NULL DEFAULT '{}',
    mission_period_json TEXT,
    authority_status TEXT NOT NULL,
    source_json TEXT NOT NULL DEFAULT '{}',
    data_version TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(event_id,phase_id),
    FOREIGN KEY(event_id) REFERENCES public_event_master(event_id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_public_event_phase_active
    ON public_event_phase(start_at,end_at,event_id)`);
}

export function applyPublicEventMasterSchemaMigration(db){
  applyPublicEventMasterSchema(db);
  db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at)
    VALUES(${PUBLIC_EVENT_MASTER_SCHEMA_MIGRATION_VERSION},datetime('now'))`);
}
