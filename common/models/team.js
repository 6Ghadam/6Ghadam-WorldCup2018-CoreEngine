var app = require('../../server/server')
var utility = require('../../public/utility')
var roleManager = require('../../public/roleManager')

module.exports = function(team) {
  team.validatesUniquenessOf('code', {
    message: 'code is not unique'
  })
  
  team.selectFavorite = function (ctx, clientId, teamId, cb) {
		var client = app.models.client
    client.findById(clientId.toString(), function (err, clientInst) {
      if (err)
        return cb(err)
      if (!clientInst)
        return cb(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
      team.findById(teamId.toString(), function (err, teamInst) {
        if (err)
					return cb(err)
        if (!teamInst)
          return cb(new Error('خطا! تیم معتبری با این مشخصات وجود ندارد'))  
        clientInst.updateAttribute('teamId', teamId.toString(), function (err, result) {
					if (err)
						return cb(err)
					return cb(null, result)
				})
      })
    })
  }

  team.remoteMethod('selectFavorite', {
    accepts: [{
      arg: 'ctx',
      type: 'object',
      http: {
        source: 'context'
      }
    }, {
      arg: 'clientId',
      type: 'string',
      http: {
        source: 'path'
      },
    }, {
      arg: 'teamId',
      type: 'string',
      http: {
        source: 'path'
      },
    }],
    description: 'join a client to a particular favorite team',
    http: {
      path: '/:clientId/selectFavorite/:teamId',
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
