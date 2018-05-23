var app = require('../../server/server')
var utility = require('../../public/utility')
var roleManager = require('../../public/roleManager')

var statusConfig = require('../../config/estimateStatus.json')
var predictStatusConfig = require('../../config/predictStatus.json')

module.exports = function(estimate) {

  var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

	estimate.validatesInclusionOf('status', {in: statusList})

  estimate.beforeRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		var predict = app.models.predict
		client.findById(ctx.args.data.clientId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
      if (!clientInst)
        return next(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
			clientInst.estimates({where:{predictId: ctx.args.data.predictId.toString()}}, function(err, estimatesList) {
				if (err)
					return next(err)
				if (estimatesList.length != 0)
					return next(new Error('خطا! شما در حال حاضر این پیش‌بینی را تائید کرده‌اید'))
				predict.findById(ctx.args.data.predictId.toString(), function(err, predictInst) {
					if (err)
						return next(err)
					if (!predictInst)
						return next(new Error('خطا! پیش‌بینی‌ای با این مشخصات وجود ندارد'))	
					if (Number(clientInst.accountInfoModel.chances) <= 0)
						return next(new Error('خطا! فرصت‌های شما برای پیش‌بینی تمام شده‌است'))
					var time = utility.getUnixTimeStamp()
					if (!(predictInst.status === predictStatusConfig.working))
						return next(new Error('خطا! این پیش‌بینی دیگر باز نیست'))
					if (!(time >= Number(predictInst.beginningTime) && time <= Number(predictInst.endingTime)))
						return next(new Error('خطا! دوره زمانی این پیش‌بینی تمام شده‌است'))
					predictInst.leagueRel(function(err, leagueInst) {
						if (err)
							return next(err)
						ctx.args.data.status = statusConfig.open
						ctx.args.data.point = Number(predictInst.point)
						ctx.args.data.explanation = predictInst.explanation
						ctx.args.data.leagueName = leagueInst.name
						return next()							
					})
				})	
			})
		})
	})

  estimate.afterRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		var predict = app.models.predict
		client.findById(modelInstance.clientId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
      if (!clientInst)
        return next(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
			predict.findById(modelInstance.predictId.toString(), function(err, predictInst) {
				if (err)
					return next(err)
				if (!predictInst)
					return next(new Error('خطا! پیش‌بینی‌ای با این مشخصات وجود ندارد'))	
				var newChances = Number(clientInst.accountInfoModel.chances) - 1
				var newTotalEstimates = Number(clientInst.accountInfoModel.totalEstimates) + 1
				clientInst.accountInfo.update({'chances': newChances, 'totalEstimates': newTotalEstimates}, function(err, instance) {
					if (err)
						return next(err)
					modelInstance.clientRel(clientInst)
					modelInstance.predictRel(predictInst)
					return next()					
				})
			})
		})
	})
}
