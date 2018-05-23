var columnify = require('columnify')
var columnsOptins = {
  showHeaders: false,
  minWidth: 35,
  columnSplitter: ' |    '
}

const relationMethodPrefixes = [
  'prototype.__findById__',
  'prototype.__destroyById__',
  'prototype.__updateById__',
  'prototype.__exists__',
  'prototype.__link__',
  'prototype.__get__',
  'prototype.__create__',
  'prototype.__update__',
  'prototype.__destroy__',
  'prototype.__unlink__',
  'prototype.__count__',
  'prototype.__delete__'
]

function reportDisabledMethod(model, methods) {
  const joinedMethods = methods.join(', ')
  const modelName = 'Disabled Remote Model ' + model.sharedClass.name
  var data = {}
  data[modelName] = joinedMethods
  if (methods.length)
    console.log(columnify(data, columnsOptins))
}

module.exports = {
  /**
   * Options for methodsToDisable:
   * @param model
   * @param methodsToDisable array
   */
  disableOnlyTheseMethods(model, methodsToDisable) {
    methodsToDisable.forEach(function (method) {
      model.disableRemoteMethodByName(method)
    })
    reportDisabledMethod(model, methodsToDisable)
  },

  /**
   * Options for disableAllExcept:
   * @param model
   * @param methodsToEnable array
   */  
  disableAllExcept(model, methodsToExpose) {
    const
      excludedMethods = methodsToExpose || []
    var hiddenMethods = []

    if (model && model.sharedClass) {
      model.sharedClass.methods().forEach(disableMethod)
      Object.keys(model.definition.settings.relations).forEach(disableRelatedMethods)
    }

    function disableRelatedMethods(relation) {
      relationMethodPrefixes.forEach(function (prefix) {
        var methodName = prefix + relation

        disableMethod({
          name: methodName
        })
      })
    }

    function disableMethod(method) {
      var methodName = method.name

      if (excludedMethods.indexOf(methodName) < 0) {
        model.disableRemoteMethodByName(methodName)
        hiddenMethods.push(methodName)
      }
    }
  }
}
