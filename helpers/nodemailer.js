const nodemailer = require('nodemailer');

// Configuração do transporte de e-mail
let transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    auth: {
        user: 'vance.app@hotmail.com',
        pass: 'queassimseja1'
    }
});

module.exports = transporter;
