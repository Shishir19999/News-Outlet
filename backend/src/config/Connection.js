import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
class Connection {
  
    static async connect() {
        try{
            await mongoose.connect(process.env.MONGODB_URL);
            console.log('Database connected successfully');

        }catch(error){
            console.log(error);
        }
    }
}
export default Connection;