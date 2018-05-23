var cron = require('cron')

var config = require('../../server/config.json')
var path = require('path')

var utility = require('../../public/utility.js')
var app = require('../../server/server')
var roleManager = require('../../public/roleManager')

var PRODUCTION = false

var methodDisabler = require('../../public/methodDisabler.js')
var relationMethodPrefixes = [
  'createChangeStream',
  'upsertWithWhere',
  'patchOrCreate',
  'exists',
  'prototype.patchAttributes'
]

var userStatus = require('../../config/userStatus.json')

var persianize = require('persianize')

module.exports = function(client) {

	var dailyPredict = cron.job("00 00 00 * * 1-7", function () {
    client.find({limit: 50000}, function(err, clientList) {
      if (err)
        return console.error(err)
      for (var i = 0; i < clientList.length; i++) {
        var clientInst = clientList[i]
        if (!clientInst.accountInfoModel)
          continue
        clientInst.accountInfo.update({'dailyAward': "false"}, function(err, result) {
          if (err)
            return console.error(err)
        })
      }
    })
  })

	dailyPredict.start()

	methodDisabler.disableOnlyTheseMethods(client, relationMethodPrefixes)
	client.validatesLengthOf('password', {min: 6})
  client.validatesUniquenessOf('username', {
    message: 'خطا! نام کاربری وارد شده قبلا در سیستم ثبت شده است'
  })
  client.validatesUniquenessOf('email', {
    message: 'خطا! ایمیل وارد شده قبلا در سیستم ثبت شده است'
  })
  client.validatesUniquenessOf('phoneNumber', {
    message: 'خطا! شماره وارد شده قبلا در سیستم ثبت شده است'
  })

  client.beforeRemote('login', function (ctx, modelInstance, next) {
    if (PRODUCTION) {
      var pass1 = utility.base64Decoding(ctx.args.credentials.password).toString()
      var pass2 = utility.base64Decoding(ctx.req.body.password).toString()
      ctx.args.credentials.password = pass1
      ctx.req.body.password 				= pass2
    }
    if (ctx.args.credentials.email || ctx.req.body.email) {
      ctx.args.credentials.email 	= ctx.args.credentials.email.toLowerCase()
      ctx.req.body.email 					= ctx.req.body.email.toLowerCase()
    }
    if (ctx.args.credentials.phoneNumber) {
      client.find({where:{phoneNumber: ctx.args.credentials.phoneNumber.toString()}, limit: 50000}, function(err, results) {
        if (err)
          return next(err)
        if (results.length == 0)
          return next(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
        var clientInst = results[0]
        if (clientInst.status === 'Suspended')
          return next(new Error('خطا! اکانت کاربری شما مسدود شده است'))
        var verification = app.models.verification
        verification.checkUserVerification(ctx.args.credentials.phoneNumber.toString(), function(err, result) {
          if (err)
            return next(err)
          if (result == 0)
            return next(new Error('خطا! کاربری با این مشخصات در لیست احراز هویت وجود ندارد'))
          if (result == 1)
            return next(new Error('خطا! شما هنوز احراز هویت نکرده‌اید'))
          ctx.args.credentials.email 	= clientInst.email.toLowerCase()
          ctx.req.body.email 					= clientInst.email.toLowerCase()
          return next()  
        })    
      })  
    }
    else {
      next()
    }
  })

  client.afterRemote('login', function (ctx, modelInstance, next) {
    client.findById(modelInstance.userId, function(err, clientInst) {
      if (err)
        return next(err)
      if (!clientInst)
        return next(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
      if (clientInst.phoneNumber === '09120001122')
        return next()
      if (clientInst.accountInfoModel.lastLogin == 0 || !clientInst.accountInfoModel.lastLogin) {
        clientInst.accountInfo.update({'dailyAward': "true", 'lastLogin': utility.getUnixTimeStamp()}, function(err, result) {
          if (err)
            return next(err)
          return next()
        })
      }
      else {
        function updateLoginDate() {
          clientInst.accountInfo.update({'lastLogin': utility.getUnixTimeStamp()}, function(err, result) {
            if (err)
              return next(err)
            return next()
          })
        }
        if (clientInst.accountInfoModel.dailyAward === 'false') {
          var newChances = clientInst.accountInfoModel.chances + 3
          clientInst.accountInfo.update({'dailyAward': "true", 'chances': newChances}, function(err, result) {
            if (err)
              return next(err)
            updateLoginDate()
          })
        }
        else {
          updateLoginDate()
        }  
      }
    })
  })

  client.beforeRemote('create', function (ctx, modelInstance, next) {
    if (PRODUCTION) {
      var pass1 = utility.base64Decoding(ctx.args.data.password).toString()
      var pass2 = utility.base64Decoding(ctx.req.body.password).toString()
      ctx.args.data.password 	= pass1
      ctx.req.body.password 	= pass2
    }
    var verification = app.models.verification
    verification.checkUserVerification(ctx.args.data.phoneNumber, function(err, result) {
      if (err)
        return next(err)
      if (result == 1)
        return next(new Error('خطا! شما هنوز احراز هویت نکرده‌اید'))
      if (result == 2)
        return next(new Error('خطا! اکانت شما در حال حاضر احراز هویت شده‌است'))
      var whiteList = ['email', 'username', 'password', 'time', 'phoneNumber', 'fullname', 'referrer']
      if (!utility.inputChecker(ctx.args.data, whiteList))
        return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
      else {
        function done() {
          if (ctx.args.data.fullname) {
            if (persianize.validator().text(ctx.args.data.fullname)) 
              ctx.args.data.fullname = persianize.convert().all(ctx.args.data.fullname).get()
            else
              return next(new Error('خطا! نام و نام‌خانوادگی شما باید فارسی وارد شود'))
          }
          ctx.args.data.emps          = new Buffer(ctx.args.data.password).toString('base64')
          ctx.args.data.time          = Number(ctx.args.data.time)
          ctx.args.data.emailVerified = true
          ctx.args.data.status        = userStatus.available
          ctx.args.data.email 				= ctx.args.data.email.toLowerCase()
          ctx.args.data.accountInfoModel 	= {}
          ctx.args.data.accountInfoModel.chances 		    = 25
          ctx.args.data.accountInfoModel.roundWins 	    = 0
          ctx.args.data.accountInfoModel.totalPoints    = 0
          ctx.args.data.accountInfoModel.totalEstimates = 0
          ctx.args.data.accountInfoModel.totalChoices   = 0
          ctx.args.data.accountInfoModel.dailyAward     = "true"
          ctx.args.data.accountInfoModel.lastLogin      = 0
          ctx.args.data.referralModel = {}
          ctx.args.data.referralModel.clients = []
          ctx.args.data.trophyModel 	= {}
          ctx.args.data.trophyModel.time    = Number(ctx.args.data.time)
          ctx.args.data.trophyModel.level   = 0
          ctx.args.data.checkpointModel = {}
          ctx.args.data.checkpointModel.leagues = {}
          return next()
        }
        if (ctx.args.data.referrer) {
          client.findById(ctx.args.data.referrer.toString(), function(err, result) {
            if (err)
              return next(new Error('خطا! معرفی با این کد وجود ندارد'))
            if (!result)
              return next(new Error('خطا! معرفی با این کد وجود ندارد'))
            done()
          })
        } else {
          done()
        }
      }
    })
  })

  
  client.afterRemote('create', function (ctx, modelInstance, next) {
    var option = {}
    option.name = '' + modelInstance.id.toString()
    var container = app.models.container
    container.createContainer(option, function (err, res) {
      if (err)
        return next(err)
      container.uploadSampleProImage(modelInstance.id.toString(), function(err, result) {
        if (err)
          return next(err)
        if (modelInstance.referrer) {
          client.findById(modelInstance.referrer.toString(), function(err, referrerInst) {
            if (err)
              return next(err)
            if (!referrerInst)
              return next()
            if (referrerInst.referralModel.clients.length >= 10) {
              return next()
            }
            else {
              var newClients = []
              newClients = referrerInst.referralModel.clients
              newClients.push(modelInstance.id.toString())
              referrerInst.referrals.update({'clients': newClients}, function(err, result) {
                if (err)
                  return next(err)
                var newReferrerChances = Number(referrerInst.accountInfoModel.chances) + 5
                referrerInst.accountInfo.update({'chances': newReferrerChances}, function(err, result) {
                  if (err)
                    return next(err)
                  var newModelInstanceChances = Number(modelInstance.accountInfoModel.chances) + 5
                  modelInstance.accountInfo.update({'chances': newModelInstanceChances}, function(err, result) {
                    if (err)
                      return next(err)
                    return next()
                  })
                })
              })
            }
          })
        } else {
          return next()
        }
      })
    })
  })
  

  client.beforeRemote('prototype.__update__accountInfo', function (ctx, modelInstance, next) {
    if (!ctx.args.options.accessToken)
      return next()
    client.findById(ctx.req.params.id.toString(), function (err, result) {
      if (err)
        return next(err)
      if (!result)
        return next(new Error('خطا! کاربری با این مشخصات وجود ندارد')) 
			if (ctx.args.data.chances)
				ctx.args.data.chances 		+= Number(result.accountInfoModel.chances)
			if (ctx.args.data.roundWins)
				ctx.args.data.roundWins 	+= Number(result.accountInfoModel.roundWins)
			if (ctx.args.data.totalPoints)
        ctx.args.data.totalPoints += Number(result.accountInfoModel.totalPoints)
			if (ctx.args.data.totalEstimates)
        ctx.args.data.totalEstimates += Number(result.accountInfoModel.totalEstimates)
			if (ctx.args.data.totalChoices)
        ctx.args.data.totalChoices += Number(result.accountInfoModel.totalChoices)
      return next()
    })
  })

  client.beforeRemote('changePassword', function (ctx, modelInstance, next) {
    if (PRODUCTION) {
      var pass1 = utility.base64Decoding(ctx.args.data.password).toString()
      var pass2 = utility.base64Decoding(ctx.req.body.password).toString()
      var conf1 = utility.base64Decoding(ctx.args.data.confirmation).toString()
      var conf2 = utility.base64Decoding(ctx.req.body.confirmation).toString()
      ctx.args.data.password 			= pass1
      ctx.req.body.password 			= pass2
      ctx.args.data.confirmation 	= conf1
      ctx.req.body.confirmation 	= conf2
    }
    return next()
  })

  client.beforeRemote('replaceById', function (ctx, modelInstance, next) {
    var whiteList = ['fullname']
    if (utility.inputChecker(ctx.args.data, whiteList))
      return next()
    else
      return next(new Error('White List Error! Allowed Parameters: ' + whiteList.toString()))
  })

  client.changePassword = function (data, req, res, cb) {
    if (!req.accessToken)
      return res.sendStatus(401)

    if (!req.body.password || !req.body.confirmation ||
      req.body.password !== req.body.confirmation) {
      return res.sendStatus(400, new Error('خطا! پسورد شما با تائیدیه آن هماهنگ نیست'))
    }

    client.findById(req.accessToken.userId.toString(), function (err, user) {
      if (err) return res.sendStatus(404)
      user.updateAttribute('password', req.body.password, function (err, user) {
        if (err) return res.sendStatus(404)
        res.render('response', {
          title: 'Password reset success',
          content: 'Your password has been reset successfully',
          redirectTo: '/',
          redirectToLinkText: 'Log in'
        })
      })
    })
  }

  client.remoteMethod('changePassword', {
    accepts: [{
      arg: 'data',
      type: 'object',
      http: {
        source: 'body'
      }
    }, {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    }, {
      arg: 'res',
      type: 'object',
      http: {
        source: 'res'
      }
    }],
    description: 'change password method with accessToken',
    http: {
      path: '/changePassword',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      arg: 'response',
      type: 'string'
    }
  })

  client.nextObject = function (ctx, clientId, leagueId, callback) {
    if (!ctx.req.accessToken)
      return callback(new Error('خطا! برای گرفتن پیش‌بینی‌ها نیاز است که ابتدا وارد شوید'))

    if (ctx.req.accessToken.userId.toString() !== clientId.toString())
      return callback(new Error('خطا! شما امکان دیدن پیش‌بینی‌ها را ندارید'))

    client.findById(clientId.toString(), function(err, clientInst) {
      if (!clientInst)
        return callback(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
      clientInst.estimates({'where':{'status':'Open'}}, function(err, estimatesList) {
        if (err)
          return callback(err)
        var estimatesIds = []
        for (var i = 0; i < estimatesList.length; i++)
          estimatesIds.push(estimatesList[i].predictId.toString())
        function gatherData(predictsList) {
          var res = []
          for (var i = 0; i < predictsList.length; i++) {
            if (estimatesIds.indexOf(predictsList[i].id.toString()) <= -1)
              res.push(predictsList[i])
          }
          return callback(null, res)
        }
        var league = app.models.league
        if (leagueId === 'every') {
          league.find({limit: 50000}, function(err, leagueList) {
            if (err)
              return callback(err)
            var counter = 0
            var predictFullArray = []
            for (var k = 0; k < leagueList.length; k++) {
              var leagueInst = leagueList[k]
              leagueInst.predicts({'where':{'status':'Working'}}, function(err, predictsList) {
                if (err)
                  return callback(err)
                for (var m = 0; m < predictsList.length; m++)
                  predictFullArray.push(predictsList[m])
                counter++
                if (counter == leagueList.length)
                  gatherData(predictFullArray)
              })  
            }
          })
        }
        else {
          league.findById(leagueId.toString(), function(err, leagueInst) {
            if (err)
              return callback(err)
            if (!leagueInst)
              return callback(new Error('خطا! لیگ معتبری با این مشخصات وجود ندارد'))      
            leagueInst.predicts({'where':{'status':'Working'}}, function(err, predictsList) {
              if (err)
                return callback(err)
              gatherData(predictsList)
            })
          })            
        }
      })
		})
  }

  client.remoteMethod('nextObject', {
    description: 'get array of next objects',
    accepts: [{
        arg: 'ctx',
        type: 'object',
        http: {
          source: 'context'
        }
      }, {
        arg: 'clientId',
        type: 'string',
        required: true,
        http: {
          source: 'path'
        }
      }, {
        arg: 'leagueId',
        type: 'string',
        required: true,
        http: {
          source: 'path'
        }
      }
    ],
    http: {
      path: '/:clientId/nextObject/:leagueId',
      verb: 'GET',
      status: 200,
      errorStatus: 400
    },
    returns: {
			type: 'object',
			root: true
    }
  })
  
  client.sendPassword = function (phoneNumber, callback) {
    client.find({'where':{'phoneNumber': phoneNumber}, limit: 50000}, function(err, clients) {
      if (err)
        return callback(err)
      if (clients.length == 0) {
        return callback(new Error('خطا! شما هنوز ثبت‌نام نکرده‌اید'))
      }
      else {
        clientInst = clients[0]
        var verification = app.models.verification
        var ps = new Buffer(clientInst.emps, 'base64').toString('utf8')
        verification.sendPassword(clientInst.phoneNumber, ps, function(err, result) {
          if (err)
            return callback(err, null)
          return callback(null, 'successfuly password sent')
        })
      }
    })
  }

  client.remoteMethod('sendPassword', {
    description: 'send password to users phone number',
    accepts: [{
        arg: 'phoneNumber',
        type: 'string',
        required: true,
        http: {
          source: 'path'
        }
      }
    ],
    http: {
      path: '/:phoneNumber/sendPassword/',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
			type: 'string',
			root: true
    }
  })

  client.statistics = function (callback) {
		var filter = {
      skip: '2',
      limit: 50000,
			fields: {
				'email': false,
				'time': false,
				'phoneNumber': false,
				'emailVerified': false,
				'trophyModel': false,
				'teamId': false,
				'referralModel': false,
				'checkpointModel': false,
				'emps': false,
				'status': false,
				'profilePath': false,
				'accountInfoModel': true,
				'username': true,
				'fullname': true,
				'id': true
			}
		}
    client.find(filter, function(err, clients) {
      if (err)
        return callback(err)
      return callback(null, clients)
    })
  }

  client.remoteMethod('statistics', {
    description: 'get all statistics information of all clients',
    accepts: [],
    http: {
      path: '/statistics',
      verb: 'GET',
      status: 200,
      errorStatus: 400
    },
    returns: {
			type: 'object',
			root: true
    }
  })

  client.changePhone = function (data, callback) {
    var phoneNumber = data.phoneNumber
    var email = data.email
    var password = data.password
    client.find({where:{email: email.toString()}, limit: 50000}, function(err, results) {
      if (err)
        return callback(err)
      if (results.length == 0)
        return callback(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
      var clientInst = results[0]
      if (!clientInst)
        return callback(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
      var pass = utility.base64Decoding(clientInst.emps).toString()
      if (phoneNumber === '09120001122')
        return callback(new Error('خطا! شماره وارد شده قبلا در سیستم ثبت شده است'))
      if (pass !== password)
        return callback(new Error('خطا! رمز وارد شده نادرست است'))
      var formerPhone = clientInst.phoneNumber
      clientInst.updateAttribute('phoneNumber', phoneNumber, function(err, updateInst) { 
        if (err)
          return callback(err)
        if (!updateInst)
          return callback(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
        var verification = app.models.verification
        verification.find({where:{phoneNumber: formerPhone}, limit: 50000}, function(err, verifResult) {
          if (err)
            return callback(err)
          if (verifResult.length == 0)
            return callback(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
          var verfModel = verifResult[0]
          verification.destroyById(verfModel.id, function(err, result) {
            if (err)
              return callback(err)
            return callback(null, verfModel)
          })
        })
      })
    })
  }

  client.remoteMethod('changePhone', {
    description: 'change phone number of user and send user verficiation if needed',
    accepts: [{
      arg: 'data',
      type: 'object',
      required: true,
      http: {
        source: 'body'
      }
    }],
    http: {
      path: '/changePhone',
      verb: 'PUT',
      status: 200,
      errorStatus: 400
    },
    returns: {
			type: 'object',
			root: true
    }
  })

}
