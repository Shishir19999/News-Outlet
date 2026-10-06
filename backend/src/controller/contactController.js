import { createTransport, fromAddress } from '../config/mail.js';
import dotenv from 'dotenv';

dotenv.config();

class ContactController{

    // `transporter` can be injected (tests use a stub); otherwise SMTP_* env is used.
    constructor(transporter){
        this.transporter = transporter || createTransport();
    
        this.index = this.index.bind(this);
    }

    async index(req, res){

        try{
            const {name,subject, email, message} = req.body;
            if (![name, subject, email, message].every(v => typeof v === 'string' && v.trim())) {
                return res.status(422).json({ message: 'name, email, subject and message are required' });
            }
            if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email.trim())) {
                return res.status(422).json({ message: 'A valid email address is required' });
            }
            let response = await this.transporter.sendMail({
                // Gmail rejects/rewrites foreign From addresses, so the visitor goes in Reply-To.
                from: fromAddress(),
                replyTo: email.trim(),
                to: process.env.RECIPIENT_EMAIL,
                subject: `I am: ${name}, ${subject}`,
                text: message
            });
    
            return res.status(200).json({success:true,message: 'Email sent successfully'});
        }catch(e){
            console.log(e);
            return res.status(500).json({message: 'Internal server error'});
        }
    }



}

export default ContactController