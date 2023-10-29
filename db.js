const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'vance',
  password: '123456',
  port: 5432,
});


// const pool = new Pool({
//   connectionString: process.env.POSTGRES_URL + "?sslmode=require",
// });
module.exports = {
  query: (text, params) => pool.query(text, params),
};