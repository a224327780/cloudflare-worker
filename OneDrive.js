import {get, put} from "./storage";

const timestamp = () => {
    return Math.floor(Date.now() / 1000)
}

const getDate = () => {
    const d = new Date(new Date().getTime() + (parseInt(new Date().getTimezoneOffset() / 60) + 8) * 3600 * 1000)
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDay()} ${d.getHours()}:${d.getMinutes()}:${d.getMilliseconds()}`
}


class OneDrive {

    constructor() {
        this.base_api = 'https://graph.microsoft.com/v1.0'
        this.token_url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
        this.auth_url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
        this.redirect_uri = 'https://oauth.atcaoyufei.workers.dev'
        this.scope = 'offline_access User.Read Sites.ReadWrite.All'
        this.config = {}
        this.query = new URLSearchParams()
        this.limit = this.query.get('limit') || 20
        this.host = ''
        this.file_fields = 'id, name, size, folder, audio, video, photo, image, lastModifiedDateTime'
        this.drivePath = this.getDrivePath()
    }

    async _init(driveId) {
        this.config = await get(driveId)
        if (this.config === null) {
            throw `Not Fount Drive ${driveId}`
        }
        if (timestamp() > this.config.expires_time) {
            await this.refreshToken()
        }
    }

    getDrivePath() {
        if (typeof this.config.siteId !== 'undefined') {
            return `/sites/${this.config.siteId}/drive/root`
        }
        return '/me/drive/root'
    }

    async upload(filePath, fileData) {
        return await this.api(`${this.drivePath}:/${filePath}:/content`, null, fileData, 'PUT')
    }

    async deleteFile(filePath) {
        return await this.api(`${this.drivePath}:/${filePath}`, null, null, 'DELETE')
    }

    async getFile(filePath) {
        return await this.api(`${this.drivePath}:/${filePath}`)
    }

    async getFileList(path, page = null) {
        if (page) {
            return await this.api(path)
        }
        const fields = this.query.get('fields') || this.file_fields
        let params = {
            select: fields,
            '$top': this.limit
        }
        const wd = this.query.get('wd')
        if (wd) {
            return await this.api(`${this.drivePath}/search(q='${wd}')`, params)
        }
        let dest = '/children'
        if (path.length > 1) {
            dest = `:/${path}:/children`
        }
        params['$expand'] = 'thumbnails($select=large)'
        return await this.api(`${this.drivePath}${dest}`, params)
    }

    async getDrive() {
        let api = null
        if (this.config.driveType === 'OneDrive') {
            api = '/me/drive'
        } else {
            api = `/sites/${this.config.siteId}/drive`
        }
        return await this.api(api)
    }

    async refreshToken() {
        const body = {
            refresh_token: this.config.refresh_token,
            grant_type: 'refresh_token',
            client_id: this.config.client_id,
            client_secret: this.config.client_secret,
            redirect_uri: this.redirect_uri,
            scope: this.scope
        }
        const data = await this.api(this.token_url, null, body)

        this.config['access_token'] = data['access_token']
        this.config['expires_time'] = timestamp() + 3500
        this.config['update_date'] = getDate();
        if (data.refresh_token) {
            this.config['refresh_token'] = data['refresh_token']
        }
        const driveData = await this.getDrive()

        this.config['drive_id'] = driveData.id
        this.config['total'] = driveData.quota.total
        this.config['used'] = driveData.quota.used
        this.config['remaining'] = driveData.quota.remaining
        this.config['username'] = driveData.owner.user.email

        return await put(this.config['driveId'], JSON.stringify(this.config))
    }

    async api(url, params = null, body = null, method = 'GET') {
        if (!url.includes('http')) {
            url = `${this.base_api.trims('/')}/${url.trims('/')}`
        }
        if (params) {
            url = `${url}?${new URLSearchParams(params).toString()}`
        }
        let headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
        if (this.config.access_token) {
            headers['Authorization'] = `Bearer ${this.config.access_token}`
        }
        let init = {
            method: method,
            headers: headers,
        }
        if (body) {
            if (method === 'GET') {
                init['method'] = 'POST'
            }
            if (body.constructor === Object) {
                init['body'] = new URLSearchParams(body).toString()
            } else {
                init['body'] = body
            }
        }
        const response = await fetch(url, init)
        if (response.ok) {
            if (response.status === 204) {
                return {'status_code': response.status}
            }
            return await response.json()
        }
        throw `request ${url} error ${JSON.stringify(await response.text())}`
    }

    async authorize() {
        const driveId = this.query.get('id')
        const driveName = this.query.get('name')
        const client_id = this.query.get('client_id')
        const driveType = this.query.get('drive_type') || 'OneDrive'
        const client_secret = this.query.get('client_secret')

        let params = {
            client_id: client_id,
            redirect_uri: this.redirect_uri,
            scope: this.scope
        }

        if (client_id && client_secret && driveId) {
            await put(driveId, JSON.stringify(Object.assign({}, params, {
                name: driveName,
                client_secret: client_secret,
                driveType: driveType,
                driveId: driveId,
                siteId: ''
            })))
        }

        params['prompt'] = 'consent'
        params['state'] = `${this.host}/code/${driveId}`
        params['response_type'] = 'code'

        const searchParams = new URLSearchParams(params)
        return `${this.auth_url}?${searchParams.toString()}`
    }

    async authorize_token(pathname) {
        const driveId = pathname.split('/')[1]
        this.config = await get(driveId)

        const params = {
            code: this.query.get('code'),
            grant_type: 'authorization_code',
            client_id: this.config.client_id,
            client_secret: this.config.client_secret,
            redirect_uri: this.redirect_uri,
            scope: this.scope
        }
        console.log(params)
        let data = await this.api(this.token_url, null, params)

        this.config['expires_time'] = timestamp() + 3500
        this.config['access_token'] = data['access_token']
        this.config['refresh_token'] = data['refresh_token']
        this.config['update_date'] = getDate();

        await put(driveId, JSON.stringify(this.config))
        return data
    }
}

export default OneDrive