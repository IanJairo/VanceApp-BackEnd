const express = require('express');
const morgan = require('morgan');
const bcrypt = require('bcrypt');

const db = require('./db');
const app = express();

app.use(express.json());
app.use(morgan('dev'))

function singup(req, res) {
    console.log(req.body);
    res.send('Requisição foi correta');
}
async function createUser(req, res) {
    try {
        const { name, email, password } = req.body;
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            return res.status(409).json({ error: 'Email already exists' });
        }
        const hash = await bcrypt.hash(password, 10);
        const insertResult = await db.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id', [name, email, hash]);
        res.status(201).json({ id: insertResult.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}


async function login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Email or password is incorrect' });
      }
      const user = result.rows[0];
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Email or password is incorrect' });
      }
      res.status(200).json({ id: user.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
async function getUsers(req, res) {
    try {
        const result = await db.query('SELECT * FROM users');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

app.listen(3000, () => {
    console.log('Server on port 3000')
});

app.get('/', (req, res) => {
    res.send('Hello World');
});

app.post('/api/singup', createUser);
app.post('/api/login', login);
app.get('/api/users', getUsers);