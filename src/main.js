import express from 'express'
import path from 'path'
import fs from 'fs'
import querystring from 'querystring'
import nodeSchedule from 'node-schedule'
import request from 'request'
import nodemailer from 'nodemailer'

const WWW = path.join(__dirname, '../www')
let SPOTIFY_CLIENT_SECRET, SPOTIFY_CLIENT_ID, SPOTIFY_USERNAME, PLAYLIST, GMAIL_USERNAME, GMAIL_PASSWORD, EMAIL_RECIPIENT, EMAIL_SUBJECT, GMAIL_ACCESS_TOKENl, GMAIL_REFRESH_TOKEN, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_ACCESS_TOKEN
fs.readFile(path.join(__dirname, '../client_info.json'), 'utf8', (err, data) => {
  if (err) throw err
  const results = JSON.parse(data)
  SPOTIFY_CLIENT_SECRET = results.spotifyClientSecret
  SPOTIFY_CLIENT_ID = results.spotifyClientId
  SPOTIFY_USERNAME = results.spotifyUsername
  PLAYLIST = results.playlist

  GMAIL_USERNAME = results.gmailUsername
  GMAIL_ACCESS_TOKEN = results.gmailAccessToken
  GMAIL_REFRESH_TOKEN = results.gmailRefreshToken
  GMAIL_CLIENT_ID = results.gmailClientId
  GMAIL_CLIENT_SECRET = results.gmailClientSecret

  EMAIL_RECIPIENT = results.emailRecipient
  EMAIL_SUBJECT = results.emailSubject
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
      client_id: SPOTIFY_CLIENT_ID,
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
      'Authorization': 'Basic ' + (new Buffer(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'))
    },
    json: true
  }

  request.post(authOptions, (err, resp, body) => {
    if (err) throw err

    const accessToken = body.access_token
    const options = {
      url: `https://api.spotify.com/v1/users/${SPOTIFY_USERNAME}/playlists/${PLAYLIST}/tracks`,
      headers: { 'Authorization': 'Bearer ' + accessToken },
      json: true
    }

    request.get(options, function(err, res, body) {
      if (err) throw err

      const songs = body.items.map(element => element.track)
      let playedSongs = []
      // job.schedule('0 20 * * 0', () => {
        while (true) {
          const song = songs[Math.floor(Math.random() * songs.length)]
          if (!playedSongs.includes(song.name) && !song.explicit) {
            playedSongs.push(song.name)
            console.log(song.name, playedSongs)
            main(song)
            break
          }
        }
      // })
    })
  })

  res.sendFile('callback.html', { root: WWW })
})

function main(song) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: GMAIL_USERNAME,
      clientId: GMAIL_CLIENT_ID,
      clientSecret: GMAIL_CLIENT_SECRET,
      accessToken: GMAIL_ACCESS_TOKEN,
      refreshToken: GMAIL_REFRESH_TOKEN
    }
  })

  const messageOptions = {
    from: GMAIL_USERNAME,
    to: EMAIL_RECIPIENT,
    subject: EMAIL_SUBJECT,
    text: `
    Name:   ${song.name}
    Song:   ${song.album.name}
    Album:   ${song.artists[0].name}
    `
  }

  transporter.sendMail(messageOptions, (err, info) => {
    if (err) throw err
    else {
      console.log('Email sent: ' + info.response)
    }
  })
}


console.log('RUNNING ON http://0.0.0.0:4000/')
