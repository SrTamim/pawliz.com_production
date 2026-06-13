import type { MigrationBuilder } from 'node-pg-migrate';

// Refresh tokens are now stored as a SHA-256 hash instead of plaintext.
// Existing rows hold plaintext values that can't be re-hashed in place, so wipe
// them — all active sessions are invalidated and users simply log in again.
export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`TRUNCATE TABLE refresh_tokens;`);
};

export const down = (): void => {
  // Nothing to revert — truncated session rows are not recoverable.
};
