import express from 'express';
import controller from '../controllers/profileController';
import uploadReceipt from '../middleware/uploadReceipt';

const router = express.Router();

router.get('/', controller.getProfile);
router.patch('/', uploadReceipt.single('avatar'), controller.updateProfile);
router.get('/devices', controller.listDevices);
router.delete('/devices/:deviceId', controller.revokeDevice);
router.post('/devices/logout-all', controller.revokeDevice);
router.post('/google/disconnect', controller.disconnectGoogle);
// startGoogleConnect dipindah ke /auth/google/connect (tanpa middleware authenticate,
// karena dipanggil via POST form redirect yang tidak membawa header Bearer)

export default router;
