import express from 'express'
import path from 'path'

const WWW = path.join(__dirname, 'www')

const app = express()
const server = app.listen(3000)
app.use(express.static(WWW))

console.log('RUNNING ON http://127.0.0.1:3000/')
