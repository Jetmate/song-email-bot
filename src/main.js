import express from 'express'
import path from 'path'
import fs from 'fs'
import querystring from 'querystring'
import nodeSchedule from 'node-schedule'
import request from 'request'

const WWW = path.join(__dirname, '../www')
let clientSecret, clientId, USER, PLAYLIST
fs.readFile(path.join(__dirname, '../client_info.json'), 'utf8', (err, data) => {
  if (err) throw err
  const results = JSON.parse(data)
  clientSecret = results.clientSecret
  clientId = results.clientId
  USER = results.user
  PLAYLIST = results.playlist
})
const redirectUri = 'http://0.0.0.0:4000/callback'

const app = express()
app.set('views', WWW)
const server = app.listen(4000, '0.0.0.0')
let job = new nodeSchedule.Job()

app.get('/', (req, res) => {
  let scope = 'playlist-read-private';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: clientId,
      scope: scope,
      redirect_uri: redirectUri
    })
  )
})

app.get('/callback', (req, res, next) => {
  const code = req.query.code

  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    },
    headers: {
      'Authorization': 'Basic ' + (new Buffer(clientId + ':' + clientSecret).toString('base64'))
    },
    json: true
  }

  request.post(authOptions, (err, resp, body) => {
    if (err) throw err
    console.log(2)

    const accessToken = body.access_token
    // job.schedule('0 20 * * 0', () => {
      main(accessToken)
    // })
  })

  res.sendFile('callback.html', { root: WWW })
})

function main(accessToken) {
  var options = {
    url: `https://api.spotify.com/v1/users/${USER}/playlists/${PLAYLIST}/tracks`,
    headers: { 'Authorization': 'Bearer ' + accessToken },
    json: true
  }

  request.get(options, function(err, res, body) {
    console.log(body);
  })
}


console.log('RUNNING ON http://0.0.0.0:4000/')
