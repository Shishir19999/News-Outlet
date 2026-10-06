// `npm run mail:test` - sends ONE test email through the SMTP configured in backend/.env (or process env)
// and prints success/failure. Recipient: MAIL_TEST_TO, else RECIPIENT_EMAIL.
import dotenv from 'dotenv';
import { createTransport, fromAddress, smtpOptions, logMailStartupChecks } from './config/mail.js';

dotenv.config();
logMailStartupChecks();

const to = process.env.MAIL_TEST_TO || process.env.RECIPIENT_EMAIL;
if (!to) {
    console.error('FAIL: no recipient. Set RECIPIENT_EMAIL (or MAIL_TEST_TO).');
    process.exit(1);
}
const o = smtpOptions();
console.log(`Sending test email via ${o.host}:${o.port} (secure=${o.secure}, auth=${o.auth ? 'yes' : 'no'}) ...`);
try {
    const info = await createTransport().sendMail({
        from: fromAddress(),
        to,
        subject: 'NEWS mail test',
        text: `This is a test email from the NEWS backend sent at ${new Date().toISOString()}.`,
    });
    console.log(`SUCCESS: sent (${info.response || info.messageId})`);
} catch (e) {
    console.error(`FAIL: ${e.code ? e.code + ' - ' : ''}${e.message}`);
    process.exit(1);
}
