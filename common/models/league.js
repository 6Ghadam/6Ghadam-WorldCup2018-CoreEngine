var app = require('../../server/server')
var utility = require('../../public/utility')
var roleManager = require('../../public/roleManager')

module.exports = function(league) {

	league.beforeRemote('create', function (ctx, modelInstance, next) {
		var requiredList = ['name']
    if (!utility.requiredChecker(ctx.args.data, requiredList))
			return next(new Error('Required Parameters'))
		var whiteList = ['name']
		if (!utility.whiteChecker(ctx.args.data, whiteList))
			return next(new Error('White Parameters'))
		return next()
	})

	league.beforeRemote('updateById', function (ctx, modelInstance, next) {
		var requiredList = ['name']
    if (!utility.requiredChecker(ctx.args.data, requiredList))
			return next(new Error('Required Parameters'))
		var whiteList = ['name']
		if (!utility.whiteChecker(ctx.args.data, whiteList))
			return next(new Error('White Parameters'))
		return next()
	})

	league.afterRemote('updateById', function (ctx, modelInstance, next) {
		var identifier = modelInstance.id.toString()
		var team = app.models.team
		team.updateAll({'leagueId': identifier}, {'leagueName': modelInstance.name}, function(err, updatedList){
			if (err)
				return next(err)
			var coach = app.models.coach
			coach.updateAll({'leagueId': identifier}, {'leagueName': modelInstance.name}, function(err, updatedList){
				if (err)
					return next(err)
				var player = app.models.player
				player.updateAll({'leagueId': identifier}, {'leagueName': modelInstance.name}, function(err, updatedList){
					if (err)
						return next(err)
					return next()
				})			
			})
		})
	})

	league.afterRemote('deleteById', function (ctx, modelInstance, next) {
		var identifier = ctx.ctorArgs.id.toString()
		var team = app.models.team
		team.destroyAll({'leagueId': identifier}, function(err, destroyedList){
			if (err)
				return next(err)
			var coach = app.models.coach
			coach.destroyAll({'leagueId': identifier}, function(err, destroyedList){
				if (err)
					return next(err)
				var player = app.models.player
				player.destroyAll({'leagueId': identifier}, function(err, destroyedList){
					if (err)
						return next(err)
					return next()
				})
			})
		})
	})

	league.beforeRemote('prototype.__create__teams', function (ctx, modelInstance, next) {
		ctx.args.data.leagueId = ctx.req.params.id.toString()
		var requiredList = ['name', 'code', 'leagueId']
    if (!utility.requiredChecker(ctx.args.data, requiredList))
			return next(new Error('Required Parameters'))
		var whiteList = ['name', 'code', 'leagueId']
		if (!utility.whiteChecker(ctx.args.data, whiteList))
			return next(new Error('White Parameters'))
		league.findById(ctx.args.data.leagueId.toString(), function(err, leagueModel) {
			if (err)
				return next(err)
			if (!leagueModel)
				return next(new Error('League Model Does not Exist'))
			ctx.args.data.leagueName = leagueModel.name
			return next()
		})
	})

	league.afterRemote('prototype.__create__teams', function (ctx, modelInstance, next) {
		league.findById(modelInstance.leagueId.toString(), function(err, leagueInst) {
			if (err)
				return next(err)
			if (!leagueInst)
				return next(new Error('League Model Does not Exist'))
			modelInstance.leagueRel(leagueInst)	
			return next()
		})	
	})

	league.beforeRemote('prototype.__updateById__teams', function (ctx, modelInstance, next) {
		var requiredList = ['name', 'code']
    if (!utility.requiredChecker(ctx.args.data, requiredList))
			return next(new Error('Required Parameters'))
		var whiteList = ['name', 'code']
		if (!utility.whiteChecker(ctx.args.data, whiteList))
			return next(new Error('White Parameters'))
		return next()
	})

	league.afterRemote('prototype.__deleteById__teams', function (ctx, modelInstance, next) {
		var identifier = ctx.ctorArgs.id.toString()
		var coach = app.models.coach
		coach.destroyAll({'teamId': identifier}, function(err, destroyedList){
			if (err)
				return next(err)
			var player = app.models.player
			player.destroyAll({'teamId': identifier}, function(err, destroyedList){
				if (err)
					return next(err)
				return next()
			})
		})
	})

	league.beforeRemote('prototype.__create__coaches', function (ctx, modelInstance, next) {
		ctx.args.data.leagueId = ctx.req.params.id.toString()
		var requiredList = ['name', 'leagueId', 'teamId']
    if (!utility.requiredChecker(ctx.args.data, requiredList))
			return next(new Error('Required Parameters'))
		var whiteList = ['name', 'leagueId', 'teamId']
		if (!utility.whiteChecker(ctx.args.data, whiteList))
			return next(new Error('White Parameters'))
		league.findById(ctx.args.data.leagueId.toString(), function(err, leagueModel) {
			if (err)
				return next(err)
			if (!leagueModel)
				return next(new Error('League Model Does not Exist'))
			ctx.args.data.leagueName = leagueModel.name
			var team = app.models.team
			team.findById(ctx.args.data.teamId.toString(), function(err, teamModel) {
				if (err)
					return next(err)
				if (!teamModel)
					return next(new Error('Team Model Does not Exist'))
				if (leagueModel.id.toString() !== teamModel.leagueId.toString())
					return next(new Error('Team Does not Belong to This League'))
				ctx.args.data.teamName = teamModel.name
				return next()
			})
		})
	})

	league.afterRemote('prototype.__create__coaches', function (ctx, modelInstance, next) {
		league.findById(modelInstance.leagueId.toString(), function(err, leagueInst) {
			if (err)
				return next(err)
			if (!leagueInst)
				return next(new Error('League Model Does not Exist'))
			var team = app.models.team
			team.findById(modelInstance.teamId.toString(), function(err, teamInst) {
				if (err)
					return next(err)
				if (!teamInst)
					return next(new Error('Team Model Does not Exist'))
				modelInstance.leagueRel(leagueInst)
				modelInstance.teamRel(teamInst)
				return next()
			})		
		})
	})

	league.beforeRemote('prototype.__updateById__coaches', function (ctx, modelInstance, next) {
		var requiredList = ['name', 'teamId']
    if (!utility.requiredChecker(ctx.args.data, requiredList))
			return next(new Error('Required Parameters'))
		var whiteList = ['name', 'teamId']
		if (!utility.whiteChecker(ctx.args.data, whiteList))
			return next(new Error('White Parameters'))
		return next()
	})

	league.beforeRemote('prototype.__create__players', function (ctx, modelInstance, next) {
		ctx.args.data.leagueId = ctx.req.params.id.toString()
		var requiredList = ['name', 'leagueId', 'teamId']
    if (!utility.requiredChecker(ctx.args.data, requiredList))
			return next(new Error('Required Parameters'))
		var whiteList = ['name', 'leagueId', 'teamId']
		if (!utility.whiteChecker(ctx.args.data, whiteList))
			return next(new Error('White Parameters'))
		league.findById(ctx.args.data.leagueId.toString(), function(err, leagueModel) {
			if (err)
				return next(err)
			if (!leagueModel)
				return next(new Error('League Model Does not Exist'))
			ctx.args.data.leagueName = leagueModel.name
			var team = app.models.team
			team.findById(ctx.args.data.teamId.toString(), function(err, teamModel) {
				if (err)
					return next(err)
				if (!teamModel)
					return next(new Error('Team Model Does not Exist'))
				if (leagueModel.id.toString() !== teamModel.leagueId.toString())
					return next(new Error('Team Does not Belong to This League'))
				ctx.args.data.teamName = teamModel.name
				return next()
			})
		})
	})

	league.afterRemote('prototype.__create__players', function (ctx, modelInstance, next) {
		league.findById(modelInstance.leagueId.toString(), function(err, leagueInst) {
			if (err)
				return next(err)
			if (!leagueInst)
				return next(new Error('League Model Does not Exist'))
			var team = app.models.team
			team.findById(modelInstance.teamId.toString(), function(err, teamInst) {
				if (err)
					return next(err)
				if (!teamInst)
					return next(new Error('Team Model Does not Exist'))
				modelInstance.leagueRel(leagueInst)
				modelInstance.teamRel(teamInst)
				return next()
			})		
		})
	})

	league.beforeRemote('prototype.__updateById__players', function (ctx, modelInstance, next) {
		var requiredList = ['name', 'teamId']
    if (!utility.requiredChecker(ctx.args.data, requiredList))
			return next(new Error('Required Parameters'))
		var whiteList = ['name', 'teamId']
		if (!utility.whiteChecker(ctx.args.data, whiteList))
			return next(new Error('White Parameters'))
		return next()
	})

}
