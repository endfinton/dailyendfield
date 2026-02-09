/**
 * Web Server - Express.js
 * Provides web interface and API for configuration
 */

const express = require('express');
const path = require('path');
const { getDatabase } = require('./database');
const { performCheckIn, validateToken } = require('./index');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'endfield'; // Default password

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Security Middleware for Admin Routes
const adminAuth = (req, res, next) => {
    const token = req.headers['x-admin-token'];
    if (token === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }
};

// ==========================================
// API ROUTES
// ==========================================

// Get all configuration
app.get('/api/config', (req, res) => {
    try {
        const db = getDatabase();
        const config = db.getAllConfig();

        // Convert array to object
        const configObj = {};
        config.forEach(item => {
            configObj[item.key] = item.value;
        });

        res.json({
            success: true,
            config: configObj
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update configuration
app.post('/api/config', async (req, res) => {
    try {
        const db = getDatabase();
        const { account_token } = req.body;

        if (!account_token) {
            return res.status(400).json({ success: false, message: 'account_token is required' });
        }

        console.log('[API] Validating token from index...');
        const isValid = await validateToken(account_token);
        if (!isValid) {
            console.log('[API] Token validation failed');
            return res.status(400).json({ success: false, message: 'Token Inválido o Expirado' });
        }

        // Check if this token is already in the accounts table
        const allTokens = db.getAllTokens();
        const isDuplicate = allTokens.find(t => t.token === account_token && t.id !== 'main');
        if (isDuplicate) {
            console.log('[API] Duplicate token detected in accounts table');
            return res.status(400).json({ success: false, message: 'El token ya está registrado en la lista de cuentas' });
        }

        console.log('[API] Token validated successfully, saving to config...');
        db.setConfig('account_token', account_token);

        res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
        console.error('[API] Error updating config:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get recent logs
app.get('/api/logs', (req, res) => {
    try {
        const db = getDatabase();
        const limit = parseInt(req.query.limit) || 10;
        const logs = db.getRecentLogs(limit);

        res.json({
            success: true,
            logs: logs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get last log (status)
app.get('/api/status', (req, res) => {
    try {
        const db = getDatabase();
        const lastLog = db.getLastLog();
        const config = db.getAllConfig();

        const configObj = {};
        config.forEach(item => {
            configObj[item.key] = item.value;
        });

        res.json({
            success: true,
            status: lastLog || { status: 'waiting', message: 'No check-in performed yet' },
            config: configObj
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// ADMIN ROUTES (Multi-Account)
// ==========================================

// Get all accounts (unified list including config token)
app.get('/api/admin/accounts', adminAuth, (req, res) => {
    try {
        const db = getDatabase();
        const accounts = db.getAllTokens(); // Use unified tokens list

        // Obfuscate tokens for UI
        const safeAccounts = accounts.map(acc => ({
            ...acc,
            token: acc.token ? (acc.token.substring(0, 4) + '****************' + acc.token.substring(acc.token.length - 4)) : 'Invalid'
        }));

        res.json({ success: true, accounts: safeAccounts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Add new account
app.post('/api/admin/accounts', adminAuth, async (req, res) => {
    try {
        const { account_name, token } = req.body;
        if (!account_name || !token) {
            return res.status(400).json({ success: false, message: 'Name and token required' });
        }

        // Validate token
        console.log(`[API] Validating token for account: ${account_name}...`);
        const isValid = await validateToken(token);
        if (!isValid) {
            console.log('[API] Admin token validation failed');
            return res.status(400).json({ success: false, message: 'Token Inválido o Expirado' });
        }

        const db = getDatabase();
        db.addAccount(account_name, token);
        console.log(`[API] Account added successfully: ${account_name}`);
        res.json({ success: true, message: 'Account added' });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT' || error.message.includes('already exists')) {
            return res.status(400).json({ success: false, message: 'El token ya está registrado' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete account
app.delete('/api/admin/accounts/:id', adminAuth, (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase();
        db.deleteAccount(id);
        res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Manual check-in trigger
app.post('/api/checkin', async (req, res) => {
    try {
        const db = getDatabase();
        const token = db.getConfig('account_token');

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'No token configured'
            });
        }

        console.log('[API] Manual check-in triggered');
        const result = await performCheckIn(token);

        // Save to database
        if (result.success) {
            if (result.status === 'success') {
                db.addLog('success', result.message, result.rewards, result.daysSign);
            } else if (result.status === 'already_signed') {
                db.addLog('already_signed', result.message);
            }
        } else {
            db.addLog('error', result.message);
        }

        res.json({
            success: result.success,
            result: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log('===========================================');
    console.log('  Arknights: Endfield Web Interface');
    console.log('===========================================');
    console.log(`[SERVER] Running on http://localhost:${PORT}`);
    console.log('[SERVER] Open your browser to configure the service');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[SERVER] Received SIGTERM, shutting down gracefully...');
    const db = getDatabase();
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[SERVER] Received SIGINT, shutting down gracefully...');
    const db = getDatabase();
    db.close();
    process.exit(0);
});
