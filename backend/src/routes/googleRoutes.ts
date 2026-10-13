import { Router } from 'express';
import googleController from '../controllers/googleController';

const router = Router();

router.get('/google', googleController.googleStart);
router.get('/google/callback', googleController.googleCallback);

export default router;
