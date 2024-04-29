import User from "../models/User.js";
import TokenMiddleware from "../middleware/TokenMiddleware.js";

class AuthController{

    static async login(req, res){
        try{
        let {email, password} = req.body;
          let findData = await User.findOne({email});
            if(!findData){
                return res.status(500).json({email: "Email not found"});
            }else{
                let isMatch = await findData.checkPassword(password);
                if(isMatch){
                    let token = await findData.generateToken();
                    return res.status(200).json({token});
                }else{
                    return res.status(500).json({password: "Password not match"});
                }
            }
        }catch(error){
            console.log(error);
        }
    }

    static async  tokenCheck(req,res){
        let response =await TokenMiddleware.check(req.body.token);
        if(response){
            return res.status(200).json({success:true});
        }else{
            return res.status(200).json({success:false});
        }

    } 
}

export default AuthController;