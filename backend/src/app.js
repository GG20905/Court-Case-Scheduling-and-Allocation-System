const express = require('express');
const cors = require('cors');

require('./config/db');

const apiRouter = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.get('/', (_req, res) => {
	res.status(200).json({
		message: 'Virtual court backend is running.',
		health_endpoint: '/api/health'
	});
});

app.get('/api/health', (_req, res) => {
	res.status(200).json({ status: 'ok', message: 'Virtual court API is healthy.' });
});

app.use('/api', apiRouter);

app.use((err, _req, res, _next) => {
	console.error(err);
	res.status(500).json({ message: 'Internal server error', details: err.message });
});

module.exports = app;
