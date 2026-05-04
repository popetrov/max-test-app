const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./stroypodryad.db", (error) => {
  if (error) {
    console.error("Ошибка подключения к SQLite:", error.message);
  } else {
    console.log("SQLite база подключена");
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS contractor_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
});

module.exports = db;