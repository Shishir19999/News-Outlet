import TokenMiddleware from "./TokenMiddleware.js";
import { can, roleAtLeast, normalizeRole } from "../shared/rules.js";

class Auth{
    // Verifies the JWT and attaches the payload ({_id, role, name}) to req.user.
    static async check(req,res,next){
        if(!req.headers.authorization){
            return res.status(401).json({status: false,message: 'Token not found'});
        }
        const response = await TokenMiddleware.checkActive(req.headers.authorization);
        if(response && response.pay_load){
            req.user = response.pay_load;
            next();
        }else{
            return res.status(401).json({status: false,message: 'Invalid token'});
        }
    }

    // Like check, but anonymous or invalid callers simply continue without req.user.
    static async optional(req,res,next){
        if(req.headers.authorization){
            const response = await TokenMiddleware.checkActive(req.headers.authorization);
            if(response && response.pay_load){
                req.user = response.pay_load;
            }
        }
        next();
    }

    // Must run after Auth.check.
    static admin(req,res,next){
        if(req.user && normalizeRole(req.user.role) === 'admin'){
            return next();
        }
        return res.status(403).json({status: false,message: 'Admin access required'});
    }

    // Must run after Auth.check: at least this role (reader < author < editor < admin).
    static atLeast(role){
        return (req,res,next) => {
            if(req.user && roleAtLeast(req.user.role, role)) return next();
            return res.status(403).json({status: false,message: `${role[0].toUpperCase()}${role.slice(1)} access required`});
        };
    }

    // Must run after Auth.check: the role must hold this permission (see shared/rules.js).
    static can(perm){
        return (req,res,next) => {
            if(req.user && can(req.user.role, perm)) return next();
            return res.status(403).json({status: false,message: 'You do not have permission to do this'});
        };
    }

    // Must run after Auth.check. Allows admins, or a user acting on their own :id.
    static adminOrSelf(req,res,next){
        if(req.user && (normalizeRole(req.user.role) === 'admin' || String(req.user._id) === String(req.params.id))){
            return next();
        }
        return res.status(403).json({status: false,message: 'Forbidden'});
    }
}

export default Auth;
