function getUid(len = 20) {
    const timestamp = (new Date()).getTime().toString(36);
    const randomString = (len) => [...Array(len)].map(_ => Math.random().toString(36)[3]).join('');
    len = len - (timestamp.length + 1);
    return `${timestamp}-${randomString(len)}`;
}

module.exports = getUid;