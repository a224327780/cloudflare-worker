import OneDrive from './OneDrive'

String.prototype.trims = function (c) {
    const re = new RegExp("^[" + c + "]+|[" + c + "]+$", "g");
    return this.replace(re, "");
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event))
})

const driveId = 'tuchuang'

async function handleRequest(event) {
    const request = event.request
    const {pathname, searchParams, origin} = new URL(request.url)
    if (pathname.includes('favicon')) {
        return Response.redirect('https://dash.cloudflare.com/favicon.ico', 301)
    }

    const oneDrive = new OneDrive()
    oneDrive.query = searchParams
    oneDrive.host = origin

    try {
        await oneDrive._init(driveId)

        const a = searchParams.get('a')
        if (a === 'upload') {
            let data = await oneDrive.upload(searchParams.get('filePath'), request.body)
            return handlerResponse(data)
        }

        let path = pathname.trims('/')
        let data = {}
        if (path.length > 0) {
            data = await oneDrive.getFile(path)
        }
        return handlerResponse(data)
    } catch (e) {
        const stack = e.toString()
        return handlerResponse(null, 1, stack)
    }
}

function handlerResponse(data, code, message) {
    const result = {
        'code': code || 0,
        'data': data || [],
        'message': message || 'ok',
    }
    const json = JSON.stringify(result, null, 4)
    return new Response(json, {
        headers: {'content-type': 'application/json;charset=UTF-8'},
    })
}
