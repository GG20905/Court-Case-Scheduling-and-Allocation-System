const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const usersController = require('../controllers/usersController');
const casesController = require('../controllers/casesController');
const hearingsController = require('../controllers/hearingsController');
const documentsController = require('../controllers/documentsController');
const rulingsController = require('../controllers/rulingsController');
const dashboardController = require('../controllers/dashboardController');

// ─── AUTH ─────────────────────────────────────────────────────
router.post('/auth/register', usersController.register);
router.post('/auth/login', usersController.login);
router.post('/auth/forgot-password', usersController.forgotPassword);
router.post('/auth/reset-password', usersController.resetPassword);
router.post('/auth/login/2fa', usersController.loginWith2FA);
router.post('/auth/login/2fa/resend', usersController.resendLogin2FACode);
router.get('/auth/me', authenticate, usersController.getMe);
router.post('/auth/2fa/setup', authenticate, usersController.setup2FA);
router.post('/auth/2fa/enable', authenticate, usersController.enable2FA);
router.post('/auth/2fa/disable', authenticate, usersController.disable2FA);

// ─── USERS (admin) ────────────────────────────────────────────
router.get('/users', authenticate, authorize('admin'), usersController.getUsers);
router.post('/users', usersController.createUser); // kept for compatibility

// ─── DASHBOARD ────────────────────────────────────────────────
router.get('/dashboard/summary', authenticate, authorize('admin'), dashboardController.getSummary);
router.get('/dashboard/judges', authenticate, authorize('admin'), dashboardController.getJudges);
router.get('/dashboard/assignment-responses', authenticate, authorize('admin'), dashboardController.getRecentAssignmentResponses);

// ─── CASES ────────────────────────────────────────────────────
router.post('/cases', authenticate, authorize('litigant', 'advocate'), casesController.createCase);
router.get('/cases', authenticate, casesController.getCases);
router.get('/cases/categories', authenticate, casesController.getCaseCategories);
router.get('/cases/:id', authenticate, casesController.getCaseById);
router.patch('/cases/:id/status', authenticate, authorize('admin'), casesController.updateCaseStatus);
router.patch('/cases/:id/register', authenticate, authorize('admin'), casesController.registerCase);

// ─── HEARINGS ─────────────────────────────────────────────────
router.post('/hearings/request', authenticate, authorize('litigant', 'advocate'), hearingsController.requestHearing);
router.get('/hearings', authenticate, hearingsController.getHearings);
router.get('/hearings/:id', authenticate, hearingsController.getHearingById);
router.post('/hearings', authenticate, authorize('litigant', 'advocate'), hearingsController.createHearing); // compatibility
router.patch('/hearings/:id/status', authenticate, authorize('admin'), hearingsController.updateHearingStatus);
router.patch('/hearings/:id/approve', authenticate, authorize('admin'), hearingsController.approveHearing);
router.patch('/hearings/:id/reject', authenticate, authorize('admin'), hearingsController.rejectHearing);
router.patch('/hearings/:hearingId/reassign', authenticate, authorize('admin'), hearingsController.reassignJudge);
router.patch('/hearings/assignments/:assignmentId/respond', authenticate, authorize('judge'), hearingsController.respondToAssignment);
router.patch('/hearings/:id/mode', authenticate, authorize('judge'), hearingsController.setHearingModeByJudge);

// ─── DOCUMENTS ────────────────────────────────────────────────
router.post('/cases/:caseId/documents', authenticate, authorize('litigant', 'advocate'), upload.single('document'), documentsController.createDocument);
router.get('/cases/:caseId/documents', authenticate, documentsController.getDocumentsByCase);
router.patch('/documents/:id/share', authenticate, authorize('admin'), documentsController.shareDocumentToDesignatedJudge);
router.get('/documents/:id/download', authenticate, documentsController.downloadDocument);
router.delete('/documents/:id', authenticate, documentsController.deleteDocument);

// ─── RULINGS ──────────────────────────────────────────────────
router.post('/rulings', authenticate, authorize('judge'), rulingsController.submitRuling);
router.get('/rulings', authenticate, rulingsController.getAllRulings);
router.get('/rulings/case/:caseId', authenticate, rulingsController.getRulingByCase);
router.patch('/rulings/:id/publish', authenticate, authorize('admin'), rulingsController.publishRuling);

module.exports = router;