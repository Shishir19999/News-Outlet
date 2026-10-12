import multer from 'multer';
import  fs from 'fs';

class UploadMiddleware{
    folder_exists(folder){
        const path = `public/${folder}`;
        if (!fs.existsSync(path)){
            fs.mkdirSync(path, { recursive: true });
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
                const fileName = file.originalname.trim().replace(/[^\w.-]+/g, '_');
                cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + "-" + fileName);
            }
        });
        // pictures only, at most 8 MB
        return multer({
            storage: this.storage,
            limits: { fileSize: 8 * 1024 * 1024 },
            fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g|gif|webp|svg\+xml|avif)$/.test(file.mimetype)),
        });
    }
}
export default UploadMiddleware;
