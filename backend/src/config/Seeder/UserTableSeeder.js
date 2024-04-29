import User from "../../models/User.js";

class UserTableSeeder{

    static async run(){
        let userData = [
            {
                name: "admin",
                email: "admin@gmail.com",
                password: "admin123",
                gender:"male",
                role: "admin",
                image: ""
            },
            {
                name: "user",
                email: "user@gmail.com",
                password: "user123",
                gender:"male",
                role: "user",
                image: ""
            }

        ];

        userData.forEach(async (user) => {
            let findUser = await User.findOne({email: user.email});
            if(!findUser){
                let newUser = new User(user);
                await newUser.save();
            }
        })
    }


}

export default UserTableSeeder;