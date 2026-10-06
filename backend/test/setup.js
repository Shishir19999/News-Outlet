// Must be imported before anything from src/: configures a throwaway database and fake SMTP.
// dotenv never overrides variables that are already set, so these win over backend/.env.
process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://127.0.0.1:27017/news_test';
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.JWT_EXPIRE = '1h';
process.env.PUBLIC_URL = 'http://localhost:0';
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '1';
process.env.SMTP_EMAIL = 'test';
process.env.SMTP_PASSWORD = 'test';
process.env.RECIPIENT_EMAIL = 'inbox@test.local';

if (!/news_test/.test(process.env.MONGODB_URL)) {
    throw new Error('Refusing to run tests against a database that is not news_test');
}
