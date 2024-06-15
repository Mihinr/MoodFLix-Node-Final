var express = require("express");
var router = express.Router();

const savedMovies_controller = require('../controllers/savedMovies_controller');

router.get('/savedMovies', savedMovies_controller.savedMovies);

module.exports = router;