var app = require('../../server/server')
var utility = require('../../public/utility')
var roleManager = require('../../public/roleManager')

var statusConfig = require('../../config/choiceStatus.json')
var choicePriorityConfig = require('../../config/choicePriority.json')
var exactStatusConfig = require('../../config/exactStatus.json')

module.exports = function(choice) {

  choice.beforeRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		var exact = app.models.exact
		if (!ctx.args.data.firstOption || !ctx.args.data.secondOption || !ctx.args.data.thirdOption)
			return next(new Error('خطا! شما حتما باید یک انتخاب داشته باشید'))
		var totalCount = 0
		if (ctx.args.data.firstOption.choice)
			totalCount++
		if (ctx.args.data.secondOption.choice)
			totalCount++
		if (ctx.args.data.thirdOption.choice)
			totalCount++
		client.findById(ctx.args.data.clientId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
			if (!clientInst)
				return next(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
			if (Number(clientInst.accountInfoModel.chances) <= 0)
				return next(new Error('خطا! فرصت‌های شما برای پیش‌بینی تمام شده‌است'))
			if (Number(clientInst.accountInfoModel.chances) < totalCount)
				return next(new Error('خطا! فرصت‌های شما برای پیش‌بینی کافی‌ نیست'))
			exact.findById(ctx.args.data.exactId.toString(), function(err, exactInst) {
				if (err)
					return next(err)
				if (!exactInst)
					return next(new Error('خطا! پیش‌بینی قطعی‌ای با این مشخصات وجود ندارد'))
				var time = utility.getUnixTimeStamp()
				if (!(exactInst.status === exactStatusConfig.working))
					return next(new Error('خطا! این پیش‌بینی قطعی دیگر باز نیست'))
				if (!(time >= Number(exactInst.beginningTime) && time <= Number(exactInst.endingTime)))
					return next(new Error('خطا! دوره زمانی این پیش‌بینی قطعی تمام شده‌است'))
				exactInst.leagueRel(function(err, leagueInst) {
					if (err)
						return next(err)
					exactInst.choices({'where':{'clientId': ctx.args.data.clientId.toString()}}, function(err, userExactChoices) {
						if (err)
							return next(err)
						if (userExactChoices.length == 0) {
							if (!ctx.args.data.firstOption)
								return next (new Error('خطا! شما حتما باید اولین انتخاب خود را پر کنید'))
							if (ctx.args.data.firstOption && !ctx.args.data.secondOption && ctx.args.data.thirdOption)
								return next (new Error('خطا! شما حتما باید دومین انتخاب خود را پر کنید'))
							if (ctx.args.data.firstOption.choice) {
								if (ctx.args.data.secondOption.choice) {
									if (ctx.args.data.firstOption.choice === ctx.args.data.secondOption.choice)
										return next (new Error('خطا! انتخاب اول و دوم شما نباید یکسان باشد'))
									if (ctx.args.data.thirdOption.choice) {
										if (ctx.args.data.thirdOption.choice === ctx.args.data.secondOption.choice)
											return next (new Error('خطا! انتخاب دوم و سوم شما نباید یکسان باشد'))						
									}
								}
								if (ctx.args.data.thirdOption.choice) {
									if (ctx.args.data.firstOption.choice === ctx.args.data.thirdOption.choice)
										return next (new Error('انتخاب اول و سوم شما نباید یکسان باشد'))					
								}
							}
							ctx.args.data.status = statusConfig.open
							ctx.args.data.topic = exactInst.topic
							ctx.args.data.leagueName = leagueInst.name
							for (var i = 0; i < exactInst.selectors.length; i++) {
								var model = exactInst.selectors[i]
								if (ctx.args.data.firstOption) {
									if (ctx.args.data.firstOption.choice === model.choice) {
										ctx.args.data.firstOption.point = Number(model.point.first)
										ctx.args.data.firstOption.status = statusConfig.open
									}	
								}
								if (ctx.args.data.secondOption) {
									if (ctx.args.data.secondOption.choice === model.choice) {
										ctx.args.data.secondOption.point = Number(model.point.second)
										ctx.args.data.secondOption.status = statusConfig.open
									}
								}
								if (ctx.args.data.thirdOption) {
									if (ctx.args.data.thirdOption.choice === model.choice) {
										ctx.args.data.thirdOption.point = Number(model.point.third)
										ctx.args.data.thirdOption.status = statusConfig.open
									}
								}
							}			
							return next()		
						}
						else 
							return next(new Error('خطا! شما در حال حالضر یک مدل انتخاب برای این پیش‌بینی قطعی دارید'))
					})	
				})
			})
		})
	})

  choice.beforeRemote('replaceById', function (ctx, modelInstance, next) {
		choice.findById(ctx.args.data.id.toString(), function(err, choiceInst) {
			if (err)
				return next(err)
			var client = app.models.client
			var exact = app.models.exact
			client.findById(choiceInst.clientId.toString(), function(err, clientInst) {
				if (err)
					return next(err)
				if (!clientInst)
					return next(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
				exact.findById(choiceInst.exactId.toString(), function(err, exactInst) {
					if (err)
						return next(err)
					if (!exactInst)
						return next(new Error('خطا! پیش‌بینی قطعی‌ای با این مشخصات وجود ندارد'))		
					var time = utility.getUnixTimeStamp()
					if (!(exactInst.status === exactStatusConfig.working))
						return next(new Error('خطا! این پیش‌بینی قطعی دیگر باز نیست'))
					if (!(time >= Number(exactInst.beginningTime) && time <= Number(exactInst.endingTime)))
						return next(new Error('خطا! دوره زمانی این پیش‌بینی قطعی تمام شده‌است'))
	
					if (choiceInst.firstOption.choice && choiceInst.secondOption.choice && choiceInst.thirdOption.choice)
						return next(new Error('خطا! شما انتخاب دیگری نمیتوانید برای این پیش‌بینی قطعی انجام دهید'))

					if (ctx.args.data.firstOption.choice) {
						if (ctx.args.data.secondOption.choice) {
							if (ctx.args.data.firstOption.choice === ctx.args.data.secondOption.choice)
								return next (new Error('خطا! انتخاب اول و دوم شما نباید یکسان باشد'))
							if (ctx.args.data.thirdOption.choice) {
								if (ctx.args.data.thirdOption.choice === ctx.args.data.secondOption.choice)
									return next (new Error('خطا! انتخاب دوم و سوم شما نباید یکسان باشد'))						
							}
						}
						if (ctx.args.data.thirdOption.choice) {
							if (ctx.args.data.firstOption.choice === ctx.args.data.thirdOption.choice)
								return next (new Error('انتخاب اول و سوم شما نباید یکسان باشد'))					
						}
					}

					var totalCount = 0
					if (choiceInst.firstOption.choice) {
						if (choiceInst.firstOption.choice !== ctx.args.data.firstOption.choice)
							return next(new Error('خطا! شما نمیتوانید انتخاب اول خود را تغییر دهید'))
						else {
							ctx.args.data.firstOption.byEdit = false
							ctx.args.data.firstOption.point = choiceInst.firstOption.point
							ctx.args.data.firstOption.status = choiceInst.firstOption.status
						}
					}
					if (choiceInst.secondOption.choice) {
						if (choiceInst.secondOption.choice !== ctx.args.data.secondOption.choice)
							return next(new Error('خطا! شما نمیتوانید انتخاب دوم خود را تغییر دهید'))
						else {
							ctx.args.data.secondOption.byEdit = false
							ctx.args.data.secondOption.point = choiceInst.secondOption.point
							ctx.args.data.secondOption.status = choiceInst.secondOption.status
						}
					}
					else {
						if (ctx.args.data.secondOption.choice) {
							totalCount++							
							for (var i = 0; i < exactInst.selectors.length; i++) {
								var model = exactInst.selectors[i]
								if (ctx.args.data.secondOption.choice === model.choice) {
									ctx.args.data.secondOption.point = Number(model.point.second)
									ctx.args.data.secondOption.status = statusConfig.open
									ctx.args.data.secondOption.byEdit = true
								}
							}			
						}
					}
					if (choiceInst.thirdOption.choice) {
						if (choiceInst.thirdOption.choice !== ctx.args.data.thirdOption.choice)
							return next(new Error('خطا! شما نمیتوانید انتخاب سوم خود را تغییر دهید'))
						else {
							ctx.args.data.thirdOption.byEdit = false
							ctx.args.data.thirdOption.point = choiceInst.thirdOption.point
							ctx.args.data.thirdOption.status = choiceInst.thirdOption.status
						}
					}
					else {
						if (ctx.args.data.thirdOption.choice) {
							totalCount++							
							for (var i = 0; i < exactInst.selectors.length; i++) {
								var model = exactInst.selectors[i]
								if (ctx.args.data.thirdOption.choice === model.choice) {
									ctx.args.data.thirdOption.point = Number(model.point.third)
									ctx.args.data.thirdOption.status = statusConfig.open
									ctx.args.data.thirdOption.byEdit = true
								}
							}			
						}
					}

					if (Number(clientInst.accountInfoModel.chances) <= 0)
						return next(new Error('خطا! فرصت‌های شما برای پیش‌بینی تمام شده‌است'))
					if (Number(clientInst.accountInfoModel.chances) < totalCount)
						return next(new Error('خطا! فرصت‌های شما برای پیش‌بینی کافی‌ نیست'))			

					ctx.args.data.status = choiceInst.status
					ctx.args.data.topic = choiceInst.topic
					ctx.args.data.leagueName = choiceInst.leagueName

					return next()
				})
			})			
		})
	})

  choice.afterRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		var exact = app.models.exact
		client.findById(modelInstance.clientId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
			if (!clientInst)
				return next(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
			exact.findById(modelInstance.exactId.toString(), function(err, exactInst) {
				if (err)
					return next(err)
				if (!exactInst)
					return next(new Error('خطا! پیش‌بینی قطعی‌ای با این مشخصات وجود ندارد'))
				var totalCount = 0
				if (modelInstance.firstOption.choice)
					totalCount++
				if (modelInstance.secondOption.choice)
					totalCount++
				if (modelInstance.thirdOption.choice)
					totalCount++
				var newChances = Number(clientInst.accountInfoModel.chances) - totalCount
				var newTotalChoices = Number(clientInst.accountInfoModel.totalChoices) + totalCount
				clientInst.accountInfo.update({'chances': newChances, 'totalChoices': newTotalChoices}, function(err, instance) {
					if (err)
						return next(err)
					modelInstance.clientRel(clientInst)
					modelInstance.exactRel(exactInst)
					return next()					
				})
			})
		})
	})

  choice.afterRemote('replaceById', function (ctx, modelInstance, next) {
		var client = app.models.client
		var exact = app.models.exact
		client.findById(modelInstance.clientId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
			if (!clientInst)
				return next(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
			exact.findById(modelInstance.exactId.toString(), function(err, exactInst) {
				if (err)
					return next(err)
				if (!exactInst)
					return next(new Error('خطا! پیش‌بینی قطعی‌ای با این مشخصات وجود ندارد'))
				var totalCount = 0
				if (modelInstance.firstOption.choice && modelInstance.firstOption.byEdit)
					totalCount++
				if (modelInstance.secondOption.choice && modelInstance.secondOption.byEdit)
					totalCount++
				if (modelInstance.thirdOption.choice && modelInstance.thirdOption.byEdit)
					totalCount++
				var newChances = Number(clientInst.accountInfoModel.chances) - totalCount
				var newTotalChoices = Number(clientInst.accountInfoModel.totalChoices) + totalCount
				clientInst.accountInfo.update({'chances': newChances, 'totalChoices': newTotalChoices}, function(err, instance) {
					if (err)
						return next(err)
					return next()					
				})
			})
		})
	})

}
