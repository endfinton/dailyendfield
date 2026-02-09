/**
 * Worker Process - Periodic Check-in
 * Reads token from database and performs check-in
 */

const { performCheckIn } = require('./index');
const { getDatabase } = require('./database');

let checkInTimer = null;

async function runCheckIn() {
    const db = getDatabase();

    try {
        // Get all accounts/tokens from database (unified)
        const accounts = db.getAllTokens();

        if (accounts.length === 0) {
            console.log('[WORKER] No accounts configured. Waiting...');
            return;
        }

        console.log(`[WORKER] Starting check-in process for ${accounts.length} accounts...`);

        // Perform check-in for each account
        for (const account of accounts) {
            console.log(`[WORKER] Processing account: ${account.account_name}`);

            try {
                const result = await performCheckIn(account.token);

                // Save result to database
                if (result.success) {
                    if (result.status === 'success') {
                        db.addLog('success', `[${account.account_name}] ${result.message}`, result.rewards, result.daysSign);
                        db.updateAccountLastCheckin(account.id);
                    } else if (result.status === 'already_signed') {
                        db.addLog('already_signed', `[${account.account_name}] ${result.message}`);
                        db.updateAccountLastCheckin(account.id);
                    }
                } else {
                    db.addLog('error', `[${account.account_name}] ${result.message}`);
                }
            } catch (accError) {
                console.error(`[WORKER] Error for account ${account.account_name}:`, accError.message);
                db.addLog('error', `[${account.account_name}] ${accError.message}`);
            }

            // Small delay between accounts to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Cleanup old logs
        db.cleanupOldLogs();

    } catch (error) {
        console.error('[WORKER] Fatal check-in error:', error.message);
        db.addLog('error', `Fatal error: ${error.message}`);
    }
}

function scheduleNextRun() {
    // Schedule for 20:00 UTC daily
    const now = new Date();
    const target = new Date();

    // Set target to today at 20:00 UTC
    target.setUTCHours(20, 0, 0, 0);

    // If it's already past 20:00 UTC today, schedule for tomorrow
    if (now >= target) {
        target.setUTCDate(target.getUTCDate() + 1);
    }

    const msUntilTarget = target.getTime() - now.getTime();
    const hoursUntil = (msUntilTarget / (1000 * 60 * 60)).toFixed(1);

    console.log(`[WORKER] Next check-in scheduled for: ${target.toISOString()} (in ${hoursUntil} hours)`);

    if (checkInTimer) {
        clearTimeout(checkInTimer);
    }

    checkInTimer = setTimeout(async () => {
        await runCheckIn();
        scheduleNextRun(); // Schedule next day
    }, msUntilTarget);
}

async function startWorker() {
    console.log('===========================================');
    console.log('  Arknights: Endfield Check-In Worker');
    console.log('===========================================');
    console.log('[WORKER] Schedule: Daily at 20:00 UTC');

    // Run immediately on start
    await runCheckIn();

    // Schedule future runs
    scheduleNextRun();
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('[WORKER] Received SIGTERM, shutting down gracefully...');
    if (checkInTimer) {
        clearTimeout(checkInTimer);
    }
    const db = getDatabase();
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[WORKER] Received SIGINT, shutting down gracefully...');
    if (checkInTimer) {
        clearTimeout(checkInTimer);
    }
    const db = getDatabase();
    db.close();
    process.exit(0);
});

// Start the worker
startWorker().catch(error => {
    console.error('[WORKER] Fatal error:', error);
    process.exit(1);
});
