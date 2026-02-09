/**
 * Database Module - SQLite
 * Manages configuration and check-in logs
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'database.db');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.init();
    }
    init() {
        try {
            // Create data directory if it doesn't exist
            const fs = require('fs');
            const dataDir = path.dirname(DB_PATH);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Initialize database
            this.db = new Database(DB_PATH);
            this.db.pragma('journal_mode = WAL');

            this.createTables();
            console.log(`[DB] Database initialized at: ${path.resolve(DB_PATH)}`);
        } catch (error) {
            console.error('[DB] Failed to initialize database:', error);
            throw error;
        }
    }

    createTables() {
        // Config table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Logs table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT NOT NULL,
                message TEXT,
                rewards TEXT,
                days_signed INTEGER
            )
        `);

        // Tokens table for multiple accounts
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_name TEXT NOT NULL,
                token TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_checkin DATETIME
            )
        `);

        // Add unique index to token column if it doesn't exist
        this.db.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_token ON accounts(token)
        `);
    }

    // Config operations
    setConfig(key, value) {
        const stmt = this.db.prepare(`
            INSERT INTO config (key, value, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET 
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(key, value);
        console.log(`[DB] Config updated: ${key}`);
    }

    getConfig(key) {
        const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
        const row = stmt.get(key);
        return row ? row.value : null;
    }

    getAllConfig() {
        const stmt = this.db.prepare('SELECT key, value, updated_at FROM config');
        return stmt.all();
    }

    // Log operations
    addLog(status, message, rewards = null, daysSign = null) {
        const stmt = this.db.prepare(`
            INSERT INTO logs (status, message, rewards, days_signed)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(status, message, rewards, daysSign);
        console.log(`[DB] Log added: ${status}`);
    }

    getRecentLogs(limit = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM logs 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    getLastLog() {
        const stmt = this.db.prepare(`
            SELECT * FROM logs 
            ORDER BY timestamp DESC 
            LIMIT 1
        `);
        return stmt.get();
    }

    // Cleanup old logs (keep last 100)
    cleanupOldLogs() {
        this.db.exec(`
            DELETE FROM logs 
            WHERE id NOT IN (
                SELECT id FROM logs 
                ORDER BY timestamp DESC 
                LIMIT 100
            )
        `);
    }

    close() {
        if (this.db) {
            this.db.close();
            console.log('[DB] Database connection closed');
        }
    }
    // Account/Token operations
    addAccount(name, token) {
        // Check if token already exists in accounts table
        const existingAccount = this.db.prepare('SELECT id FROM accounts WHERE token = ?').get(token);
        // Check if token exists in config table
        const mainToken = this.getConfig('account_token');

        if (existingAccount || token === mainToken) {
            const error = new Error('Token already exists');
            error.code = 'SQLITE_CONSTRAINT';
            throw error;
        }

        const stmt = this.db.prepare(`
            INSERT INTO accounts (account_name, token)
            VALUES (?, ?)
        `);
        return stmt.run(name, token);
    }

    deleteAccount(id) {
        const stmt = this.db.prepare('DELETE FROM accounts WHERE id = ?');
        return stmt.run(id);
    }

    getAllAccounts() {
        const stmt = this.db.prepare('SELECT id, account_name, token, created_at, last_checkin FROM accounts');
        return stmt.all();
    }

    updateAccountLastCheckin(id) {
        const stmt = this.db.prepare('UPDATE accounts SET last_checkin = CURRENT_TIMESTAMP WHERE id = ?');
        return stmt.run(id);
    }

    /**
     * Get all tokens for check-in (from both tables to ensure compatibility)
     */
    getAllTokens() {
        const tokens = [];

        // From config table (legacy/main page)
        const mainToken = this.getConfig('account_token');
        if (mainToken) {
            tokens.push({
                id: 'main',
                account_name: 'Principal (Config)',
                token: mainToken
            });
        }

        // From accounts table (admin panel)
        const accounts = this.getAllAccounts();
        accounts.forEach(acc => {
            // Avoid duplicates if same token
            if (!tokens.find(t => t.token === acc.token)) {
                tokens.push(acc);
            }
        });

        return tokens;
    }

    // Singleton instance
    static getInstance() {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }
}

// Singleton variable outside of class for private scope or just use the static property
DatabaseManager.instance = null;

function getDatabase() {
    return DatabaseManager.getInstance();
}

module.exports = { getDatabase };
