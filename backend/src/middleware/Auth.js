import TokenMiddleware from "./TokenMiddleware.js";
class Auth{
    static async check(req,res,next){
        if(!req.headers.authorization){
            return res.json({status: false,message: 'Token not found'});
        }
        let token = req.headers.authorization;
        let response = TokenMiddleware.check(token);
        if(response){
            next();
        }else{
            return res.json({status: false,message: 'Invalid token'});
        }

    }
}

export default Auth;