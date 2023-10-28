const {Note} = require('./Controllers/notes');
const {User} = require('./Controllers/user');


const express = require('express');
const morgan = require('morgan');

const db = require('./db');
const app = express();
app.use(express.json());
app.use(morgan('dev'))


async function getUsers(req, res) {
    try {
        const result = await db.query('SELECT * FROM users');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}


// Get all notes 
app.post('/api/notes/get', Note.getNotes);

// Add a new note
app.post('/api/notes', Note.createNote);

// Update a note
app.put('/api/notes/:id', Note.updateNote);

// Delete a note
app.delete('/api/notes/:id', Note.deleteNote);

// Favoritar Notas
app.post('/api/notes/:id/favorite', Note.favoriteNote);

app.listen(3000, () => {
    console.log('Server on port 3000')
});

// Share a note with another user
app.post('/api/notes/share', Note.shareNote);

// Update a shared note
app.put('/api/notes/shared/:id', Note.editSharedNotes);

// Get all users associated with a shared note
app.get('/api/notes/shared/:noteId/users/', Note.getSharedNoteUsers);

// Update the can_edit permission of a shared note
app.post('/api/notes/shared/permission', Note.updateNotePermission);

app.post('/api/signup', User.signup);

app.post('/api/login', User.login);

app.get('/api/forgot-password/:email/code', User.forgotPassword);

app.post('/api/validate-pin', User.validatePin);

app.post('/api/reset-password', User.resetPassword);

app.get('/api/users', getUsers);

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/views/landing.html');
});
