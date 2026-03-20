import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { MigrationController } from '../controllers/migration.controller.js';
import { TemplateController } from '../controllers/template.controller.js';
import { CSVController } from '../controllers/csv.controller.js';
import { AlertController } from '../controllers/alert.controller.js';
import { SettingsController } from '../controllers/settings.controller.js';
import { AuthController } from '../controllers/auth.controller.js';
import { AccountController } from '../controllers/account.controller.js';
import { WizardController } from '../controllers/wizard.controller.js';

const router = Router();

// Configurar multer para upload de archivos CSV
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// ==================== Auth Routes ====================
router.post('/auth/login', AuthController.login);
router.get('/auth/session', AuthController.getSession);
router.get('/auth/sessions', AuthController.listSessions);
router.post('/auth/validate', AuthController.validate);
router.delete('/auth/session', AuthController.logout);
router.delete('/auth/sessions/:id', AuthController.revokeSession);

// ==================== Account Routes ====================
router.get('/account/info', AccountController.getInfo);
router.get('/account/renditions', AccountController.getRenditions);
router.get('/account/categories', AccountController.getCategories);

// ==================== Migration Routes ====================
router.get('/migrations', MigrationController.list);
router.get('/migrations/:id', MigrationController.getById);
router.post('/migrations', MigrationController.create);
router.put('/migrations/:id', MigrationController.update);
router.delete('/migrations/:id', MigrationController.delete);

// Migration validation
router.post('/migrations/:id/validate', upload.single('file'), MigrationController.validate);
router.get('/migrations/:id/validation', MigrationController.getValidation);

// Migration control
router.post('/migrations/:id/create-in-mediastream', MigrationController.createInMediastream);
router.post('/migrations/:id/start', MigrationController.start);
router.post('/migrations/:id/stop', MigrationController.stop);
router.post('/migrations/:id/retry', MigrationController.retry);

// Migration stats & logs
router.get('/migrations/:id/stats', MigrationController.getStats);
router.get('/migrations/:id/logs', MigrationController.getLogs);

// ==================== Template Routes ====================
router.get('/templates', TemplateController.list);
router.get('/templates/:id', TemplateController.getById);
router.post('/templates', TemplateController.create);
router.put('/templates/:id', TemplateController.update);
router.delete('/templates/:id', TemplateController.delete);
router.post('/templates/:id/duplicate', TemplateController.duplicate);
router.post('/templates/detect', TemplateController.detectTemplate);

// ==================== CSV Routes ====================
router.post('/csv/analyze', upload.single('file'), CSVController.analyze);
router.post('/csv/validate', upload.single('file'), CSVController.validate);
router.post('/csv/check-urls', CSVController.checkUrls);
router.post('/csv/check-url', CSVController.checkSingleUrl);
router.get('/csv/mapper-options', CSVController.getMapperOptions);

// CSV temp (wizard)
router.post('/csv/temp', upload.single('file'), CSVController.uploadTemp);
router.post('/csv/temp/:id/normalize', CSVController.normalizeTemp);
router.post('/csv/temp/:id/extract-urls', CSVController.extractUrlsFromTemp);
router.post('/csv/temp/:id/validate-urls', CSVController.validateUrlsFromTemp);
router.delete('/csv/temp/:id', CSVController.cleanupTemp);
router.get('/csv/temp/:id/download', CSVController.downloadTemp);

// ==================== Wizard Routes ====================
router.post('/wizard/create', WizardController.createMigration);

// ==================== Alert Routes ====================
router.get('/alerts', AlertController.list);
router.put('/alerts/:id/acknowledge', AlertController.acknowledge);
router.put('/alerts/acknowledge-all', AlertController.acknowledgeAll);
router.get('/alerts/unread-count', AlertController.getUnreadCount);

// ==================== Settings Routes ====================
router.get('/settings', SettingsController.get);
router.put('/settings', SettingsController.update);
router.post('/settings/test-connection', SettingsController.testConnection);
router.get('/settings/mediastream-migrations', SettingsController.getMediastreamMigrations);

export default router;
