const express = require('express');
const usersController = require('../controllers/usersController');
const casesController = require('../controllers/casesController');
const hearingsController = require('../controllers/hearingsController');
const dashboardController = require('../controllers/dashboardController');
const documentsController = require('../controllers/documentsController');

const router = express.Router();

router.get('/dashboard/summary', dashboardController.getSummary);

router.get('/users', usersController.getUsers);
router.post('/users', usersController.createUser);

router.get('/cases', casesController.getCases);
router.get('/cases/:id', casesController.getCaseById);
router.post('/cases', casesController.createCase);
router.patch('/cases/:id/status', casesController.updateCaseStatus);

router.get('/hearings', hearingsController.getHearings);
router.post('/hearings', hearingsController.createHearing);
router.patch('/hearings/:id/status', hearingsController.updateHearingStatus);

router.get('/cases/:caseId/documents', documentsController.getDocumentsByCase);
router.post('/cases/:caseId/documents', documentsController.createDocument);

module.exports = router;
