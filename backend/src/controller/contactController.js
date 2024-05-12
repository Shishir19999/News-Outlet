import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class ContactController{

    constructor(){
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
            tls: {
                rejectUnauthorized: true,
                minVersion: "TLSv1.2"
            }
        });
    
        this.index = this.index.bind(this);
    }

    async index(req, res){

        try{
            const {name,subject, email, message} = req.body;
            console.log(name,subject,email,message);
            let response = await this.transporter.sendMail({
                from: email,
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