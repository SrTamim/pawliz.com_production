const pool = require('../config/database');

async function getOwnedVet(userId) {
  const result = await pool.query(
    'SELECT * FROM vets WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
}

module.exports = { getOwnedVet };
