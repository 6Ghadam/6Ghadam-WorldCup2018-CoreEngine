var app = require('../../server/server')
var utility = require('../../public/utility')

module.exports = function (trophy) {

  trophy.trophyCheck = function (clientInst, cb) {
    var badgeArray = [0, 500, 3000, 8000, 15000, 30000, 50000, 100000, 200000, 500000, 1000000]
    var totalPoints = Number(clientInst.accountInfoModel.totalPoints)
    var level = 0
    for (var i = 0; i < (badgeArray.length); i++) {
      if (totalPoints >= badgeArray[i])
        level++
      else
        break
    }
    var data = {
      'time': utility.getUnixTimeStamp(),
      'level': level
    }
    clientInst.trophy.update(data, function(err, result) {
      if (err)
        return cb(err)
      return cb(null, 'successful')
    })
  }

  trophy.recheckTrophy = function (cb) {
    var client = app.models.client
    client.find({where:{phoneNumber:{neq: '09120001122'}}, limit: 50000}, function(err, clientList) {
      if (err)
        return cb(err)
      var counter = 0
      for (var i = 0; i < clientList.length; i++) {
        var model = clientList[i]
        trophy.trophyCheck(model, function(err, result) {
          if (err)
            return cb(err)
          counter++
          if (counter == clientList.length)
            return cb(null, counter + ' clients rechecked for trophy')
        })
      }
    })
  }

  trophy.remoteMethod('recheckTrophy', {
    accepts: [],
    description: 'recheck trophy points for all of clients',
    http: {
      path: '/recheckTrophy',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'object',
      root: true
    }
  })
  
}
