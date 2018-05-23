var utility	= require('../../public/utility')
var request = require('request')

var statusConfig = require('../../config/verificationStatus.json')

function requestToBackend(url, verb, payload, callback) {
  var options = {
    method: verb,
    url: url,
    preambleCRLF: true,
    postambleCRLF: true,
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json'
    },
    body: JSON.stringify(payload)
  }

  request(options, function (error, response, body) {
    if (error || response.statusCode >= 400)
      return callback(error, null)
    return callback(null, JSON.parse(body))
  })
}

function postRequest (url, body, callback) {
	requestToBackend(url, 'POST', body, function (err, result) {
		if (err)
			return callback(err, null) 
		return callback(null, result)
	})
}

function getRequest(url, callback) {
  request.get(url)
    .on('data', function (data) {
      callback(null, data)
    })
    .on('error', function (err) {
      console.log(err)
      callback(err, null)
    })
}

module.exports = function(verification) {

	var baseURL = 'https://api.kavenegar.com/v1/@/verify/lookup.json'
	var token = ''

	var begURL = baseURL.replace('@', token)

  var statusList = []
  for (var key in statusConfig) 
    statusList.push(statusConfig[key])

	verification.validatesInclusionOf('status', {in: statusList})

	function getRandomInt(min, max) {
		min = Math.ceil(min)
		max = Math.floor(max)
		return Math.floor(Math.random() * (max - min)) + min
	}

	function sendSMS(phoneNumber, randNumb, callback) {
		var data = {
			'receptor': phoneNumber,
			'token': randNumb,
			'template': 'VerificationNo1'
		}
		var url = begURL + '?' + utility.generateQueryString(data)
		getRequest(url, function(err, result) {
			if (err)
				return callback(err, null)
			return callback(null, result)
		})
	}

	function sendFailureSMS(phoneNumber, randNumb, callback) {
		var data = {
			'receptor': phoneNumber,
			'token': randNumb,
			'template': 'VerificationNo2'
		}
		var url = begURL + '?' + utility.generateQueryString(data)
		getRequest(url, function(err, result) {
			if (err)
				return callback(err, null)
			return callback(null, result)
		})
	}

	function sendPasswordSMS(phoneNumber, message, callback) {
		var base = 'https://api.kavenegar.com/v1/@/sms/send.json'
		var beg = base.replace('@', token)
		var data = {
			'receptor': phoneNumber,
			'message': message
		}
		var url = beg + '?' + utility.generateQueryString(data)
		getRequest(url, function(err, result) {
			if (err)
				return callback(err, null)
			return callback(null, result)
		})
	}
	
	function checkExistance(phoneNumber, callback) {
		verification.find({'where':{'phoneNumber': phoneNumber}, limit: 50000}, function(err, result) {
			if (err)
				return callback(err, null)
			if (result.length <= 0)
				return callback(null, null)
			else
				return callback(null, result[0])
		})
	}

	function sendVerificationAlgorithm(phoneNumber, isNew, verif, callback) {
		checkExistance(phoneNumber, function(err, result) {
			if (err)
				return callback(err, null)
			if (!result) {
				if (isNew) {
					createVerification(phoneNumber, verif, function(err, result) {
						if (err)
							return callback(err, null)
						sendSMS(phoneNumber, verif, function(err, result) {
							if (err)
								return callback(err, null)
							return callback(null, result)
						})
					})	
				}
				else
					return callback(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
			}
			else if (result.status === statusConfig.verified)
				return callback(null, 'already verified')
			else {
				result.updateAttribute('verificationNumber', verif, function(err, result) {
					if (err)
						return callback(err, null)
					sendSMS(phoneNumber, verif, function(err, result) {
						if (err)
							return callback(err, null)
						return callback(null, result)
					})
				})
			}
		})
	}

	function createVerification(phoneNumber, verif, callback) {
		verification.create({'phoneNumber': phoneNumber, 'verificationNumber': verif, 'status': statusConfig.pending}, function(err, result) {
			if (err)
				return callback(err, null)
			return callback(null, result)
		})
	}

	function doVerificationAlgorithm(phoneNumber, verif, callback) {
		checkExistance(phoneNumber, function(err, result) {
			if (err)
				return callback(err, null)
			if (!result)
				return callback(new Error('خطا! کاربری با این مشخصات وجود ندارد'))
			else if (result.status === statusConfig.verified)
				return callback(new Error('خطا! این کاربر قبلا احراز هویت شده است'))
			else {
				if (result.verificationNumber === verif) {
					result.updateAttribute('status', statusConfig.verified, function(err, result) {
						if (err)
							return callback(err, null)
						return callback(null, result)
					})					
				}
				else 
					return callback(new Error('خطا! کد احراز هویت غلط است'))
			}
		})
	}

  verification.sendVerification = function (phoneNumber, callback) {
		var rand = getRandomInt(1250, 9999)
		sendVerificationAlgorithm(phoneNumber, true, rand, function(err, response) {
			if (err)
				return callback(err, null)
			return callback(null, response)
		})
  }

  verification.remoteMethod('sendVerification', {
    accepts: [{
      arg: 'phoneNumber',
      type: 'string',
      http: {
        source: 'path'
      }
    }],
    description: 'send verification sms to user',
    http: {
      path: '/:phoneNumber/sendVerification',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'object',
      root: true
    }
  })

  verification.resendVerification = function (phoneNumber, callback) {
		var rand = getRandomInt(1250, 9999)
		sendVerificationAlgorithm(phoneNumber, false, rand, function(err, response) {
			if (err)
				return callback(err, null)
			return callback(null, response)
		})
  }

  verification.remoteMethod('resendVerification', {
    accepts: [{
      arg: 'phoneNumber',
      type: 'string',
      http: {
        source: 'path'
      }
    }],
    description: 'send verification sms to user',
    http: {
      path: '/:phoneNumber/resendVerification',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'object',
      root: true
    }
  })

  verification.verify = function (phoneNumber, verifyNumber, callback) {
		doVerificationAlgorithm(phoneNumber, verifyNumber, function(err, response) {
			if (err)
				return callback(err, null)
			return callback(null, response)			
		})
  }

  verification.remoteMethod('verify', {
    accepts: [{
      arg: 'phoneNumber',
      type: 'string',
      http: {
        source: 'path'
      }
    }, {
      arg: 'verifyNumber',
      type: 'string',
      http: {
        source: 'path'
      }
    }],
    description: 'verify user phone number by sent verification number',
    http: {
      path: '/:phoneNumber/verify/:verifyNumber',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'object',
      root: true
    }
  })

	verification.checkUserVerification = function (phoneNumber, callback) {
		checkExistance(phoneNumber, function(err, result) {
			if (err)
				return callback(err, null)
			if (!result)
				return callback(null, 0)
			else {
				if (result.status === statusConfig.pending)
					return callback(null, 1)
				else if (result.status === statusConfig.verified)
					return callback(null, 2)
			}
		})
  }

  verification.remoteMethod('checkUserVerification', {
    accepts: [{
      arg: 'phoneNumber',
      type: 'string',
      http: {
        source: 'path'
      }
    }],
    description: 'check user verification latest status',
    http: {
      path: '/checkUserVerification/:phoneNumber',
      verb: 'GET',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'number',
      root: true
    }
  })

	verification.sendPassword = function(phoneNumber, password, callback) {
		var string = 'پسورد شما در ۶قدم:' + '\n' + password
		sendPasswordSMS(phoneNumber, string, function(err, result) {
			if (err)
				return callback(err, null)
			return callback(null, result)			
		})
	}
	
  verification.resendPendingVerification = function (callback) {
		verification.find({where:{"status": statusConfig.pending}, limit: 50000}, function(err, verifyList) {
			if (err)
				return callback(err, null)
			var counter = 0
			for (var i = 0; i < verifyList.length; i++) {
				var model = verifyList[i]
				sendFailureSMS(model.phoneNumber, model.verificationNumber, function(err, result) {
					if (err)
						return callback(err, null)
					counter++
					if (counter == verifyList.length)
						return callback(null, counter.toString() + ' models send')
				})
			}
		})
	}

  verification.remoteMethod('resendPendingVerification', {
    accepts: [],
    description: 'resending verification number to all pending user phone number',
    http: {
      path: '/resendPendingVerification',
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
