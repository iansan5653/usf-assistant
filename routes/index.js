var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
	res.setHeader('Content-Type', 'application/json');
  response = JSON.stringify({ a: 1 });
  res.send(response);
});

module.exports = router;