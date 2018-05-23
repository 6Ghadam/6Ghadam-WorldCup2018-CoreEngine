var app = require('../../server/server')
var utility = require('../../public/utility')
var roleManager = require('../../public/roleManager')
var cron = require('cron')

var statusConfig = require('../../config/exactStatus.json')
var labelConfig = require('../../config/exactLabels.json')
var topicConfig = require('../../config/exactTopics.json')
var choiceStatusConfig = require('../../config/choiceStatus.json')
var choicePriorityConfig = require('../../config/choicePriority.json')

module.exports = function(exact) {

  var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

	exact.validatesInclusionOf('status', {in: statusList})

  var labelList = []
  for (var key in labelConfig) 
    labelList.push(labelConfig[key])

	exact.validatesInclusionOf('label', {in: labelList})

  var topiclList = []
  for (var key in topicConfig) 
    topiclList.push(topicConfig[key])

	exact.validatesInclusionOf('topic', {in: topiclList})

	function finishExact(exactInstance, cb) {
		exactInstance.choices({'status': choiceStatusConfig.open}, function(err, choiceList) {
			if (err)
				return cb(err)
			if (choiceList.length == 0)
				return cb(null)
			var time = utility.getUnixTimeStamp()
			var counter3 = 0
			for (var i = 0; i < choiceList.length; i++) {
				var choiceInst = choiceList[i]
				var point = 0
				var data = {
					'checkTime': time
				}
				data.status = choiceStatusConfig.lose
				if (choiceInst.firstOption) {
					if (choiceInst.firstOption.choice === exactInstance.answer) {
						point = Number(choiceInst.firstOption.point)
						data.status = choiceStatusConfig.win
						choiceInst.firstOption.status = choiceStatusConfig.win
						choiceInst.secondOption.status = choiceStatusConfig.lose
						choiceInst.thirdOption.status = choiceStatusConfig.lose
					}	
				}
				else if (choiceInst.secondOption) {
					if (choiceInst.secondOption.choice === exactInstance.answer) {
						point = Number(choiceInst.secondOption.point)
						data.status = choiceStatusConfig.win
						choiceInst.secondOption.status = choiceStatusConfig.win
						choiceInst.firstOption.status = choiceStatusConfig.lose
						choiceInst.thirdOption.status = choiceStatusConfig.lose
					}	
				}
				else if (choiceInst.thirdOption.choice) {
					if (choiceInst.thirdOption.choice === exactInstance.answer) {
						point = Number(choiceInst.thirdOption.point)
						data.status = choiceStatusConfig.win
						choiceInst.thirdOption.status = choiceStatusConfig.win
						choiceInst.secondOption.status = choiceStatusConfig.lose
						choiceInst.firstOption.status = choiceStatusConfig.lose
					}	
				}
				data.firstOption = choiceInst.firstOption
				data.secondOption = choiceInst.secondOption
				data.thirdOption = choiceInst.thirdOption
				choiceInst.updateAttributes(data, function(err, updateInstance) {
					if (err)
						return cb(err)
					if (updateInstance.status === choiceStatusConfig.win) {
						updateInstance.clientRel(function(err, clientInst) {
							if (err)
								return cb(err)
							var newRoundWins = Number(clientInst.accountInfoModel.roundWins) + 1
							var newTotalPoints = Number(clientInst.accountInfoModel.totalPoints) + point
							clientInst.accountInfo.update({'roundWins': newRoundWins, 'totalPoints': newTotalPoints}, function(err, accountInst) {
								if (err)
									return cb(err)
								var leaguePoint = 0
								if (clientInst.checkpointModel.leagues[exactInstance.leagueId.toString()]) 
									leaguePoint = Number(clientInst.checkpointModel.leagues[exactInstance.leagueId.toString()])
								clientInst.checkpointModel.leagues[exactInstance.leagueId.toString()] = leaguePoint + point
								clientInst.checkpoint.update({'leagues': clientInst.checkpointModel.leagues}, function(err, result) {
									if (err)
										return cb(err)
									var trophy = app.models.trophy
									trophy.trophyCheck(clientInst, function(err, result) {
										counter3++
										if (err)
											return cb(err)
										if (counter3 == choiceList.length)
											return cb(null, result)
									})
								})
							})
						})
					}
					else {
						counter3++
						if (counter3 == choiceList.length)
							return cb(null)
					}
				})
			}					
		})
	}

	var startExacts = cron.job("0 */1 * * * *", function () {
		var time = utility.getUnixTimeStamp()
		exact.find({
			where: {
				'status': statusConfig.created
			},
			limit: 50000
		}, function (err, exactList) {
			if (err)
				console.error(err)
			for (var i = 0; i < exactList.length; i++) {
				var exactInst = exactList[i]
				if (Number(exactInst.beginningTime) <= time && Number(exactInst.endingTime) >= time) {
					exactInst.updateAttribute('status', statusConfig.working, function (err, exactInstante) {
						if (err)
							console.error(err)
					})
				}
			}
		})
	})

	var finishExacts = cron.job("0 */1 * * * *", function () {
		var time = utility.getUnixTimeStamp()
		exact.find({
			where: {
				'status': statusConfig.working
			},
			limit: 50000
		}, function (err, exactList) {
			if (err)
				console.error(err)
			for (var i = 0; i < exactList.length; i++) {
				var exactInst = exactList[i]
				if (Number(exactInst.endingTime) <= time) {
					exactInst.updateAttribute('status', statusConfig.closed, function (err, exactInstante) {
						if (err)
							console.error(err)
					})
				}
			}
		})
	})

	startExacts.start()
	finishExacts.start()

	var weeklyReduction = cron.job("0 0 0 * * 0", function () {
		var time = utility.getUnixTimeStamp()
		exact.find({
			where: {
				'status': statusConfig.working
			},
			limit: 50000
		}, function (err, exactList) {
			if (err)
				console.error(err)
			for (var i = 0; i < exactList.length; i++) {
				var model = exactList[i]
				if (Number(model.beginningTime) + (2 * 24 * 60 * 60 * 1000) >= time) {
					for (var i = 0; i < model.selectors.length; i++) {
						var firstPoint = (Number(model.selectors[i].point.first) * 0.9)
						var secondPoint = (Number(model.selectors[i].point.second) * 0.9)
						var thirdPoint = (Number(model.selectors[i].point.third) * 0.9)
						model.selectors[i].point.first = firstPoint
						model.selectors[i].point.second = secondPoint
						model.selectors[i].point.third = thirdPoint
					}
					model.updateAttribute('selectors', model.selectors, function (err, exactInst) {
						if (err)
							console.error(err)
					})
				}
			}
		})		
	})

	weeklyReduction.start()

  exact.beforeRemote('create', function (ctx, modelInstance, next) {
		for (var i = 0; i < ctx.args.data.selectors.length; i++) {
			var model = ctx.args.data.selectors[i]
			if (!model["choice"] || !model["point"])
				return next(new Error('خطا! مدل نمونه پاسخ کامل نیست'))
			if (!model.point["first"] || !model.point["second"] || !model.point["third"])
				return next(new Error('خطا! مدل نمونه امتیازات کامل نیست'))
		}
		for (var i = 0; i < ctx.args.data.selectors.length; i++) {
			ctx.args.data.selectors[i].point.first = Number(ctx.args.data.selectors[i].point.first)
			ctx.args.data.selectors[i].point.second = Number(ctx.args.data.selectors[i].point.second)
			ctx.args.data.selectors[i].point.third = Number(ctx.args.data.selectors[i].point.third)
		}
		return next()
	})

  exact.afterRemote('create', function (ctx, modelInstance, next) {
		var league = app.models.league
		league.findById(modelInstance.leagueId.toString(), function(err, leagueInst) {
			if (err)
				return next(err)
      if (!leagueInst)
        return next(new Error('خطا! لیگ معتبری با این مشخصات وجود ندارد'))
			modelInstance.leagueRel(leagueInst)
			return next()
		})	
	})

	exact.beforeRemote('replaceById', function (ctx, modelInstance, next) {
		if (ctx.args.data.answer !== '') {
			if (ctx.args.data.status === statusConfig.working || ctx.args.data.status === statusConfig.closed) 
				next()
			else
				next(new Error('Cant do Finalize'))
		}
		else 
			next()
	})

  exact.afterRemote('replaceById', function (ctx, modelInstance, next) {
		if ((modelInstance.status === statusConfig.working || modelInstance.status === statusConfig.closed) && (modelInstance.answer && modelInstance.answer !== '')) {
			var client = app.models.client
			modelInstance.updateAttribute('status', statusConfig.finished, function(err, exactInstance) {
				if (err)
					return next(err)
				finishExact(exactInstance, function(err, result) {
					if (err)
						return next(err)
					return next()
				})
			})
		}
		else 
			return next()
	})

  exact.finalizeExact = function (exactId, answer, callback) {
		exact.findById(exactId.toString(), function(err, modelInstance) {
			if (err)
				return callback(err)
			if ((modelInstance.status === statusConfig.working || modelInstance.status === statusConfig.closed) && (answer)) {
				var client = app.models.client
				modelInstance.updateAttributes({'status': statusConfig.finished, 'answer': answer}, function(err, exactInstance) {
					if (err)
						return callback(err)
					finishExact(exactInstance, function(err, result) {
						if (err)
							return callback(err)
						return callback(null, 'Successful Finishing Exact')
					})
				})
			}
			else 
				return callback(new Error('Cant do Finalize'))
		})
  }

  exact.remoteMethod('finalizeExact', {
    accepts: [{
      arg: 'exactId',
      type: 'string',
      http: {
        source: 'path'
      }
    }, {
      arg: 'answer',
      type: 'string',
      http: {
        source: 'query'
      }
    }],
    description: 'finalize an exact',
    http: {
      path: '/finalizeExact/:exactId',
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
