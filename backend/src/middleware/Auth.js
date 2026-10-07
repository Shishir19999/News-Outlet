import TokenMiddleware from "./TokenMiddleware.js";

class Auth{
    // Verifies the JWT and attaches the payload ({_id, role}) to req.user.
    static async check(req,res,next){
        if(!req.headers.authorization){
            return res.status(401).json({status: false,message: 'Token not found'});
        }
        let token = req.headers.authorization;
        let response = await TokenMiddleware.checkActive(token);
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
        if(req.user && req.user.role === 'admin'){
            return next();
        }
        return res.status(403).json({status: false,message: 'Admin access required'});
    }

    // Must run after Auth.check. Allows admins, or a user acting on their own :id.
    static adminOrSelf(req,res,next){
        if(req.user && (req.user.role === 'admin' || String(req.user._id) === String(req.params.id))){
            return next();
        }
        return res.status(403).json({status: false,message: 'Forbidden'});
    }
}

export default Auth;
