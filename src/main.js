import express from 'express'
import path from 'path'
import fs from 'fs'
import querystring from 'querystring'
import nodeSchedule from 'node-schedule'
import request from 'request'
import nodemailer from 'nodemailer'
import cheerio from 'cheerio'

const WWW = path.join(__dirname, '../www')
let SPOTIFY_CLIENT_SECRET, SPOTIFY_CLIENT_ID, SPOTIFY_USERNAME, PLAYLIST, GMAIL_USERNAME, EMAIL_RECIPIENT, EMAIL_SUBJECT, GMAIL_ACCESS_TOKEN, GMAIL_REFRESH_TOKEN, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GENIUS_ACCESS_TOKEN
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

  GENIUS_ACCESS_TOKEN = results.geniusAccessToken

  EMAIL_RECIPIENT = results.emailRecipient
  EMAIL_SUBJECT = results.emailSubject
})

let redirectUri
if (process.env.NODE_ENV === 'production') {
  redirectUri = 'http://104.131.40.228:4000/callback'
  console.log('running on http://104.131.40.228:4000')
} else {
  redirectUri = 'http://0.0.0.0:4000/callback'
  console.log('running on http://0.0.0.0:4000')
}

let playedSongs
fs.readFile(path.join(__dirname, '../read_songs.txt'), 'utf8', (err, data) => {
  if (err) throw err
  playedSongs = data.split('\n')
})


const app = express()
app.set('views', WWW)
app.listen(4000, '0.0.0.0')

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
    console.log('Making request to spotify...')

    request.get(options, function(err, res, body) {
      if (err) throw err

      const songs = body.items.map(element => element.track)
      if (process.env.NODE_ENV === 'production') {
        console.log('prod schedule')
        if (!nodeSchedule.scheduleJob({ dayOfWeek: [0, 3, 5], hour: 20, minute: 0 }, () => {
          console.log('job start')
          findSong(songs, playedSongs)
        })) throw new Error('Job creation failure')
      } else {
        console.log('dev schedule')
        let count = 0
        if (!nodeSchedule.scheduleJob({ second: [0, 5, 10] }, () => {
          console.log('job start')
          if (count < 4) {
            findSong(songs, playedSongs)
            count++
          }
        })) throw new Error('Job creation failure')
      }
    })
  })

  res.sendFile('callback.html', { root: WWW })
})

function findSong (songs, playedSongs) {
  const song = songs[Math.floor(Math.random() * songs.length)]
  if (!playedSongs.includes(song.name) && !song.explicit) {
    console.log('good song')
    getLyrics(song, (lyrics) => {
      console.log('lyrics found!')
      fs.appendFile(path.join(__dirname, '../read_songs.txt'), song.name + '\n', (err) => {if (err) throw err})
      playedSongs.push(song.name)
      console.log('sending')
      send(song, lyrics)
    })
  } else {
    console.log('bad song')
    findSong(songs, playedSongs)
  }
}

function getLyrics (song, callback) {
  request.get({
    url: `http://api.genius.com/search?` + querystring.stringify({q: song.name, per_page: 50}),
    headers: { 'Authorization': 'Bearer ' + GENIUS_ACCESS_TOKEN },
    json: true
  }, (err, res, body) => {
    if (err) {
      console.log(err)
      return
    }
    console.log('lyrics json received')

    let found = false
    for (let hit of body.response.hits) {

      let artistName = hit.result.primary_artist.name
      console.log(song.artists[0].name, artistName)
      if (song.artists[0].name.includes(artistName) || artistName.includes(song.artists[0].name)) {
        found = true
        console.log('lyrics song found')
        request.get({url: hit.result.url}, (err, res, body) => {
          if (err) return

          console.log('lyrics page found')

          const $ = cheerio.load(body)
          callback($('.lyrics').text().trim())
        })
        break
      }
    }

    if (!found) {
      callback('[instrumental]')
    }
  })
}

function send (song, lyrics) {
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
    Name:   ${song.artists[0].name}
    Song:   ${song.name}
    Album:   ${song.album.name}
    Lyrics:

    ${lyrics}
    `
  }

  transporter.sendMail(messageOptions, (err, info) => {
    if (err) throw err
    else {
      console.log('Email sent: ' + info.response)
    }
  })
}
