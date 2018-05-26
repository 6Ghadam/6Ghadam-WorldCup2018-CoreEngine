var utility = require('../../public/utility')
var userStatus = require('../../config/userStatus.json')

module.exports = function (app) {
  var mongoDs = app.dataSources.mongoDs

  var User = app.models.client
  var Role = app.models.Role
  var RoleMapping = app.models.RoleMapping

	var time = utility.getUnixTimeStamp()
	var status = userStatus.available

  var users = [{
      username: 'alireza',
      email: 'ceo@6ghadam.com',
      password: '6GhadamPass',
			fullname: '6Ghadam Admin',
      time: time,
      status: status,
      emailVerified: true,
      phoneNumber: '09120001122'
    },
    {
      username: 'support',
      email: 'support@6ghadam.com',
      password: '6GhadamSupport1Pass',
			fullname: '6Ghadam Support',
      time: time,
      status: status,
      emailVerified: true,
      phoneNumber: '09120001122'
    }
  ]

  function createRoles(users) {
    console.log('creaingRoles')
    var role1 = {
      name: 'founder'
    }

    Role.create(role1, function (err, role) {
      if (err)
        throw err
      role.principals.create({
        principalType: RoleMapping.USER,
        principalId: users[0].id
      }, function (err, principal) {
        if (err)
          throw err
      })
    })

    var role2 = {
      name: 'admin'
    }
    Role.create(role2, function (err, role) {
      if (err)
        throw err
      role.principals.create({
        principalType: RoleMapping.USER,
        principalId: users[1].id
      }, function (err, principal) {
        if (err)
          throw err
      })
    })
  }

  User.find({'where': {'phoneNumber': '09120001122'}}, function(err, result) {
    if (err)
      throw err
    if (!result) {
      User.create(users, function (err, users) {
        if (err)
          throw err 
        createRoles(result)
      })
    }
  })

}
