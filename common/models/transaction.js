var app = require('../../server/server')
var utility = require('../../public/utility')
var roleManager = require('../../public/roleManager')

var statusConfig = require('../../config/transactionStatus.json')

module.exports = function(transaction) {

	var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

	transaction.validatesInclusionOf('status', {in: statusList})

  transaction.afterRemote('create', function (ctx, modelInstance, next) {
		var client = app.models.client
		var package = app.models.package
		client.findById(ctx.args.data.clientId.toString(), function(err, clientInst) {
			if (err)
				return next(err)
      if (!clientInst)
        return next(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
			package.findById(ctx.args.data.packageId.toString(), function(err, packageInst) {
				if (err)
					return next(err)
				if (!packageInst)
					return next(new Error('خطا! پکیجی با این مشخصات وجود ندارد'))	
				modelInstance.clientRel(clientInst)
				modelInstance.packageRel(packageInst)
				if (modelInstance.status === statusConfig.successful) {
					var newChances = Number(clientInst.accountInfoModel.chances) + Number(packageInst.chances)
					clientInst.accountInfo.update({'chances': newChances}, function(err, instance) {
						if (err)
							return next(err)
						transaction.find({where:{'clientId': clientInst.id.toString(), 'status': statusConfig.successful}, limit: 50000}, function(err, transactionList) {
							if (err)
								return next(err)
							if (transactionList.length == 1 && clientInst.referrer) {
								client.findById(clientInst.referrer.toString(), function(err, referrerInst) {
									if (err)
										return next(err)
									if (!referrerInst)
										return next()
									var newReferrerChances = Number(referrerInst.accountInfoModel.chances) + 5
									referrerInst.accountInfo.update({'chances': newReferrerChances}, function(err, result) {
										if (err)
											return next(err)
										return next()
									})
								})
							} else {
								return next()
							}
						})
					})
				}
				else {
					return next()
				}
			})
		})
	})
	
}
