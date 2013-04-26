function EventSource()
{
    var handlers = {}
    return {
        "emit": function() {
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
        },
        "addHandler": function(type, callback) {
            if (type && callback)
            {
                if (!handlers[type]) handlers[type] = []
                handlers[type].push(callback)
            }
        },
        "removeHandler": function(type, callback) {
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
    }
}
