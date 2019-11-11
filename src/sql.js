var mysql = require('mysql')
require('dotenv').config()
import * as Load from './load'

const main = () => {
  var con = mysql.createConnection({
    host: process.env.HOST,
    user: 'root',
    password: process.env.PASSWORD,
  })
  
  con.connect(function(err) {
    if (err) throw err
    console.log('Connected!')
  })

  Load.players(con)
  setTimeout(() => {
    Load.seasonStats(con)
  }, 30000)

  setTimeout(() => {
    console.log('Completed SQL Queries!')
    con.end(err => {
      console.log('Good-bye!')
    })
  }, 60000)
  



}

main()


// con.query('SELECT * FROM JSXR.players', function(error, results, fields) {
//   const values = results
//   console.log(values)
// })

// setTimeout(
//   () =>
//     con.end(function(err) {
//       console.log('Good-bye!')
//     }),
//   30000,
// )
