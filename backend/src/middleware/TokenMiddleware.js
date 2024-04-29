import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
dotenv.config();

class TokenMiddleware{

    static async check(token){
        try{
        return jwt.verify(token,process.env.JWT_SECRET);
        }catch(e){
            return false;
        }
    }

}

export default TokenMiddleware;