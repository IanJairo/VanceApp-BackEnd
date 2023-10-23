const express = require('express');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const ejs = require('ejs');
const fs = require('fs');
const db = require('./db');
const app = express();
const transporter = require('./helpers/nodemailer');
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
    },

    async shareNote(req, res) {
        // Rota para compartilhar uma nota com outro usuário
        const { noteId, email, canEdit } = req.body;
        let response = { error: '' };

        console.log(req.body);
        try {
            // Verifica se a nota existe no banco de dados
            const note = await db.query('SELECT * FROM note WHERE id = $1', [noteId]);

            console.log(note.rows.length)
            if (note.rows.length === 0) {
                response = { error: 'Note not found', status: 204, message: "Nota inexistente." };
                return res.status(response.status).json(response);
            }

            // Verifica se o usuário atual é o autor da nota
            if (note.rows[0].user_id !== req.body.user.id) {
                response = { error: 'Note not found', status: 204, message: "A nota já pertence ao usuário." };
                return res.status(response.status).json(response);
            }

            // Verifica se o email do destinatário existe no banco de dados
            const recipient = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            console.log(recipient.rows)
            if (recipient.rows.length === 0) {
                response = { error: 'Recipient not found', status: 204, message: "Destinatario não encontrado." };
                console.log("entrou?", response);
                return res.status(response.status).json(response);
            }

            console.log("recipient.rows[0].id", recipient.rows[0].id)

            // Verifica se a nota já foi compartilhada com o destinatário
            const isShared = await db.query('SELECT * FROM user_note WHERE note_id = $1 AND user_id = $2', [noteId, recipient.rows[0].id]);

            console.log("isShared.rows", isShared)

            if (isShared.rows.length > 0) {
                console.error("entrou?")
                response = { error: 'Note already shared with recipient', status: 204, message: "Nota já pertence ao destinatário." };
                return res.status(response.status).json(response);
            }

            console.log("passou")

            // Compartilha a nota com o destinatário
            await db.query('INSERT INTO user_note (note_id, user_id, can_edit) VALUES ($1, $2, $3)', [noteId, recipient.rows[0].id, canEdit]);

            response = { status: 200, message: "Nota compartilhada." };
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
                return res.status(response.status).json(response);
            }
            const hash = await bcrypt.hash(password, 10);
            const insertResult = await db.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id', [name, email, hash]);

            response.status = 201;
            response.data = { id: insertResult.rows[0].id };

            res.status(response.status).json(response);
        } catch (err) {
            response.error = err.message;
            response.status = 500;
            res.status(response.status).json(response);
        }
    },

    async forgotPassword(req, res) {
        const { email } = req.params;
        const response = { error: '' };

        try {
            // Verifica se o email existe no banco de dados
            const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (user.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Gera um PIN de 6 dígitos
            const pin = crypto.randomInt(100000, 999999);

            // Salva o PIN no banco de dados
            await db.query('UPDATE users SET pin = $1 WHERE email = $2', [pin, email]);


            // Lê o conteúdo do arquivo HTML
            const messageHtml = fs.readFileSync('./helpers/message.html', 'utf8');



            // Renderiza o HTML com o PIN preenchido
            const renderedHtml = ejs.render(messageHtml, { "pin": pin, "user": user.rows[0].name });


            const mailOptions = {
                from: 'vance.app@hotmail.com',
                to: email,
                subject: '[VANCE] PIN de recuperação de Senha',
                text: `Seu PIN de recuperação de senha é ${pin}`,
                html: renderedHtml
            };

            // Envia o PIN por e-mail
            await transporter.sendMail(mailOptions);

            response.status = 200;
            res.status(response.status).json(response);

        } catch (err) {
            response.error = err.message;
            response.status = 500;
            res.status(response.status).json(response);
        }

    },

    async validatePin(req, res) {
        const { email, pin } = req.body;
        const response = { error: '' };

        try {
            // Verifica se o email existe no banco de dados
            const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (user.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Verifica se o PIN fornecido corresponde ao PIN armazenado no banco de dados
            if (user.rows[0].pin !== pin) {
                response.error = 'Invalid PIN';
                response.status = 400;
                return res.status(response.status).json(response);
            }

            await db.query('UPDATE users SET pin = NULL WHERE email = $1', [email]);

            response.status = 200;
            res.status(response.status).json(response);
        } catch (err) {
            response.error = err.message;
            response.status = 500;
            res.status(response.status).json(response);
        }
    },

    async resetPassword(req, res) {
        const { email, newPassword } = req.body;
        let response = { error: '' };

        try {
            // Verifica se o email existe no banco de dados
            const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (user.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Gera um hash da nova senha
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(newPassword, salt);

            // Atualiza a senha do usuário no banco de dados
            await db.query('UPDATE users SET password = $1 WHERE email = $2', [hash, email]);

            response.status = 200;
            response.message = 'Password changed';
            res.status(response.status).json(response);
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

// Share a note with another user
app.post('/api/notes/share', Note.shareNote);

app.post('/api/signup', User.signup);

app.post('/api/login', User.login);

app.post('/api/forgot-password/:email/code', User.forgotPassword);

app.post('/api/validate-pin', User.validatePin);

app.post('/api/reset-password', User.resetPassword);

app.get('/api/users', getUsers);

app.get('/', (req, res) => {
    res.sendFile('views/landing.html', { root: __dirname })
});