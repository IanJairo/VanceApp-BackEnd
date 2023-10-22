const express = require('express');
const morgan = require('morgan');
const bcrypt = require('bcrypt');

const db = require('./db');
const app = express();

app.use(express.json());
app.use(morgan('dev'))


const Note = {
    async createNote(req, res) {
        let response = { error: '' }

        try {
            const { title, content, data } = req.body;
            const userId = req.body.user.id; // assume que o usuário está autenticado e o ID do usuário está armazenado em req.user.id

            const query = `
            INSERT INTO note (user_id, title, content, data)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            `;

            const values = [userId, title, content, data];
            const result = await db.query(query, values);

            const note = result.rows[0];

            response.status = 201;
            response.data = note;

            res.status(response.status).json(response);

        } catch (err) {
            response.error = err.message;
            response.status = 500;
            res.status(response.status).json(response);
        }

    },

    async updateNote(req, res) {
        let response = { error: '' }
        try {

            const { title, content } = req.body;
            const userId = req.body.user.id; // assume que o usuário está autenticado e o ID do usuário está armazenado em req.user.id
            const noteId = req.params.id;
            const isAuthor = await db.query('SELECT * FROM note WHERE id = $1 AND user_id = $2', [noteId, userId]);

            // Verifica se a nota pertence ao usuário
            if (isAuthor.rows.length === 0) {
                response.error = 'Note not found or does not belong to user';
                response.status = 401;
                return res.status(response.status).json(response);
            }

            const query = `
                UPDATE note
                SET title = $1, content = $2
                WHERE id = $3
                RETURNING *
                `;

            const values = [title, content, noteId];
            const result = await db.query(query, values);

            const note = result.rows[0];

            response.status = 200;
            response.data = note;

            res.status(response.status).json(response);
        } catch (err) {
            response.error = err.message;
            response.status = 500;
            res.status(response.status).json(response);
        }
    },

    async deleteNote(req, res) {

        let response = { error: '' }

        try {
            const noteId = req.params.id;

            const query = `
            DELETE FROM note
            WHERE id = $1
          `;
            const values = [noteId];
            await db.query(query, values);

            response.status = 204;
            res.status(response.status).json(response);
        } catch (err) {
            response.error = err.message;
            response.status = 500;
            res.status(response.status).json(response);
        }
    },

    async getNotes(req, res) {

        let response = { error: '' };

        try {
            const userId = req.body.user.id; // assume que o usuário está autenticado e o ID do usuário está armazenado em req.user.id


            const query = `
            SELECT *
            FROM note
            WHERE user_id = $1
          `;
            const values = [userId];
            const result = await db.query(query, values);

            response.data = result.rows;
            response.status = 200;
            res.status(response.status).json(response);
        } catch (err) {
            response.error = err.message;
            response.status = 500;
            res.status(response.status).json(response);
        }
    }
};

const User = {



    async signup(req, res) {
        let response = { error: '' }
        try {
            const { name, email, password } = req.body;
            const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (result.rows.length > 0) {
                response.error = 'Email already exists';
                response.status = 409;
                return res.status(response.error).json(response);
            }
            const hash = await bcrypt.hash(password, 10);
            const insertResult = await db.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id', [name, email, hash]);

            response.status = 201;
            response.data = { id: insertResult.rows[0].id };

            res.status(response.status).json({ response });
        } catch (err) {
            response.error = err.message;
            response.status = 500;
            res.status(response.status).json(response);
        }
    },


    async login(req, res) {
        let response = { error: '' }
        try {
            const { email, password } = req.body;
            const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (result.rows.length === 0) {
                response.error = 'Email or password is incorrect';
                response.status = 401;
                return res.status(response.status).json(response);
            }
            const user = result.rows[0];
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                response.error = 'Email or password is incorrect';
                response.status = 401;
                return res.status(response.status).json(response);
            }

            response.status = 200;
            response.data = { id: user.id };
            res.status(response.status).json(response);
        } catch (err) {
            console.log(err)
            response.error = err.message;
            response.status = 500;
            res.status(response.status).json(response);
        }
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

async function getNotes(req, res) {
    try {
        const result = await db.query('SELECT * FROM note');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
// Get all notes 
app.get('/api/notes', Note.getNotes);

// Add a new note
app.post('/api/notes', Note.createNote);

// Update a note
app.put('/api/notes/:id', Note.updateNote);

// Delete a note
app.delete('/api/notes/:id', Note.deleteNote);

app.listen(3000, () => {
    console.log('Server on port 3000')
});


app.post('/api/signup', User.signup);
app.post('/api/login', User.login);
app.get('/api/users', getUsers);
app.get('/', (req, res) => {
    res.sendFile('views/landing.html', {root: __dirname })
});