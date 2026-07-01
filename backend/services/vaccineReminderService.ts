import pool from '../config/database';
import logger from '../utils/logger';
import { createNotification } from './notificationService';
import { getSmsEnabled, sendSms } from './smsService';

/**
 * Daily vaccine-reminder job.
 *
 * Scans pet_vaccination_records for doses due within a ±3-day window (served by
 * idx_pet_vaccination_records_next_due) and, for each new milestone, creates an
 * in-app notification (all owners) and — one day before, opt-in only — an SMS.
 *
 * Idempotency: vaccine_reminder_log has a UNIQUE (record, due-date, milestone).
 * We claim milestones with a single multi-row INSERT ... ON CONFLICT DO NOTHING
 * ... RETURNING, so a rerun/restart never double-sends. Low DB pressure: one
 * windowed SELECT + one dedup INSERT + one notification INSERT per new reminder.
 */

type Milestone =
  | 'in_app_3' | 'in_app_2' | 'in_app_1' | 'in_app_0'
  | 'overdue_1' | 'overdue_2' | 'overdue_3'
  | 'sms_1';

interface DueRow {
  id: number;
  vaccine_name: string;
  next_due_date: string; // YYYY-MM-DD
  pet_name: string;
  pet_public_id: string;
  user_id: number;
  phone: string | null;
  meta: Record<string, any> | null;
  days_left: number;
}

function inAppMilestone(daysLeft: number): Milestone | null {
  switch (daysLeft) {
    case 3: return 'in_app_3';
    case 2: return 'in_app_2';
    case 1: return 'in_app_1';
    case 0: return 'in_app_0';
    case -1: return 'overdue_1';
    case -2: return 'overdue_2';
    case -3: return 'overdue_3';
    default: return null;
  }
}

function inAppMessage(row: DueRow): string {
  const pet = row.pet_name;
  const vaccine = row.vaccine_name;
  const d = row.days_left;
  if (d > 0) return `${pet}'s ${vaccine} vaccine is due in ${d} day${d === 1 ? '' : 's'}`;
  if (d === 0) return `${pet}'s ${vaccine} vaccine is due today`;
  const overdue = -d;
  return `${pet}'s ${vaccine} vaccine is overdue by ${overdue} day${overdue === 1 ? '' : 's'}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Claim which (record, due-date, milestone) tuples are new. Returns the set of
 * "recordId|milestone" keys that this run is responsible for sending.
 */
async function claimMilestones(
  claims: Array<{ recordId: number; nextDueDate: string; milestone: Milestone }>,
): Promise<Set<string>> {
  const claimed = new Set<string>();
  if (!claims.length) return claimed;

  const values: string[] = [];
  const params: any[] = [];
  claims.forEach((c, i) => {
    const base = i * 3;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
    params.push(c.recordId, c.nextDueDate, c.milestone);
  });

  const { rows } = await pool.query(
    `INSERT INTO vaccine_reminder_log (vaccination_record_id, next_due_date, milestone)
     VALUES ${values.join(', ')}
     ON CONFLICT (vaccination_record_id, next_due_date, milestone) DO NOTHING
     RETURNING vaccination_record_id, milestone`,
    params,
  );
  for (const r of rows) claimed.add(`${r.vaccination_record_id}|${r.milestone}`);
  return claimed;
}

export async function runVaccineReminders(): Promise<void> {
  try {
    const { rows } = await pool.query<DueRow>(
      `SELECT v.id, v.vaccine_name, v.next_due_date,
              p.name AS pet_name, p.pet_id AS pet_public_id, p.user_id,
              u.phone, u.meta,
              (v.next_due_date - CURRENT_DATE) AS days_left
       FROM pet_vaccination_records v
       JOIN pets p  ON p.id = v.pet_id
       JOIN users u ON u.id = p.user_id
       WHERE v.next_due_date IS NOT NULL
         AND v.next_due_date BETWEEN CURRENT_DATE - INTERVAL '3 days'
                                 AND CURRENT_DATE + INTERVAL '3 days'`,
    );

    if (!rows.length) {
      logger.info('Vaccine reminders: no records in window');
      return;
    }

    // Build the full set of candidate claims (in-app for every row in window;
    // SMS only for opt-in owners with a phone, one day before, gated globally).
    const smsEnabled = await getSmsEnabled();

    const claims: Array<{ recordId: number; nextDueDate: string; milestone: Milestone; row: DueRow }> = [];
    for (const row of rows) {
      const m = inAppMilestone(row.days_left);
      if (m) claims.push({ recordId: row.id, nextDueDate: row.next_due_date, milestone: m, row });

      const optedIn = row.meta?.sms_vaccine_reminders === true || row.meta?.sms_vaccine_reminders === 'true';
      if (row.days_left === 1 && smsEnabled && optedIn && row.phone) {
        claims.push({ recordId: row.id, nextDueDate: row.next_due_date, milestone: 'sms_1', row });
      }
    }

    const claimed = await claimMilestones(
      claims.map((c) => ({ recordId: c.recordId, nextDueDate: c.nextDueDate, milestone: c.milestone })),
    );

    let inAppSent = 0;
    let smsSent = 0;
    for (const c of claims) {
      if (!claimed.has(`${c.recordId}|${c.milestone}`)) continue;
      const row = c.row;

      if (c.milestone === 'sms_1') {
        const message = `Your ${row.pet_name}'s next vaccine (${row.vaccine_name}) is due on ${formatDate(row.next_due_date)}. Please vaccinate your loving pet. — Pawliz`;
        try {
          await sendSms(row.phone!, message);
          smsSent++;
        } catch (err) {
          logger.warn(`Vaccine SMS failed for user ${row.user_id}:`, (err as Error).message);
        }
      } else {
        const days = row.days_left;
        const title = days > 0 ? 'Vaccine reminder' : days === 0 ? 'Vaccine due today' : 'Vaccine overdue';
        await createNotification(
          row.user_id,
          'vaccine_reminder',
          title,
          inAppMessage(row),
          null,
          'pet',
          null,
          `/pet/${row.pet_public_id}`,
        );
        inAppSent++;
      }
    }

    logger.info(`Vaccine reminders: ${inAppSent} in-app, ${smsSent} SMS sent`);
  } catch (err) {
    logger.error('runVaccineReminders error:', err);
  }
}
