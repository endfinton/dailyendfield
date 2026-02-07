/**
 * ARKNIGHTS: ENDFIELD DAILY ATTENDANCE (Node.js)
 * Core check-in logic module
 */

const crypto = require('crypto');

// ==========================================
// CONSTANTS
// ==========================================

const CONSTANTS = {
    APP_CODE: "6eb76d4e13aa36e6",
    PLATFORM: "3",
    VNAME: "1.0.0",
    ENDFIELD_GAME_ID: "3",
    URLS: {
        GRANT: "https://as.gryphline.com/user/oauth2/v2/grant",
        GENERATE_CRED: "https://zonai.skport.com/web/v1/user/auth/generate_cred_by_code",
        REFRESH_TOKEN: "https://zonai.skport.com/web/v1/auth/refresh",
        BINDING: "https://zonai.skport.com/api/v1/game/player/binding",
        ATTENDANCE: "https://zonai.skport.com/web/v1/game/endfield/attendance"
    }
};

// ==========================================
// MAIN LOGIC
// ==========================================

async function performCheckIn(accountToken) {
    if (!accountToken || accountToken === "YOUR_ACCOUNT_TOKEN_HERE") {
        throw new Error("ACCOUNT_TOKEN not configured. Please set it via the web interface.");
    }

    console.log('[INFO] Starting Endfield Check-in...');

    // 1. Auth Flow
    const oauthCode = await getOAuthCode(accountToken);
    if (!oauthCode) throw new Error("Failed to get OAuth Code (Check ACCOUNT_TOKEN)");

    const cred = await getCred(oauthCode);
    if (!cred) throw new Error("Failed to get Credential");

    const signToken = await getSignToken(cred);
    if (!signToken) throw new Error("Failed to get Sign Token");

    const gameRole = await getPlayerBinding(cred, signToken);

    // 2. Attendance Request
    const response = await sendAttendanceRequest(cred, signToken, gameRole);
    console.log('[DEBUG] API Response:', JSON.stringify(response, null, 2));

    // 3. Process Result
    return handleResponse(response);
}

// ==========================================
// RESULT HANDLER
// ==========================================

function handleResponse(json) {
    const code = json.code;
    const msg = json.message || "";

    // Success (Code 0)
    if (code === 0) {
        const rewards = parseRewards(json.data);
        const dayCount = json.data.signInCount || "?";

        console.log('[SUCCESS] Signed in successfully!');
        console.log(`[INFO] Days Signed: ${dayCount}`);
        console.log(`[INFO] Rewards: ${rewards}`);

        return {
            success: true,
            status: 'success',
            message: 'Signed in successfully!',
            rewards: rewards,
            daysSign: dayCount
        };
    }
    // Already Signed In
    else if (code === 1001 || code === 10001 || msg.toLowerCase().includes("already")) {
        console.log('[INFO] Already signed in today.');
        return {
            success: true,
            status: 'already_signed',
            message: 'Already signed in today.'
        };
    }
    // Token Expired / Error
    else if (code === 10002) {
        console.error('[ERROR] Account Token is expired. Please update ACCOUNT_TOKEN.');
        return {
            success: false,
            status: 'token_expired',
            message: 'Account Token is expired. Please update it.'
        };
    }
    // Unknown Error
    else {
        console.error(`[ERROR] Unknown API Error - Code: ${code}, Message: ${msg}`);
        return {
            success: false,
            status: 'error',
            message: `API Error - Code: ${code}, Message: ${msg}`
        };
    }
}

// ==========================================
// HELPERS
// ==========================================

function parseRewards(data) {
    if (!data) return "Unknown";
    if (data.reward) return `${data.reward.name} x${data.reward.count}`;
    if (data.awardIds && data.resourceInfoMap) {
        let list = [];
        for (let i = 0; i < data.awardIds.length; i++) {
            const id = data.awardIds[i].id;
            if (data.resourceInfoMap[id]) {
                const item = data.resourceInfoMap[id];
                list.push(`${item.name} x${item.count}`);
            }
        }
        return list.join(", ");
    }
    return "No rewards data found";
}

// ==========================================
// API STEPS
// ==========================================

async function getOAuthCode(token) {
    const payload = { token: token, appCode: CONSTANTS.APP_CODE, type: 0 };
    const response = await fetch(CONSTANTS.URLS.GRANT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const json = await response.json();
    return (json.status === 0 && json.data && json.data.code) ? json.data.code : null;
}

async function getCred(oauthCode) {
    const payload = { kind: 1, code: oauthCode };
    const response = await fetch(CONSTANTS.URLS.GENERATE_CRED, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const json = await response.json();
    return (json.code === 0 && json.data && json.data.cred) ? json.data.cred : null;
}

async function getSignToken(cred) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const headers = {
        "cred": cred,
        "platform": CONSTANTS.PLATFORM,
        "vname": CONSTANTS.VNAME,
        "timestamp": timestamp,
        "sk-language": "en"
    };
    const response = await fetch(CONSTANTS.URLS.REFRESH_TOKEN, {
        method: 'GET',
        headers: headers
    });
    const json = await response.json();
    return (json.code === 0 && json.data && json.data.token) ? json.data.token : null;
}

async function getPlayerBinding(cred, signToken) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = "/api/v1/game/player/binding";
    const signature = computeSign(path, "", timestamp, signToken);
    const headers = {
        "cred": cred,
        "platform": CONSTANTS.PLATFORM,
        "vname": CONSTANTS.VNAME,
        "timestamp": timestamp,
        "sk-language": "en",
        "sign": signature
    };
    const response = await fetch(CONSTANTS.URLS.BINDING, {
        method: 'GET',
        headers: headers
    });
    const json = await response.json();

    if (json.code === 0 && json.data && json.data.list) {
        const apps = json.data.list;
        for (let i = 0; i < apps.length; i++) {
            if (apps[i].appCode === "endfield" && apps[i].bindingList) {
                const binding = apps[i].bindingList[0];
                const role = binding.defaultRole || (binding.roles && binding.roles[0]);
                if (role) return `${CONSTANTS.ENDFIELD_GAME_ID}_${role.roleId}_${role.serverId}`;
            }
        }
    }
    return null;
}

async function sendAttendanceRequest(cred, signToken, gameRole) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = "/web/v1/game/endfield/attendance";
    const signature = computeSign(path, "", timestamp, signToken);
    const headers = {
        "cred": cred,
        "platform": CONSTANTS.PLATFORM,
        "vname": CONSTANTS.VNAME,
        "timestamp": timestamp,
        "sk-language": "en",
        "sign": signature,
        "Content-Type": "application/json"
    };
    if (gameRole) headers["sk-game-role"] = gameRole;

    const response = await fetch(CONSTANTS.URLS.ATTENDANCE, {
        method: 'POST',
        headers: headers
    });
    return await response.json();
}

// ==========================================
// CRYPTO LOGIC
// ==========================================

function computeSign(path, body, timestamp, signToken) {
    const headerObj = {
        "platform": CONSTANTS.PLATFORM,
        "timestamp": timestamp,
        "dId": "",
        "vName": CONSTANTS.VNAME
    };
    const headersJson = JSON.stringify(headerObj);
    const signString = path + body + timestamp + headersJson;

    // HMAC SHA256
    const hmac = crypto.createHmac('sha256', signToken);
    hmac.update(signString);
    const hmacHex = hmac.digest('hex');

    // MD5 of HMAC
    const md5 = crypto.createHash('md5');
    md5.update(hmacHex);
    return md5.digest('hex');
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    performCheckIn,
    CONSTANTS
};
