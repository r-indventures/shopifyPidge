const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce')();
const querystring = require('querystring');
const request = require('request-promise');
const Promise = require('promise');
const async = require('async');

var createError = require('http-errors');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var bodyParser = require('body-parser');
var hbs = require('express-handlebars');
var mysql = require('mysql');
//var db = require('./db_connection');
var shopifyAPI = require('shopify-api-node');
const HELPER= require("./helper/store_helper")
var router = express.Router();
const url = require('url');


var apps = require('express')();
var server = require('http').Server(app);

var session=require('express-session');
app.set('trust proxy', true);
app.use(session({
		secret: 'ssshhhhh',
		resave: false,
		saveUninitialized: true,
		cookie: {
			secure: false,
		}
	
	}));

//app.use(session({secret:'app',cookie:{maxAge:6000}}));
var sess;
  
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var indexRouter = require('./routes/index');

const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
const googleApiKey = process.env.GOOGLE_GEO_API_KEY;
const scopes =  'write_shipping,read_orders,write_orders,read_inventory,read_products';
//const forwardingAddress = "https://33f80cfa.ngrok.io"; // Replace this with your HTTPS Forwarding address
const forwardingAddress = "https://shopify.pidge.in"; // Replace this with your HTTPS Forwarding address
const PIDGE_API=process.env.PIDGE_API
// view engine setup
//app.engine('hbs', hbs({extname: 'hbs', defaultLayout: 'layout', layoutsDir: __dirname +'/views/'}));
app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'hbs');
app.set('view engine', 'pug');
app.use(express.static(path.join(__dirname, 'assets')));
app.listen(3000, function() {
  console.log('Example app listening on port 3000!');
});

app.get('/', function(req, res, next) {

  res.render('index', { shopname : req.query.shopname  });
  
});


app.get('/shopify', (req, res) => {

  const shop = req.query.shop;
   //console.log(req.query);
   if (shop) {
    const state = nonce();
    const redirectUri = forwardingAddress + '/shopify/callback';
    const installUrl = 'https://' + shop +
      '/admin/oauth/authorize?client_id=' + apiKey +
      '&scope=' + scopes +
      '&state=' + state +
      '&redirect_uri=' + redirectUri;

    res.cookie('state', state);
	
    res.redirect(installUrl);
  } else {
    return res.status(400).send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request');
  }
});

app.get('/shopify/callback', (req, res) => {
	const { shop, hmac, code, state } = req.query;
	var shopAccessToken = "";
	var redirectUrl;
	const stateCookie = cookie.parse(req.headers.cookie).state;
	
	if (state !== stateCookie) {
		return res.status(403).send('Request origin cannot be verified');
	}

	if (shop && hmac && code) {
		const map = Object.assign({}, req.query);
		delete map['signature'];
		delete map['hmac'];
		const message = querystring.stringify(map);
		const providedHmac = Buffer.from(hmac, 'utf-8');
		const generatedHash = Buffer.from(
		  crypto
			.createHmac('sha256', apiSecret)
			.update(message)
			.digest('hex'),
			'utf-8'
		);

		let hashEquals = false;
		// timingSafeEqual will prevent any timing attacks. Arguments must be buffers
		try {
			hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac)
		// timingSafeEqual will return an error if the input buffers are not the same length.
		} catch (e) {
			hashEquals = false;
		};

		if (!hashEquals) {
			return res.status(400).send('HMAC validation failed');
		} else {
			console.log("Here in hashEqual");
		}

		const accessTokenRequestUrl = 'https://' + shop + '/admin/oauth/access_token';
		const accessTokenPayload = {
			client_id: apiKey,
			client_secret: apiSecret,
			code,
		};

		request.post(accessTokenRequestUrl, { json: accessTokenPayload })
			.then((accessTokenResponse) => {
				const accessToken = accessTokenResponse.access_token;
				shopAccessToken = accessToken;
				/*console.log("-------------");
				console.log(shopAccessToken);
				console.log("------------");*/
				const shopRequestUrl = 'https://' + shop + '/admin/api/2020-01/shop.json';
				const shopRequestHeaders = {
				  'X-Shopify-Access-Token': shopAccessToken,
				};

				return request.get(shopRequestUrl, { headers: shopRequestHeaders });
			})
			.then((shopResponse) => {
				const obj = JSON.parse(shopResponse);
			
				var shopname = obj.shop.name;
				var shopurl = obj.shop.myshopify_domain;
				var datetime = new Date();
				var store_id= obj.shop.id;
				req.session.appInstalled = true;
				req.session.shopAccessToken = shopAccessToken;
				
				redirectUrl = '/sucess/?shopname='+ shopname +'&shopurl='+shopurl+'&store_id='+store_id;
				
				/*******************************/
				var shopify = new shopifyAPI({
					shopName: shop,
					accessToken: shopAccessToken
				});
				/*console.log("--------------");
				console.log(shopAccessToken);
				console.log("--------------");*/
				var carrierServicePayload = {
					"name": "Pidge Shipping Provider",
					"callback_url": "https://shopify.pidge.in/carrier-services",
					"service_discovery": true
				};
				
				return shopify.carrierService.create(carrierServicePayload);
				/*******************************/
				
			})
			.then((carrierServiceResponse) => {
				
				/*****************************************/
				const shopRequestHeaders = {
				  'X-Shopify-Access-Token': shopAccessToken,
				  'Content-Type': 'application/json'
				};
				var shopRequestUrl = 'https://'+shop+'/admin/webhooks.json';
				
				
				var webhookOrdersCancelled =  {
					webhook : {
					"topic": "orders/create",
					"address": "https://shopify.pidge.in/shopify-orders-create",
					"format": "json"
					}
				};
				return request.post(shopRequestUrl, { headers: shopRequestHeaders,json: webhookOrdersCancelled});
				/*****************************************/

			})
			.then((webhookOrdersCreateResponse) => {
				
				/************************************************/
				const shopRequestHeaders = {
				  'X-Shopify-Access-Token': shopAccessToken,
				  'Content-Type': 'application/json'
				};
				var shopRequestUrl = 'https://'+shop+'/admin/webhooks.json';
				
				
				var webhookOrdersCancelled =  {
					webhook : {
					"topic": "orders/cancelled",
					"address": "https://shopify.pidge.in/shopify-orders-cancelled",
					"format": "json"
					}
				};
				return request.post(shopRequestUrl, { headers: shopRequestHeaders,json: webhookOrdersCancelled})
				/************************************************/
			})
			.then((webhookOrdersCancelled) => {
				
				/************************************************/
				const shopRequestHeaders = {
				  'X-Shopify-Access-Token': shopAccessToken,
				  'Content-Type': 'application/json'
				};
				var shopRequestUrl = 'https://'+shop+'/admin/webhooks.json';
				
				
				var webhookOrdersUpdated =  {
					webhook : {
					"topic": "orders/updated",
					"address": "https://shopify.pidge.in/shopify-orders-updated",
					"format": "json"
					}
				};
				return request.post(shopRequestUrl, { headers: shopRequestHeaders,json: webhookOrdersUpdated})
				/************************************************/
			})
			.then((webhookOrdersUpdated) => {
				
				/************************************************/
				const shopRequestHeaders = {
				  'X-Shopify-Access-Token': shopAccessToken,
				  'Content-Type': 'application/json'
				};
				var shopRequestUrl = 'https://'+shop+'/admin/webhooks.json';
				
				
				var webhookAppUnistall =  {
					webhook : {
					"topic": "app/uninstalled",
					"address": "https://shopify.pidge.in/shopify-app-uninstall",
					"format": "json"
					}
				};
				return request.post(shopRequestUrl, { headers: shopRequestHeaders,json: webhookAppUnistall});
				/************************************************/
			})
			.then((webhookAppUnistall) => {
				
				res.redirect(redirectUrl);
				res.end();
			})
			.catch((error) => {
				console.log("--error----");
				console.log(error);
				var redirectUri = forwardingAddress + '/welcome?shopname='+shop;
					res.redirect(redirectUri);
			});

			// TODO
			// Validate request is from Shopify
			// Exchange temporary code for a permanent access token
			  // Use access token to make API call to 'shop' endpoint
	} else {
		res.status(400).send('Required parameters missing');
	}
});
app.get('/', (req, res) => {
	var shopname = req.query.shopname;
	 var datetime = new Date();
	console.log(shopname);
	var sql = 'SELECT * FROM pidge_client WHERE client_name ='+ mysql.escape(shopname) ;
		db.query(sql, function (err, result) {
			if (result) {
				result.forEach((value) => {
				if(value.status == 'inactive'){
				res.render('sucess', {  });
				}else{
				  
				res.render('test', {  });	
				}
				});
			}else{
				res.render('index', { shopname : req.query.shopname  });
			}
			
			
			
		});
	
	
		
	
});

app.post('/shopify', function(req, res, next) {
	
	var shopurl = req.body.url;
	//console.log(shopurl);
	
	if (shopurl) {
		if(isSSlUrl(shopurl)) {
		let urlObject = url.parse(shopurl, true);
		var storeName = urlObject.host
			checkStoreStatus(storeName)
				.then((storeStatus) => { 
					if(storeStatus.storeExist == false) {
						const state = nonce();
						const redirectUri = forwardingAddress + '/shopify/callback';
					   // const installUrl = 'https://' + shopurl +
						var lastChar = shopurl.substr(-1); // Selects the last character
						if (lastChar === '/') {         // If the last character is not a slash
						   shopurl = shopurl.substring(0, shopurl.length - 1);
						}
						if(shopurl.endsWith('.myshopify.com')) {
							const installUrl = shopurl +
							  '/admin/oauth/authorize?client_id=' + apiKey +
							  '&scope=' + scopes +
							  '&state=' + state +
							  '&redirect_uri=' + redirectUri;

							res.cookie('state', state);
							console.log(req.query.shopname);
							res.redirect(installUrl);	
						} else {
							res.render('index', { error:true  });
						}
									
					} else {
						var currStatus = "Inactive";
						if(storeStatus.storeStatus){
							currStatus = "Active";
						}
						var redirectUri = forwardingAddress + '/shop-status?shopname='+storeName+'&storeStatus='+currStatus;
						res.redirect(redirectUri);
					}
				});
		} else {
			res.render('index', { error:true  });
		}
		
		
	} else {
		res.render('index', { error:true  });
		//return res.status(400).send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request');
	}
	
		
	
});

app.get('/sucess', (req, res) => {
	if(req.session.appInstalled) {
		req.session.appInstalled = false;
		var store_id = req.query.store_id;				
		var shopname = req.query.shopname;
		var shopurl = req.query.shopurl;
		var datetime = new Date();
		var shopAccessToken = req.session.shopAccessToken;
		req.session.shopAccessToken = "";
		var checkAppInstalledAlready = PIDGE_API+"/shopify/shopify-client?store_id="+store_id;
		
		request.get(
		  checkAppInstalledAlready, 
		  (error, response, body) => {
			if (error) {
				res.render('error', {  });
			} else {
				
				var responseObj = JSON.parse(response.body);
				var usersResposne = responseObj.data;
				
				if(usersResposne.count > 0){
					res.render('sucess', {  });
				} else {
					
					var add_client_url = PIDGE_API+"/shopify/shopify-client";
					request.post(
					  add_client_url,
					  {
						json: {
							store_id: store_id,
							store_url: shopurl,
							customer_name: shopname,
							status:0,
							access_token: shopAccessToken
						}
					  },
					  (error, postResponse, body) => {
						if (error) { console.log("Here in if error of success");
						  res.render('error', {  });
						} else {
						  res.render('sucess', {  });	
						}
					  }
					)	
				}
				
			}
		  }
		)
		
		
	} else {
		res.render('error', {  });
	}
	
	
});
app.get('/shipping', (req, res) => {	
	res.render('pidge_shipping_rates', {  });
});


app.get('/admin', (req, res) => {
	res.render('admin/login', {  });
});

app.get('/shop-status', (req, res) => {
	var shopname = "";
	var storeStatus = "Inactive";
	if(req.query.shopname) {
		shopname = req.query.shopname;
	} 
	if(req.query.storeStatus) {
		storeStatus = req.query.storeStatus;
	}
	
	res.render('shop-status', {shopname:shopname, storeStatus:storeStatus  });
	
});
app.get('/welcome', (req, res) => {
	var shopname = "";
	var storestatus = "Inactive";
	if(req.query.shopname) {
		shopname = req.query.shopname;
	}
	
	checkStoreStatus(shopname)
		.then((storeStatus) => {
			
			if(storeStatus.storeStatus) {
				storestatus = "Activated";
			}
			res.render('welcome', {shopname:shopname, storestatus:storestatus });
		})
		.catch((error) => {
			console.log(error);
			res.render('welcome', {shopname:shopname, storestatus:storestatus });
		});
	
	
});


app.post('/admin/dashboard', function(req, res, next) {
	sess=req.session;
	sess.username = req.body.username;
	var authUrl = PIDGE_API+"/shopify/auth";
	var loginData = {
		username: req.body.username,
		password: req.body.password
	};
	return request.post(authUrl, {json: loginData})
	.then((authUrl) => { 
		console.log("succ");
		sess.loggedIn = true;
		res.redirect('/admin/dashboard/?name='+ req.body.username);
	})
	.catch((error) => {
		console.log("ko");
		res.render('admin/login', { error:true });
	});

});

app.get('/admin/dashboard', function(req, res, next) {
	sess=req.session;
	
	if(sess.loggedIn){
		var userListingUrl = PIDGE_API+"/shopify/shopify-client";

		request.get(
		  userListingUrl, 
		  (error, response, body) => {
			if (error) {
				console.error(error);
				res.render('admin/login', {  });
			} else {
				
				var responseObj = JSON.parse(response.body);
				var usersResposne = responseObj.data;
				var userData = usersResposne.data;

				res.render('admin/dashboard', { clients : userData });
				
			}
		  }
		)
		
	}else{
		res.render('admin/login', {  });
	}
  
});

app.get('/logout', (req, res) => {
	req.session.loggedIn=false;
	res.render('admin/login', {  });
});
 
app.post('/update-client', function(req, res, next) {
	var store_id = parseInt(req.body.store_id);
	var store_url = req.body.store_url;
	var customer_name = req.body.customer_name;
	var new_status = parseInt(req.body.status);
	var customer_id = parseInt(req.body.customer_id);
	var updateClientUrl = PIDGE_API+"/shopify/shopify-client/"+customer_id;
	var updateClientInfo = {
		// "store_id": store_id,
		// "store_url": store_url,
		"customer_name":customer_name,
		"status":new_status
		
	};
	request({ 
		url: updateClientUrl, 
		method: 'PUT', 
		json: updateClientInfo}, 
		(error, response, body) => {
			if (error) { console.log("error");
				console.error(error);
				res.redirect('/admin/dashboard')
			} else {
				res.redirect('/admin/dashboard');
			}
		}
	) 
});
 
 

/***************************************************/
//var counero = 0;
app.post('/carrier-services', (req, res) => {
	//counero = counero + 1;
	var storeName = req.headers['x-shopify-shop-domain'];
	
	var accessTokenShop = '';
	var fromNameg = storeName;
	var locationId;
	var storeID;
	var inventorys;
	let store_info={}
	checkStoreStatus(storeName)
		.then((storeStatus) => { 
			if(storeStatus.storeStatus) {
				storeID = parseInt(storeStatus.storeId);
				store_info =storeStatus;
				var dataToProcess = req.body;
				var fromCounrtyG = '';
				var items = req.body.rate.items;
				var destinationAdd = req.body.rate.destination;
				//console.log(req.body);
				checkStoreStatus(storeName)
					.then((storeStatus) => {

						accessTokenShop = storeStatus.accessToken;
						/*const shopRequestUrl = 'https://' + storeName + '/admin/api/2020-01/shop.json';
						const shopRequestHeaders = {
						  'X-Shopify-Access-Token': accessTokenShop,
						};*/

						return getdestinationLatNlong(destinationAdd);
										
					})
					.then((destinationLatNlong) => {
						return getInvenrties(items,accessTokenShop,storeName,destinationLatNlong)
					})
					.then((inventoryResponse) => {
						if(inventoryResponse.length == items.length) {
							console.log("====inventoryResponse====");
							console.log(inventoryResponse);
							console.log("=========inventoryResponse======");
							return processingData(inventoryResponse);
							//getLocationIds(inventoryResponse);
						} else {
							throw new Error('Des');
							console.log("else");
							res.send({});
						}
						
					})
					.then((locations) => {
						return cretaeMultiple(locations)
					})
					.then((inventories) => {
						// console.log('iiiiiiiiii',inventories)
						inventorys = inventories;
						return getDistLoc(inventories);
					})
					.then((getDistLocRes) => { 
						
						return getTotalPriceNloc(inventorys,getDistLocRes);
						
					})
					.then((getTotalPriceNlocRes) => { 
						var pr = getTotalPriceNlocRes.totP * 100;
						var returnF = {};

						const slot=HELPER.shipping_slot(pr, store_info)
						console.log(slot)
						returnF = {
						   "rates":slot
							//    [
							//    {
							// 	   "service_name": "Pidge: Next Day Delivery",
							// 	   "service_code": "PSD",
							// 	   "total_price": pr,
							// 	   "description": "Instant Delivery & Courier Service",
							// 	   "currency": "INR",
							// 	   "min_delivery_date": "2013-04-12 14:48:45 -0400",
							// 	   "max_delivery_date": "2013-04-12 14:48:45 -0400"
							//    },
							//    {
							// 	   "service_name": "Pidge: Within Week Delivery",
							// 	   "service_code": "PSW",
							// 	   "total_price": pr,
							// 	   "description": "Instant Delivery & Courier Service",
							// 	   "currency": "INR",
							// 	   "min_delivery_date": "2013-04-12 14:48:45 -0400",
							// 	   "max_delivery_date": "2013-04-12 14:48:45 -0400"
							//    },
						   // ]
						};
						//console.log(counero);
						//console.log(JSON.stringify(returnF, null, 4));
						res.send(returnF);
						
					})
					.catch((error) => {
						console.log('====error=====');
						console.log(error);
						res.send({});
					});		
			} else {
				res.send( );
			}
		});
});

const getLatNLong = (addressStr) => {
	return new Promise(function (fulfill, reject) {
		var returnval = {};
        var encodedAddress = encodeURI(addressStr);
		var addressUrl = "https://maps.googleapis.com/maps/api/geocode/json?key="+googleApiKey+"&address="+encodedAddress;
		request.get(addressUrl)
		.then((geoResponse) => {
			geoResponse = JSON.parse(geoResponse);
			if(geoResponse.status == "OK") {
				returnval.lat = geoResponse.results[0].geometry.location.lat;
				returnval.lng = geoResponse.results[0].geometry.location.lng;
				console.log(returnval);
				fulfill(returnval);
			} else {
				fulfill(returnval);
			}
			
		})
		.catch(e => {
			fulfill(returnval);
		});
    });
}
const processData = (dataToProcess,fromAddressData,storeID) => {
	return new Promise(function (fulfill, reject) {
		//console.log(dataToProcess);
		var returnval = {};
		var d = new Date();
		var orderId = d.valueOf();
		orderId = parseInt(orderId);
		var firstName = dataToProcess.rate.destination.name.split(' ').slice(0, -1).join(' ');
		var lastName = dataToProcess.rate.destination.name.split(' ').slice(-1).join(' ');
		var datetime = new Date();
		var address1 = dataToProcess.rate.destination.address1;
		var address2 = dataToProcess.rate.destination.address2;
		var address3 = dataToProcess.rate.destination.address3;
		var address = address1;
		if(address2) {
			address = address +", "+address2;
		} else {
			address2 = "N/A";
		}
		if(address3) {
			address = address +", "+address3;
		} else {
			address3 = "N/A";
		}
		var city = dataToProcess.rate.destination.city;
		var state = dataToProcess.rate.destination.province;
		var postalCode = dataToProcess.rate.destination.postal_code;
		var country = dataToProcess.rate.destination.country;
		var fullAddress = address+", "+city+", "+state+", "+postalCode+", "+country;
		var toLatNLong = {
		  "latitude": "",
		  "longitude": ""
		};
		/**************Store Address******************************/
		var fromFullName = fromAddressData.name;
		
		if(fromAddressData.phone) {
			var fromPhone = fromAddressData.phone;
		} else {
			var fromPhone =  "0000000000";
		}
		if(fromFullName) {
			var fromFirstName = fromFullName;
		} else {
			var fromFirstName = "N/A";
		}
		
		var fromAddress1 = fromAddressData.address_line1;
		var fromAddress2 = fromAddressData.address_line2;
		var fromAddress3 = fromAddressData.landmark;
		
		
		var fromAddress = fromAddress1;
		if(fromAddress2 && fromAddress2 !="N/A") {
			fromAddress = fromAddress +", "+fromAddress2;
		}
		if(fromAddress3  && fromAddress2 !="N/A") {
			fromAddress = fromAddress +", "+fromAddress3;
		}
		var fromCity = fromAddressData.city;
		var fromState = fromAddressData.state;
		var fromPostalCode = fromAddressData.zip;
		var fromCountry = fromAddressData.country;
		var fromFullAddress = fromAddress+", "+fromCity+", "+fromState+", "+fromPostalCode+", "+fromCountry;
		var fromLatNLong = {
		  "latitude": "",
		  "longitude": ""
		};
		/***************Store Address*******************************/
		getLatNLong(fullAddress)
			.then((latNLong) => { 
				toLatNLong.latitude = latNLong.lat;
				toLatNLong.longitude = latNLong.lng;
				return getLatNLong(fromFullAddress)
			})
			.then((latNLong) => {
				fromLatNLong.latitude = latNLong.lat;
				fromLatNLong.longitude = latNLong.lng;
				var toAddress = {
					"address_line1": address1,
					"address_line2": address2,
					"landmark": address3,
					"instructions_to_reach": "ANY",
					"google_maps_address": fullAddress,
					"exact_location": toLatNLong,
					"state": dataToProcess.rate.destination.province,
					"pincode": dataToProcess.rate.destination.postal_code
				};
				var fromAddress = {
					"address_line1": fromAddress1,
					"address_line2": fromAddress2,
					"landmark": fromAddress3,
					"instructions_to_reach": "ANY",
					"google_maps_address": fromFullAddress,
					"exact_location": fromLatNLong,
					"state": fromState,
					"pincode": fromPostalCode
				};
				var processedData = {
					store_id : storeID,
					vendor_order_id :orderId,
					originator_details:{
						first_name:firstName,
						last_name:lastName,
						mobile:dataToProcess.rate.destination.phone
					},
					sender_details:{
						name:fromFirstName,
						mobile:fromPhone
					},
					receiver_details:{
						name:firstName,
						mobile:dataToProcess.rate.destination.phone
					},
					pickup_time:datetime,
					"from_address": fromAddress,
					"to_address": toAddress,
					"all_packages": {
						"not_sending_illegal_items": true,
						"packages": [
							{
								"dimension": {
								"width": 200,
								"height": 20
								},
								"handling_instructions": "Please take care",
								"category": 1,
								"value_of_item": 1,
								"label": "Tree"
							}
						]
					}
				  
				};
				
				fulfill(processedData);
			})
			.catch(e => {
				reject({});
			});
		
    });
}

const checkStoreStatus = (storeName) => {
	
	return new Promise(function (fulfill, reject) {
		var getStoreInfoUrl = PIDGE_API+"/shopify/shopify-client?store_url="+storeName;
		var retirnval = {};
		
		request.get(getStoreInfoUrl)
			.then((storeInfoResponse) => {
				storeInfoResponse = JSON.parse(storeInfoResponse);
				
				if(storeInfoResponse.data.count > 0) { 
					retirnval.storeExist = true;
					retirnval.storeStatus = storeInfoResponse.data.data[0].status;
					retirnval.accessToken = storeInfoResponse.data.data[0].access_token;
					retirnval.id = storeInfoResponse.data.data[0].id;
					retirnval.storeId = storeInfoResponse.data.data[0].store_id;
					retirnval.meta_info = storeInfoResponse.data.data[0].meta_info;
					fulfill(retirnval);
				} else {
					retirnval.storeExist = false;
					retirnval.storeStatus = false;
					retirnval.accessToken = false;
					retirnval.id = null;
					retirnval.storeId = null;
					fulfill(retirnval);
				}
				
			})
			.catch(e => {
				retirnval.storeExist = false;
				retirnval.storeStatus = false;
				retirnval.accessToken = false;
				retirnval.id = null;
				retirnval.storeId = null;
				fulfill(retirnval);
			});
	});
}
/******************************************************************
app.post('/shopify-orders-create', (req, res) => {
	console.log("shopify-orders-created");
	//shopify_order_id
	//console.log(req.body);
	var storeName = req.headers['x-shopify-shop-domain'];
	var accessTokenShop = '';
	var fromNameg = storeName;
	var fromAddressG;
	var storeID;
	var locationId;
	console.log(storeName);
	
	var bodyResponse = req.body;
	if( bodyResponse.shipping_lines[0].source == "Pidge Shipping Provider") {
		var orderId = parseInt(bodyResponse.id);
		console.log("pidge-services");
		checkStoreStatus(storeName)
			.then((storeStatus) => { 
				storeID = parseInt(storeStatus.storeId);
				accessTokenShop = storeStatus.accessToken;
				const shopRequestUrl = 'https://' + storeName + '/admin/api/2020-01/shop.json';
				const shopRequestHeaders = {
				  'X-Shopify-Access-Token': accessTokenShop,
				};

				return request.get(shopRequestUrl, { headers: shopRequestHeaders });
					
						
			})
			.then((storeResponse) => { 
				storeResponse = JSON.parse(storeResponse);
				fromNameg = storeResponse.shop.name;
				locationId = storeResponse.shop.primary_location_id;
				const locationRequestUrl = 'https://' + storeName + '/admin/api/2020-04/locations/'+locationId+'.json';
					const locRequestHeaders = {
					  'X-Shopify-Access-Token': accessTokenShop,
					};

				return request.get(locationRequestUrl, { headers: locRequestHeaders });
			})
			.then((locaResponse) => { 
				locaResponse = JSON.parse(locaResponse);
				locaResponse.location.name = fromNameg;
				fromAddressG = locaResponse;
				return fullFillOrder(storeName,orderId,locationId,accessTokenShop);
			})
			.then((fullFillmentResponse) => {
				console.log("fullFillmentResponse");
				var fromAddress = createAddressForOrder(fromAddressG.location);
				 
				return getLatNLong(fromAddress.google_maps_address);
			})
			.then((latNLong) => {
				var fromLatitude = latNLong.lat;
				var fromLongitude = latNLong.lng;
				
				var fromAddress = createAddressForOrder(fromAddressG.location);
				fromAddress.exact_location.latitude = fromLatitude;
				fromAddress.exact_location.longitude = fromLongitude;
				var toAddress = createAddressForOrder(bodyResponse.shipping_address);
				var datetime = new Date();
				var fromPhone = "0000000000";
				if(fromAddressG.location.phone) {
					fromPhone = fromAddressG.location.phone;
				}
				
				var processedData = {
					store_id : storeID,
					vendor_order_id : orderId,
					originator_details:{
						first_name:bodyResponse.billing_address.first_name,
						last_name:bodyResponse.billing_address.last_name,
						mobile:bodyResponse.billing_address.phone
					},
					sender_details:{
						name:fromAddressG.location.name,
						mobile:fromPhone
					},
					receiver_details:{
						name:bodyResponse.shipping_address.first_name,
						mobile:bodyResponse.shipping_address.phone
					},
					pickup_time:datetime,
					"from_address": fromAddress,
					"to_address": toAddress,
					"all_packages": {
						"not_sending_illegal_items": true,
						"packages": [
							{
								"dimension": {
								"width": 200,
								"height": 20
								},
								"handling_instructions": "Please take care",
								"category": 1,
								"value_of_item": 1,
								"label": "Tree"
							}
						]
					}

				};
				var create_order_url = PIDGE_API+"/shopify/order";
				return request.post(create_order_url, { json: processedData});
						
			})
			.then((createOrderResponse) => {
				var confirmOrderUrl = PIDGE_API+"/shopify/order/"+orderId+"/confirm";
				console.log("----Order Cretaed------");
				console.log(createOrderResponse);
				console.log("----Order Cretaed------");
				return request({ url: confirmOrderUrl, method: 'PUT' });
			})
			.then((confirmOrderUrl) => {
				console.log("----Order Confirmation------");
				console.log(confirmOrderUrl);
				console.log("----Order Confirmation------");
				res.send(  );
			})
			.catch((error) => {
			console.log("----error order create-----");
				console.log(error);
				res.send(  );
			});
		
	} else {
		res.send("");
	}
	
});
***********************************************************************/
app.post('/shopify-orders-create', (req, res) => {
	console.log("shopify-orders-created");
	//shopify_order_id

	var storeName = req.headers['x-shopify-shop-domain'];
	var accessTokenShop = '';
	var fromNameg = storeName;
	var fromAddressG;
	var storeID;
	var locationId;
	var items;
	let store_detail
	 console.log("order response", storeName)
	 console.log(req.body);
	 console.log(req.body.line_items);
	// return res.send(req.body)
	
	var bodyResponse = req.body;
	if( bodyResponse.shipping_lines[0].source == "Pidge Shipping Provider") {
		var orderId = parseInt(bodyResponse.id);
		console.log("pidge-services");
		checkStoreStatus(storeName)
			.then((storeStatus) => { 
				storeID = parseInt(storeStatus.storeId);
				accessTokenShop = storeStatus.accessToken;
				store_detail =storeStatus
				/*const shopRequestUrl = 'https://' + storeName + '/admin/api/2020-01/shop.json';
				const shopRequestHeaders = {
				  'X-Shopify-Access-Token': accessTokenShop,
				}*/;

				//return request.get(shopRequestUrl, { headers: shopRequestHeaders });
				
				var destinationAdd = bodyResponse.shipping_address;
				items = bodyResponse.line_items;
				return getdestinationLatNlong(destinationAdd);
			})
			.then((destinationLatNlong) => { 
				return getInvenrties(items,accessTokenShop,storeName,destinationLatNlong)
			})
			.then((inventoryResponse) => {
				if(inventoryResponse.length == items.length) {
					console.log("====inventoryResponse====");
					//console.log(inventoryResponse);
					console.log("=========inventoryResponse======");
					return processingData(inventoryResponse);
					//getLocationIds(inventoryResponse);
				} else {
					throw new Error('Des');
					console.log("else");
					res.send({});
				}
				
			})
			.then((locations) => {
				return cretaeMultipleNew(locations)
			})
			// .then((inventories) => {
			// 	console.log("====inventories inventories====");
			// 		//console.log(inventories);
			// 		console.log("=========inventories inventories======");
			// 	inventorys = inventories;
			// 	return getDistLoc(inventories);
			// })
			// .then((getDistLocRes) => {
			// 	return getTotalPriceNloc(inventorys,getDistLocRes);
			// })
			.then((getTotalPriceNlocRes) => { 
				var orders = getTotalPriceNlocRes;
				var orderKeys = Object.keys(orders);
				// console.log("---orderKeys---");
				// console.log(orderKeys);
				console.log("---orderKeys---");
				var ismultipleOrder = false;
				if(orderKeys.length > 1) {
					ismultipleOrder = true;
				}
				 
				async.mapSeries(orderKeys,
					(orderKey, callback) => { 
							var ord = orders[orderKey];
							console.log("--------Start ord----------");
							console.log(ord)
							//console.log(JSON.stringify(ord, null, 4));
							console.log("--------End ord----------");
							completeOrderProcess(accessTokenShop,storeName,storeID,orderId,orderKey,ord,bodyResponse,ismultipleOrder,store_detail)
							.then((completeOrderPro) => { 
								if(completeOrderPro == "Success") {
									callback(null,completeOrderPro);
								} else {
									callback();
								}
							})
							.catch((error) => {
								callback();
							});
					},
					(error, results) => {
						if (error) {
							console.log("----getTotalPriceNlocRes error-----");
							reject();
						} else { 
							console.log("----getTotalPriceNlocRes sd-----");
							console.log(JSON.stringify(results, null, 4));
							console.log("----getTotalPriceNlocRes sd-----");
							fulfill(results);
						}
					}
				);
				
				
			})
			.then((finalstep) => { 
				res.send({});
			})
			.catch((error) => {
				console.log('====error=====');
				console.log(error);
				res.send({});
			});
			/**********************************************************/
					
	} else {
		res.send("");
	}
	
});

const completeOrderProcess=(accessTokenShop,storeName,storeID,orderId,locationId,orderDetail,bodyResponse,ismultipleOrder,store_detail) => {
	return new Promise(function (fulfill, reject) {
				var toLatNLongG;
				var  today = new Date();
				// var dropDate = new Date(today);
				 const code= bodyResponse.shipping_lines[0].code
				// if(bodyResponse.shipping_lines[0].code == "Pidge: Next Day Delivery") {
				// 	dropDate.setDate(dropDate.getDate() + 1);
				// } else {
				// 	dropDate.setDate(dropDate.getDate() + 7);
				// }
		     let dropDate = HELPER.get_shipping_date(code)
				//
				// if(bodyResponse.shipping_lines[0].title == "Pidge: Next Day Delivery") {
				// 	dropDate.setDate(dropDate.getDate() + 1);
				// } else {
				// 	dropDate.setDate(dropDate.getDate() + 7);
				// }
				var orderItems;
				var fullPara;
				var fromNameg = storeName;
				fullfillParaa(orderDetail)
				.then((orderDetailResponse) => {
					fullPara = orderDetailResponse;
					return getDimension(orderDetail,store_detail);
				})
				.then((getDimensionResponse) => {
					console.log("--getDimensionResponse--");
					// console.log(JSON.stringify(orderDetail, null, 4));
					console.log("--getDimensionResponse--");
					orderItems = getDimensionResponse;
					
					const locationRequestUrl = 'https://' + storeName + '/admin/api/2020-04/locations/'+locationId+'.json';
						const locRequestHeaders = {
						  'X-Shopify-Access-Token': accessTokenShop,
						};

					return request.get(locationRequestUrl, { headers: locRequestHeaders });
				})
				.then((locaResponse) => { 
					locaResponse = JSON.parse(locaResponse);
					locaResponse.location.name = fromNameg;
					fromAddressG = locaResponse;
					return fullFillOrder(storeName,orderId,locationId,accessTokenShop,fullPara);
				})
				.then((fullFillmentResponse) => {
					var toAddressA = createAddressForOrder(bodyResponse.shipping_address);
					return getLatNLong(toAddressA.google_maps_address);
				})
				.then((toAddressALatLong) => {
					toLatNLongG = toAddressALatLong;
					console.log("fullFillmentResponse");
					var fromAddress = createAddressForOrder(fromAddressG.location);
					 
					return getLatNLong(fromAddress.google_maps_address);
				})
				.then((latNLong) => {
					var fromLatitude = latNLong.lat;
					var fromLongitude = latNLong.lng;
					var tooLatitude = toLatNLongG.lat;
					var tooLongitude = toLatNLongG.lng;
					
					var fromAddress = createAddressForOrder(fromAddressG.location);
					fromAddress.exact_location.latitude = fromLatitude;
					fromAddress.exact_location.longitude = fromLongitude;
					var toAddress = createAddressForOrder(bodyResponse.shipping_address);
					toAddress.exact_location.latitude = tooLatitude;
					toAddress.exact_location.longitude = tooLongitude;
					var datetime = new Date();
					var fromPhone = "0000000000";
					if(fromAddressG.location.phone) {
						fromPhone = fromAddressG.location.phone;
					}
					const mobile_slice=(value)=>{
						let mobile = '';
						if(value.charAt(0) == '+' || value.charAt(0)=='0'){
							mobile = value.replace(/[^a-zA-Z0-9+]/g, "").substr(3);
						}
						else {
							mobile = value.replace(/[^a-zA-Z0-9]/g, "");
						}
						return mobile
					}
					
					var processedData = {
						store_id : storeID,
						vendor_order_id : orderId,
						originator_details:{
							first_name:bodyResponse.billing_address.first_name,
							last_name:bodyResponse.billing_address.last_name,
							mobile:mobile_slice(bodyResponse.billing_address.phone)
						},
						sender_details:{
							name:fromAddressG.location.name,
							mobile:mobile_slice(fromPhone)
						},
						receiver_details:{
							name:bodyResponse.shipping_address.first_name,
							mobile:mobile_slice(bodyResponse.shipping_address.phone)
						},
						pickup_time:dropDate,
						drop_time:dropDate,
						"from_address": fromAddress,
						"to_address": toAddress,
						"all_packages": {
							"not_sending_illegal_items": true,
							"packages": orderItems
						}

					};

					console.log(JSON.stringify(processedData, null, 4));
					var create_order_url = PIDGE_API+"/shopify/order";
					return request.post(create_order_url, { json: processedData});
							
				})
				.then((createOrderResponse) => {
					console.log("--==-==createOrderResponse===--=-=-=-");
					//console.log(createOrderResponse);
					//console.log(JSON.stringify(createOrderResponse, null, 4));
					console.log("--==-==createOrderResponse===--=-=-=-");
					var confirmOrderUrl = PIDGE_API+"/shopify/order/"+orderId+"/confirm";
					console.log("----Order Cretaed------");
					//console.log(createOrderResponse);
					console.log("----Order Cretaed------");
					return request({ url: confirmOrderUrl, method: 'PUT' });
				})
				.then((confirmOrderUrl) => {
					console.log("----Order Confirmation------");
					console.log(confirmOrderUrl);
					console.log("----Order Confirmation------");
					fulfill("Success");
				})
				.catch((error) => {
				console.log("----error order create-----");
					console.log(error);
					fulfill("Not Success");
				});
	});
}
/**************************************************************/
app.post('/shopify-orders-cancelled', (req, res) => {
	console.log("shopify-orders-cancelled");
	//console.log(req.body);
	var bodyResponse = req.body;
	if( bodyResponse.shipping_lines[0].source == "Pidge Shipping Provider") {
		var orderId = parseInt(bodyResponse.id);
		var cancelOrderUrl = PIDGE_API+"/shopify/order/"+orderId+"/cancel";
		console.log("----Order cancelled req------");
		request({ url: cancelOrderUrl, method: 'PUT' })
			.then((cancelOrderUrlResponse) => {
				console.log("----Order cancelled------");
				console.log(cancelOrderUrlResponse);
				console.log("----Order cancelled------");
				res.send(  );
			})
			.catch((error) => {
				console.log("-----error order cancel-----");
				console.log(error);
				res.send(  );
			});	
	} else {
		res.send(  );
	}
	
});
app.post('/shopify-orders-updated', (req, res) => {
	console.log("shopify-orders-updated");
	/*************************************************************/
	var storeName = req.headers['x-shopify-shop-domain'];
	var accessTokenShop = '';
	var fromNameg = storeName;
	console.log(storeName);
	
	var bodyResponse = req.body;
	if( bodyResponse.shipping_lines[0].source == "Pidge Shipping Provider" && !(bodyResponse.cancelled_at)) {
		var orderId = parseInt(bodyResponse.id);
		console.log("pidge-services");
		checkStoreStatus(storeName)
			.then((storeStatus) => { 
				
				accessTokenShop = storeStatus.accessToken;
				const shopRequestUrl = 'https://' + storeName + '/admin/api/2020-01/shop.json';
				const shopRequestHeaders = {
				  'X-Shopify-Access-Token': accessTokenShop,
				};

				return request.get(shopRequestUrl, { headers: shopRequestHeaders });
								
			})
			.then((storeResponse) => { 
				storeResponse = JSON.parse(storeResponse);
				fromNameg = storeResponse.shop.name;
				var locationId = storeResponse.shop.primary_location_id;
				const locationRequestUrl = 'https://' + storeName + '/admin/api/2020-04/locations/'+locationId+'.json';
					const locRequestHeaders = {
					  'X-Shopify-Access-Token': accessTokenShop,
					};

					return request.get(locationRequestUrl, { headers: locRequestHeaders });
			})
			.then((locaResponse) => { 
				locaResponse = JSON.parse(locaResponse);
				locaResponse.location.name = fromNameg;
				fromAddressG = locaResponse;
				var fromAddress = createAddressForOrder(locaResponse.location);
				 
				return getLatNLong(fromAddress.google_maps_address)
			})
			.then((latNLong) => {
				var fromLatitude = latNLong.lat;
				var fromLongitude = latNLong.lng;
				
				var fromAddress = createAddressForOrder(fromAddressG.location);
				fromAddress.exact_location.latitude = fromLatitude;
				fromAddress.exact_location.longitude = fromLongitude;
				var toAddress = createAddressForOrder(bodyResponse.shipping_address);
				/*console.log(JSON.stringify(bodyResponse.shipping_address, null, 4));
				console.log(JSON.stringify(toAddress, null, 4));*/
				var datetime = new Date();
				var fromPhone = "0000000000";
				if(fromAddressG.location.phone) {
					fromPhone = fromAddressG.location.phone;
				}
				/*var processedData = {
					originator_details:{
						first_name:bodyResponse.billing_address.first_name,
						last_name:bodyResponse.billing_address.last_name,
						mobile:bodyResponse.billing_address.phone
					},
					sender_details:{
						name:fromAddressG.location.name,
						mobile:fromPhone
					},
					receiver_details:{
						name:bodyResponse.shipping_address.first_name,
						mobile:bodyResponse.shipping_address.phone
					},
					pickup_time:datetime,
					"all_packages": {
						"not_sending_illegal_items": true,
						"packages": [
							{
								"dimension": {
								"width": 200,
								"height": 20
								},
								"handling_instructions": "Please take care",
								"category": 1,
								"value_of_item": 1,
								"label": "Tree"
							}
						]
					}
					*/
				var processedData = {
					"from_address": fromAddress,
					"to_address": toAddress,
				};
				var update_order_url = PIDGE_API+"/shopify/order/"+orderId;
				//return request.post(create_order_url, { json: processedData});
				return request({ url: update_order_url, method: 'PUT', json: processedData });
						
			})
			.then((updateOrderResponse) => {
				console.log(updateOrderResponse);
				res.send(  );
			})
			.catch((error) => {
			console.log("----error order update-----");
				console.log(error);
				res.send(  );
			});
		
	} else {
		res.send("");
	}
	/*****************************************************************/
	res.send("");
	
	
});

const createAddressForOrder = (fromAddress) => {
	
	//return new Promise(function (fulfill, reject) {
		/******************Billing Address**********************/
		//var firstName = fromAddress.first_name;
		//var lastName = fromAddress.last_name;
		/*console.log("*****Billing Address**");
		console.log(fromAddress);
		console.log("*****Billing Address**");*/
		var addressLine1 = fromAddress.address1;
		var addressLine2 = fromAddress.address2;
		var addressLine3 = '';
		if('address2' in fromAddress) {
			var addressLine3 = fromAddress.address3;
		}
		var state = fromAddress.province;
		var pincode = fromAddress.zip;
		var city = fromAddress.city;
		var country = fromAddress.country;
		var latitude = fromAddress.latitude;
		var longitude = fromAddress.longitude;
		var addressString = addressLine1;
		if(addressLine2) {
			addressString = addressString + ", " + addressLine2;
		} else {
			addressLine2 = "N/A";
		}
		if(addressLine3) {
			addressString = addressString + ", " + addressLine3;
		}  else {
			addressLine3 = "N/A";
		}
		
		addressString = addressString + ", " + city + ", " + state + " " + pincode + ", " + country;
		var fromAddress = {
			"address_line1": addressLine1,
			"address_line2": addressLine2,
			"landmark": addressLine3,
			"instructions_to_reach": "ANY",
			"google_maps_address": addressString,
			"exact_location": {
			  "latitude": latitude,
			  "longitude": longitude
			},
			"state": state,
			"pincode": pincode
		};
		return fromAddress;
		/******************Billing Address**********************/
	//});
}
const fullFillOrder = (storeName,orderId,locationId,accessTokenShop,fullPara) => {
	return new Promise(function (fulfill, reject) { 
		var fullFillmentUrl = "https://"+storeName+"/admin/api/2020-01/orders/"+orderId+"/fulfillments.json";
/*console.log(fullFillmentUrl);
console.log(locationId);
console.log(JSON.stringify(fullPara, null, 4));*/
		var d = new Date();
		var randomTrackingNo = d.valueOf();
		/*var fulfillmentdata = {
			"fulfillment": {
				"location_id": locationId,
				"tracking_number": randomTrackingNo,
				"tracking_urls": [
				  "http://google.com/",
				  "http://google.com/"
				],
				"notify_customer": true,
				"line_items_by_fulfillment_order":fullPara
			}
		};*/
		
		var fulfillmentdata = {
			  "fulfillment": {
				"location_id": locationId,
				"tracking_number": randomTrackingNo,
				"tracking_company": "Custom Tracking Company",
				"line_items": fullPara
			  }
			};
		const fulfilRequestHeaders = {
		  'X-Shopify-Access-Token': accessTokenShop,
		};
		request.post(fullFillmentUrl, { headers: fulfilRequestHeaders, json: fulfillmentdata})
			.then((fullFillmentResponse) => {
				console.log("fullfil success");
				fulfill({status:true});
			})
			.catch((error) => {
				console.log("fullfil error");
				console.log(error.errors);
				fulfill({status:false});
			});
	})
}

const isSSlUrl = (url) => {
   var regexp = /(https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
   return regexp.test(url);
}

app.post('/shopify-app-uninstall', (req, res) => {
	console.log("shopify-app-uninstall");
	var storeName = req.headers['x-shopify-shop-domain'];
	checkStoreStatus(storeName)
		.then((storeStatus) => { 
			var clientId = storeStatus.id;
			var urlToDel = PIDGE_API+"/shopify/shopify-client/"+clientId;
			return request({ url: urlToDel, method: 'DELETE' });
		})
		.then((storeStatus) => { 
			console.log("-----su app-uninstall-----");
			res.send(  );
		})
		.catch((error) => {
			console.log("-----error app-uninstall-----");
			console.log(error);
			res.send(  );
		});
	
});

app.get('/get-locations', (req, res) => {

	/**************************************/
	var callBackResponse = {
	"rate": {
	"destination": { country: 'IN', postal_code: '122003', province: 'HR', city: 'Gurugram', name: 'name name', address1: 'Gurugram University Mayfield Garden Sector 51', address2: '', address3: null, phone: '+91 964 696 3199', fax: null, email: null, address_type: null, company_name: null },
	"items" :[ { name: 'Kettel Electric',
    sku: '123456789',
    quantity: 1,
    grams: 500,
    price: 200000,
    vendor: 'testpidge',
    requires_shipping: true,
    taxable: true,
    fulfillment_service: 'manual',
    properties: {},
    product_id: 4633359712349,
    variant_id: 32266200219741 },
  { name: 'T-Shirt',
    sku: '',
    quantity: 1,
    grams: 200,
    price: 100000,
    vendor: 'testpidge',
    requires_shipping: true,
    taxable: true,
    fulfillment_service: 'manual',
    properties: {},
    product_id: 4658114068573,
    variant_id: 32337003282525 } ]
	} };
	
	//var items = callBackResponse.rate.items;
	/***************************************************************/
	var items = [ { id: 4698678329402,
    variant_id: 31452815786042,
    title: 'test product 1',
    quantity: 1,
    sku: '',
    variant_title: '',
    vendor: 'pidge_test',
    fulfillment_service: 'manual',
    product_id: 4433344069690,
    requires_shipping: true,
    taxable: true,
    gift_card: false,
    name: 'test product 1',
    variant_inventory_management: 'shopify',
    properties: [],
    product_exists: true,
    fulfillable_quantity: 1,
    grams: 0,
    price: '400.00',
    total_discount: '0.00',
    fulfillment_status: null,
    price_set: { shop_money: [Object], presentment_money: [Object] },
    total_discount_set: { shop_money: [Object], presentment_money: [Object] },
    discount_allocations: [],
    admin_graphql_api_id: 'gid://shopify/LineItem/4698678329402',
    tax_lines: [],
    origin_location:
     { id: 1863067074618,
       country_code: 'IN',
       province_code: 'HR',
       name: 'pidge_test',
       address1: '12 Bus Stand Road Acharya Puri Sector 12',
       address2: '',
       city: 'Gurugram',
       zip: '122001' } },
  { id: 4698678362170,
    variant_id: 31497880436794,
    title: 'test product 3',
    quantity: 1,
    sku: '',
    variant_title: '',
    vendor: 'pidge_test',
    fulfillment_service: 'manual',
    product_id: 4444081291322,
    requires_shipping: true,
    taxable: true,
    gift_card: false,
    name: 'test product 3',
    variant_inventory_management: 'shopify',
    properties: [],
    product_exists: true,
    fulfillable_quantity: 1,
    grams: 0,
    price: '300.00',
    total_discount: '0.00',
    fulfillment_status: null,
    price_set: { shop_money: [Object], presentment_money: [Object] },
    total_discount_set: { shop_money: [Object], presentment_money: [Object] },
    discount_allocations: [],
    admin_graphql_api_id: 'gid://shopify/LineItem/4698678362170',
    tax_lines: [],
    origin_location:
     { id: 1863067074618,
       country_code: 'IN',
       province_code: 'HR',
       name: 'pidge_test',
       address1: '12 Bus Stand Road Acharya Puri Sector 12',
       address2: '',
       city: 'Gurugram',
       zip: '122001' } } ];
	var destinationAdd = callBackResponse.rate.destination;
	/**************************************/
	
	var accessTokenShop = "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";
	var  storeName = "testpidge.myshopify.com";
	
	var inventorys;
	getdestinationLatNlong(destinationAdd)
		.then((destinationLatNlong) => { 
			return getInvenrties(items,accessTokenShop,storeName,destinationLatNlong)
		})
		.then((inventoryResponse) => {
			if(inventoryResponse.length == items.length) {
				console.log("====inventoryResponse====");
				console.log(inventoryResponse);
				console.log("=========inventoryResponse======");
				return processingData(inventoryResponse);
				//getLocationIds(inventoryResponse);
			} else {
				throw new Error('Des');
				console.log("else");
				res.send({});
			}
			
		})
		.then((locations) => {
			return cretaeMultiple(locations)
		})
		.then((inventories) => {
			
			inventorys = inventories;
			return getDistLoc(inventories);
		})
		.then((getDistLocRes) => { 
			
			return getTotalPriceNloc(inventorys,getDistLocRes);
			
		})
		.then((getTotalPriceNlocRes) => { 
			var pr = getTotalPriceNlocRes.totP * 100;
			var returnF = {
			   "rates": [
				   {
					   "service_name": "pidge-services-daily",
					   "service_code": "ON",
					   "total_price": pr,
					   "description": "This is the fastest option by Pidge Services",
					   "currency": "INR",
					   "min_delivery_date": "2013-04-12 14:48:45 -0400",
					   "max_delivery_date": "2013-04-12 14:48:45 -0400"
				   },
				   {
					   "service_name": "pidge-services-weekly",
					   "service_code": "ON",
					   "total_price": pr,
					   "description": "This is the fastest option by Pidge Services",
					   "currency": "INR",
					   "min_delivery_date": "2013-04-12 14:48:45 -0400",
					   "max_delivery_date": "2013-04-12 14:48:45 -0400"
				   }
			   ]
			};
			console.log(JSON.stringify(getTotalPriceNlocRes, null, 4));
		})
		.catch((error) => {
			console.log('====error=====');
			console.log(error);
			res.send({});
		});
	
})

const getLocationIds = (inventories) => {
	return new Promise(function (fulfill, reject) {
		console.log('==Inventory==');
		console.log(inventories);
		console.log('==Inventory==');
		async.mapSeries(inventories,
			(item, callback) => {
				let result = item.map(a => {
					console.log(a);
					return a.location_id;
				});
				callback(null, result);
			},
			(error, results) => {
				if (error) {  console.log()
					fulfill([]);
				} else {
					fulfill(results);
				}
			}
		);
	});
}
const getInvenrties = (cartItems,accessTokenShop,storeName,destinationLatNlong) => {
	return new Promise(function (fulfill, reject) {
		console.log("----cartItems----");
		console.log(cartItems);
		console.log("----cartItems----");
		var inventories = [];
			async.mapSeries(cartItems,
			(item, callback) => {
				if( 'product_id' in  item ) {
					var productId = item.product_id;
				} else {
					var productId = item.id;
				}
				
				var variantId = item.variant_id;
				var quantity = item.quantity;
				getProductInvenrties(productId, accessTokenShop, storeName,variantId,quantity,destinationLatNlong)
					.then(response => {
						
						if('results' in response && 'productTags' in response) {
							item.inventory_locations = response.results;
							item.productTags = response.productTags;
							callback(null, item);
						} else {
							throw new Error('Des productTags');
						}
						var successResponse = [];
						//successResponse[productId] = response;
						
						//callback(null, successResponse);
					})
					.catch(error =>callback(error));
			},
			(error, results) => {
				if (error) {
					fulfill([]);
				} else {
					console.log("--results-getInvenrties--");
					//console.log(results);
					fulfill(results);
					console.log("--results-getInvenrties--");
				}
			}
		);	
	});
}
const getProductInvenrties = (productId,accessTokenShop,storeName,variantId,quantity,destinationLatNlong) => {
	return new Promise(function (fulfill, reject) {
	var productsDetailUrl = 'https://' + storeName + '/admin/api/2020-04/products/'+productId+'.json/';
	var inventoryIds = [];
	var productTags = "";
	const locRequestHeaders = {
	  'X-Shopify-Access-Token': accessTokenShop,
	};
	
	request.get(productsDetailUrl, { headers: locRequestHeaders })
		.then((productResponse) => {
			var product = JSON.parse(productResponse);
			//console.log("-----product start-----");
			//console.log(JSON.stringify(product, null, 4));
			//console.log("-----product-----");
			product = product.product;
			if(product.tags.length > 0) {
				productTags = product.tags;
			} else{
				productTags=[]
			}
			
			var variantInfo = product.variants.find( ({ id }) => id === variantId );
			inventoryIds.push(variantInfo.inventory_item_id);
			
			var inventoryIdsStr = inventoryIds.join();
			console.log(inventoryIdsStr);
			
			
			var inventoryLevelsUrl = 'https://' + storeName + '/admin/api/2020-04/inventory_levels.json?inventory_item_ids='+inventoryIdsStr;
			return request.get(inventoryLevelsUrl, { headers: locRequestHeaders });
			
		})
		.then((inventoryResponse) => {
			var inventories = [];
			inventoryResponse = JSON.parse(inventoryResponse);
			console.log(inventoryResponse);
			for ( inventory of inventoryResponse.inventory_levels){
				console.log(inventory);
				inventory.product_id = productId;
				inventories.push(inventory);
			}
			if(inventories.length > 0) {
				return inventories;
			} else {
				throw new Error('Inventory');
			}
		})
		.then((filteredInventories) => {
			async.mapSeries(filteredInventories,
			(inventor, callback) => {
				getLocationInfo(accessTokenShop,storeName,inventor.location_id,destinationLatNlong)
					.then((deliverLocation) => {
							if(deliverLocation != "Not Success") {
								inventor.delivery_charges = deliverLocation;
								if(Math.sign(inventor.available) === -1) {
									inventor.available = 100;
								}
								console.log("----inventor---");
								console.log(inventor);
								console.log("----inventor---");
								callback(null, inventor);
							} else {
								callback(null, {});
							}
					})
			},
			(error, results) => {
				if (error) {
					fulfill();
				} else {
					console.log("--results f--");
					console.log(results);
					var respo = {results:results,productTags:productTags};
					fulfill(respo);
					console.log("--results f---");
				}
			}
			);
			
		})
		.catch((error) => {
			fulfill();
		});
	});
}

const getLocationInfo = (accessTokenShop,storeName,locationId,destinationLatNlong) => {
	return new Promise(function (fulfill, reject) {
		var locationRequestUrl = 'https://' + storeName + '/admin/api/2020-04/locations/'+locationId+'.json';
		var locRequestHeaders = {
		  'X-Shopify-Access-Token': accessTokenShop,
		};

		request.get(locationRequestUrl, { headers: locRequestHeaders })
			.then((locationResponse) => {
				locationResponse = JSON.parse(locationResponse);
				console.log(locationResponse);
				locationResponse.location.name = storeName;
				return createAddressForOrder(locationResponse.location);
			})
			.then((addressForOrder) => {
				return getLatNLong(addressForOrder.google_maps_address);
			})
			.then((latNLong) => {
				var price_url = PIDGE_API+"/shopify/order/price";
				var priceData = {
					"location": [
					{
					  "to_address": {
						"latitude": destinationLatNlong.lat,
						"longitude": destinationLatNlong.lng
					  },
					  "from_address": {
						"latitude": latNLong.lat,
						"longitude": latNLong.lng
					  }
					}
					]
				}
				console.log('price lat long', priceData)
				return request.post(price_url, { json: priceData});
			})
			.then((priceResponse) => {
				console.log("====priceResponse=====");
				console.log(priceResponse.data);
				console.log("====priceResponse=====");
				fulfill(priceResponse.data);
			})
			.catch((error) => {
				console.log("+++++priceResponse++error+++++++++++");
				fulfill('Not Success');
			});
	});
}


const checkDeliverableLocation = (accessTokenShop,storeName,locationId) => {
	locaResponse.location.name = fromNameg;
	fromCounrtyG = locaResponse.location.country;
	return createAddressForOrder(locaResponse.location);	
}
const getdestinationLatNlong = (destination) => {
	return new Promise(function (fulfill, reject) {
		var address1 = destination.address1;
		var address2 = destination.address2;
		var address3 = destination.address3;
		var address = address1;
		if(address2) {
			address = address +", "+address2;
		} else {
			address2 = "N/A";
		}
		if(address3) {
			address = address +", "+address3;
		} else {
			address3 = "N/A";
		}
		var city = destination.city;
		var state = destination.province;
		var postalCode = destination.postal_code;
		var country = destination.country;
		var fullAddress = address+", "+city+", "+state+", "+postalCode+", "+country;
		getLatNLong(fullAddress)
			.then((latNLong) => {
				fulfill(latNLong);
			})
			.catch(e => {
				reject({});
			});
	});
}
/***********************************************************/
const processingData=(data) => {
console.log("ajay")
// console.log(data)
 const filter_locations = (locations, qnt) => {
   const result=[]
   locations.sort((a,b) => b.quantity-a.available)
   // console.log(locations)
   for( let item of locations){
     if(qnt > 0){
      if(item.available >= qnt){
        result.push({quantity:qnt,locations:item.location,delivery_charges:item.delivery_charges,location_id:item.location_id,inventory_item_id:item.inventory_item_id})
        break;
      }else{
        result.push({quantity:item.available,locations:item.location,delivery_charges:item.delivery_charges,location_id:item.location_id,inventory_item_id:item.inventory_item_id})
         qnt  = qnt - item.available
      }
     }else{
       break;
     }
   }
   return result
 }
 let rows = data.map((item) => {
   item.inventory_locations =filter_locations(item.inventory_locations,item.quantity)
   return item
 })
// console.log(rows[0].inventory_locations)
console.log("ajay end")
 
 /*console.log("-----rows-----");
 //console.log(rows);
 console.log(JSON.stringify(rows, null, 4));
 console.log("-----rows-----"); */
 return rows
 
}
/**************************************************/
const cretaeMultipleNew=async (data) => {
	const returnVal = [];
	let order={}
	for(let row of data){
		for(let item of row.inventory_locations){
		if(item.quantity == 0){
			continue
		}
			const obj = {
				delivery_charges:item.delivery_charges,
				inventory_item_id:item.inventory_item_id,
				location_id:item.location_id,
				id:item.location_id,
				quantity:item.quantity,
				name:row.name,
				variant_id:row.variant_id,
				title:row.title,
				product_id:row.id,
				productTags:row.productTags,
				grams:row.grams,
				product_info:row
			}
			if(typeof order[item.location_id] ==='undefined'){
				order[item.location_id]=[]
				order[item.location_id].push(obj)
			}else{
				order[item.location_id].push(obj)
			}
			returnVal.push(returnVal)
		}
	}
	return order;
}
const cretaeMultiple=(data) => {
	
	return new Promise(function (fulfill, reject) {
		var returnVal = [];
		async.mapSeries(data,
			(inven, callback) => {
				if( inven.inventory_locations.length > 1 ) {
					disttt(inven)
					.then((distttRes) => { 
						callback(null, distttRes);
					})
					.catch(error =>callback(error));
				} else {
					callback(null, inven);
				}
				
			},
			(error, results) => {
				if (error) {
					reject();
				} else {
					var newArr = [];
					for(var i = 0; i < results.length; i++)
					{
						newArr = newArr.concat(results[i]);
					}
					fulfill(newArr);
					//return results;
				}
			}
		);
		
	});
}
/************************************/
const disttt=(data) => {
	return new Promise(function (fulfill, reject) {
		var arr = [];
		var inventory_locations = data.inventory_locations;
		async.mapSeries(inventory_locations,
			(elm, callback) => {
				var pklo = data;
				pklo.inventory_locations = [elm];
				callback(null, pklo);
			},
			(error, results) => {
			if (error) {
					fulfill([]);
			} else {
					fulfill( results );
				}
			}
		);
	});
}

const onlyUnique=(value, index, self) => {
    return self.indexOf(value) === index;
}
const getDistLoc=(inventories) => {
    return new Promise(function (fulfill, reject) {
		var locationObj = [];
		async.mapSeries(inventories,
			(inven, callback) => {
				locationObj.push(inven.inventory_locations[0].location_id);
				callback(null,inven);
			},
			(error, results) => {
				if (error) {
					
					reject();
				} else {
					
					var unique = locationObj.filter( onlyUnique );
					
					fulfill(unique);
				}
			}
		);
	});
}
const getTotalPriceNloc=(inventorys,getDistLocRes) => { 
	return new Promise(function (fulfill, reject) { 
		var locationObj = {};
		var price = [];
		async.mapSeries(inventorys,
			(inven, callback) => {
				var lob = inven.inventory_locations[0].location_id;
				
				if( locationObj.hasOwnProperty(lob) ) {
					locationObj[inven.inventory_locations[0].location_id].push(inven);
				} else {
					locationObj[inven.inventory_locations[0].location_id] = [inven];
				}
				
				
				callback(null,inven);
			},
			(error, results) => {
				if (error) {
					
					reject();
				} else {
					
					getTotalPrice(locationObj,getDistLocRes)
					.then((getTotalPriceRes) => {
						console.log("----getTotalPriceRes-----");
						console.log(getTotalPriceRes);
						console.log("----getTotalPriceRes-----");
						var arr = {'order':locationObj,'totP':getTotalPriceRes};
						console.log(JSON.stringify(arr, null, 4));
						fulfill(arr);
					})
					.catch(error =>{ console.log(error);console.log("----getTotalPriceRes-- err---");reject()});
				}
			}
		);
	});
}

const getTotalPrice=(locationObj,getDistLocRes) => { 
	return new Promise(function (fulfill, reject) { 
		console.log("----getTotalPrice dd-----");
		var price = 0;
		console.log(getDistLocRes);
		async.mapSeries(getDistLocRes,
			(inven, callback) => {

				price = price + locationObj[inven][0].inventory_locations[0].delivery_charges;
				callback(null,price);
			},
			(error, results) => {
				if (error) {
					console.log("----getTotalPrice error-----");
					reject();
				} else { 
					console.log("----getTotalPrice sd-----");
					fulfill(price);
				}
			}
		);
			
	});

};
/************************************************************************/
const getDimension=(orderDetail, store_detail={}) => {
	return new Promise(function (fulfill, reject) { 
		console.log("--getDimension getDimension---");
		async.mapSeries(orderDetail,
			(itemDetail, callback) => {
				// if(itemDetail.productTags.length < 0) {
				// 	var dimensionP = {
				// 		"width": 200,
				// 		"height": 20
				// 		};
				// } else {
				// 	var dimensionP = calDimension(itemDetail.productTags);
				// }
				var dimensionP = {
							"width": 0,
							"height": 0
							};
				const get_volume= HELPER.weight_to_size_conversion(store_detail,itemDetail.quantity, itemDetail.grams)
				var ordItm = {
						"dimension": dimensionP,
						"handling_instructions": "Please take care",
						"category": 7,
						"value_of_item": itemDetail.quantity,
						"label": itemDetail.name,
					    "volume":get_volume
					};
					callback(null,ordItm);
			},
			(error, results) => {
				if (error) {
					console.log("----getDimension create error-----");
					reject();
				} else { 
					console.log("----getDimension create sd-----");
					console.log(results);
					fulfill(results);
				}
			}
		);
			
	});

};
const calDimension=(tagsStr) => {
	var dimension = {width:200,height:20};
	if(tagsStr !="" || tagsStr.length ==0){
		return dimension
	}
	var tags = tagsStr.split(",");
	for (tag of tags) {
			if(tag.indexOf("pidge__height") != -1 || tag.indexOf("pidge__width") != -1) {
			if(tag.indexOf("pidge__height") != -1) {
				var height = tag.split("pidge__height:"); 
				dimension.height = parseInt(height[1]);
			} else {
				var width = tag.split("pidge__width:");
				dimension.width = parseInt(width[1]);
			}
			
		}
	}
	return dimension;
};
/************************************************************************/
const fullfillParaa=(orderDetail) => { 
	return new Promise(function (fulfill, reject) { 
		async.mapSeries(orderDetail,
			(itemDetail, callback) => {
				
				
				var dimensionP = {
						//"product_id": itemDetail.product_id,
						"id": itemDetail.id,
						//"variant_id": itemDetail.id
						};
				
					callback(null,dimensionP);
			},
			(error, results) => {
				if (error) {
					reject();
				} else {
					fulfill(results);
				}
			}
		);
			
	});

};