import { google } from 'googleapis';

let cachedAuth: any = null;

export async function getGoogleSheetsClient() {
    if (cachedAuth) {
        return google.sheets({ version: 'v4', auth: cachedAuth });
    }

    let client_email = (process.env.GOOGLE_CLIENT_EMAIL || '').trim();
    let private_key = (process.env.GOOGLE_PRIVATE_KEY || '').trim();

    // Strip surrounding quotes if present
    if (client_email.startsWith('"') && client_email.endsWith('"')) {
        client_email = client_email.slice(1, -1);
    }
    if (client_email.startsWith("'") && client_email.endsWith("'")) {
        client_email = client_email.slice(1, -1);
    }
    if (private_key.startsWith('"') && private_key.endsWith('"')) {
        private_key = private_key.slice(1, -1);
    }
    if (private_key.startsWith("'") && private_key.endsWith("'")) {
        private_key = private_key.slice(1, -1);
    }

    if (client_email && private_key) {
        private_key = private_key.replace(/\\n/g, '\n');
    } else {
        // In production, require env vars directly
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Missing Google Service Account credentials. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in environment variables.');
        }

        // Local development only: dynamically read local json file
        try {
            const fs = await import('fs');
            const path = await import('path');
            const credPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'pro-bliss-430010-m9-c238238bcff4.json');
            if (fs.existsSync(credPath)) {
                const keyFile = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
                client_email = keyFile.client_email;
                private_key = keyFile.private_key;
            } else {
                throw new Error('Local Google Service Account credentials file not found: pro-bliss-430010-m9-c238238bcff4.json');
            }
        } catch (localErr: any) {
            throw new Error(`Google credentials error: ${localErr.message}`);
        }
    }

    const auth = new google.auth.JWT({
        email: client_email,
        key: private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    await auth.authorize();
    cachedAuth = auth;
    return google.sheets({ version: 'v4', auth: cachedAuth });
}
