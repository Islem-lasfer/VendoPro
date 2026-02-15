const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const licenseRoutes = require('../routes/license');
const app = express();
app.use(express.json());
app.use(cors());

// Log all incoming requests for debugging
app.use((req, res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
	next();
});

mongoose.connect('mongodb://lasferislem:94d7239F2400@localhost:27017/licenses?authSource=licenses');

app.use('/api/license', licenseRoutes);

app.listen(3000, '0.0.0.0', () => console.log('License server running on port 3000'));
