const mysql = require('mysql2/promise');

async function testConnection() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.SSL_MODE ? { rejectUnauthorized: false } : null
  });
  console.log('✅ Успешное подключение к БД!');
}

testConnection().catch(err => console.error('Ошибка:', err));