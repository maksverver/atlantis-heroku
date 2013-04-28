"use strict"

function CustomEventSource()
{
    var handlers = {}

    function emit()
    {
        var type = arguments[0]
        if (type)
        {
            var funcs = handlers[type]
            if (funcs)
            {
                var args = []
                for (var i = 1; i < arguments.length; ++i)
                {
                    args.push(arguments[i])
                }
                funcs = funcs.slice()
                for (var i = 0; i < funcs.length; ++i)
                {
                    funcs[i].apply(null, args)
                }
            }
        }
    }

    function addHandler(type, callback)
    {
        if (type && callback)
        {
            if (!handlers[type]) handlers[type] = []
            handlers[type].push(callback)
        }
    }

    function removeHandler(type, callback)
    {
        if (type && callback)
        {
            var h = handlers[type]
            if (h)
            {
                for (var i = 0; i < h.length; ++i)
                {
                    if (h[i] === callback) h.splice(i--, 1)
                }
            }
        }
    }

    return { emit:          emit,
             addHandler:    addHandler,
             removeHandler: removeHandler }
}

module.exports = CustomEventSource