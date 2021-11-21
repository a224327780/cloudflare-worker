export async function getList() {
    return (await ONE_INDEX.list()).keys
}

export async function get(key) {
    return await ONE_INDEX.get(key, 'json')
}

export async function put(key, value) {
    return await ONE_INDEX.put(key, value)
}