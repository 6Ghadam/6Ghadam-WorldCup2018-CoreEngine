module.exports = function(team) {
  team.validatesUniquenessOf('code', {
    message: 'code is not unique'
	})
}
