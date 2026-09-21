import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

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
        // Explicitly load the service account JSON to avoid ADC path resolution issues
        // on Windows with spaces in the path (used for local development).
        let credPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
        if (credPath.startsWith('"') && credPath.endsWith('"')) {
            credPath = credPath.slice(1, -1);
        }
        if (credPath.startsWith("'") && credPath.endsWith("'")) {
            credPath = credPath.slice(1, -1);
        }

        const candidatePaths: string[] = []
        if (credPath) {
            candidatePaths.push(path.resolve(credPath))
            candidatePaths.push(path.resolve(process.cwd(), credPath))
        }
        candidatePaths.push(path.join(process.cwd(), 'pro-bliss-430010-m9-c238238bcff4.json'))

        const resolvedPath = candidatePaths.find(p => fs.existsSync(p))
        if (!resolvedPath) {
            throw new Error(`Google credentials file not found at: ${candidatePaths[0] || 'pro-bliss-430010-m9-c238238bcff4.json'}`)
        }

        const keyFile = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'))
        client_email = keyFile.client_email
        private_key = keyFile.private_key
    }

    const auth = new google.auth.JWT({
        email: client_email,
        key: private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    await auth.authorize()
    cachedAuth = auth
    return google.sheets({ version: 'v4', auth: cachedAuth });
}
