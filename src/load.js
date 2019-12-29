import { isNullOrUndefined } from 'util'

const fetch = require('node-fetch')
const fs = require('fs')
const math = require('mathjs')
require('dotenv').config()

const ELIGIBLE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

const parseJSON = filename => {
  const rawdata = fs.readFileSync(`files/${filename}`)
  return JSON.parse(rawdata)
}

export const test = async () => {
  console.log('testing')
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve('foo')
    }, 15000)
  })
}

// READ IN PLAYERS
export const players = async con => {
  return new Promise(async (res, rej) => {
    console.log('Writing players to SQL')
    const URL = 'https://api.sleeper.app/v1/players/nfl'

    await getPlayerData(URL, con)
    console.log('all done')
    res('players')
  })
}

const getPlayerData = async (url, con) => {
  let data
  try {
    const response = await fetch(url)
    console.log('Got data')
    const json = await response.json()
    data = json
    console.log('Retrieved JSON')
  } catch (error) {
    console.log('ERROR', error)
  }

  await con.execute(`DELETE FROM JSXR.players;`, [], err => {
    console.log('deleting from players')
    if (err) console.log('Error delete from JSXR.players', err)
  })

  let stuff = new Set()

  Object.keys(data).map(async id => {
    const player = data[id]
    if(player.position === 'DEF'){
    Object.keys(player).map(key => {
      stuff.add(key)
    }) 
    }
    const name = player.full_name ? player.full_name.replace(`'`, `\\'`) : (player.position === 'DEF' ? `${player.first_name} ${player.last_name}` : null)
    const team = player.team || 'FA'
    const position = player.position
    const status = player.status
    const injury_status = player.injury_status
    const active = player.active || false
    const age = player.age || -1
    const years_exp = player.years_exp === null ? -1 : player.years_exp
    const number = player.number || -1
    const height = player.height ? player.height.replace(`'`, `\\'`) : null
    const weight = player.weight || -1
    const depth_chart_position = player.depth_chart_position
    const depth_chart_order = player.depth_chart_order
    const fantasy_data_id =
      player.fantasy_data_id === null ? -1 : player.fantasy_data_id
    const stats_id = player.stats_id === null ? -1 : player.stats_id
    const espn_id = player.espn_id === null ? -1 : player.espn_id
    const injury_start_date =
      player.injury_start_date === undefined ? null : player.injury_start_date
    const search_rank = player.search_rank === null ? -1 : player.search_rank
    const fantasy_positions = player.fantasy_positions || ['unknown']
    if (position !== 'DEF' && active && ELIGIBLE_POSITIONS.includes(position)) {
      fantasy_positions.map(async p => {
        try{
        const query = `INSERT INTO JSXR.players 
      (id, name, team, position, fantasy_position, status, injury_status, active, age, years_exp, number, height, weight, depth_chart_position, depth_chart_order, search_rank, fantasy_data_id, stats_id, espn_id, injury_start_date)
      VALUES ('${id}', '${name}', '${team}', '${position}', '${p}', '${status}', '${injury_status}', ${active}, '${age}', '${years_exp}', '${number}', '${height}', ${weight}, '${depth_chart_position}', ${depth_chart_order}, ${search_rank}, ${fantasy_data_id}, ${stats_id}, ${espn_id}, '${injury_start_date}');`

        await con.execute(query, [], function(error, results, fields) {
          if (error) console.log({ error })
        })
      } catch (err) {
        console.log(err)
      }
      })
    }
    else if (position === 'DEF' && active){
      try{
        const query = `INSERT INTO JSXR.players
        (id, name, team, position, fantasy_position, active)
        VALUES ('${id}', '${name}', '${team}', '${position}', '${position}', ${active});`

        await con.execute(query, [], (err, res, fields) => {
          if (error) console.log({error})
        })
      } catch (err) {
        console.log(err)
      }
    }
  })

  console.log(stuff)
}


// READ IN SEASON STATS
export const seasonStats = async con => {
  return new Promise(async (res, rej) => {
    console.log('Writing season stats to SQL')
    const URL = 'https://api.sleeper.app/v1/stats/nfl/regular/2019'

    await getSeasonData(URL, con)
    console.log('also all done')
    res()
  })
}

const getSeasonData = async (url, con) => {
  let data
  try {
    const response = await fetch(url)
    const json = await response.json()
    data = json
    console.log('Retrieved JSON')
  } catch (error) {
    console.log('ERROR', error)
    data = parseJSON('season.json')
  }

  await con.execute(`DELETE FROM JSXR.season;`, [], (err, res) => {
    console.log('deleting from season')
    if (err) console.log('Error delete from JSXR.season', err)
  })

  const query = `SELECT id, position FROM JSXR.players ORDER BY id ASC;`
  const resp = await con.execute(query, [])

  const fieldsQuery = `DESCRIBE JSXR.season;`
  const fieldsResp = await con.execute(fieldsQuery, [])

  const allFields = fieldsResp[0].map(row => row.Field)

  const ids = resp[0]
  await Promise.all(ids.map(async p => {
    if (data[p.id]) {
      try {
        await con.execute(`INSERT INTO JSXR.season (id) VALUES ('${p.id}')`, [])
      } catch (err) {
        // console.log({err})
      }
      await Promise.all(Object.keys(data[p.id]).map(async key => {
        if (allFields.includes(key)){
          try {
            await con.execute(
              `UPDATE JSXR.season SET \`${key}\` = ? WHERE id = ?`,
              [data[p.id][key], p.id]
            )
          } catch (err) {
            console.log(err)
          }

          //If defense, also put games active
          if(key === 'gp' && p.position === 'DEF') {
            try{
              await con.execute(`UPDATE JSXR.season SET gms_active = ? WHERE id = ?`, [data[p.id][key], p.id])
            }
            catch (err) {
              console.log(err)
            }
          }
        }
      }))
    }
  }))

  console.log('done querying')
}


// READ IN Weekly STATS
export const weeklyStats = async con => {
  return new Promise(async (res, rej) => {
    console.log('Writing weekly stats to SQL')
    const BASE_URL = 'https://api.sleeper.app/v1/stats/nfl/regular/2019/'
    const MAX_WEEKS = 17

    await DoAllWeeks(BASE_URL, con, MAX_WEEKS)

    console.log('also also all done')
    res()
  })
}

const DoAllWeeks = async (url, con, max_weeks) => {
  let i;
  for (i = 1; i <= max_weeks; i++) {
    await getWeeklyData(`${url}${i}`, con, i)
  }
}

const getWeeklyData = async (url, con, week) => {
  let data
  try {
    const response = await fetch(url)
    const json = await response.json()
    data = json
    console.log(`Retrieved JSON for week ${week}`)
  } catch (error) {
    console.log('ERROR', error)
    data = parseJSON('season.json')
  }

  const query = `SELECT id, position FROM JSXR.players ORDER BY id ASC;`
  const resp = await con.execute(query, [])

  const fieldsQuery = `DESCRIBE JSXR.weeks;`
  const fieldsResp = await con.execute(fieldsQuery, [])
  const allFields = fieldsResp[0].map(row => row.Field)

  const ids = resp[0]
  await Promise.all(ids.map(async p => {
    if (data[p.id] && (isNullOrUndefined(data[p.id]['gp']) || data[p.id]['gp'] > 0)) {
      try {
        await con.execute(`INSERT INTO JSXR.weeks (id, week) VALUES ('${p.id}', ${week})`, [])
      } catch (err) {
        // console.log({err})
      }
      await Promise.all(Object.keys(data[p.id]).map(async key => {
        if (allFields.includes(key)){
          try {
            await con.execute(
              `UPDATE JSXR.weeks SET \`${key}\` = ? WHERE id = ? AND week = ?`,
              [data[p.id][key], p.id, week]
            )
          } catch (err) {
            console.log(err)
          }
        }
      }))

      //For defenses
      if(p.position === 'DEF') {
        try {
          await con.execute(`UPDATE JSXR.weeks SET gp = 1, gms_active = 1 WHERE id = ? AND week = ?`, [p.id, week]) 
        } catch (err) {
          console.log({err})
        } 
      }
    }
  }))

  console.log(`done querying week ${week}`)
}

//GET ROSTERS
export const rosters = async con => {
  return new Promise(async (res, rej) => {
    console.log('Putting players into rosters')
    const URL = `https://api.sleeper.app/v1/league/${process.env.LEAGUE_ID}/rosters`

    await getRosterData(URL, con)
    console.log('also all done')
    res()
  })
}

const getRosterData = async (url, con) => {
  let data
  try {
    const response = await fetch(url)
    const json = await response.json()
    data = json
    console.log('Retrieved JSON')
  } catch (error) {
    console.log('ERROR', error)
    data = []
  }

  await Promise.all(data.map(async user => {
    const id = user.owner_id
    const players = user.players
    await Promise.all(players.map(async p => {
      try{
        await con.execute(`UPDATE JSXR.players SET owner_id = '${id}' WHERE id = '${p}';`, [])
      }
      catch (err) {
        console.log(err)
      }
    }))
  }))

  console.log('done querying')
}

export const calculateData = async (con) => {

  await calculateAllDefPPR(con)

  let resp
  const query = `SELECT DISTINCT id FROM JSXR.weeks ORDER BY id ASC;`
  try{
    resp = await con.execute(query, [])
  }
  catch (err) {
    console.log(err)
  }
  const data = resp[0]

  await Promise.all(data.map(async row => {
    await calculateStandardDeviation(con, row.id)
  }))
}

const calculateStandardDeviation = async (con, id) => {
  let query = `SELECT week, pts_ppr FROM JSXR.weeks WHERE id = '${id}' ORDER BY week ASC;`
  let resp = await con.execute(query, [])
  let data = resp[0].map(week => {
    return (week['pts_ppr'])
  })

  const stddev = math.std(data)

  query = `UPDATE JSXR.season SET std_dev = ${stddev} WHERE id = '${id}';`
  resp = await con.execute(query, [])

}

const calculateAllDefPPR = async con => {
  
  let resp
  const query = `SELECT id FROM JSXR.players WHERE position = 'DEF' ORDER BY id ASC;`
  try{
    resp = await con.execute(query, [])
  }
  catch (err){
    console.log(err)
  }
  const data = resp[0]

  await Promise.all(data.map(async row => {
    await calculateDefPPR(con, row.id)
  }))
}

const calculateDefPPR = async (con, id) => {
  const MAX_WEEKS = 17

  let sum = 0
  let i
  for(i = 1; i <= MAX_WEEKS; i++){
    let query = `SELECT pts_allow, ff, fum_rec, \`int\`, sack, def_pr_td, def_st_td, def_td, def_kr_td, safe, def_2pt FROM JSXR.weeks WHERE id = '${id}' AND week = ${i};`
    let resp
    try{
      resp = await con.execute(query, [])
    }
    catch (err) {
      console.log(err)
    }
    const data = resp[0][0]

    if (!data) continue

    const ptsAllowed = data['pts_allow']

    let ptsAllowPts = 0
    if (ptsAllowed === 0){
      ptsAllowPts = 10
    }
    else if (ptsAllowed >= 1 && ptsAllowed <= 6) {
      ptsAllowPts = 7
    }
    else if (ptsAllowed >= 7 && ptsAllowed <= 13 ) {
      ptsAllowPts = 4
    }
    else if (ptsAllowed >= 14 && ptsAllowed <= 20) {
      ptsAllowPts = 1
    }
    else if (ptsAllowed >= 28 && ptsAllowed <= 34) {
      ptsAllowPts = -1
    }
    else if (ptsAllowed >= 35) {
      ptsAllowPts = -4
    }

    let ptsPPR = ptsAllowPts + data.ff + data.fum_rec * 2 + data.int * 2 + data.sack + data.def_pr_td * 6 + data.def_st_td * 6 + data.def_td * 6 + data.def_kr_td * 6 + data.safe * 2 + data.def_2pt * 2
    sum += ptsPPR
    try{
      await con.execute(`UPDATE JSXR.weeks SET pts_ppr = ? WHERE id = ? AND week = ?`, [ptsPPR, id, i])
    }
    catch (err) {
      console.log(err)
    }
  }

  try{
    await con.execute(`UPDATE JSXR.season SET pts_ppr = ? WHERE id = ?`, [sum, id])
  }
  catch (err) {
    console.log(err) 
  }

}