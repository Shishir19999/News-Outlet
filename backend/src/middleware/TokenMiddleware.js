import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
dotenv.config();

class TokenMiddleware{

    static async check(token){
        try{
        return jwt.verify(token,process.env.JWT_SECRET || "fdsdffdseds45fsdfds34cret");
        }catch(e){
            return false;
        }
    }

    // Signature check plus revocation check: the user must still exist and the
    // token's tokenVersion must match the stored one. Returns the decoded token
    // (with a fresh role) or false.
    static async checkActive(token){
        const decoded = await TokenMiddleware.check(token);
        const payload = decoded && decoded.pay_load;
        if(!payload || !mongoose.Types.ObjectId.isValid(payload._id)){
            return false;
        }
        const user = await User.findById(payload._id).select('role tokenVersion');
        if(!user || (user.tokenVersion || 0) !== (payload.tokenVersion || 0)){
            return false;
        }
        return { ...decoded, pay_load: { ...payload, role: user.role } };
    }

}

export default TokenMiddleware;