//@ts-ignore
import * as mysql from 'mysql2/promise'
require('dotenv').config()
import * as Load from './load'

const main = async () => {
  const con = await mysql.createConnection({
    host: process.env.HOST,
    user: 'root',
    password: process.env.PASSWORD,
  })

  await Load.players(con)
  await Load.seasonStats(con)
  await Load.weeklyStats(con)
  await Load.rosters(con)

  console.log('trying to close')
  await con.end(err => {
    console.log('Good-bye!')
  })
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
