import OneDrive from './OneDrive'
import {getList} from "./storage";

String.prototype.trims = function (c) {
    const re = new RegExp("^[" + c + "]+|[" + c + "]+$", "g");
    return this.replace(re, "");
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})


async function handleRequest(request) {
    const {pathname, searchParams, origin} = new URL(request.url)
    if (pathname.includes('favicon')) {
        return Response.redirect('https://dash.cloudflare.com/favicon.ico', 301)
    }

    const oneDrive = new OneDrive()
    oneDrive.query = searchParams
    oneDrive.host = origin

    try {
        if (pathname.includes('init')) {
            const oauth = await oneDrive.authorize()
            return handlerResponse(oauth)
        }
        if (pathname.includes('code')) {
            const data = await oneDrive.authorize_token(pathname.trims('/'))
            return handlerResponse(data)
        }

        if (pathname.length <= 0 || pathname === '/') {
            const driveList = await getList()
            if (driveList.length <= 0) {
                return handlerResponse(null, 1, 'No Drive')
            }
            return Response.redirect(`${origin}/${driveList[0].name}/`, 301)
        }

        let match = pathname.match(/^\/([^\/]+)$/)
        if (null === match) {
            match = pathname.match(/\/([^\/]+)?(.+)/i)
        }
        await oneDrive._init(match[1])

        let data = {}
        let action = searchParams.get('a')
        if (action) {
            const filePath = searchParams.get('filePath')
            if (action === 'delete') {
                data = await oneDrive.deleteFile(filePath)
            } else if (action === 'upload') {
                data = await oneDrive.upload(filePath, request.body)
            }
        } else {
            if (pathname.endsWith('/') || match.length === 2) {
                const page = request.headers.get('page')
                data = await oneDrive.getFileList(match.length === 2 ? '' : match[2].trims('/'), page)
            } else {
                data = await oneDrive.getFile(match[2])
            }
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
