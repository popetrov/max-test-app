const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contractor_requests (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      city TEXT,
      performers TEXT,
      sro TEXT,
      category TEXT,
      price_from INTEGER,
      price_to INTEGER,
      contact_type TEXT,
      contact TEXT,
      created_at TEXT NOT NULL
    )
  `);

  console.log("PostgreSQL база подключена и таблица готова");
}

initDatabase().catch((error) => {
  console.error("Ошибка инициализации PostgreSQL:", error);
});

module.exports = pool;