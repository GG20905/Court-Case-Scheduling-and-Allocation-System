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
	if (err && err.name === 'MulterError') {
		if (err.code === 'LIMIT_FILE_SIZE') {
			return res.status(400).json({ success: false, message: 'File is too large. Maximum size is 10MB.' });
		}
		return res.status(400).json({ success: false, message: err.message || 'File upload error.' });
	}

	if (err && typeof err.message === 'string' && err.message.includes('Only PDF files are allowed.')) {
		return res.status(400).json({ success: false, message: err.message });
	}

	console.error(err);
	res.status(500).json({ message: 'Internal server error', details: err.message });
});

module.exports = app;
