require('dotenv').config();

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ejs = require('ejs');
const fs = require('fs');
const db = require('./../db');
const transporter = require('./../helpers/nodemailer');

const User = {
    async updateUserTotalNotes(userId) {
        try {
            const result = await pool.query(
                'UPDATE users SET total_notes = total_notes + 1 WHERE id = $1 RETURNING *',
                [userId]
            );

            if (result.rows.length === 0) {
                return false
            }

            return true
        } catch (err) {
            return false
        }
    },

    async updateUserSharedNotes(userId) {
        try {
            const result = await pool.query(
                'UPDATE users SET shared_notes = shared_notes + 1 WHERE id = $1 RETURNING *',
                [userId]
            );


            if (result.rows.length === 0) {
                return false
            }

            return true
        } catch (err) {
            return false
        }
    },

    async signup(req, res) {
        let response = { error: '' }
        try {
            const { name, email, password } = req.body;
            const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (result.rows.length > 0) {

                response = { error: "Email already exists", status: 409, message: "E-mail já cadastrado." }
                return res.json(response);
            }
            const hash = await bcrypt.hash(password, 10);
            const insertResult = await db.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id', [name, email, hash]);

            response = { error: '', status: 201, message: "Usuário cadastrado com sucesso." }

            res.json(response);
        } catch (err) {
            response = { error: err.message, status: 500, message: "Erro interno do servidor." };
            res.json(response);
        }
    },

    async forgotPassword(req, res) {
        const email = req.params.email;
        let response = { error: '' };
        console.log(email)
        try {
            // Verifica se o email existe no banco de dados
            const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (user.rows.length === 0) {
                response = { error: 'User not found', status: 404, message: "Usuário não encontrado." };
                return res.json(response);
            }

            // Gera um PIN de 6 dígitos
            const pin = crypto.randomInt(100000, 999999);

            // Salva o PIN no banco de dados
            await db.query('UPDATE users SET pin = $1 WHERE email = $2', [pin, email]);


            // Lê o conteúdo do arquivo HTML
            const messageHtml = fs.readFileSync(process.cwd() + '/helpers/message.html', 'utf8');

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

            response = { error: '', status: 200, message: "PIN enviado por e-mail." }
            res.json(response);

        } catch (err) {
            response.error = err.message;
            response.status = 500;
            res.json(response);
        }

    },

    async validatePin(req, res) {
        const { email, pin } = req.body;
        let response = { error: '' };

        try {
            // Verifica se o email existe no banco de dados
            const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (user.rows.length === 0) {
                response = { error: 'User not found', status: 404, message: "Usuário não encontrado." };
                return res.json(response);
            }

            // Verifica se o PIN fornecido corresponde ao PIN armazenado no banco de dados
            if (user.rows[0].pin !== pin) {
                response = { error: 'Invalid PIN', status: 401, message: "PIN inválido." };
                return res.json(response);
            }

            await db.query('UPDATE users SET pin = NULL WHERE email = $1', [email]);

            response = { error: '', status: 200, message: "PIN validado." };
            res.json(response);
        } catch (err) {
            response = { error: err.message, status: 500, message: "Erro interno do servidor." };
            res.json(response);
        }
    },
    async resetPassword(req, res) {
        const { email, newPassword } = req.body;
        let response = { error: '' };

        try {
            // Verifica se o email existe no banco de dados
            const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (user.rows.length === 0) {
                response = { error: 'User not found', status: 404, message: "Usuário não encontrado." };
                return res.json(response);
            }

            // Gera um hash da nova senha
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(newPassword, salt);

            // Atualiza a senha do usuário no banco de dados
            await db.query('UPDATE users SET password = $1 WHERE email = $2', [hash, email]);

            response = { error: '', status: 200, message: "Senha atualizada com sucesso." }
            res.json(response);
        } catch (err) {
            response = { error: err.message, status: 500, message: "Erro interno do servidor." };
            res.json(response);
        }
    },

    async login(req, res) {
        let response = { error: '' }
        const secret = process.env.JWT_SECRET;
        console.log('secret', secret)
        try {
            const { email, password } = req.body;
            const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (result.rows.length === 0) {
                response.error = 'E-mail ou senha errados!';
                response.status = 401;
                return res.json(response);
            }
            const user = result.rows[0];
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                response.error = 'E-mail ou senha errados!';
                response.status = 401;
                return res.json(response);
            }

            response.status = 200;
            delete user.password
            const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '1h' });
            response.data = { user, token, message: 'Login efetuado com sucesso' };
            res.json(response);
        } catch (err) {
            response.error = err.message;
            response.message = "Erro interno do servidor."
            response.status = 500;
            res.json(response);
        }
    }

}

module.exports = { User }