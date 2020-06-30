const request_handler =require('./request_handler')
const request = require('request-promise');
const Promise = require('promise');
const async = require('async');
const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
const googleApiKey = process.env.GOOGLE_GEO_API_KEY;
const HELPER = {
    // create_order:async(req, res)=>{
    //     try {
    //         console.log("shopify-orders-created");
    //         //shopify_order_id
    //         var storeName = req.headers['x-shopify-shop-domain'];
    //         var accessTokenShop = '';
    //         var fromNameg = storeName;
    //         var fromAddressG;
    //         var storeID;
    //         var locationId;
    //         var items;
    //         let store_detail
    //         console.log("order response", storeName)
    //         console.log(req.body);
    //
    //
    //         //console.log(req.body.line_items);
    //
    //         var bodyResponse = req.body;
    //         if( bodyResponse.shipping_lines[0].source == "Pidge Shipping Provider") {
    //             var orderId = parseInt(bodyResponse.id);
    //             console.log("pidge-services");
    //             checkStoreStatus(storeName)
    //                 .then((storeStatus) => {
    //                     storeID = parseInt(storeStatus.storeId);
    //                     accessTokenShop = storeStatus.accessToken;
    //                     store_detail =storeStatus
    //                     /*const shopRequestUrl = 'https://' + storeName + '/admin/api/2020-01/shop.json';
    //                     const shopRequestHeaders = {
    //                       'X-Shopify-Access-Token': accessTokenShop,
    //                     }*/;
    //
    //                     //return request.get(shopRequestUrl, { headers: shopRequestHeaders });
    //
    //                     var destinationAdd = bodyResponse.shipping_address;
    //                     items = bodyResponse.line_items;
    //                     return HELPER.get_destination_lat_long(destinationAdd);
    //                 })
    //                 .then((destinationLatNlong) => {
    //                     return HELPER.get_invenrties(items,accessTokenShop,storeName,destinationLatNlong)
    //                 })
    //                 .then((inventoryResponse) => {
    //                     if(inventoryResponse.length == items.length) {
    //                         console.log("====inventoryResponse====");
    //                         //console.log(inventoryResponse);
    //                         console.log("=========inventoryResponse======");
    //                         return HELPER.processing_data(inventoryResponse);
    //                         //getLocationIds(inventoryResponse);
    //                     } else {
    //                         throw new Error('Des');
    //                         console.log("else");
    //                         res.send({});
    //                     }
    //
    //                 })
    //                 .then((locations) => {
    //                     return HELPER.create_multiple(locations)
    //                 })
    //                 .then((inventories) => {
    //                     console.log("====inventories inventories====");
    //                     //console.log(inventories);
    //                     console.log("=========inventories inventories======");
    //                     inventorys = inventories;
    //                     return   HELPER.get_dist_loc(inventories);
    //                 })
    //                 .then((getDistLocRes) => {
    //
    //                     return getTotalPriceNloc(inventorys,getDistLocRes);
    //
    //                 })
    //                 .then((getTotalPriceNlocRes) => {
    //                     var orders = getTotalPriceNlocRes.order;
    //                     var orderKeys = Object.keys(orders);
    //                     console.log("---orderKeys---");
    //                     console.log(orderKeys);
    //                     console.log("---orderKeys---");
    //                     var ismultipleOrder = false;
    //                     if(orderKeys.length > 1) {
    //                         ismultipleOrder = true;
    //                     }
    //
    //                     async.mapSeries(orderKeys,
    //                         (orderKey, callback) => {
    //                             var ord = orders[orderKey];
    //                             console.log("--------ord----------");
    //                             //console.log(JSON.stringify(ord, null, 4));
    //                             console.log("--------ord----------");
    //                             completeOrderProcess(accessTokenShop,storeName,storeID,orderId,orderKey,ord,bodyResponse,ismultipleOrder,store_detail)
    //                                 .then((completeOrderPro) => {
    //                                     if(completeOrderPro == "Success") {
    //                                         callback(null,completeOrderPro);
    //                                     } else {
    //                                         callback();
    //                                     }
    //                                 })
    //                                 .catch((error) => {
    //                                     callback();
    //                                 });
    //                         },
    //                         (error, results) => {
    //                             if (error) {
    //                                 console.log("----getTotalPriceNlocRes error-----");
    //                                 reject();
    //                             } else {
    //                                 console.log("----getTotalPriceNlocRes sd-----");
    //                                 console.log(JSON.stringify(results, null, 4));
    //                                 console.log("----getTotalPriceNlocRes sd-----");
    //                                 fulfill(results);
    //                             }
    //                         }
    //                     );
    //
    //
    //                 })
    //                 .then((finalstep) => {
    //                     res.send({});
    //                 })
    //                 .catch((error) => {
    //                     console.log('====error=====');
    //                     console.log(error);
    //                     res.send({});
    //                 });
    //             /**********************************************************/
    //
    //         } else {
    //             res.send("");
    //         }
    //     }catch (e) {
    //         console.error(e)
    //         res.send("error");
    //     }
    // },
    get_dist_loc:(inventories) => {
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
    },
    create_multiple:(data) => {
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
    },
    check_store_status : (storeName) => {
        return new Promise(function (fulfill, reject) {
            var getStoreInfoUrl = "https://uat-api.pidge.in/v1.0/shopify/shopify-client?store_url="+storeName;
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
    },
    get_invenrties:async (cartItems,accessTokenShop,storeName,destinationLatNlong)=>{
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
                        HELPER.get_product_invenrties(productId, accessTokenShop, storeName,variantId,quantity,destinationLatNlong)
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
    },
    get_product_invenrties : async (productId, accessTokenShop, storeName, variantId, quantity, destinationLatNlong) => {
        try {
        const productsDetailUrl = 'https://' + storeName + '/admin/api/2020-04/products/'+productId+'.json/';
        const inventoryIds = [];
        let productTags = "";
        const locRequestHeaders = {
            'X-Shopify-Access-Token': accessTokenShop,
        };
        let product= await request_handler.get(productsDetailUrl,locRequestHeaders)
            // product=JSON.parse(product)
            product = product.product;
            if(product.tags.length > 0) {
                productTags = product.tags;
            }

            let variantInfo = product.variants.find( ({ id }) => id === variantId );
            inventoryIds.push(variantInfo.inventory_item_id);
            var inventoryIdsStr = inventoryIds.join();
            console.log(inventoryIdsStr);

            const inventoryLevelsUrl = 'https://' + storeName + '/admin/api/2020-04/inventory_levels.json?inventory_item_ids='+inventoryIdsStr;
            let inventoryResponse= await request_handler.get(inventoryLevelsUrl,locRequestHeaders)
            let inventories = [];
            // inventoryResponse = JSON.parse(inventoryResponse);
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
           const result =await async.mapSeries(inventories,
                (inventor, callback) => {
                    HELPER.get_location_info(accessTokenShop,storeName,inventor.location_id,destinationLatNlong)
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
                       throw new Error(error)
                    } else {
                        console.log("--results f--");
                        console.log(results);
                        var respo = {results:results,productTags:productTags};
                       return respo
                    }
                }
            );
            return result

        } catch (e) {
            console.error(e)
            return null
        }
    },
    get_order:async (req,res)=>{
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
        try {


        const destinationLatNlong = await HELPER.get_destination_lat_long(destinationAdd)
        const inventoryResponse= HELPER.get_invenrties(items,accessTokenShop,storeName,destinationLatNlong)
        if(inventoryResponse.length == items.length) {
            console.log("====inventoryResponse====");
            console.log(inventoryResponse);
            console.log("=========inventoryResponse======");
            const result= HELPER.processing_data(inventoryResponse);
            console.log('final result', result)
            res.send(result)
        } else {
            throw new Error('Des');
        }

        }catch (e) {
            console.log("else",e);
           return res.send({});
        }
    },
    get_lat_long: (addressStr) => {
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
    },
    get_destination_lat_long :async (destination) => {
            let address1 = destination.address1;
            let address2 = destination.address2;
            let address3 = destination.address3;
            let address = address1;
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
            let city = destination.city;
            let state = destination.province;
            let postalCode = destination.postal_code;
            let country = destination.country;
            let fullAddress = address+", "+city+", "+state+", "+postalCode+", "+country;
            const result= await HELPER.get_lat_long(fullAddress)
            return result

    },
    get_location_info : async (accessTokenShop,storeName,locationId,destinationLatNlong) => {
        var locationRequestUrl = 'https://' + storeName + '/admin/api/2020-04/locations/' + locationId + '.json';
        var locRequestHeaders = {
            'X-Shopify-Access-Token': accessTokenShop,
        };
        try {
        let locationResponse = await request_handler.get(locationRequestUrl, {headers: locRequestHeaders})
        locationResponse.location.name = storeName;
        let addressForOrder = HELPER.create_address_for_order(locationResponse.location);
        let destinationLatNlong= HELPER.get_lat_long(addressForOrder.google_maps_address);
            var price_url = "https://uat-api.pidge.in/v1.0/shopify/order/price";
            var priceData = {
                "location": [
                    {
                        "from_address": {
                            "latitude": destinationLatNlong.lat,
                            "longitude": destinationLatNlong.lng
                        },
                        "to_address": {
                            "latitude": latNLong.lat,
                            "longitude": latNLong.lng
                        }
                    }
                ]
            }
            let priceResponse = request_handler.post(price_url, { json: priceData});
            console.log("====priceResponse=====");
            console.log(priceResponse.data);
            console.log("====priceResponse=====");
            return priceResponse.data

        } catch (e) {
            console.error(e)
            return null
        }

    },
    create_address_for_order :(fromAddress) => {

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
    },
    processing_data:(data) => {
        const filter_locations = (locations, qnt) => {
            const result=[]
            locations.sort((a,b) => b.quantity-a.available)
            console.log(locations)
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

        /*console.log("-----rows-----");
        //console.log(rows);
        console.log(JSON.stringify(rows, null, 4));
        console.log("-----rows-----"); */
        return rows

    }
};
module.exports = HELPER;
