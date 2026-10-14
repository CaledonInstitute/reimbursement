import { Router } from 'express';
import googleController from '../controllers/googleController';
import profileController from '../controllers/profileController';

const router = Router();

router.get('/google', googleController.googleStart);
router.get('/google/callback', googleController.googleCallback);
router.post('/google/connect', profileController.startGoogleConnect);

export default router;
