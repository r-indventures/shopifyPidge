var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var bodyParser = require('body-parser');
//var db = require('../db_connection');
var app = require('express')();
var server = require('http').Server(app);

router.use(bodyParser.urlencoded({ extended: true }));


/* GET home page. */	

router.get('/shopify', function(req, res, next) {
	
	res.render('index', {  });
});

router.post('/sucess/submit', function(req, res, next) {
	
	var shopurl = req.body.url;
	 var datetime = new Date();
   // console.log(datetime);
	//res.render('sucess', {  });
  var sql = "INSERT INTO pidge_client (client_name, shop_name,status,created_at,modified_at) VALUES ?";
  var values = [
    ['test', shopurl , 'inactive',datetime,datetime]
	];
  db.query(sql,[values], function (err, result) {
    if (err) throw err;
    console.log("1 record inserted");
	//res.render('index', {  });
  });

	
});



module.exports = router;
