'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Remove obsolete fields from vets (clinic profile) table
  pgm.sql(`ALTER TABLE vets DROP COLUMN IF EXISTS designation`);
  pgm.sql(`ALTER TABLE vets DROP COLUMN IF EXISTS chamber_name`);
  pgm.sql(`ALTER TABLE vets DROP COLUMN IF EXISTS doc_reg_number`);

  // Add separate BVC/BMDC fields to clinic_vets (staff members)
  pgm.sql(`ALTER TABLE clinic_vets ADD COLUMN IF NOT EXISTS bvc_reg_number VARCHAR(100)`);
  pgm.sql(`ALTER TABLE clinic_vets ADD COLUMN IF NOT EXISTS bmdc_reg_number VARCHAR(100)`);
  pgm.sql(`ALTER TABLE clinic_vets DROP COLUMN IF EXISTS doc_reg_number`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE vets ADD COLUMN IF NOT EXISTS designation VARCHAR(150)`);
  pgm.sql(`ALTER TABLE vets ADD COLUMN IF NOT EXISTS chamber_name VARCHAR(150)`);
  pgm.sql(`ALTER TABLE vets ADD COLUMN IF NOT EXISTS doc_reg_number VARCHAR(100)`);

  pgm.sql(`ALTER TABLE clinic_vets ADD COLUMN IF NOT EXISTS doc_reg_number VARCHAR(100)`);
  pgm.sql(`ALTER TABLE clinic_vets DROP COLUMN IF EXISTS bvc_reg_number`);
  pgm.sql(`ALTER TABLE clinic_vets DROP COLUMN IF EXISTS bmdc_reg_number`);
};
