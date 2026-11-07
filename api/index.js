'use strict';
// Función de Vercel: atiende /api/* y /media/* con el mismo servidor que se usa localmente.
const { handler } = require('../server/index');

module.exports = (req, res) => handler(req, res);
