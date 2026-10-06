import User from "../../models/User.js";

class UserTableSeeder{

    static async run({force = false} = {}){
        // On startup only seed an empty database; `npm run seed` (force) creates any missing demo account.
        if(!force && await User.countDocuments() > 0){
            return;
        }
        // Dev defaults are for local development only; set SEED_* in .env otherwise.
        const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
        const userPassword = process.env.SEED_USER_PASSWORD || "user123";
        let userData = [
            {
                name: "admin",
                email: "admin@gmail.com",
                password: adminPassword,
                gender:"male",
                role: "admin",
                image: ""
            },
            {
                name: "user",
                email: "user@gmail.com",
                password: userPassword,
                gender:"male",
                role: "user",
                image: ""
            }

        ];

        for(const user of userData){
            if(await User.exists({email: user.email})) continue;
            await new User(user).save();
        }
    }


}

export default UserTableSeeder;