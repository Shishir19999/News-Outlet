import crypto from 'crypto';
import Subscriber from '../models/Subscriber.js';
import News, { liveFilter } from '../models/News.js';
import Category from '../models/Category.js';
import { validateNewsletter, validateDigest, excerpt } from '../shared/rules.js';
import { escapeXml } from '../shared/feeds.js';
import { sendMail } from '../config/mail.js';
import { str, isId, getSettings, audit } from '../lib/helpers.js';

const site = () => (process.env.SITE_URL || process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
const newToken = () => crypto.randomBytes(24).toString('hex');
const link = (path) => `${site()}${path}`;

async function sendConfirmation(sub) {
    const settings = await getSettings();
    const url = link(`/newsletter/confirm?token=${sub.token}`);
    await sendMail({
        to: sub.email,
        subject: `Confirm your ${settings.siteName} newsletter`,
        text: `Please confirm your subscription to the ${settings.siteName} newsletter:\n\n${url}\n\nIf you did not ask for this, ignore this message and nothing will be sent.`,
        html: `<p>Please confirm your subscription to the ${escapeXml(settings.siteName)} newsletter:</p><p><a href="${escapeXml(url)}">Confirm my subscription</a></p><p>If you did not ask for this, ignore this message and nothing will be sent.</p>`,
    });
}

class NewsletterController {
    // Step 1 of double opt-in: store the address as pending and e-mail a confirmation link.
    async subscribe(req, res) {
        try {
            const settings = await getSettings();
            if (!settings.newsletterEnabled) return res.status(403).json({ success: false, message: 'The newsletter is not open for sign-ups right now' });
            const { errors, values } = validateNewsletter(req.body);
            if (Object.keys(errors).length) return res.status(422).json({ success: false, message: errors.email, errors });
            let sub = await Subscriber.findOne({ email: values.email });
            let mailed = false;
            if (!sub) sub = new Subscriber({ email: values.email, token: newToken(), topics: values.topics });
            if (!sub.confirmed) {
                sub.token = sub.token || newToken();
                sub.topics = values.topics;
                await sub.save();
                try {
                    await sendConfirmation(sub);
                    mailed = true;
                } catch (err) {
                    console.log('[newsletter] confirmation e-mail failed:', err.message);
                }
            }
            // The same answer for new, pending and confirmed addresses so the list cannot be probed.
            res.status(201).json({ success: true, mailed, message: mailed || sub.confirmed ? 'Almost done: check your inbox and open the confirmation link.' : 'We saved your address, but the confirmation e-mail could not be sent. Please try again later.' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Step 2: the link in the e-mail.
    async confirm(req, res) {
        try {
            const token = str(req.body.token);
            const sub = token ? await Subscriber.findOne({ token }) : null;
            if (!sub) return res.status(404).json({ success: false, message: 'This confirmation link is not valid any more' });
            if (!sub.confirmed) { sub.confirmed = true; sub.confirmedAt = new Date(); await sub.save(); }
            res.status(200).json({ success: true, message: 'You are subscribed. Thank you!', email: sub.email, topics: sub.topics });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async preferences(req, res) {
        try {
            const token = str(req.query.token || req.body.token);
            const sub = token ? await Subscriber.findOne({ token }) : null;
            if (!sub) return res.status(404).json({ success: false, message: 'This link is not valid any more' });
            if (req.method === 'PUT') {
                const { values } = validateNewsletter({ email: sub.email, topics: req.body.topics });
                sub.topics = values.topics;
                await sub.save();
            }
            res.status(200).json({ success: true, email: sub.email, confirmed: sub.confirmed, topics: sub.topics });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async unsubscribe(req, res) {
        try {
            const token = str(req.body.token);
            const sub = token ? await Subscriber.findOneAndDelete({ token }) : null;
            if (!sub) return res.status(404).json({ success: false, message: 'This link is not valid any more' });
            res.status(200).json({ success: true, message: 'You have been unsubscribed.' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async index(req, res) {
        try {
            res.status(200).json(await Subscriber.find().sort({ createdAt: -1 }));
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    async destroy(req, res) {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Subscriber not found' });
            const deleted = await Subscriber.findByIdAndDelete(req.params.id);
            if (!deleted) return res.status(404).json({ success: false, message: 'Subscriber not found' });
            res.status(200).json({ success: true, message: 'Subscriber removed' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }

    // Admin: send a digest of chosen articles to confirmed subscribers (filtered by topic when given).
    async send(req, res) {
        try {
            const { errors, values } = validateDigest(req.body);
            if (Object.keys(errors).length) return res.status(422).json({ success: false, message: 'Validation failed', errors });
            const settings = await getSettings();
            const ids = values.articleIds.filter(isId);
            const articles = await News.find({ _id: { $in: ids }, ...liveFilter() });
            if (!articles.length) return res.status(422).json({ success: false, message: 'None of the chosen articles is published', errors: { articleIds: 'Pick published articles' } });
            const cats = await Category.find();
            const catName = new Map(cats.map((c) => [String(c._id), c.name]));
            const filter = { confirmed: true };
            if (values.topics.length) filter.$or = [{ topics: { $size: 0 } }, { topics: { $in: values.topics } }];
            const subs = await Subscriber.find(filter);
            let sent = 0;
            let failed = 0;
            for (const sub of subs) {
                const unsub = link(`/newsletter/preferences?token=${sub.token}`);
                const items = articles.map((a) => ({ title: a.title, url: link(`/news-details/${a.slug}?src=newsletter`), text: a.summary || excerpt(a.description, 160), section: catName.get(String(a.categoryId)) || '' }));
                try {
                    await sendMail({
                        to: sub.email,
                        subject: values.subject,
                        text: `${values.intro ? `${values.intro}\n\n` : ''}${items.map((i) => `${i.title}\n${i.text}\n${i.url}`).join('\n\n')}\n\nManage topics or unsubscribe: ${unsub}`,
                        html: `${values.intro ? `<p>${escapeXml(values.intro)}</p>` : ''}${items.map((i) => `<h3><a href="${escapeXml(i.url)}">${escapeXml(i.title)}</a></h3><p>${escapeXml(i.text)}</p>`).join('')}<hr><p><a href="${escapeXml(unsub)}">Manage topics or unsubscribe</a></p>`,
                    });
                    sent++;
                    sub.lastSentAt = new Date();
                    await sub.save();
                } catch (err) {
                    failed++;
                    console.log('[newsletter] send failed:', err.message);
                }
            }
            await audit(req.user, 'newsletter.send', { targetType: 'newsletter', targetLabel: values.subject, detail: `${sent} sent, ${failed} failed, site ${settings.siteName}` });
            res.status(200).json({ success: true, sent, failed, total: subs.length });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
}

export default NewsletterController;
