var express = require('express');
var request = require('request');
var Q = require('q');
var _ = require('underscore');
var router = express.Router();
var mongoose = require('mongoose');

// DATABASE CONNECTION
mongoose.connect('mongodb://localhost/restaurants');

// Error handler
mongoose.connection.on('error', function (err) {
  console.log(err)
});

// Reconnect when closed
mongoose.connection.on('disconnected', function () {
  mongoose.connect('mongodb://localhost/test');
});

var Schema = mongoose.Schema;
var restaurantSchema = new Schema({
  restaurantID: Number,
  name: String,
  address: String,
  city: String,
  state: String,
  area: String,
  postal_code: String,
  country: String,
  phone: String,
  reserve_url: String,
  mobile_reserve_url: String
})

var Restaurant = mongoose.model('Restaurant', restaurantSchema);

var url = 'https://opentable.herokuapp.com/api/restaurants?city=New+York';
function getRestaurantPage(page) {
  console.log("Loading page " + page)
  var deferred = Q.defer();
  request(url + '&page=' + page, function (error, response, restaurantData) {
    deferred.resolve(JSON.parse(restaurantData).restaurants)
  });
  return deferred.promise;
}

function saveRestaurant(restaurant) {
  var deferred = Q.defer();
  var restaurant = new Restaurant({
    restaurantID: restaurant.id,
    name: restaurant.name,
    address: restaurant.address,
    city: restaurant.city,
    state: restaurant.state,
    area: restaurant.area,
    postal_code: restaurant.postal_code,
    country: restaurant.country,
    phone: restaurant.phone,
    reserve_url: restaurant.reserve_url,
    mobile_reserve_url: restaurant.mobile_reserve_url,
  });
  restaurant.save(function (err) {
    if (err) {
      deferred.resolve(false);
    } else {
      deferred.resolve(true);
    }
  });
  return deferred.promise;
}

/* GET home page. */
exports.index = router.get('/', function(req, res) {
  Restaurant.count({}, function(err, count) {
    if (count === 0) {
      request(url, function (error, response, data) {
        if (!error && response.statusCode == 200) {
          initialData = JSON.parse(data);
          totalEntries = initialData.total_entries;
          entriesPerPage = initialData.per_page;
          numPages = Math.ceil(totalEntries/entriesPerPage)
          console.log("Loading restaurants in NYC (" + numPages + " pages, 25 restaurants/page)...")
          var promises = _.range(1, numPages + 1);
          promises = _.map(promises, function(page) {
            return getRestaurantPage(page);
          });

          Q.allSettled(promises).then(function(restaurants) {
            var list = _.filter(restaurants, function (result) {
              if (result.state === "fulfilled") {
                return true;
              }
            });
            list = _.map(list, function (result) {
              return result.value;
            })
            list = _.flatten(list);

            var promises = [];
            _.each(list, function(restaurant, index) {
              promises.push(saveRestaurant(restaurant));
            })

            Q.allSettled(promises).then(function(promiseList) {
              console.log("Loaded all restaurants in NYC")
              res.render('index.html', {restaurants: list});
            })
          })
        }
      });
    } else {
      Restaurant.find({}, function(err, list) {
        res.render("index.html", {restaurants: list})
      })
    }
  })
});
