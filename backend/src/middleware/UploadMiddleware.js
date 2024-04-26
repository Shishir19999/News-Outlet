import multer from 'multer';
import  fs from 'fs';

class UploadMiddleware{
    folder_exists(folder){
        const path = `public/${folder}`;
        if (!fs.existsSync(path)){
            fs.mkdirSync(path);
            return true;
        }
        return false;
    }
    upload(destination) {
        this.folder_exists(destination);
        this.storage = multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, `public/${destination}`);
            },
            filename: function (req, file, cb) {
                let fileName = file.originalname.trim();
                let imageName = Date.now() + '-' + Math.round(Math.random() * 1E9) + "-" + fileName;
                cb(null, imageName)
            }
        });
        return multer({storage: this.storage});
    }
}
export default UploadMiddleware;