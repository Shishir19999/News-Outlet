import mongoose from 'mongoose';
import Subscriber from '../models/Subscriber.js';

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

// Signups are only stored here; this app never sends e-mail to subscribers.
class NewsletterController {
    async subscribe(req, res) {
        try {
            const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
            if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
                return res.status(422).json({ success: false, message: 'A valid email address is required', errors: { email: 'A valid email address is required' } });
            }
            // Same answer for new and existing addresses so the list cannot be probed.
            await Subscriber.updateOne({ email }, { $setOnInsert: { email } }, { upsert: true });
            res.status(201).json({ success: true, message: 'You are subscribed. Thank you!' });
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
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ success: false, message: 'Subscriber not found' });
            const deleted = await Subscriber.findByIdAndDelete(req.params.id);
            if (!deleted) return res.status(404).json({ success: false, message: 'Subscriber not found' });
            res.status(200).json({ success: true, message: 'Subscriber removed' });
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    }
}

export default NewsletterController;
