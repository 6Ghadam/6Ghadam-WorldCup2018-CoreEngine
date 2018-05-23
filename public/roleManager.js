var _ = require('underscore')

module.exports = {
  getRolesById: function (app, id, cb) {
    var RoleMapping = app.models.RoleMapping
    var Role = app.models.Role
    RoleMapping.find({
      where: {
        principalId: id
      }
    }, function (err, roleMappings) {
      if (!roleMappings.length) {
        return cb(null, {
          "roles": []
        });
      }
      var roleIds = _.uniq(roleMappings
        .map(function (roleMapping) {
          return roleMapping.roleId
        }))
      var conditions = roleIds.map(function (roleId) {
        return {
          id: roleId
        }
      })
      Role.find({
        where: {
          or: conditions
        }
      }, function (err, roles) {
        if (err)
          console.error(err)
        var roleNames = roles.map(function (role) {
          return role.name
        })
        cb(null, {
          "roles": roleNames
        })
      })
    })
  }
}
