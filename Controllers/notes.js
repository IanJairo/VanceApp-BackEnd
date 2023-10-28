
const db = require('./../db');
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

            res.json(response);

        } catch (err) {
            response.error = err.message;
            response.status = 500;
            res.json(response);
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
                return res.json(response);
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

            res.json(response);
        } catch (err) {
            response.error = err.message;
            response.status = 500;
            res.json(response);
        }
    },

    async favoriteNote(req, res) {
        const noteId = req.params.id;
        const userId = req.body.user.id;


        try {
            const result = await pool.query(
                'SELECT * FROM notes WHERE id = $1',
                [noteId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Note not found' });
            }

            const note = result.rows[0];

            if (note.favorites.includes(userId)) {
                return res.status(400).json({ error: 'Note already favorited' });
            }

            note.favorites.push(userId);

            await pool.query(
                'UPDATE notes SET favorites = $1 WHERE id = $2',
                [note.favorites, noteId]
            );

            res.json({ message: 'Note favorited successfully' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getQueryUsers(users) {
        let result = [];
        for (let i = 0; i < users.length; i++) {
            const query = `
                SELECT name, email
                FROM users
                WHERE id = $1
            `;
            const values = [users[i].user_id];
            const queryResult = await db.query(query, values);
            queryResult.rows[0].can_edit = users[i].can_edit;
            result.push(queryResult.rows[0]);
        }
        return result;
    },


    async getSharedNoteUsers(req, res) {
        const { noteId } = req.params;
        let response = { error: '' };
        try {
            // Verifica se a nota compartilhada existe no banco de dados
            const sharedNote = await db.query('SELECT * FROM user_note WHERE note_id = $1', [noteId]);
            if (sharedNote.rows.length === 0) {
                response = { error: 'Shared note not found', status: 404, message: "Nota compartilhada não encontrada." };
                return res.json(response);
            }


            // Obtém todos os usuários associados à nota compartilhada
            const users = await Note.getQueryUsers(sharedNote.rows);

            response = { error: null, status: 200, message: "Usuários associados à nota compartilhada.", data: users };
            res.json(response);
        } catch (err) {
            response = { error: err.message, status: 500, message: "Erro interno do servidor." };

        }
    },

    // Agora preciso de uma função para alterar a permissão de edição de uma nota compartilhada
    async updateNotePermission(req, res) {
        let response = { error: '' };
        try {
            const { noteId, userId, canEdit } = req.body;

            // Check if the shared note exists
            const sharedNote = await db.query('SELECT * FROM user_note WHERE note_id = $1 AND user_id = $2', [noteId, userId]);
            if (sharedNote.rows.length === 0) {
                response = { error: 'Shared note not found', status: 404, message: "Nota compartilhada não encontrada." };
                return res.json(response);
            }

            // Update the can_edit permission of the shared note
            const query = `
                    UPDATE user_note
                    SET can_edit = $1
                    WHERE note_id = $2 AND user_id = $3
                `;
            const values = [canEdit, noteId, userId];
            await db.query(query, values);

            response = { error: null, status: 200, message: "Permissão de edição atualizada com sucesso." };
            res.json(response);
        } catch (err) {
            response = { error: err.message, status: 500, message: "Erro interno do servidor." };
            res.json(response);
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

            response = { error: null, status: 200, message: "Nota deletada." };
            res.json(response);
        } catch (err) {
            response = { error: err.message, status: 500, message: "Erro interno do servidor." };
            res.json(response);
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

            response = { error: null, status: 200, message: "Notas do usuário.", data: result.rows };
            res.json(response);
        } catch (err) {
            response = { error: err.message, status: 500, message: "Erro interno do servidor." };
            res.json(response);
        }
    },

    async shareNote(req, res) {
        // Rota para compartilhar uma nota com outro usuário
        const { noteId, email, canEdit } = req.body;
        let response = { error: '' };

        try {
            // Verifica se a nota existe no banco de dados
            const note = await db.query('SELECT * FROM note WHERE id = $1', [noteId]);

            if (note.rows.length === 0) {
                response = { error: 'Note not found', status: 204, message: "Nota inexistente." };
                return res.json(response);
            }

            // Verifica se o usuário atual é o autor da nota
            if (note.rows[0].user_id !== req.body.user.id) {
                response = { error: 'Note not found', status: 204, message: "A nota já pertence ao usuário." };
                return res.json(response);
            }

            // Verifica se o email do destinatário existe no banco de dados
            const recipient = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (recipient.rows.length === 0) {
                response = { error: 'Recipient not found', status: 204, message: "Destinatario não encontrado." };
                return res.json(response);
            }

            // Verifica se a nota já foi compartilhada com o destinatário
            const isShared = await db.query('SELECT * FROM user_note WHERE note_id = $1 AND user_id = $2', [noteId, recipient.rows[0].id]);

            if (isShared.rows.length > 0) {
                console.error("entrou?")
                response = { error: 'Note already shared with recipient', status: 204, message: "Nota já pertence ao destinatário." };
                return res.json(response);
            }

            // Compartilha a nota com o destinatário
            await db.query('INSERT INTO user_note (note_id, user_id, can_edit) VALUES ($1, $2, $3)', [noteId, recipient.rows[0].id, canEdit]);

            response = { error: null, status: 200, message: "Nota compartilhada." };
            res.json(response);
        } catch (err) {
            response = { error: err.message, status: 500, message: "Erro interno do servidor." };
            res.json(response);
        }
    },

    async editSharedNotes(req, res) {
        const noteId = req.params.id;
        const { title, content } = req.body;

        let response = { error: '', message: '' };

        try {
            // Verifica se a nota compartilhada existe no banco de dados
            const sharedNote = await db.query('SELECT * FROM user_note WHERE note_id = $1', [noteId]);
            if (sharedNote.rows.length === 0) {
                response = { error: 'Shared note not found', status: 404, message: "Nota compartilhada não encontrada." };
                return res.json(response);
            }

            // Verifica se o usuário atual tem permissão para editar a nota compartilhada
            if (sharedNote.rows[0].user_id !== req.body.user.id || !sharedNote.rows[0].can_edit) {
                response = { error: 'Forbidden', status: 403, message: "Usuário não tem permissão para editar a nota." };
                return res.json(response);
            }

            // Atualiza a nota compartilhada
            const query = 'UPDATE note SET title = $1, content = $2 WHERE id = $3';
            const values = [title, content, sharedNote.rows[0].note_id];
            await db.query(query, values);

            response = { error: null, status: 200, message: "Nota compartilhada atualizada." };
            res.json(response);
        } catch (err) {
            response = { error: err.message, status: 500, message: "Erro interno do servidor." };
            res.json(response);
        }
    }

};

module.exports = {Note};